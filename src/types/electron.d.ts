import type { AgentSummary, AttachmentFile, McpServerConfig } from "./agents"

export interface ElectronAPI {
  updateContentDimensions: (dimensions: {
    width: number
    height: number
  }) => Promise<void>
  setWindowLayoutMode: (
    mode: "compact" | "settings",
    dimensions?: { width: number; height: number }
  ) => Promise<{ success: boolean; mode: "compact" | "settings" }>
  getWindowLayoutMode: () => Promise<"compact" | "settings">
  clearStore: () => Promise<{ success: boolean; error?: string }>
  getScreenshots: () => Promise<Array<{ path: string; preview: string }>>
  deleteScreenshot: (
    path: string
  ) => Promise<{ success: boolean; error?: string }>
  onScreenshotTaken: (
    callback: (data: { path: string; preview: string }) => void
  ) => () => void
  onResetView: (callback: () => void) => () => void
  onAgentRunStart: (callback: () => void) => () => void
  onAgentRunError: (callback: (error: string) => void) => () => void
  onProcessingNoScreenshots: (callback: () => void) => () => void
  onAgentRunSuccess: (callback: (data: unknown) => void) => () => void
  openExternal: (url: string) => void
  toggleMainWindow: () => Promise<{ success: boolean; error?: string }>
  triggerScreenshot: () => Promise<{ success: boolean; error?: string }>
  setUserPrompt: (prompt?: string) => Promise<{ success: boolean }>
  setAttachments: (paths: string[]) => Promise<{ success: boolean }>
  pickAttachmentFiles: () => Promise<{ success: boolean; files: AttachmentFile[] }>
  listAgents: () => Promise<AgentSummary[]>
  reloadAgent: (agentId: string) => Promise<{ success: boolean }>
  openAgentsDirectory: () => Promise<{ success: boolean }>
  syncWebAgents: () => Promise<{ success: boolean; synced: string[]; error?: string }>
  openWebPortal: () => Promise<{ success: boolean }>
  getMcpServers: () => Promise<McpServerConfig[]>
  saveMcpServers: (servers: McpServerConfig[]) => Promise<McpServerConfig[]>
  testMcpConnection: (server: McpServerConfig) => Promise<{ ok: boolean; error?: string }>
  triggerProcessScreenshots: (prompt?: string) => Promise<{ success: boolean; error?: string }>
  triggerReset: () => Promise<{ success: boolean; error?: string }>
  triggerMoveLeft: () => Promise<{ success: boolean; error?: string }>
  triggerMoveRight: () => Promise<{ success: boolean; error?: string }>
  triggerMoveUp: () => Promise<{ success: boolean; error?: string }>
  triggerMoveDown: () => Promise<{ success: boolean; error?: string }>
  startUpdate: () => Promise<{ success: boolean; error?: string }>
  installUpdate: () => void
  onUpdateAvailable: (callback: (info: unknown) => void) => () => void
  onUpdateDownloaded: (callback: (info: unknown) => void) => () => void
  getPlatform: () => string
  getConfig: () => Promise<Record<string, unknown>>
  updateConfig: (config: Record<string, unknown>) => Promise<boolean>
  checkApiKey: () => Promise<boolean>
  validateApiKey: (apiKey: string) => Promise<{ valid: boolean; error?: string }>
  openLink: (url: string) => void
  onApiKeyInvalid: (callback: () => void) => () => void
  removeListener: (eventName: string, callback: (...args: unknown[]) => void) => void
  onDeleteLastScreenshot: (callback: () => void) => () => void
  deleteLastScreenshot: () => Promise<unknown>
  onShowSettings: (callback: () => void) => () => void
  openSettingsPortal: () => Promise<{ success: boolean; error?: string }>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
    __IS_INITIALIZED__: boolean
  }
}

export {}
