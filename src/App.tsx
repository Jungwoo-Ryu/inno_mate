import MainApp from "./_pages/MainApp"
import { UpdateNotification } from "./components/UpdateNotification"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useEffect, useState, useCallback } from "react"
import {
  Toast,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport
} from "./components/ui/toast"
import { ToastContext } from "./contexts/toast"
import { WelcomeScreen } from "./components/WelcomeScreen"
import { SettingsDialog } from "./components/Settings/SettingsDialog"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: Infinity,
      retry: 1,
      refetchOnWindowFocus: false
    },
    mutations: {
      retry: 1
    }
  }
})

function App() {
  const [toastState, setToastState] = useState({
    open: false,
    title: "",
    description: "",
    variant: "neutral" as "neutral" | "success" | "error"
  })
  const [isInitialized, setIsInitialized] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const markInitialized = useCallback(() => {
    setIsInitialized(true)
    window.__IS_INITIALIZED__ = true
  }, [])

  const showToast = useCallback(
    (
      title: string,
      description: string,
      variant: "neutral" | "success" | "error"
    ) => {
      setToastState({
        open: true,
        title,
        description,
        variant
      })
    },
    []
  )

  useEffect(() => {
    const checkApiKey = async () => {
      try {
        const hasKey = await window.electronAPI.checkApiKey()
        setHasApiKey(hasKey)

        if (!hasKey) {
          setTimeout(() => setIsSettingsOpen(true), 1000)
        }
      } catch (error) {
        console.error("Failed to check API key:", error)
      }
    }

    if (isInitialized) {
      checkApiKey()
    }
  }, [isInitialized])

  useEffect(() => {
    const unsubscribeSettings = window.electronAPI.onShowSettings(() => {
      setIsSettingsOpen(true)
    })

    return () => unsubscribeSettings()
  }, [])

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await window.electronAPI.getConfig()
        markInitialized()
      } catch (error) {
        console.error("Failed to initialize app:", error)
        markInitialized()
      }
    }

    initializeApp()

    const onApiKeyInvalid = () => {
      showToast(
        "API 키 오류",
        "AI API 키가 유효하지 않거나 크레딧이 부족합니다",
        "error"
      )
      setIsSettingsOpen(true)
    }

    window.electronAPI.onApiKeyInvalid(onApiKeyInvalid)

    return () => {
      window.electronAPI.removeListener("API_KEY_INVALID", onApiKeyInvalid)
      window.__IS_INITIALIZED__ = false
      setIsInitialized(false)
    }
  }, [markInitialized, showToast])

  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(true)
  }, [])

  const handleCloseSettings = useCallback((open: boolean) => {
    setIsSettingsOpen(open)
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ToastContext.Provider value={{ showToast }}>
          <div className="app-shell">
            {isInitialized ? (
              <>
                {hasApiKey ? (
                  <MainApp />
                ) : (
                  <WelcomeScreen onOpenSettings={handleOpenSettings} />
                )}
                {isSettingsOpen && (
                  <SettingsDialog open onOpenChange={handleCloseSettings} />
                )}
              </>
            ) : (
              <div className="app-content">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-6 h-6 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
                  <p className="text-white/50 text-sm">초기화 중...</p>
                </div>
              </div>
            )}
            <UpdateNotification />
          </div>

          <Toast
            open={toastState.open}
            onOpenChange={(open) =>
              setToastState((prev) => ({ ...prev, open }))
            }
            variant={toastState.variant}
            duration={1500}
          >
            <ToastTitle>{toastState.title}</ToastTitle>
            <ToastDescription>{toastState.description}</ToastDescription>
          </Toast>
          <ToastViewport />
        </ToastContext.Provider>
      </ToastProvider>
    </QueryClientProvider>
  )
}

export default App
