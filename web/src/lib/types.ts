export interface ChatSession {
  id: string
  title: string
  agentId: string
  createdAt: string
  updatedAt: string
}

export interface ChatAttachment {
  name: string
  mimeType: string
  size: number
  kind: "text" | "image" | "binary"
  content?: string
}

export interface ChatMessage {
  id: string
  sessionId: string
  role: "user" | "assistant"
  content: string
  attachments: ChatAttachment[]
  createdAt: string
}

export type AgentRuntime = "local" | "databricks"

export interface InputField {
  key: string
  label: string
  type: "string" | "date" | "enum" | "number"
  required: boolean
  enumValues?: string[]
}

export interface InputSchema {
  fields: InputField[]
}

export interface GraphSpec {
  nodes: { id: string; label: string; description?: string }[]
  edges: { from: string; to: string; kind: "always" | "conditional" }[]
}

/** 웹 레지스트리 — Desktop/CLI sync SSOT */
export interface AgentRecord {
  id: string
  name: string
  version: string
  guide: string
  tools: string[]
  delegates: string[]
  model: string
  classifierModel: string
  enabled: boolean
  updatedAt: string
  runtime: AgentRuntime
  templateId?: string
  endpointUrl?: string
  toolName?: string
  toolDescription?: string
  inputSchema?: InputSchema
  graph?: GraphSpec
  description?: string
}

export interface McpServerRecord {
  id: string
  name: string
  url: string
  description: string
  enabled: boolean
  updatedAt: string
}

export interface RunRecord {
  id: string
  sessionId: string
  agentId: string
  status: "running" | "paused" | "completed" | "error"
  missingFields?: InputField[]
  collectedFields?: Record<string, unknown>
  resultJson?: string
  createdAt: string
  updatedAt: string
}
