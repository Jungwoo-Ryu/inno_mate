import { useState, useEffect, useLayoutEffect } from "react"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { useToast } from "../../contexts/toast"
import {
  type APIProvider,
  DEFAULT_MODELS,
  DEFAULT_AZURE_API_VERSION
} from "../../constants/aiModels"
import { requestLayoutRemeasure } from "../../hooks/useContentDimensions"
import { COMMAND_KEY } from "../../utils/platform"

const PROVIDERS: Array<{
  id: APIProvider
  label: string
  model: string
}> = [
  { id: "openai", label: "OpenAI", model: "GPT / 게이트웨이" },
  { id: "azure", label: "Azure OpenAI", model: "사내 Azure" },
  { id: "anthropic", label: "Claude", model: "Anthropic" }
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
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState("")
  const [azureEndpoint, setAzureEndpoint] = useState("")
  const [azureApiVersion, setAzureApiVersion] = useState(DEFAULT_AZURE_API_VERSION)
  const [deploymentOrModel, setDeploymentOrModel] = useState("")

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
      width: 440,
      height: apiProvider === "azure" ? 620 : 560
    })

    return () => {
      void window.electronAPI.setWindowLayoutMode("compact").then(() => {
        requestLayoutRemeasure()
      })
    }
  }, [open, apiProvider])

  useEffect(() => {
    if (!open) return

    setIsLoading(true)
    window.electronAPI
      .getConfig()
      .then((config: {
        apiKey?: string
        apiProvider?: APIProvider
        openaiBaseUrl?: string
        azureEndpoint?: string
        azureApiVersion?: string
        agentModel?: string
      }) => {
        const provider =
          config.apiProvider === "azure" ||
          config.apiProvider === "anthropic" ||
          config.apiProvider === "openai"
            ? config.apiProvider
            : "openai"
        setApiKey(config.apiKey || "")
        setApiProvider(provider)
        setOpenaiBaseUrl(config.openaiBaseUrl || "")
        setAzureEndpoint(config.azureEndpoint || "")
        setAzureApiVersion(config.azureApiVersion || DEFAULT_AZURE_API_VERSION)
        setDeploymentOrModel(config.agentModel || DEFAULT_MODELS[provider].agent)
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
    if (apiProvider === "azure" && !azureEndpoint.trim()) {
      showToast("안내", "Azure Endpoint URL을 입력하세요", "neutral")
      return
    }

    setIsLoading(true)
    try {
      const defaults = DEFAULT_MODELS[apiProvider]
      const model = deploymentOrModel.trim() || defaults.agent
      const result = await window.electronAPI.updateConfig({
        apiKey,
        apiProvider,
        openaiBaseUrl: openaiBaseUrl.trim(),
        azureEndpoint: azureEndpoint.trim(),
        azureApiVersion: azureApiVersion.trim() || DEFAULT_AZURE_API_VERSION,
        agentModel: model,
        extractionModel: apiProvider === "azure" ? model : defaults.classifier,
        solutionModel: model
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

  const canSave =
    Boolean(apiKey.trim()) &&
    (apiProvider !== "azure" || Boolean(azureEndpoint.trim()))

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
                    onClick={() => {
                      setApiProvider(id)
                      setDeploymentOrModel(DEFAULT_MODELS[id].agent)
                    }}
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

            {apiProvider === "openai" && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-white" htmlFor="baseUrl">
                  Base URL (선택 · 사내 게이트웨이)
                </label>
                <Input
                  id="baseUrl"
                  value={openaiBaseUrl}
                  onChange={(e) => setOpenaiBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="border-white/10 bg-black/50 font-mono text-xs text-white"
                />
              </div>
            )}

            {apiProvider === "azure" && (
              <>
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-white"
                    htmlFor="azureEndpoint"
                  >
                    Azure Endpoint
                  </label>
                  <Input
                    id="azureEndpoint"
                    value={azureEndpoint}
                    onChange={(e) => setAzureEndpoint(e.target.value)}
                    placeholder="https://YOUR_RESOURCE.openai.azure.com"
                    className="border-white/10 bg-black/50 font-mono text-xs text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-white"
                    htmlFor="azureVersion"
                  >
                    API Version
                  </label>
                  <Input
                    id="azureVersion"
                    value={azureApiVersion}
                    onChange={(e) => setAzureApiVersion(e.target.value)}
                    placeholder={DEFAULT_AZURE_API_VERSION}
                    className="border-white/10 bg-black/50 font-mono text-xs text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-white"
                    htmlFor="deployment"
                  >
                    Deployment 이름
                  </label>
                  <Input
                    id="deployment"
                    value={deploymentOrModel}
                    onChange={(e) => setDeploymentOrModel(e.target.value)}
                    placeholder="gpt-4o"
                    className="border-white/10 bg-black/50 text-white"
                  />
                </div>
              </>
            )}

            {apiProvider !== "azure" && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-white" htmlFor="model">
                  Model
                </label>
                <Input
                  id="model"
                  value={deploymentOrModel}
                  onChange={(e) => setDeploymentOrModel(e.target.value)}
                  placeholder={DEFAULT_MODELS[apiProvider].agent}
                  className="border-white/10 bg-black/50 text-white"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-white" htmlFor="apiKey">
                {apiProvider === "openai"
                  ? "OpenAI API Key"
                  : apiProvider === "azure"
                    ? "Azure OpenAI API Key"
                    : "Anthropic API Key"}
              </label>
              <Input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  apiProvider === "anthropic" ? "sk-ant-..." : "API key"
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
