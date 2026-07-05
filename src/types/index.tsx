export interface Screenshot {
  id: string
  path: string
  timestamp: number
  thumbnail: string
}

export interface AgentTaskResult {
  agentId: string
  status: string
  message_ko: string
  data?: Record<string, unknown>
  missingFields?: string[]
}
