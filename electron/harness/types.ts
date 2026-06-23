export interface HarnessConfig {
  id: string
  version: string
  guide: string
  tools: string[]
  model: string
  classifierModel?: string
  delegates?: string[]
  scenarios?: string[]
}

export interface AgentRunResult {
  status: "success" | "error" | "needs_input"
  agentId: string
  message_ko: string
  data?: Record<string, unknown>
  missingFields?: string[]
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
