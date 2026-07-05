console.log("Preload script starting...")
import { contextBridge, ipcRenderer } from "electron"
const { shell } = require("electron")

export const PROCESSING_EVENTS = {
  UNAUTHORIZED: "procesing-unauthorized",
  NO_SCREENSHOTS: "processing-no-screenshots",
  API_KEY_INVALID: "api-key-invalid",
  AGENT_RUN_START: "initial-start",
  AGENT_RUN_SUCCESS: "solution-success",
  AGENT_RUN_ERROR: "solution-error",
  RESET: "reset"
} as const

const electronAPI = {
  updateContentDimensions: (dimensions: { width: number; height: number }) =>
    ipcRenderer.invoke("update-content-dimensions", dimensions),
  setWindowLayoutMode: (
    mode: "compact" | "settings",
    dimensions?: { width: number; height: number }
  ) => ipcRenderer.invoke("set-window-layout-mode", mode, dimensions),
  getWindowLayoutMode: () => ipcRenderer.invoke("get-window-layout-mode"),
  clearStore: () => ipcRenderer.invoke("clear-store"),
  getScreenshots: () => ipcRenderer.invoke("get-screenshots"),
  deleteScreenshot: (path: string) =>
    ipcRenderer.invoke("delete-screenshot", path),
  toggleMainWindow: async () => ipcRenderer.invoke("toggle-window"),
  onScreenshotTaken: (
    callback: (data: { path: string; preview: string }) => void
  ) => {
    const subscription = (_: unknown, data: { path: string; preview: string }) =>
      callback(data)
    ipcRenderer.on("screenshot-taken", subscription)
    return () => ipcRenderer.removeListener("screenshot-taken", subscription)
  },
  onResetView: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on("reset-view", subscription)
    return () => ipcRenderer.removeListener("reset-view", subscription)
  },
  onAgentRunStart: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on(PROCESSING_EVENTS.AGENT_RUN_START, subscription)
    return () =>
      ipcRenderer.removeListener(PROCESSING_EVENTS.AGENT_RUN_START, subscription)
  },
  onAgentRunError: (callback: (error: string) => void) => {
    const subscription = (_: unknown, error: string) => callback(error)
    ipcRenderer.on(PROCESSING_EVENTS.AGENT_RUN_ERROR, subscription)
    return () =>
      ipcRenderer.removeListener(PROCESSING_EVENTS.AGENT_RUN_ERROR, subscription)
  },
  onProcessingNoScreenshots: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on(PROCESSING_EVENTS.NO_SCREENSHOTS, subscription)
    return () =>
      ipcRenderer.removeListener(PROCESSING_EVENTS.NO_SCREENSHOTS, subscription)
  },
  onAgentRunSuccess: (callback: (data: unknown) => void) => {
    const subscription = (_: unknown, data: unknown) => callback(data)
    ipcRenderer.on(PROCESSING_EVENTS.AGENT_RUN_SUCCESS, subscription)
    return () =>
      ipcRenderer.removeListener(PROCESSING_EVENTS.AGENT_RUN_SUCCESS, subscription)
  },
  openLink: (url: string) => shell.openExternal(url),
  triggerScreenshot: () => ipcRenderer.invoke("trigger-screenshot"),
  setUserPrompt: (prompt?: string) =>
    ipcRenderer.invoke("set-user-prompt", prompt),
  setAttachments: (paths: string[]) =>
    ipcRenderer.invoke("set-attachments", paths),
  pickAttachmentFiles: () => ipcRenderer.invoke("pick-attachment-files"),
  listAgents: () => ipcRenderer.invoke("list-agents"),
  reloadAgent: (agentId: string) => ipcRenderer.invoke("reload-agent", agentId),
  openAgentsDirectory: () => ipcRenderer.invoke("open-agents-directory"),
  syncWebAgents: () => ipcRenderer.invoke("sync-web-agents"),
  openWebPortal: () => ipcRenderer.invoke("open-web-portal"),
  getMcpServers: () => ipcRenderer.invoke("get-mcp-servers"),
  saveMcpServers: (servers: unknown[]) =>
    ipcRenderer.invoke("save-mcp-servers", servers),
  testMcpConnection: (server: unknown) =>
    ipcRenderer.invoke("test-mcp-connection", server),
  triggerProcessScreenshots: (prompt?: string) =>
    ipcRenderer.invoke("trigger-process-screenshots", prompt),
  triggerReset: () => ipcRenderer.invoke("trigger-reset"),
  triggerMoveLeft: () => ipcRenderer.invoke("trigger-move-left"),
  triggerMoveRight: () => ipcRenderer.invoke("trigger-move-right"),
  triggerMoveUp: () => ipcRenderer.invoke("trigger-move-up"),
  triggerMoveDown: () => ipcRenderer.invoke("trigger-move-down"),
  startUpdate: () => ipcRenderer.invoke("start-update"),
  installUpdate: () => ipcRenderer.invoke("install-update"),
  onUpdateAvailable: (callback: (info: unknown) => void) => {
    const subscription = (_: unknown, info: unknown) => callback(info)
    ipcRenderer.on("update-available", subscription)
    return () => ipcRenderer.removeListener("update-available", subscription)
  },
  onUpdateDownloaded: (callback: (info: unknown) => void) => {
    const subscription = (_: unknown, info: unknown) => callback(info)
    ipcRenderer.on("update-downloaded", subscription)
    return () => ipcRenderer.removeListener("update-downloaded", subscription)
  },
  getPlatform: () => process.platform,
  getConfig: () => ipcRenderer.invoke("get-config"),
  updateConfig: (config: Record<string, unknown>) =>
    ipcRenderer.invoke("update-config", config),
  onShowSettings: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on("show-settings-dialog", subscription)
    return () => ipcRenderer.removeListener("show-settings-dialog", subscription)
  },
  checkApiKey: () => ipcRenderer.invoke("check-api-key"),
  validateApiKey: (apiKey: string) =>
    ipcRenderer.invoke("validate-api-key", apiKey),
  openExternal: (url: string) => ipcRenderer.invoke("openExternal", url),
  onApiKeyInvalid: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on(PROCESSING_EVENTS.API_KEY_INVALID, subscription)
    return () =>
      ipcRenderer.removeListener(PROCESSING_EVENTS.API_KEY_INVALID, subscription)
  },
  removeListener: (eventName: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(eventName, callback)
  },
  onDeleteLastScreenshot: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on("delete-last-screenshot", subscription)
    return () =>
      ipcRenderer.removeListener("delete-last-screenshot", subscription)
  },
  deleteLastScreenshot: () => ipcRenderer.invoke("delete-last-screenshot")
}

contextBridge.exposeInMainWorld("electronAPI", electronAPI)

ipcRenderer.on("restore-focus", () => {
  const activeElement = document.activeElement as HTMLElement
  if (activeElement && typeof activeElement.focus === "function") {
    activeElement.focus()
  }
})
