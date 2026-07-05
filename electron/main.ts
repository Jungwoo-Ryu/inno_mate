import { app, BrowserWindow, screen, shell, ipcMain } from "electron"
import path from "path"
import fs from "fs"
import { initializeIpcHandlers } from "./ipcHandlers"
import { AgentOrchestrator } from "./AgentOrchestrator"
import { ScreenshotHelper } from "./ScreenshotHelper"
import { ShortcutsHelper } from "./shortcuts"
import { initAutoUpdater } from "./autoUpdater"
import { configHelper } from "./ConfigHelper"
import { harnessLoader } from "./harness/HarnessLoader"
import { loadEnvVariables } from "./envFileStore"

// Constants
const isDev = process.env.NODE_ENV === "development"

// InnoMate: 최소 창 크기 (콘텐츠 기반 리사이즈 시 너무 작아지지 않도록)
const MIN_WINDOW_WIDTH = 400
const MIN_WINDOW_HEIGHT = 280
const DEFAULT_WINDOW_WIDTH = 480
const DEFAULT_WINDOW_HEIGHT = 320
const SETTINGS_MIN_WIDTH = 480
const SETTINGS_MIN_HEIGHT = 680

// Application State
const state = {
  mainWindow: null as BrowserWindow | null,
  isWindowVisible: false,
  windowPosition: null as { x: number; y: number } | null,
  windowSize: null as { width: number; height: number } | null,
  screenWidth: 0,
  screenHeight: 0,
  step: 0,
  currentX: 0,
  currentY: 0,
  windowLayoutMode: "compact" as "compact" | "settings",
  compactWindowSize: null as { width: number; height: number } | null,
  wasVisibleBeforeScreenshot: true,

  // Application helpers
  screenshotHelper: null as ScreenshotHelper | null,
  shortcutsHelper: null as ShortcutsHelper | null,
  processingHelper: null as AgentOrchestrator | null,

  // View and state management
  view: "queue" as "queue" | "solutions" | "debug",
  problemInfo: null as any,
  hasDebugged: false,

  // Processing events
  PROCESSING_EVENTS: {
    UNAUTHORIZED: "processing-unauthorized",
    NO_SCREENSHOTS: "processing-no-screenshots",
    OUT_OF_CREDITS: "out-of-credits",
    API_KEY_INVALID: "api-key-invalid",
    INITIAL_START: "initial-start",
    PROBLEM_EXTRACTED: "problem-extracted",
    SOLUTION_SUCCESS: "solution-success",
    INITIAL_SOLUTION_ERROR: "solution-error",
    DEBUG_START: "debug-start",
    DEBUG_SUCCESS: "debug-success",
    DEBUG_ERROR: "debug-error"
  } as const
}

// Add interfaces for helper classes
export interface IProcessingHelperDeps {
  getScreenshotHelper: () => ScreenshotHelper | null
  getMainWindow: () => BrowserWindow | null
  getView: () => "queue" | "solutions" | "debug"
  setView: (view: "queue" | "solutions" | "debug") => void
  getProblemInfo: () => any
  setProblemInfo: (info: any) => void
  getScreenshotQueue: () => string[]
  getExtraScreenshotQueue: () => string[]
  clearQueues: () => void
  takeScreenshot: () => Promise<string[]>
  getImagePreview: (filepath: string) => Promise<string>
  deleteScreenshot: (
    path: string
  ) => Promise<{ success: boolean; error?: string }>
  setHasDebugged: (value: boolean) => void
  getHasDebugged: () => boolean
  PROCESSING_EVENTS: typeof state.PROCESSING_EVENTS
}

export interface IShortcutsHelperDeps {
  getMainWindow: () => BrowserWindow | null
  takeScreenshot: () => Promise<string[]>
  getImagePreview: (filepath: string) => Promise<string>
  processingHelper: AgentOrchestrator | null
  clearQueues: () => void
  setView: (view: "queue" | "solutions" | "debug") => void
  isVisible: () => boolean
  toggleMainWindow: () => void
  moveWindowLeft: () => void
  moveWindowRight: () => void
  moveWindowUp: () => void
  moveWindowDown: () => void
  moveWindowToNextDisplay: () => void
}

export interface IIpcHandlerDeps {
  getMainWindow: () => BrowserWindow | null
  setWindowDimensions: (width: number, height: number) => void
  setWindowLayoutMode: (
    mode: "compact" | "settings",
    dimensions?: { width: number; height: number }
  ) => void
  getWindowLayoutMode: () => "compact" | "settings"
  getScreenshotQueue: () => string[]
  getExtraScreenshotQueue: () => string[]
  deleteScreenshot: (
    path: string
  ) => Promise<{ success: boolean; error?: string }>
  getImagePreview: (filepath: string) => Promise<string>
  processingHelper: AgentOrchestrator | null
  PROCESSING_EVENTS: typeof state.PROCESSING_EVENTS
  takeScreenshot: () => Promise<string[]>
  getView: () => "queue" | "solutions" | "debug"
  toggleMainWindow: () => void
  clearQueues: () => void
  setView: (view: "queue" | "solutions" | "debug") => void
  moveWindowLeft: () => void
  moveWindowRight: () => void
  moveWindowUp: () => void
  moveWindowDown: () => void
}

// Initialize helpers
function initializeHelpers() {
  state.screenshotHelper = new ScreenshotHelper(state.view)
  state.processingHelper = new AgentOrchestrator({
    getScreenshotHelper,
    getMainWindow,
    getView,
    setView,
    getProblemInfo,
    setProblemInfo,
    getScreenshotQueue,
    getExtraScreenshotQueue,
    clearQueues,
    takeScreenshot,
    getImagePreview,
    deleteScreenshot,
    setHasDebugged,
    getHasDebugged,
    PROCESSING_EVENTS: state.PROCESSING_EVENTS
  } as IProcessingHelperDeps)
  state.shortcutsHelper = new ShortcutsHelper({
    getMainWindow,
    takeScreenshot,
    getImagePreview,
    processingHelper: state.processingHelper,
    clearQueues,
    setView,
    isVisible: () => state.isWindowVisible,
    toggleMainWindow,
    moveWindowLeft: () =>
      moveWindowHorizontal((x) => Math.max(0, x - state.step)),
    moveWindowRight: () =>
      moveWindowHorizontal((x) => {
        const w = state.windowSize?.width ?? DEFAULT_WINDOW_WIDTH
        return Math.min(state.screenWidth - w, x + state.step)
      }),
    moveWindowUp: () => moveWindowVertical((y) => y - state.step),
    moveWindowDown: () => moveWindowVertical((y) => y + state.step),
    moveWindowToNextDisplay
  } as IShortcutsHelperDeps)
}

// Auth callback handler

// Register the innomate protocol
if (process.platform === "darwin") {
  app.setAsDefaultProtocolClient("innomate")
} else {
  app.setAsDefaultProtocolClient("innomate", process.execPath, [
    path.resolve(process.argv[1] || "")
  ])
}

// Handle the protocol
if (process.defaultApp && process.argv.length >= 2) {
  app.setAsDefaultProtocolClient("innomate", process.execPath, [
    path.resolve(process.argv[1])
  ])
}

// Force Single Instance Lock (disabled in development for easier reloading)
const gotTheLock = isDev || app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on("second-instance", (event, commandLine) => {
    if (state.mainWindow) {
      if (state.mainWindow.isMinimized()) state.mainWindow.restore()
      state.mainWindow.focus()
    }
  })

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit()
      state.mainWindow = null
    }
  })
}

// Auth callback removed as we no longer use Supabase authentication

// Window management functions

function getVirtualWorkAreaBounds() {
  const displays = screen.getAllDisplays()
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const display of displays) {
    const area = display.workArea
    minX = Math.min(minX, area.x)
    minY = Math.min(minY, area.y)
    maxX = Math.max(maxX, area.x + area.width)
    maxY = Math.max(maxY, area.y + area.height)
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  }
}

function getDisplayForWindow(): Electron.Display {
  if (!state.mainWindow || state.mainWindow.isDestroyed()) {
    return screen.getPrimaryDisplay()
  }
  const bounds = state.mainWindow.getBounds()
  return screen.getDisplayNearestPoint({
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2
  })
}

function refreshScreenMetrics(): void {
  const virtual = getVirtualWorkAreaBounds()
  state.screenWidth = virtual.width
  state.screenHeight = virtual.height
}

async function createWindow(): Promise<void> {
  if (state.mainWindow) {
    if (state.mainWindow.isMinimized()) state.mainWindow.restore()
    state.mainWindow.focus()
    return
  }

  const primaryDisplay = screen.getPrimaryDisplay()
  const workArea = primaryDisplay.workAreaSize
  state.screenWidth = workArea.width
  state.screenHeight = workArea.height
  state.step = 60
  const windowWidth = DEFAULT_WINDOW_WIDTH
  const windowHeight = DEFAULT_WINDOW_HEIGHT
  state.currentX = Math.max(0, Math.round((workArea.width - windowWidth) / 2))
  state.currentY = Math.max(0, Math.round((workArea.height - windowHeight) / 2))

  const windowSettings: Electron.BrowserWindowConstructorOptions = {
    width: windowWidth,
    height: windowHeight,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    x: state.currentX,
    y: state.currentY,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: isDev
        ? path.join(__dirname, "../dist-electron/preload.js")
        : path.join(__dirname, "preload.js"),
      scrollBounce: true
    },
    show: true,
    frame: false,
    transparent: true,
    fullscreenable: false,
    hasShadow: false,
    opacity: 1.0,  // Start with full opacity
    backgroundColor: "#00000000",
    focusable: true,
    skipTaskbar: false,
    paintWhenInitiallyHidden: true,
    titleBarStyle: "hidden",
    enableLargerThanScreen: true,
    movable: true
  }

  state.mainWindow = new BrowserWindow(windowSettings)

  // Add more detailed logging for window events
  state.mainWindow.webContents.on("did-finish-load", () => {
    console.log("Window finished loading")
  })
  state.mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription) => {
      // ERR_ABORTED(-3) is normal during navigation; ignore it
      if (errorCode === -3) return
      console.error("Window failed to load:", errorCode, errorDescription)
    }
  )

  if (isDev) {
    // In development, load from the dev server
    console.log("Loading from development server: http://localhost:54321")
    state.mainWindow.loadURL("http://localhost:54321").catch((error) => {
      console.error("Failed to load dev server, falling back to local file:", error)
      // Fallback to local file if dev server is not available
      const indexPath = path.join(__dirname, "../dist/index.html")
      console.log("Falling back to:", indexPath)
      if (fs.existsSync(indexPath)) {
        state.mainWindow.loadFile(indexPath)
      } else {
        console.error("Could not find index.html in dist folder")
      }
    })
  } else {
    // In production, load from the built files
    const indexPath = path.join(__dirname, "../dist/index.html")
    console.log("Loading production build:", indexPath)
    
    if (fs.existsSync(indexPath)) {
      state.mainWindow.loadFile(indexPath)
    } else {
      console.error("Could not find index.html in dist folder")
    }
  }

  // Configure window behavior
  state.mainWindow.webContents.setZoomFactor(1)
  if (isDev && process.env.INNOMATE_DEVTOOLS === "1") {
    state.mainWindow.webContents.openDevTools({ mode: "detach" })
  }
  state.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.log("Attempting to open URL:", url)
    try {
      const parsedURL = new URL(url);
      const hostname = parsedURL.hostname;
      const allowedHosts = ["google.com", "lginnotek.com"]
      if (
        allowedHosts.includes(hostname) ||
        hostname.endsWith(".google.com") ||
        hostname.endsWith(".lginnotek.com")
      ) {
        shell.openExternal(url);
        return { action: "deny" }; // Do not open this URL in a new Electron window
      }
    } catch (error) {
      console.error("Invalid URL %d in setWindowOpenHandler: %d" , url , error);
      return { action: "deny" }; // Deny access as URL string is malformed or invalid
    }
    return { action: "allow" };
  })

  // 데모·화면 공유 시 앱이 보이도록 캡처 보호 비활성 (스크린샷 순간에만 hide)
  state.mainWindow.setContentProtection(false)

  state.mainWindow.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true
  })
  state.mainWindow.setAlwaysOnTop(true, "screen-saver", 1)

  if (process.platform === "darwin") {
    state.mainWindow.setHiddenInMissionControl(false)
    state.mainWindow.setWindowButtonVisibility(false)
    state.mainWindow.setBackgroundColor("#00000000")
    state.mainWindow.setSkipTaskbar(false)
    state.mainWindow.setHasShadow(false)
  }
  state.mainWindow.webContents.setBackgroundThrottling(false)
  state.mainWindow.webContents.setFrameRate(60)

  refreshScreenMetrics()

  // Set up window listeners
  state.mainWindow.on("move", handleWindowMove)
  state.mainWindow.on("resize", handleWindowResize)
  state.mainWindow.on("closed", handleWindowClosed)

  // Initialize window state
  const bounds = state.mainWindow.getBounds()
  state.windowPosition = { x: bounds.x, y: bounds.y }
  state.windowSize = { width: bounds.width, height: bounds.height }
  state.currentX = bounds.x
  state.currentY = bounds.y
  state.isWindowVisible = true
  
  // Set opacity based on user preferences or hide initially
  // Ensure the window is visible for the first launch or if opacity > 0.1
  const savedOpacity = configHelper.getOpacity();
  console.log(`Initial opacity from config: ${savedOpacity}`);
  
  // 항상 첫 실행 시 창 표시 (InnoMate는 사내 도구 — 스텔스 숨김 비활성)
  state.mainWindow.setOpacity(savedOpacity > 0.1 ? savedOpacity : 1)
  state.mainWindow.show()
  state.mainWindow.focus()
  state.isWindowVisible = true
  console.log(`Window shown at (${state.currentX}, ${state.currentY}), opacity ${savedOpacity}`)
}

function handleWindowMove(): void {
  if (!state.mainWindow) return
  const bounds = state.mainWindow.getBounds()
  state.windowPosition = { x: bounds.x, y: bounds.y }
  state.currentX = bounds.x
  state.currentY = bounds.y
}

function handleWindowResize(): void {
  if (!state.mainWindow) return
  const bounds = state.mainWindow.getBounds()
  state.windowSize = { width: bounds.width, height: bounds.height }
}

function handleWindowClosed(): void {
  state.mainWindow = null
  state.isWindowVisible = false
  state.windowPosition = null
  state.windowSize = null
}

// Window visibility functions
function hideForScreenshot(): void {
  if (!state.mainWindow || state.mainWindow.isDestroyed()) return

  state.wasVisibleBeforeScreenshot = state.isWindowVisible
  if (!state.isWindowVisible) return

  const bounds = state.mainWindow.getBounds()
  state.windowPosition = { x: bounds.x, y: bounds.y }
  state.windowSize = { width: bounds.width, height: bounds.height }
  state.mainWindow.hide()
  state.isWindowVisible = false
  console.log("Window hidden for screenshot capture")
}

function showAfterScreenshot(): void {
  if (!state.mainWindow || state.mainWindow.isDestroyed()) return
  if (!state.wasVisibleBeforeScreenshot) return

  if (state.windowPosition && state.windowSize) {
    state.mainWindow.setBounds({
      ...state.windowPosition,
      ...state.windowSize
    })
  }

  const savedOpacity = configHelper.getOpacity()
  state.mainWindow.setContentProtection(false)
  state.mainWindow.setIgnoreMouseEvents(false)
  state.mainWindow.show()
  state.mainWindow.setOpacity(savedOpacity > 0.1 ? savedOpacity : 1)
  state.isWindowVisible = true
  console.log("Window restored after screenshot capture")
}

function hideMainWindow(): void {
  if (!state.mainWindow?.isDestroyed()) {
    const bounds = state.mainWindow.getBounds();
    state.windowPosition = { x: bounds.x, y: bounds.y };
    state.windowSize = { width: bounds.width, height: bounds.height };
    state.mainWindow.setIgnoreMouseEvents(true, { forward: true });
    state.mainWindow.setOpacity(0);
    state.isWindowVisible = false;
    console.log('Window hidden, opacity set to 0');
  }
}

function showMainWindow(): void {
  if (!state.mainWindow?.isDestroyed()) {
    if (state.windowPosition && state.windowSize) {
      state.mainWindow.setBounds({
        ...state.windowPosition,
        ...state.windowSize
      })
    }
    state.mainWindow.setIgnoreMouseEvents(false)
    state.mainWindow.setAlwaysOnTop(true, "screen-saver", 1)
    state.mainWindow.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true
    })
    state.mainWindow.setContentProtection(false)
    const savedOpacity = configHelper.getOpacity()
    state.mainWindow.show()
    state.mainWindow.setOpacity(savedOpacity > 0.1 ? savedOpacity : 1)
    state.mainWindow.focus()
    state.isWindowVisible = true
    console.log("Window shown")
  }
}

function toggleMainWindow(): void {
  console.log(`Toggling window. Current state: ${state.isWindowVisible ? 'visible' : 'hidden'}`);
  if (state.isWindowVisible) {
    hideMainWindow();
  } else {
    showMainWindow();
  }
}

// Window movement functions
function moveWindowHorizontal(updateFn: (x: number) => number): void {
  if (!state.mainWindow) return
  state.currentX = updateFn(state.currentX)
  state.mainWindow.setPosition(
    Math.round(state.currentX),
    Math.round(state.currentY)
  )
}

function moveWindowVertical(updateFn: (y: number) => number): void {
  if (!state.mainWindow) return

  const virtual = getVirtualWorkAreaBounds()
  const windowHeight = state.windowSize?.height || 0
  const newY = updateFn(state.currentY)
  const maxUpLimit = virtual.minY - (windowHeight * 2) / 3
  const maxDownLimit = virtual.maxY + (windowHeight * 2) / 3 - windowHeight

  if (newY >= maxUpLimit && newY <= maxDownLimit) {
    state.currentY = newY
    state.mainWindow.setPosition(
      Math.round(state.currentX),
      Math.round(state.currentY)
    )
  }
}

/** 다음 모니터로 창 이동 (좌→우 순, 마지막이면 첫 모니터) */
function moveWindowToNextDisplay(): void {
  if (!state.mainWindow || state.mainWindow.isDestroyed()) return

  const displays = screen.getAllDisplays()
  if (displays.length <= 1) return

  const sorted = [...displays].sort(
    (a, b) => a.workArea.x - b.workArea.x || a.workArea.y - b.workArea.y
  )
  const current = getDisplayForWindow()
  const currentIndex = sorted.findIndex((d) => d.id === current.id)
  const nextDisplay = sorted[(currentIndex + 1) % sorted.length]
  const workArea = nextDisplay.workArea
  const bounds = state.mainWindow.getBounds()
  const width = state.windowSize?.width ?? bounds.width
  const height = state.windowSize?.height ?? bounds.height

  const newX = workArea.x + Math.max(0, Math.round((workArea.width - width) / 2))
  const newY = workArea.y + Math.max(0, Math.round((workArea.height - height) / 2))

  state.currentX = newX
  state.currentY = newY
  state.mainWindow.setPosition(newX, newY)
  console.log(`[Window] Switched to display ${nextDisplay.id} (${newX}, ${newY})`)
}

// Window dimension functions
function setWindowDimensions(width: number, height: number): void {
  if (state.windowLayoutMode === "settings") return
  if (!state.mainWindow?.isDestroyed()) {
    const [currentX, currentY] = state.mainWindow.getPosition()
    const display = getDisplayForWindow()
    const workArea = display.workArea
    const maxWidth = Math.floor(workArea.width * 0.9)
    const safeWidth = Math.max(MIN_WINDOW_WIDTH, Math.min(Math.ceil(width) + 24, maxWidth))
    const safeHeight = Math.max(MIN_WINDOW_HEIGHT, Math.ceil(height) + 16)
    const maxX = workArea.x + Math.max(0, workArea.width - safeWidth)

    state.mainWindow.setBounds({
      x: Math.min(Math.max(workArea.x, currentX), maxX),
      y: currentY,
      width: safeWidth,
      height: safeHeight
    })
    state.windowSize = { width: safeWidth, height: safeHeight }
    state.currentX = state.mainWindow.getBounds().x
  }
}

function setWindowLayoutMode(
  mode: "compact" | "settings",
  dimensions?: { width: number; height: number }
): void {
  if (!state.mainWindow || state.mainWindow.isDestroyed()) {
    state.windowLayoutMode = mode
    return
  }

  const display = getDisplayForWindow()
  const workArea = display.workArea
  const [currentX, currentY] = state.mainWindow.getPosition()

  if (mode === "settings") {
    if (state.windowLayoutMode !== "settings") {
      const bounds = state.mainWindow.getBounds()
      state.compactWindowSize = { width: bounds.width, height: bounds.height }
    }

    state.windowLayoutMode = "settings"

    const width = Math.min(
      Math.max(dimensions?.width ?? SETTINGS_MIN_WIDTH, SETTINGS_MIN_WIDTH),
      Math.floor(workArea.width * 0.92)
    )
    const height = Math.min(
      Math.max(dimensions?.height ?? SETTINGS_MIN_HEIGHT, SETTINGS_MIN_HEIGHT),
      Math.floor(workArea.height * 0.92)
    )
    const maxX = workArea.x + Math.max(0, workArea.width - width)

    state.mainWindow.setBounds({
      x: Math.min(Math.max(workArea.x, currentX), maxX),
      y: currentY,
      width,
      height
    })
    state.windowSize = { width, height }
    state.currentX = state.mainWindow.getBounds().x
    return
  }

  state.windowLayoutMode = "compact"

  if (state.compactWindowSize) {
    const { width, height } = state.compactWindowSize
    const maxX = workArea.x + Math.max(0, workArea.width - width)
    state.mainWindow.setBounds({
      x: Math.min(Math.max(workArea.x, currentX), maxX),
      y: currentY,
      width,
      height
    })
    state.windowSize = { width, height }
    state.currentX = state.mainWindow.getBounds().x
    state.compactWindowSize = null
  }
}

function getWindowLayoutMode(): "compact" | "settings" {
  return state.windowLayoutMode
}

// Initialize application
async function initializeApp() {
  try {
    // Set custom cache directory to prevent permission issues
    const appDataPath = path.join(app.getPath('appData'), 'innomate')
    const sessionPath = path.join(appDataPath, 'session')
    const tempPath = path.join(appDataPath, 'temp')
    const cachePath = path.join(appDataPath, 'cache')
    
    // Create directories if they don't exist
    for (const dir of [appDataPath, sessionPath, tempPath, cachePath]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    }
    
    app.setPath('userData', appDataPath)
    app.setPath('sessionData', sessionPath)      
    app.setPath('temp', tempPath)
    app.setPath('cache', cachePath)

    // app paths 설정 완료 후 harness 초기화 (app.getPath 사용 가능 시점)
    harnessLoader.initialize()

    loadEnvVariables(appDataPath)
    
    // Ensure a configuration file exists
    if (!configHelper.hasApiKey()) {
      console.log("No API key found in configuration. User will need to set up.")
    }
    
    initializeHelpers()
    initializeIpcHandlers({
      getMainWindow,
      setWindowDimensions,
      setWindowLayoutMode,
      getWindowLayoutMode,
      getScreenshotQueue,
      getExtraScreenshotQueue,
      deleteScreenshot,
      getImagePreview,
      processingHelper: state.processingHelper,
      PROCESSING_EVENTS: state.PROCESSING_EVENTS,
      takeScreenshot,
      getView,
      toggleMainWindow,
      clearQueues,
      setView,
      moveWindowLeft: () =>
        moveWindowHorizontal((x) => {
          const virtual = getVirtualWorkAreaBounds()
          const w = state.windowSize?.width ?? DEFAULT_WINDOW_WIDTH
          return Math.max(virtual.minX - (w * 2) / 3, x - state.step)
        }),
      moveWindowRight: () =>
        moveWindowHorizontal((x) => {
          const virtual = getVirtualWorkAreaBounds()
          const w = state.windowSize?.width ?? DEFAULT_WINDOW_WIDTH
          return Math.min(virtual.maxX - w / 3, x + state.step)
        }),
      moveWindowUp: () => moveWindowVertical((y) => y - state.step),
      moveWindowDown: () => moveWindowVertical((y) => y + state.step)
    })
    await createWindow()
    state.shortcutsHelper?.registerGlobalShortcuts()

    screen.on("display-added", refreshScreenMetrics)
    screen.on("display-removed", refreshScreenMetrics)
    screen.on("display-metrics-changed", refreshScreenMetrics)

    // Initialize auto-updater regardless of environment
    initAutoUpdater()
    console.log(
      "Auto-updater initialized in",
      isDev ? "development" : "production",
      "mode"
    )
  } catch (error) {
    console.error("Failed to initialize application:", error)
    app.quit()
  }
}

// Auth callback handling removed - no longer needed
app.on("open-url", (event, url) => {
  console.log("open-url event received:", url)
  event.preventDefault()
})

// window-all-closed / second-instance는 위의 Single Instance Lock 블록에서 등록됨

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// State getter/setter functions
function getMainWindow(): BrowserWindow | null {
  return state.mainWindow
}

function getView(): "queue" | "solutions" | "debug" {
  return state.view
}

function setView(view: "queue" | "solutions" | "debug"): void {
  state.view = view
  state.screenshotHelper?.setView(view)
}

function getScreenshotHelper(): ScreenshotHelper | null {
  return state.screenshotHelper
}

function getProblemInfo(): any {
  return state.problemInfo
}

function setProblemInfo(problemInfo: any): void {
  state.problemInfo = problemInfo
}

function getScreenshotQueue(): string[] {
  return state.screenshotHelper?.getScreenshotQueue() || []
}

function getExtraScreenshotQueue(): string[] {
  return state.screenshotHelper?.getExtraScreenshotQueue() || []
}

function clearQueues(): void {
  state.screenshotHelper?.clearQueues()
  state.problemInfo = null
  setView("queue")
}

async function takeScreenshot(): Promise<string[]> {
  if (!state.mainWindow) throw new Error("No main window available")
  const paths =
    (await state.screenshotHelper?.takeScreenshot(
      () => hideForScreenshot(),
      () => showAfterScreenshot()
    )) || []

  for (const screenshotPath of paths) {
    const preview = await getImagePreview(screenshotPath)
    state.mainWindow?.webContents.send("screenshot-taken", {
      path: screenshotPath,
      preview
    })
  }

  return paths
}

async function getImagePreview(filepath: string): Promise<string> {
  return state.screenshotHelper?.getImagePreview(filepath) || ""
}

async function deleteScreenshot(
  path: string
): Promise<{ success: boolean; error?: string }> {
  return (
    state.screenshotHelper?.deleteScreenshot(path) || {
      success: false,
      error: "Screenshot helper not initialized"
    }
  )
}

function setHasDebugged(value: boolean): void {
  state.hasDebugged = value
}

function getHasDebugged(): boolean {
  return state.hasDebugged
}

// Export state and functions for other modules
export {
  state,
  createWindow,
  hideMainWindow,
  showMainWindow,
  toggleMainWindow,
  setWindowDimensions,
  setWindowLayoutMode,
  getWindowLayoutMode,
  moveWindowHorizontal,
  moveWindowVertical,
  getMainWindow,
  getView,
  setView,
  getScreenshotHelper,
  getProblemInfo,
  setProblemInfo,
  getScreenshotQueue,
  getExtraScreenshotQueue,
  clearQueues,
  takeScreenshot,
  getImagePreview,
  deleteScreenshot,
  setHasDebugged,
  getHasDebugged
}

app.whenReady().then(initializeApp)
