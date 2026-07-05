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
  /** "text" = 본문 인라인, "image" = data URL, "binary" = 메타데이터만 */
  kind: "text" | "image" | "binary"
  /** text: 파일 내용, image: base64 data URL, binary: 없음 */
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

/** 데스크톱 harness.json과 동일한 스키마 + 웹 관리 필드 */
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
}

export interface McpServerRecord {
  id: string
  name: string
  url: string
  description: string
  enabled: boolean
  updatedAt: string
}
