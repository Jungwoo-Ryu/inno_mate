import fs from "node:fs"
import { OpenAI } from "openai"
import { IProcessingHelperDeps } from "./main"
import { ScreenshotHelper } from "./ScreenshotHelper"
import { configHelper } from "./ConfigHelper"
import { harnessRunner } from "./harness/HarnessRunner"
import { harnessWatcher } from "./harness/HarnessWatcher"
import { loadAttachments } from "./attachments"
import type { AgentRunResult } from "./harness/types"

export class AgentOrchestrator {
  private deps: IProcessingHelperDeps
  private screenshotHelper: ScreenshotHelper
  private openaiClient: OpenAI | null = null
  private currentAbortController: AbortController | null = null
  private pendingUserPrompt: string | undefined
  private pendingAttachmentPaths: string[] = []

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
    if (config.apiProvider === "openai" && config.apiKey) {
      this.openaiClient = new OpenAI({ apiKey: config.apiKey })
    } else {
      this.openaiClient = null
    }
    harnessRunner.setClient(this.openaiClient)
  }

  public async processScreenshots(): Promise<void> {
    const mainWindow = this.deps.getMainWindow()
    if (!mainWindow) return

    const config = configHelper.loadConfig()

    if (config.apiProvider !== "openai" || !this.openaiClient) {
      if (config.apiKey?.startsWith("sk-") && !config.apiKey.startsWith("sk-ant-")) {
        this.initializeAIClient()
      }
      if (!this.openaiClient) {
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.API_KEY_INVALID)
        return
      }
    }

    const view = this.deps.getView()
    if (view !== "queue") {
      return
    }

    mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.INITIAL_START)

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

    try {
      this.currentAbortController = new AbortController()

      const screenshots = await Promise.all(
        existingScreenshots.map(async (filePath) => ({
          path: filePath,
          preview: await this.screenshotHelper.getImagePreview(filePath),
          data: fs.readFileSync(filePath).toString("base64")
        }))
      )

      const userPrompt = this.pendingUserPrompt
      const attachmentPaths = [...this.pendingAttachmentPaths]
      this.pendingUserPrompt = undefined
      this.pendingAttachmentPaths = []

      const attachments = loadAttachments(attachmentPaths)

      const result = await harnessRunner.runFromScreenshots(
        screenshots,
        userPrompt,
        attachments
      )

      if (this.currentAbortController.signal.aborted) return

      this.handleResult(result)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      mainWindow.webContents.send(
        this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
        message
      )
      this.deps.setView("queue")
    } finally {
      this.currentAbortController = null
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

  public cancelProcessing(): void {
    this.currentAbortController?.abort()
    this.currentAbortController = null
  }

  public cancelOngoingRequests(): void {
    this.cancelProcessing()
  }
}
