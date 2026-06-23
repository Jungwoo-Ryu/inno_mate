export interface AttachmentFile {
  path: string
  name: string
  size: number
  mimeType: string
  kind: "text" | "image" | "other"
  preview?: string
}

export interface AgentSummary {
  id: string
  version: string
  model: string
  tools: string[]
  delegates: string[]
}

export interface McpServerConfig {
  id: string
  name: string
  url: string
  enabled: boolean
  lastStatus: "connected" | "disconnected" | "error"
  lastError?: string
}

export const AGENT_LABELS: Record<string, string> = {
  super: "Super Agent",
  "meeting-room": "회의실 예약",
  "asset-export": "자산 반출",
  vacation: "휴가 신청"
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}
