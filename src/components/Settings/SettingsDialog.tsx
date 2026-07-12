import { useState, useEffect, useLayoutEffect } from "react"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { useToast } from "../../contexts/toast"
import {
  type APIProvider,
  DEFAULT_MODELS
} from "../../constants/aiModels"
import { requestLayoutRemeasure } from "../../hooks/useContentDimensions"
import { COMMAND_KEY } from "../../utils/platform"

const PROVIDERS: Array<{
  id: APIProvider
  label: string
  model: string
}> = [
  { id: "openai", label: "OpenAI", model: "GPT-5.5" },
  { id: "gemini", label: "Gemini", model: "Gemini 3.5 Flash" },
  { id: "anthropic", label: "Claude", model: "Claude Sonnet 4.6" }
]

const SHORTCUTS: Array<{ label: string; keys: string }> = [
  { label: "창 표시/숨김", keys: `${COMMAND_KEY}+B` },
  { label: "스크린샷", keys: `${COMMAND_KEY}+H` },
  { label: "Agent 실행", keys: `${COMMAND_KEY}+Enter` },
  { label: "모니터 이동", keys: `${COMMAND_KEY}+\\` },
  { label: "창 이동", keys: `${COMMAND_KEY}+←→↑↓` },
  { label: "스크린샷 삭제", keys: `${COMMAND_KEY}+L` },
  { label: "초기화", keys: `${COMMAND_KEY}+R` },
  { label: "투명도 조절", keys: `${COMMAND_KEY}+[ ]` },
  { label: "앱 종료", keys: `${COMMAND_KEY}+Q` }
]

interface SettingsDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function SettingsDialog({
  open: externalOpen = true,
  onOpenChange
}: SettingsDialogProps) {
  const { showToast } = useToast()
  const [open, setOpen] = useState(externalOpen)
  const [isLoading, setIsLoading] = useState(false)
  const [apiKey, setApiKey] = useState("")
  const [apiProvider, setApiProvider] = useState<APIProvider>("openai")

  useEffect(() => {
    setOpen(externalOpen)
  }, [externalOpen])

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    onOpenChange?.(newOpen)
  }

  useLayoutEffect(() => {
    if (!open) return

    void window.electronAPI.setWindowLayoutMode("settings", {
      width: 420,
      height: 480
    })

    return () => {
      void window.electronAPI.setWindowLayoutMode("compact").then(() => {
        requestLayoutRemeasure()
      })
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    setIsLoading(true)
    window.electronAPI
      .getConfig()
      .then((config: {
        apiKey?: string
        apiProvider?: APIProvider
      }) => {
        setApiKey(config.apiKey || "")
        setApiProvider(config.apiProvider || "openai")
      })
      .catch((error: unknown) => {
        console.error("Failed to load config:", error)
        showToast("오류", "설정을 불러오지 못했습니다", "error")
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [open, showToast])

  const handleSave = async () => {
    setIsLoading(true)
    try {
      const defaults = DEFAULT_MODELS[apiProvider]
      const result = await window.electronAPI.updateConfig({
        apiKey,
        apiProvider,
        agentModel: defaults.agent,
        extractionModel: defaults.classifier,
        solutionModel: defaults.agent
      })

      if (result) {
        showToast("완료", "설정이 저장되었습니다", "success")
        handleOpenChange(false)
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      }
    } catch (error) {
      console.error("Failed to save settings:", error)
      showToast("오류", "설정 저장에 실패했습니다", "error")
    } finally {
      setIsLoading(false)
    }
  }

  const maskApiKey = (key: string) => {
    if (!key || key.length < 10) return ""
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`
  }

  const canSave = Boolean(apiKey.trim())
  const keyLabel =
    apiProvider === "openai"
      ? "OpenAI API Key"
      : apiProvider === "gemini"
        ? "Gemini API Key"
        : "Anthropic API Key"

  if (!open) return null

  return (
    <div
      className="settings-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="InnoMate 설정"
    >
      <div className="settings-panel">
        <header className="settings-panel-header">
          <h1 className="text-lg font-semibold text-white">InnoMate 설정</h1>
        </header>

        <div className="settings-panel-scroll">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">
                API Provider
              </label>
              <div className="flex gap-2">
                {PROVIDERS.map(({ id, label, model }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setApiProvider(id)}
                    className={`flex-1 rounded-lg p-2.5 text-left transition-colors ${
                      apiProvider === id
                        ? "border border-white/20 bg-white/10"
                        : "border border-white/5 bg-black/30 hover:bg-white/5"
                    }`}
                  >
                    <p className="text-sm font-medium text-white">{label}</p>
                    <p className="mt-0.5 text-[11px] text-white/55">{model}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white" htmlFor="apiKey">
                {keyLabel}
              </label>
              <Input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  apiProvider === "openai"
                    ? "sk-..."
                    : apiProvider === "gemini"
                      ? "Gemini API key"
                      : "sk-ant-..."
                }
                className="border-white/10 bg-black/50 text-white"
              />
              {apiKey && (
                <p className="text-xs text-white/45">
                  Current: {maskApiKey(apiKey)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white">
                Keyboard Shortcuts
              </label>
              <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-xs">
                  {SHORTCUTS.map(({ label, keys }) => (
                    <div key={label} className="contents">
                      <div className="text-white/60">{label}</div>
                      <div className="font-mono tabular-nums text-white/90">
                        {keys}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className="settings-panel-footer">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="border-white/10 text-white hover:bg-white/5"
          >
            취소
          </Button>
          <Button
            className="rounded-xl bg-white px-4 py-3 font-medium text-black transition-colors hover:bg-white/90"
            onClick={() => void handleSave()}
            disabled={isLoading || !canSave}
          >
            {isLoading ? "저장 중..." : "저장"}
          </Button>
        </footer>
      </div>
    </div>
  )
}
