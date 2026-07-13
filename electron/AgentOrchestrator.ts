import fs from "node:fs"
import { randomUUID } from "node:crypto"
import { OpenAI } from "openai"
import { IProcessingHelperDeps } from "./main"
import { ScreenshotHelper } from "./ScreenshotHelper"
import { configHelper } from "./ConfigHelper"
import { harnessRunner, isAbortError } from "./harness/HarnessRunner"
import { harnessWatcher } from "./harness/HarnessWatcher"
import { loadAttachments } from "./attachments"
import { createLlmClient } from "./llmClient"
import { syncAgentsFromWeb } from "./webRegistry"
import { refreshAllMcpToolCaches, getMcpServers } from "./mcp/McpStore"
import type {
  AgentRunResult,
  AttachmentPayload,
  PausedAgentRun,
  ScreenshotPayload
} from "./harness/types"
import { resolveMissingFieldDefs } from "./harness/hitl"
import { harnessLoader } from "./harness/HarnessLoader"

export class AgentOrchestrator {
  private deps: IProcessingHelperDeps
  private screenshotHelper: ScreenshotHelper
  private openaiClient: OpenAI | null = null
  private currentAbortController: AbortController | null = null
  private pendingUserPrompt: string | undefined
  private pendingAttachmentPaths: string[] = []
  private isProcessing = false
  private registrySynced = false
  private pausedRun: PausedAgentRun | null = null

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

  getPausedRun(): PausedAgentRun | null {
    return this.pausedRun
  }

  private initializeAIClient(): void {
    const config = configHelper.loadConfig()
    const keyPreview = config.apiKey
      ? `${config.apiKey.slice(0, 7)}…(${config.apiKey.length} chars)`
      : "(none)"
    console.log(
      `[AgentOrchestrator] AI client init provider=${config.apiProvider} key=${keyPreview} source=${config.apiKeySource} model=${config.agentModel}` +
        (config.apiProvider === "azure"
          ? ` endpoint=${config.azureEndpoint || "(missing)"} ver=${config.azureApiVersion}`
          : config.openaiBaseUrl
            ? ` baseURL=${config.openaiBaseUrl}`
            : "")
    )

    if (!config.apiKey) {
      this.openaiClient = null
      harnessRunner.setClient(this.openaiClient)
      console.warn("[AgentOrchestrator] No API key — LLM disabled")
      return
    }

    this.openaiClient = createLlmClient({
      apiProvider: config.apiProvider,
      apiKey: config.apiKey,
      openaiBaseUrl: config.openaiBaseUrl,
      azureEndpoint: config.azureEndpoint,
      azureApiVersion: config.azureApiVersion
    })

    if (!this.openaiClient) {
      console.warn(
        `[AgentOrchestrator] Failed to create client for provider=${config.apiProvider}`
      )
    }
    harnessRunner.setClient(this.openaiClient)
  }

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

  /** MCP tools/list 캐시가 비어 있으면 Super용으로 한 번 갱신 */
  private async ensureMcpToolsCached(): Promise<void> {
    const enabled = getMcpServers().filter((s) => s.enabled)
    if (!enabled.length) return
    const missing = enabled.some((s) => !s.cachedTools?.length)
    if (!missing) return
    try {
      const result = await refreshAllMcpToolCaches()
      const total = result.refreshed.reduce((n, r) => n + r.toolCount, 0)
      console.log(
        `[AgentOrchestrator] MCP tool cache refreshed: ${total} tools from ${result.refreshed.length} servers`
      )
    } catch (err) {
      console.warn("[AgentOrchestrator] MCP tool cache refresh failed:", err)
    }
  }

  private collectScreenshotPayloads = async (
    paths: string[]
  ): Promise<ScreenshotPayload[]> =>
    Promise.all(
      paths.map(async (filePath) => ({
        path: filePath,
        preview: await this.screenshotHelper.getImagePreview(filePath),
        data: fs.readFileSync(filePath).toString("base64")
      }))
    )

  public async processScreenshots(): Promise<void> {
    const mainWindow = this.deps.getMainWindow()
    if (!mainWindow) return

    if (this.isProcessing) {
      console.log("[AgentOrchestrator] Already processing, skipping duplicate request")
      return
    }

    if (this.deps.getView() !== "queue") {
      this.deps.setView("queue")
    }

    const mainQueue = this.screenshotHelper.getScreenshotQueue() ?? []
    const extraQueue = this.screenshotHelper.getExtraScreenshotQueue() ?? []
    const screenshotQueue = mainQueue.length > 0 ? mainQueue : extraQueue
    const hasAttachments = this.pendingAttachmentPaths.length > 0
    const hasPrompt = !!this.pendingUserPrompt?.trim()
    if (!screenshotQueue.length && !hasAttachments && !hasPrompt) {
      console.log("[AgentOrchestrator] No screenshots/prompt/attachments to run")
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS)
      return
    }

    const existingScreenshots = screenshotQueue.filter((p) => fs.existsSync(p))
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
    const userPrompt = this.pendingUserPrompt
    const attachmentPaths = [...this.pendingAttachmentPaths]
    this.pendingUserPrompt = undefined
    this.pendingAttachmentPaths = []

    mainWindow.webContents.send("agent-user-turn", {
      content: userPrompt?.trim() || undefined,
      screenshotCount: existingScreenshots.length,
      attachmentCount: attachmentPaths.length
    })
    mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.INITIAL_START)

    try {
      await this.ensureWebAgentsSynced()
      await this.ensureMcpToolsCached()

      this.currentAbortController = new AbortController()
      const { signal } = this.currentAbortController

      const screenshots = await this.collectScreenshotPayloads(existingScreenshots)
      if (signal.aborted) return

      const attachments = loadAttachments(attachmentPaths)

      const result = await harnessRunner.runFromScreenshots(
        screenshots,
        userPrompt,
        attachments,
        signal
      )

      if (signal.aborted) return

      this.handleResult(result, {
        screenshots,
        userPrompt,
        attachments
      })
    } catch (error: unknown) {
      if (isAbortError(error)) {
        console.log("[AgentOrchestrator] Agent run cancelled")
        return
      }
      const message = error instanceof Error ? error.message : String(error)
      console.error("[AgentOrchestrator] Agent run failed:", message)
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

  /** HITL: 누락 필드 입력 후 워크플로 재개 */
  public async resumePausedRun(
    fields: Record<string, string>
  ): Promise<{ success: boolean; error?: string }> {
    const mainWindow = this.deps.getMainWindow()
    if (!this.pausedRun) {
      return { success: false, error: "재개할 paused run이 없습니다" }
    }
    if (this.isProcessing) {
      return { success: false, error: "이미 실행 중입니다" }
    }
    if (!this.openaiClient) {
      this.initializeAIClient()
      if (!this.openaiClient) {
        return { success: false, error: "API 키가 필요합니다" }
      }
    }

    const paused = this.pausedRun
    this.isProcessing = true
    mainWindow?.webContents.send("agent-user-turn", {
      content: Object.entries(fields)
        .filter(([, v]) => v.trim())
        .map(([k, v]) => `${k}: ${v}`)
        .join(", "),
      hitlResume: true
    })
    mainWindow?.webContents.send(this.deps.PROCESSING_EVENTS.INITIAL_START)

    try {
      this.currentAbortController = new AbortController()
      const { signal } = this.currentAbortController

      const result = await harnessRunner.resumeWithFields(
        paused.agentId,
        paused.collectedFields,
        fields,
        paused.screenshots,
        paused.userPrompt,
        paused.attachments,
        signal
      )

      if (signal.aborted) return { success: true }

      this.handleResult(result, {
        screenshots: paused.screenshots,
        userPrompt: paused.userPrompt,
        attachments: paused.attachments
      })
      return { success: true }
    } catch (error: unknown) {
      if (isAbortError(error)) return { success: true }
      const message = error instanceof Error ? error.message : String(error)
      console.error("[AgentOrchestrator] Resume failed:", message)
      mainWindow?.webContents.send(
        this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
        message
      )
      return { success: false, error: message }
    } finally {
      this.currentAbortController = null
      this.isProcessing = false
    }
  }

  private handleResult(
    result: AgentRunResult,
    ctx: {
      screenshots: ScreenshotPayload[]
      userPrompt?: string
      attachments: AttachmentPayload[]
    }
  ): void {
    const mainWindow = this.deps.getMainWindow()
    if (!mainWindow) return

    if (result.status === "error") {
      this.pausedRun = null
      mainWindow.webContents.send(
        this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
        result.message_ko
      )
      this.deps.setView("queue")
      return
    }

    const harness = harnessLoader.loadHarness(result.agentId)
    const missingFieldDefs = resolveMissingFieldDefs(
      harness?.config.inputSchema,
      result.missingFieldDefs ?? result.missingFields
    )

    if (result.status === "needs_input") {
      const runId = result.runId ?? randomUUID()
      this.pausedRun = {
        runId,
        agentId: result.agentId,
        collectedFields: result.collectedFields ?? {},
        missingFieldDefs,
        message_ko: result.message_ko,
        screenshots: ctx.screenshots,
        userPrompt: ctx.userPrompt,
        attachments: ctx.attachments
      }
    } else {
      this.pausedRun = null
    }

    const taskData = {
      agentId: result.agentId,
      status: result.status,
      message_ko: result.message_ko,
      data: result.data ?? {},
      missingFields: missingFieldDefs.map((f) => f.key),
      missingFieldDefs,
      collectedFields: result.collectedFields ?? {},
      runId: result.runId ?? this.pausedRun?.runId
    }

    // 채팅 로그 UI는 queue에 유지 (결과 전용 화면으로 떠나지 않음)
    mainWindow.webContents.send(
      this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
      taskData
    )
    this.deps.setView("queue")
  }

  public cancelOngoingRequests(): void {
    console.log("[AgentOrchestrator] Cancelling ongoing agent run")
    this.currentAbortController?.abort()
    this.currentAbortController = null
    this.isProcessing = false
    this.pendingUserPrompt = undefined
    this.pendingAttachmentPaths = []
    this.pausedRun = null
  }
}
