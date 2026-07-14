"use client"

import { useCallback, useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Check, ChevronDown, KeyRound, Loader2 } from "lucide-react"
import clsx from "clsx"

type Provider = "openai" | "azure"

export default function ApiSettingsPanel() {
  const [open, setOpen] = useState(false)
  const [provider, setProvider] = useState<Provider>("openai")
  const [baseUrl, setBaseUrl] = useState("")
  const [azureEndpoint, setAzureEndpoint] = useState("")
  const [azureApiVersion, setAzureApiVersion] = useState("2024-10-21")
  const [apiKey, setApiKey] = useState("")
  const [model, setModel] = useState("gpt-5.5")
  const [hasKey, setHasKey] = useState(false)
  const [masked, setMasked] = useState("")
  const [keyDirty, setKeyDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/openai")
      if (!res.ok) return
      const data = (await res.json()) as {
        provider?: Provider
        baseUrl: string
        azureEndpoint?: string
        azureApiVersion?: string
        model: string
        hasApiKey: boolean
        apiKeyMasked: string
      }
      setProvider(data.provider === "azure" ? "azure" : "openai")
      setBaseUrl(data.baseUrl || "")
      setAzureEndpoint(data.azureEndpoint || "")
      setAzureApiVersion(data.azureApiVersion || "2024-10-21")
      setModel(data.model || "gpt-5.5")
      setHasKey(data.hasApiKey)
      setMasked(data.apiKeyMasked || "")
      setApiKey("")
      setKeyDirty(false)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      if (provider === "azure" && !azureEndpoint.trim()) {
        throw new Error("Azure Endpoint URL을 입력하세요")
      }
      const payload: Record<string, string> = {
        provider,
        baseUrl: baseUrl.trim(),
        azureEndpoint: azureEndpoint.trim(),
        azureApiVersion: azureApiVersion.trim() || "2024-10-21",
        model: model.trim() || (provider === "azure" ? "gpt-4o" : "gpt-5.5")
      }
      if (keyDirty && apiKey.trim()) {
        payload.apiKey = apiKey.trim()
      }
      const res = await fetch("/api/settings/openai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? "저장 실패")
      }
      const data = (await res.json()) as {
        provider?: Provider
        baseUrl: string
        azureEndpoint?: string
        azureApiVersion?: string
        model: string
        hasApiKey: boolean
        apiKeyMasked: string
      }
      setProvider(data.provider === "azure" ? "azure" : "openai")
      setBaseUrl(data.baseUrl || "")
      setAzureEndpoint(data.azureEndpoint || "")
      setAzureApiVersion(data.azureApiVersion || "2024-10-21")
      setModel(data.model || "gpt-5.5")
      setHasKey(data.hasApiKey)
      setMasked(data.apiKeyMasked || "")
      setApiKey("")
      setKeyDirty(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border-t border-white/[0.07]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] transition-colors",
          open
            ? "bg-white/[0.1] text-white"
            : "text-white/60 hover:bg-white/[0.06] hover:text-white/85"
        )}
      >
        <KeyRound className="h-4 w-4" />
        <span className="flex-1 text-left">API 설정</span>
        {hasKey && (
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/90" title="키 등록됨" />
        )}
        <ChevronDown
          className={clsx(
            "h-3.5 w-3.5 text-white/40 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-2.5 px-1 pb-3 pt-1">
              <div className="flex gap-1.5">
                {(
                  [
                    { id: "openai" as const, label: "OpenAI" },
                    { id: "azure" as const, label: "Azure OpenAI" }
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProvider(p.id)}
                    className={clsx(
                      "flex-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors",
                      provider === p.id
                        ? "bg-white/15 text-white"
                        : "bg-white/[0.04] text-white/50 hover:bg-white/[0.08]"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {provider === "openai" ? (
                <label className="block">
                  <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-white/35">
                    Base URL
                  </span>
                  <input
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://api.openai.com/v1"
                    className="glass-input w-full !text-[11.5px] font-mono"
                  />
                </label>
              ) : (
                <>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-white/35">
                      Azure Endpoint
                    </span>
                    <input
                      value={azureEndpoint}
                      onChange={(e) => setAzureEndpoint(e.target.value)}
                      placeholder="https://YOUR_RESOURCE.openai.azure.com"
                      className="glass-input w-full !text-[11.5px] font-mono"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-white/35">
                      API Version
                    </span>
                    <input
                      value={azureApiVersion}
                      onChange={(e) => setAzureApiVersion(e.target.value)}
                      placeholder="2024-10-21"
                      className="glass-input w-full !text-[11.5px] font-mono"
                    />
                  </label>
                </>
              )}

              <label className="block">
                <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-white/35">
                  API Key
                </span>
                <input
                  type="password"
                  value={keyDirty ? apiKey : masked ? masked : apiKey}
                  onChange={(e) => {
                    setKeyDirty(true)
                    setApiKey(e.target.value)
                  }}
                  onFocus={() => {
                    if (!keyDirty && masked) {
                      setKeyDirty(true)
                      setApiKey("")
                    }
                  }}
                  placeholder="API key"
                  className="glass-input w-full !text-[11.5px] font-mono"
                  autoComplete="off"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-white/35">
                  {provider === "azure" ? "Deployment 이름" : "Model"}
                </span>
                <input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={provider === "azure" ? "gpt-4o" : "gpt-5.5"}
                  className="glass-input w-full !text-[11.5px]"
                />
              </label>

              {error && (
                <p className="text-[11px] text-red-300">{error}</p>
              )}

              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="glass-button-primary flex w-full items-center justify-center gap-1.5 !py-1.5 text-[12px]"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : saved ? (
                  <Check className="h-3.5 w-3.5" />
                ) : null}
                {saving ? "저장 중…" : saved ? "저장됨" : "저장"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
