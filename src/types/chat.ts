export type FieldType = "string" | "date" | "enum" | "number"

export interface InputField {
  key: string
  label: string
  type: FieldType
  required: boolean
  enumValues?: string[]
}

export interface ChatAttachmentMeta {
  name: string
  mimeType?: string
  size?: number
  kind?: string
}

export interface AgentHitlState {
  runId?: string
  agentId: string
  missingFieldDefs: InputField[]
  collectedFields: Record<string, unknown>
}

export interface DisplayMessage {
  id: string
  role: "user" | "assistant"
  content: string
  status?: "success" | "error" | "needs_input" | "running"
  agentId?: string
  hitl?: AgentHitlState | null
  attachments?: ChatAttachmentMeta[]
}

export interface AgentTaskResult {
  agentId: string
  status: string
  message_ko: string
  data?: Record<string, unknown>
  missingFields?: string[]
  missingFieldDefs?: InputField[]
  collectedFields?: Record<string, unknown>
  runId?: string
}
