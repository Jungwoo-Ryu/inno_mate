import { useState, useEffect, useLayoutEffect } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { useToast } from "../../contexts/toast";
import {
  type APIProvider,
  DEFAULT_MODELS,
  modelsForProvider
} from "../../constants/aiModels";
import { requestLayoutRemeasure } from "../../hooks/useContentDimensions";

type ModelCategory = {
  key: "extractionModel" | "solutionModel" | "debuggingModel";
  title: string;
  description: string;
};

const modelCategories: ModelCategory[] = [
  {
    key: "extractionModel",
    title: "Problem Extraction",
    description: "Model used to analyze screenshots and extract problem details"
  },
  {
    key: "solutionModel",
    title: "Solution Generation",
    description: "Model used to generate coding solutions"
  },
  {
    key: "debuggingModel",
    title: "Debugging",
    description: "Model used to debug and improve solutions"
  }
];

interface SettingsDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SettingsDialog({
  open: externalOpen = true,
  onOpenChange
}: SettingsDialogProps) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(externalOpen);
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiProvider, setApiProvider] = useState<APIProvider>("openai");
  const [extractionModel, setExtractionModel] = useState(DEFAULT_MODELS.openai.extraction);
  const [solutionModel, setSolutionModel] = useState(DEFAULT_MODELS.openai.solution);
  const [debuggingModel, setDebuggingModel] = useState(DEFAULT_MODELS.openai.debugging);
  const [gportalUrl, setGportalUrl] = useState("");
  const [gportalUsername, setGportalUsername] = useState("");
  const [envSources, setEnvSources] = useState<string[]>([]);
  const [apiKeySource, setApiKeySource] = useState<"env" | "hardcoded" | "config" | null>(null);

  useEffect(() => {
    setOpen(externalOpen);
  }, [externalOpen]);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    onOpenChange?.(newOpen);
  };

  useLayoutEffect(() => {
    if (!open) return;

    void window.electronAPI.setWindowLayoutMode("settings", {
      width: 500,
      height: 680
    });

    return () => {
      void window.electronAPI.setWindowLayoutMode("compact").then(() => {
        requestLayoutRemeasure();
      });
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    setIsLoading(true);
    interface Config {
      apiKey?: string;
      apiProvider?: APIProvider;
      extractionModel?: string;
      solutionModel?: string;
      debuggingModel?: string;
      gportalUrl?: string;
      gportalUsername?: string;
      envSources?: string[];
      apiKeySource?: "env" | "hardcoded" | "config" | null;
    }

    window.electronAPI
      .getConfig()
      .then((config: Config) => {
        setApiKey(config.apiKey || "");
        setApiProvider(config.apiProvider || "openai");
        setExtractionModel(config.extractionModel || DEFAULT_MODELS.openai.extraction);
        setSolutionModel(config.solutionModel || DEFAULT_MODELS.openai.solution);
        setDebuggingModel(config.debuggingModel || DEFAULT_MODELS.openai.debugging);
        setGportalUrl(config.gportalUrl || "");
        setGportalUsername(config.gportalUsername || "");
        setEnvSources(config.envSources ?? []);
        setApiKeySource(config.apiKeySource ?? null);
      })
      .catch((error: unknown) => {
        console.error("Failed to load config:", error);
        showToast("오류", "설정을 불러오지 못했습니다", "error");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [open, showToast]);

  const handleProviderChange = (provider: APIProvider) => {
    setApiProvider(provider);
    const defaults = DEFAULT_MODELS[provider];
    setExtractionModel(defaults.extraction);
    setSolutionModel(defaults.solution);
    setDebuggingModel(defaults.debugging);
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.updateConfig({
        apiKey,
        apiProvider,
        extractionModel,
        solutionModel,
        debuggingModel,
        agentModel: solutionModel,
        gportalUrl,
        gportalUsername
      });

      if (result) {
        showToast("완료", "설정이 저장되었습니다 (.env)", "success");
        handleOpenChange(false);
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      showToast("오류", "설정 저장에 실패했습니다", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const maskApiKey = (key: string) => {
    if (!key || key.length < 10) return "";
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  };

  const apiKeySourceLabel =
    apiKeySource === "env"
      ? ".env"
      : apiKeySource === "hardcoded"
      ? "하드코딩"
      : apiKeySource === "config"
      ? "config.json"
      : null;

  const canSave = Boolean(apiKey.trim());

  if (!open) return null;

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true" aria-label="InnoMate 설정">
      <div className="settings-panel">
        <header className="settings-panel-header">
          <h1 className="text-lg font-semibold text-white">InnoMate 설정</h1>
          <p className="text-sm text-white/70 mt-1">
            API 키가 없으면 입력 후 저장하면 로컬 <code className="text-white/90">.env</code>에
            기록됩니다. 하드코딩(<code className="text-white/90">electron/envConfig.ts</code>)도
            지원합니다.
          </p>
          {apiKeySourceLabel && (
            <div className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
              현재 API 키 출처: {apiKeySourceLabel}
            </div>
          )}
          {envSources.length > 0 && (
            <div className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              .env 변수: {envSources.join(", ")}
            </div>
          )}
        </header>

        <div className="settings-panel-scroll">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">API Provider</label>
              <div className="flex gap-2">
                {(
                  [
                    ["openai", "OpenAI", "GPT-5.5 · GPT-5.4"],
                    ["gemini", "Gemini", "Gemini 3.5 Flash"],
                    ["anthropic", "Claude", "Claude 4.6 · 4.7"]
                  ] as const
                ).map(([id, label, sub]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleProviderChange(id)}
                    className={`flex-1 p-2 rounded-lg text-left transition-colors ${
                      apiProvider === id
                        ? "bg-white/10 border border-white/20"
                        : "bg-black/30 border border-white/5 hover:bg-white/5"
                    }`}
                  >
                    <p className="font-medium text-white text-sm">{label}</p>
                    <p className="text-xs text-white/60">{sub}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white" htmlFor="apiKey">
                {apiProvider === "openai"
                  ? "OpenAI API Key"
                  : apiProvider === "gemini"
                  ? "Gemini API Key"
                  : "Anthropic API Key"}
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
                className="bg-black/50 border-white/10 text-white"
              />
              {apiKey && (
                <p className="text-xs text-white/50">Current: {maskApiKey(apiKey)}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white mb-2 block">
                Keyboard Shortcuts
              </label>
              <div className="bg-black/30 border border-white/10 rounded-lg p-3">
                <div className="grid grid-cols-2 gap-y-2 text-xs">
                  <div className="text-white/70">창 표시/숨김</div>
                  <div className="text-white/90 font-mono">Cmd+B</div>
                  <div className="text-white/70">스크린샷</div>
                  <div className="text-white/90 font-mono">Cmd+H</div>
                  <div className="text-white/70">Agent 실행</div>
                  <div className="text-white/90 font-mono">Cmd+Enter</div>
                  <div className="text-white/70">초기화</div>
                  <div className="text-white/90 font-mono">Cmd+R</div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-sm font-medium text-white">AI Model Selection</label>
              {modelCategories.map((category) => {
                const models = modelsForProvider(apiProvider);
                const currentValue =
                  category.key === "extractionModel"
                    ? extractionModel
                    : category.key === "solutionModel"
                    ? solutionModel
                    : debuggingModel;
                const setValue =
                  category.key === "extractionModel"
                    ? setExtractionModel
                    : category.key === "solutionModel"
                    ? setSolutionModel
                    : setDebuggingModel;

                return (
                  <div key={category.key} className="mb-4">
                    <label className="text-sm font-medium text-white mb-1 block">
                      {category.title}
                    </label>
                    <p className="text-xs text-white/60 mb-2">{category.description}</p>
                    <div className="space-y-2">
                      {models.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setValue(m.id)}
                          className={`w-full p-2 rounded-lg text-left transition-colors ${
                            currentValue === m.id
                              ? "bg-white/10 border border-white/20"
                              : "bg-black/30 border border-white/5 hover:bg-white/5"
                          }`}
                        >
                          <p className="font-medium text-white text-xs">{m.name}</p>
                          <p className="text-xs text-white/60">{m.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-3 pt-2 border-t border-white/10">
              <label className="text-sm font-medium text-white">G-portal (POC)</label>
              <Input
                placeholder="G-portal URL (GPORTAL_URL)"
                value={gportalUrl}
                onChange={(e) => setGportalUrl(e.target.value)}
                className="bg-black/50 border-white/10 text-white"
              />
              <Input
                placeholder="시스템 계정 ID (GPORTAL_USERNAME)"
                value={gportalUsername}
                onChange={(e) => setGportalUsername(e.target.value)}
                className="bg-black/50 border-white/10 text-white"
              />
            </div>
          </div>
        </div>

        <footer className="settings-panel-footer">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="border-white/10 hover:bg-white/5 text-white"
          >
            취소
          </Button>
          <Button
            className="px-4 py-3 bg-white text-black rounded-xl font-medium hover:bg-white/90 transition-colors"
            onClick={handleSave}
            disabled={isLoading || !canSave}
          >
            {isLoading ? "저장 중..." : "저장"}
          </Button>
        </footer>
      </div>
    </div>
  );
}
