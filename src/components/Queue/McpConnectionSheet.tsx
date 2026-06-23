import React, { useEffect, useState } from "react"
import { Plug, Plus, RefreshCw, Trash2, X } from "lucide-react"
import { useToast } from "../../contexts/toast"
import type { McpServerConfig } from "../../types/agents"

interface McpConnectionSheetProps {
  open: boolean
  onClose: () => void
}

function newServer(): McpServerConfig {
  return {
    id: `mcp-${Date.now()}`,
    name: "새 MCP 서버",
    url: "",
    enabled: false,
    lastStatus: "disconnected"
  }
}

const McpConnectionSheet: React.FC<McpConnectionSheetProps> = ({ open, onClose }) => {
  const { showToast } = useToast()
  const [servers, setServers] = useState<McpServerConfig[]>([])
  const [testingId, setTestingId] = useState<string | null>(null)

  const loadServers = async () => {
    const list = await window.electronAPI.getMcpServers()
    setServers(list)
  }

  useEffect(() => {
    if (open) loadServers()
  }, [open])

  const persist = async (next: McpServerConfig[]) => {
    setServers(next)
    await window.electronAPI.saveMcpServers(next)
  }

  const handleTest = async (server: McpServerConfig) => {
    setTestingId(server.id)
    try {
      const result = await window.electronAPI.testMcpConnection(server)
      const next = servers.map((s) =>
        s.id === server.id
          ? {
              ...s,
              lastStatus: result.ok ? ("connected" as const) : ("error" as const),
              lastError: result.error
            }
          : s
      )
      await persist(next)
      showToast(
        result.ok ? "연결됨" : "연결 실패",
        result.ok ? `${server.name} 연결 확인` : result.error ?? "연결 실패",
        result.ok ? "success" : "error"
      )
    } finally {
      setTestingId(null)
    }
  }

  if (!open) return null

  return (
    <div className="border-t border-white/[0.08] bg-black/40 animate-in">
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Plug className="w-4 h-4 text-white/60" />
          <span className="text-[13px] font-medium text-white/90">MCP 연결</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => persist([...servers, newServer()])}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/50"
            title="서버 추가"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="px-3 pb-3 space-y-2 max-h-[220px] overflow-y-auto">
        {servers.map((server) => (
          <div
            key={server.id}
            className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 space-y-2"
          >
            <div className="flex items-center gap-2">
              <input
                value={server.name}
                onChange={(e) => {
                  const next = servers.map((s) =>
                    s.id === server.id ? { ...s, name: e.target.value } : s
                  )
                  setServers(next)
                }}
                onBlur={() => persist(servers)}
                className="flex-1 bg-transparent text-[13px] text-white/90 outline-none border-b border-transparent focus:border-white/20"
              />
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  server.lastStatus === "connected"
                    ? "bg-emerald-400"
                    : server.lastStatus === "error"
                    ? "bg-red-400"
                    : "bg-white/25"
                }`}
              />
              <label className="flex items-center gap-1 text-[10px] text-white/50">
                <input
                  type="checkbox"
                  checked={server.enabled}
                  onChange={(e) => {
                    const next = servers.map((s) =>
                      s.id === server.id ? { ...s, enabled: e.target.checked } : s
                    )
                    persist(next)
                  }}
                  className="rounded"
                />
                ON
              </label>
            </div>
            <input
              value={server.url}
              onChange={(e) => {
                const next = servers.map((s) =>
                  s.id === server.id ? { ...s, url: e.target.value } : s
                )
                setServers(next)
              }}
              onBlur={() => persist(servers)}
              placeholder="stdio://server 또는 https://..."
              className="w-full bg-white/[0.04] rounded-lg px-2.5 py-1.5 text-[11px] text-white/80 placeholder:text-white/25 outline-none border border-white/[0.06] focus:border-white/15"
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/35 truncate">
                {server.lastError ?? (server.enabled ? "활성화됨" : "비활성화")}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => handleTest(server)}
                  disabled={testingId === server.id}
                  className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white/70 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${testingId === server.id ? "animate-spin" : ""}`} />
                  테스트
                </button>
                <button
                  type="button"
                  onClick={() => persist(servers.filter((s) => s.id !== server.id))}
                  className="p-1 rounded-lg hover:bg-red-500/15 text-white/40 hover:text-red-400"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default McpConnectionSheet
