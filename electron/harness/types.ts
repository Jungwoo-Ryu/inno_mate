import type { InputField, InputSchema } from "./hitl"

export type { InputField, InputSchema }

export interface HarnessConfig {
  id: string
  version: string
  guide: string
  tools: string[]
  model: string
  classifierModel?: string
  delegates?: string[]
  scenarios?: string[]
  /** HITL 필수 입력 스키마 (웹 레지스트리와 동일) */
  inputSchema?: InputSchema
}

export interface AgentRunResult {
  status: "success" | "error" | "needs_input"
  agentId: string
  message_ko: string
  data?: Record<string, unknown>
  /** @deprecated string[] — InputField[] 사용 권장 */
  missingFields?: string[] | InputField[]
  runId?: string
  collectedFields?: Record<string, unknown>
  /** UI용 구조화 누락 필드 */
  missingFieldDefs?: InputField[]
}

export interface IntentClassification {
  agentId: string
  confidence: number
  extractedFields: Record<string, string>
}

export interface LoadedHarness {
  config: HarnessConfig
  guideContent: string
  dirPath: string
}

export interface AttachmentPayload {
  name: string
  mimeType: string
  kind: "text" | "image" | "other"
  content: string
}

export interface ScreenshotPayload {
  path: string
  preview: string
  data: string
  displayId?: number
}

/** HITL pause 후 재개에 필요한 컨텍스트 */
export interface PausedAgentRun {
  runId: string
  agentId: string
  collectedFields: Record<string, unknown>
  missingFieldDefs: InputField[]
  message_ko: string
  screenshots: ScreenshotPayload[]
  userPrompt?: string
  attachments: AttachmentPayload[]
}
