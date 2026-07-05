import fs from "node:fs"
import { OpenAI } from "openai"
import { IProcessingHelperDeps } from "./main"
import { ScreenshotHelper } from "./ScreenshotHelper"
import { configHelper } from "./ConfigHelper"
import { harnessRunner, isAbortError } from "./harness/HarnessRunner"
import { harnessWatcher } from "./harness/HarnessWatcher"
import { loadAttachments } from "./attachments"
import { extractTextFromScreenshotPaths } from "./ocr/LocalOcr"
import { isPocOcrMode } from "./pocMode"
import { getOpenAIBaseUrl } from "./envConfig"
import type { AgentRunResult } from "./harness/types"

const GEMINI_OPENAI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/"

export class AgentOrchestrator {
  private deps: IProcessingHelperDeps
  private screenshotHelper: ScreenshotHelper
  private openaiClient: OpenAI | null = null
  private currentAbortController: AbortController | null = null
  private pendingUserPrompt: string | undefined
  private pendingAttachmentPaths: string[] = []
  private isProcessing = false

  constructor(deps: IProcessingHelperDeps) {
    this.deps = deps
    this.screenshotHelper = deps.getScreenshotHelper()!

    this.initializeAIClient()
    configHelper.on("config-updated", () => this.initializeAIClient())

    harnessWatcher.start((agentId) => {
      console.log(`[Harness] Reloaded agent: ${agentId}`)
      harnessRunner.setClient(this.openaiClient)
    })
  }

  setUserPrompt(prompt: string | undefined): void {
    this.pendingUserPrompt = prompt
  }

  setAttachments(paths: string[]): void {
    this.pendingAttachmentPaths = paths
  }

  private initializeAIClient(): void {
    const config = configHelper.loadConfig()
    if (!config.apiKey) {
      this.openaiClient = null
      harnessRunner.setClient(this.openaiClient)
      return
    }

    if (config.apiProvider === "gemini") {
      this.openaiClient = new OpenAI({
        apiKey: config.apiKey,
        baseURL: GEMINI_OPENAI_BASE_URL
      })
    } else if (config.apiProvider === "openai") {
      // 사내 게이트웨이 URL(.env OPENAI_BASE_URL)이 있으면 그쪽으로 전송
      this.openaiClient = new OpenAI({
        apiKey: config.apiKey,
        baseURL: getOpenAIBaseUrl()
      })
    } else {
      this.openaiClient = null
    }
    harnessRunner.setClient(this.openaiClient)
  }

  public async processScreenshots(): Promise<void> {
    const mainWindow = this.deps.getMainWindow()
    if (!mainWindow) return

    if (this.isProcessing) {
      console.log("[AgentOrchestrator] Already processing, skipping duplicate request")
      return
    }

    const view = this.deps.getView()
    if (view !== "queue") {
      return
    }

    const screenshotQueue = this.screenshotHelper.getScreenshotQueue()
    const hasAttachments = this.pendingAttachmentPaths.length > 0
    const hasPrompt = !!this.pendingUserPrompt?.trim()
    if (!screenshotQueue?.length && !hasAttachments && !hasPrompt) {
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS)
      return
    }

    const existingScreenshots = (screenshotQueue ?? []).filter((p) => fs.existsSync(p))
    if (!existingScreenshots.length && !hasAttachments && !hasPrompt) {
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS)
      return
    }

    // PoC: 스크린샷이 있으면 로컬 OCR만 실행 (LLM 미사용)
    if (isPocOcrMode() && existingScreenshots.length > 0) {
      await this.processWithLocalOcr(existingScreenshots)
      return
    }

    if (!this.openaiClient) {
      this.initializeAIClient()
      if (!this.openaiClient) {
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.API_KEY_INVALID)
        return
      }
    }

    this.isProcessing = true
    mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.INITIAL_START)

    try {
      this.currentAbortController = new AbortController()
      const { signal } = this.currentAbortController

      const screenshots = await Promise.all(
        existingScreenshots.map(async (filePath) => ({
          path: filePath,
          preview: await this.screenshotHelper.getImagePreview(filePath),
          data: fs.readFileSync(filePath).toString("base64")
        }))
      )

      if (signal.aborted) return

      const userPrompt = this.pendingUserPrompt
      const attachmentPaths = [...this.pendingAttachmentPaths]
      this.pendingUserPrompt = undefined
      this.pendingAttachmentPaths = []

      const attachments = loadAttachments(attachmentPaths)

      const result = await harnessRunner.runFromScreenshots(
        screenshots,
        userPrompt,
        attachments,
        signal
      )

      if (signal.aborted) return

      this.handleResult(result)
    } catch (error: unknown) {
      if (isAbortError(error)) {
        console.log("[AgentOrchestrator] Agent run cancelled")
        return
      }
      const message = error instanceof Error ? error.message : String(error)
      mainWindow.webContents.send(
        this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
        message
      )
      this.deps.setView("queue")
    } finally {
      this.currentAbortController = null
      this.isProcessing = false
    }
  }

  /**
   * PoC OCR 파이프라인:
   * 1) 스크린샷에서 로컬 OCR로 텍스트 추출 (이미지는 외부로 전송하지 않음)
   * 2) OCR 텍스트를 프롬프트로 만들어 사내 OpenAI API(Super Agent)에 전송
   * 3) Super Agent가 적합한 서브 에이전트로 할당해 실행
   * API 키가 없으면 OCR 텍스트만 표시 (폴백)
   */
  private async processWithLocalOcr(screenshotPaths: string[]): Promise<void> {
    const mainWindow = this.deps.getMainWindow()
    if (!mainWindow) return

    this.isProcessing = true
    const userPrompt = this.pendingUserPrompt
    this.pendingUserPrompt = undefined
    this.pendingAttachmentPaths = []
    mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.INITIAL_START)

    try {
      console.log("[AgentOrchestrator] PoC local OCR mode")
      const ocrText = await extractTextFromScreenshotPaths(screenshotPaths)

      if (!this.openaiClient) {
        this.initializeAIClient()
      }

      // 폴백: API 키가 없으면 OCR 텍스트만 표시
      if (!this.openaiClient) {
        console.log("[AgentOrchestrator] No API key — showing OCR text only")
        this.handleResult({
          status: "success",
          agentId: "local-ocr",
          message_ko: ocrText,
          data: { mode: "poc-ocr", screenshotCount: screenshotPaths.length }
        })
        return
      }

      // Super Agent 라우팅: OCR 텍스트 → 사내 OpenAI API → 서브 에이전트 실행
      console.log("[AgentOrchestrator] Routing OCR text via Super Agent")
      this.currentAbortController = new AbortController()
      const { signal } = this.currentAbortController

      const result = await harnessRunner.runFromOcrText(ocrText, userPrompt, signal)

      if (signal.aborted) return
      this.handleResult(result)
    } catch (error: unknown) {
      if (isAbortError(error)) {
        console.log("[AgentOrchestrator] OCR agent run cancelled")
        return
      }
      const message =
        error instanceof Error ? error.message : "OCR 처리 중 오류가 발생했습니다"
      mainWindow.webContents.send(
        this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
        message
      )
      this.deps.setView("queue")
    } finally {
      this.currentAbortController = null
      this.isProcessing = false
    }
  }

  private handleResult(result: AgentRunResult): void {
    const mainWindow = this.deps.getMainWindow()
    if (!mainWindow) return

    if (result.status === "error") {
      mainWindow.webContents.send(
        this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
        result.message_ko
      )
      this.deps.setView("queue")
      return
    }

    const taskData = {
      agentId: result.agentId,
      status: result.status,
      message_ko: result.message_ko,
      data: result.data ?? {},
      missingFields: result.missingFields ?? []
    }

    mainWindow.webContents.send(
      this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
      taskData
    )
    this.deps.setView("solutions")
  }

  public cancelOngoingRequests(): void {
    console.log("[AgentOrchestrator] Cancelling ongoing agent run")
    this.currentAbortController?.abort()
    this.currentAbortController = null
    this.isProcessing = false
    this.pendingUserPrompt = undefined
    this.pendingAttachmentPaths = []
  }
}
