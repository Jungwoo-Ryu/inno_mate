import fs from "node:fs"
import { OpenAI } from "openai"
import { IProcessingHelperDeps } from "./main"
import { ScreenshotHelper } from "./ScreenshotHelper"
import { configHelper } from "./ConfigHelper"
import { harnessRunner, isAbortError } from "./harness/HarnessRunner"
import { harnessWatcher } from "./harness/HarnessWatcher"
import { loadAttachments } from "./attachments"
import { getOpenAIBaseUrl } from "./envConfig"
import { syncAgentsFromWeb } from "./webRegistry"
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
  private registrySynced = false

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
      this.openaiClient = new OpenAI({
        apiKey: config.apiKey,
        baseURL: getOpenAIBaseUrl()
      })
    } else {
      this.openaiClient = null
    }
    harnessRunner.setClient(this.openaiClient)
  }

  /** 웹 레지스트리에서 에이전트 sync (실패해도 로컬 harness로 계속) */
  private async ensureWebAgentsSynced(): Promise<void> {
    if (this.registrySynced) return
    try {
      const result = await syncAgentsFromWeb()
      if (result.success) {
        console.log(`[AgentOrchestrator] Synced agents: ${result.synced.join(", ")}`)
        this.registrySynced = true
      } else {
        console.warn(`[AgentOrchestrator] Web sync skipped: ${result.error}`)
      }
    } catch (err) {
      console.warn("[AgentOrchestrator] Web sync failed:", err)
    }
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
      await this.ensureWebAgentsSynced()

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
