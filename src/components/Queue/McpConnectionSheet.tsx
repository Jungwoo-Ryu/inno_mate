import React, { useEffect, useState } from "react"
import { Plug, Plus, RefreshCw, Trash2, X, FileJson } from "lucide-react"
import { useToast } from "../../contexts/toast"
import type { McpServerConfig } from "../../types/agents"

interface McpConnectionSheetProps {
  open: boolean
  onClose: () => void
}

function newServer(): McpServerConfig {
  return {
    id: `mcp-${Date.now()}`,
    name: "demo-mcp",
    url: "http://127.0.0.1:8000/mcp",
    endpointUrl: "http://127.0.0.1:8000/mcp",
    transport: "http",
    enabled: true,
    lastStatus: "disconnected"
  }
}

function argsToText(args?: string[]): string {
  return (args ?? []).join("\n")
}

function textToArgs(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
}

const McpConnectionSheet: React.FC<McpConnectionSheetProps> = ({
  open,
  onClose
}) => {
  const { showToast } = useToast()
  const [servers, setServers] = useState<McpServerConfig[]>([])
  const [testingId, setTestingId] = useState<string | null>(null)
  const [toolPreview, setToolPreview] = useState<
    Record<
      string,
      Array<{ name: string; description?: string; paramKeys?: string[] }>
    >
  >({})

  const loadServers = async () => {
    const list = await window.electronAPI.getMcpServers()
    setServers(list)
    const preview: Record<
      string,
      Array<{ name: string; description?: string; paramKeys?: string[] }>
    > = {}
    for (const s of list) {
      if (s.cachedTools?.length) {
        preview[s.id] = s.cachedTools.map((t) => ({
          name: t.name,
          description: t.description,
          paramKeys: t.paramKeys
        }))
      }
    }
    setToolPreview(preview)
  }

  useEffect(() => {
    if (open) void loadServers()
  }, [open])

  const handleRefreshAllTools = async () => {
    setTestingId("__all__")
    try {
      await window.electronAPI.saveMcpServers(servers)
      const result = await window.electronAPI.refreshMcpTools()
      await loadServers()
      const total = result.refreshed.reduce((n, r) => n + r.toolCount, 0)
      showToast(
        result.ok ? "캐시됨" : "일부 실패",
        `Super Agent용 MCP tools ${total}개 저장`,
        result.ok ? "success" : "error"
      )
    } catch {
      showToast("오류", "MCP tools 갱신 실패", "error")
    } finally {
      setTestingId(null)
    }
  }

  const persist = async (next: McpServerConfig[]) => {
    setServers(next)
    await window.electronAPI.saveMcpServers(next)
  }

  const patch = (
    id: string,
    partial: Partial<McpServerConfig>,
    save = false
  ) => {
    setServers((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, ...partial } : s))
      if (save) void window.electronAPI.saveMcpServers(next)
      return next
    })
  }

  const handleTest = async (server: McpServerConfig) => {
    setTestingId(server.id)
    try {
      // 화면에 보이는 최신값 먼저 저장
      const current = await new Promise<McpServerConfig[]>((resolve) => {
        setServers((prev) => {
          resolve(prev)
          return prev
        })
      })
      await window.electronAPI.saveMcpServers(current)
      const latest = current.find((s) => s.id === server.id) ?? server
      const result = await window.electronAPI.testMcpConnection(latest)
      const next = current.map((s) =>
        s.id === server.id
          ? {
              ...s,
              lastStatus: result.ok
                ? ("connected" as const)
                : ("error" as const),
              lastError: result.error
            }
          : s
      )
      await persist(next)
      if (result.ok && result.tools) {
        setToolPreview((prev) => ({
          ...prev,
          [server.id]: result.tools!.map((t) => ({
            name: t.name,
            description: t.description,
            paramKeys: t.paramKeys
          }))
        }))
      }
      // store에 cachedTools 반영됐을 수 있으므로 재로드
      await loadServers()
      showToast(
        result.ok ? "연결됨 · Super 캐시" : "연결 실패",
        result.ok
          ? `${server.name} · tools ${result.tools?.length ?? 0}개 저장`
          : (result.error ?? "연결 실패"),
        result.ok ? "success" : "error"
      )
    } finally {
      setTestingId(null)
    }
  }

  const handleImportJson = async () => {
    const raw = window.prompt(
      "Cursor mcp.json 내용을 붙여넣으세요 (mcpServers 객체 포함)"
    )
    if (!raw?.trim()) return
    try {
      const parsed = JSON.parse(raw) as unknown
      const result = await window.electronAPI.importCursorMcpJson(parsed)
      if (!result.success) {
        showToast("가져오기 실패", result.error ?? "오류", "error")
        return
      }
      setServers(result.servers ?? [])
      showToast(
        "가져오기 완료",
        `${result.servers?.length ?? 0}개 서버 등록`,
        "success"
      )
    } catch {
      showToast("가져오기 실패", "JSON 형식이 올바르지 않습니다", "error")
    }
  }

  if (!open) return null

  return (
    <div className="animate-in border-t border-white/[0.08] bg-black/40">
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Plug className="h-4 w-4 text-white/60" />
          <span className="text-[13px] font-medium text-white/90">MCP 연결</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void handleRefreshAllTools()}
            disabled={testingId === "__all__" || servers.length === 0}
            className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 disabled:opacity-40"
            title="전체 MCP tools → Super 캐시 갱신"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${testingId === "__all__" ? "animate-spin" : ""}`}
            />
          </button>
          <button
            type="button"
            onClick={() => void handleImportJson()}
            className="rounded-lg p-1.5 text-white/50 hover:bg-white/10"
            title="Cursor mcp.json 가져오기"
          >
            <FileJson className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => void persist([...servers, newServer()])}
            className="rounded-lg p-1.5 text-white/50 hover:bg-white/10"
            title="서버 추가"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/50 hover:bg-white/10"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="max-h-[320px] space-y-2 overflow-y-auto px-3 pb-3">
        {servers.length === 0 && (
          <p className="px-1 py-3 text-center text-[11px] text-white/35">
            MCP 서버가 없습니다. + 또는 JSON 가져오기로 추가하세요.
          </p>
        )}
        {servers.map((server) => {
          const transport = server.transport ?? "stdio"
          return (
            <div
              key={server.id}
              className="space-y-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5"
            >
              <div className="flex items-center gap-2">
                <input
                  value={server.name}
                  onChange={(e) => patch(server.id, { name: e.target.value })}
                  onBlur={() => patch(server.id, {}, true)}
                  className="flex-1 border-b border-transparent bg-transparent text-[13px] text-white/90 outline-none focus:border-white/20"
                />
                <span
                  className={`h-2 w-2 flex-shrink-0 rounded-full ${
                    server.lastStatus === "connected"
                      ? "bg-emerald-400"
                      : server.lastStatus === "error"
                        ? "bg-red-400"
                        : "bg-white/25"
                  }`}
                />
                <select
                  value={transport}
                  onChange={(e) => {
                    const t = e.target.value as McpServerConfig["transport"]
                    patch(server.id, { transport: t }, true)
                  }}
                  className="rounded-md border border-white/10 bg-black/40 px-1.5 py-0.5 text-[10px] text-white/70 outline-none"
                >
                  <option value="stdio">stdio</option>
                  <option value="http">http</option>
                  <option value="sse">sse</option>
                </select>
                <label className="flex items-center gap-1 text-[10px] text-white/50">
                  <input
                    type="checkbox"
                    checked={server.enabled}
                    onChange={(e) => {
                      patch(server.id, { enabled: e.target.checked }, true)
                    }}
                    className="rounded"
                  />
                  ON
                </label>
              </div>

              {transport === "stdio" ? (
                <>
                  <input
                    value={server.command ?? ""}
                    onChange={(e) =>
                      patch(server.id, { command: e.target.value })
                    }
                    onBlur={() => patch(server.id, {}, true)}
                    placeholder="command (예: uv)"
                    className="w-full rounded-lg border border-white/[0.06] bg-white/[0.04] px-2.5 py-1.5 font-mono text-[11px] text-white/80 outline-none placeholder:text-white/25 focus:border-white/15"
                  />
                  <textarea
                    value={argsToText(server.args)}
                    onChange={(e) =>
                      patch(server.id, { args: textToArgs(e.target.value) })
                    }
                    onBlur={() => patch(server.id, {}, true)}
                    placeholder={
                      "args (줄바꿈)\nrun\n--directory\n/path/to/mcp\ndemo-mcp"
                    }
                    rows={4}
                    className="w-full resize-y rounded-lg border border-white/[0.06] bg-white/[0.04] px-2.5 py-1.5 font-mono text-[11px] text-white/80 outline-none placeholder:text-white/25 focus:border-white/15"
                  />
                  <input
                    value={server.cwd ?? ""}
                    onChange={(e) => patch(server.id, { cwd: e.target.value })}
                    onBlur={() => patch(server.id, {}, true)}
                    placeholder="cwd (선택)"
                    className="w-full rounded-lg border border-white/[0.06] bg-white/[0.04] px-2.5 py-1.5 font-mono text-[11px] text-white/80 outline-none placeholder:text-white/25 focus:border-white/15"
                  />
                </>
              ) : (
                <input
                  value={server.endpointUrl || server.url}
                  onChange={(e) =>
                    patch(server.id, {
                      endpointUrl: e.target.value,
                      url: e.target.value
                    })
                  }
                  onBlur={() => patch(server.id, {}, true)}
                  placeholder="http://127.0.0.1:8000/mcp"
                  className="w-full rounded-lg border border-white/[0.06] bg-white/[0.04] px-2.5 py-1.5 font-mono text-[11px] text-white/80 outline-none placeholder:text-white/25 focus:border-white/15"
                />
              )}

              {toolPreview[server.id]?.length ? (
                <div className="space-y-1 rounded-lg border border-emerald-400/15 bg-emerald-400/5 px-2 py-1.5">
                  {toolPreview[server.id].map((t) => (
                    <div key={t.name} className="min-w-0">
                      <p className="truncate font-mono text-[10px] text-emerald-300/90">
                        {t.name}
                        {t.paramKeys?.length
                          ? `(${t.paramKeys.join(", ")})`
                          : ""}
                      </p>
                      {t.description ? (
                        <p className="truncate text-[9px] text-white/40">
                          {t.description}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="flex items-center justify-between">
                <span className="truncate text-[10px] text-white/35">
                  {server.lastError ??
                    (server.enabled ? "활성화됨" : "비활성화")}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => void handleTest(server)}
                    disabled={testingId === server.id}
                    className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[10px] text-white/70 hover:bg-white/15 disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${testingId === server.id ? "animate-spin" : ""}`}
                    />
                    테스트
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void persist(servers.filter((s) => s.id !== server.id))
                    }
                    className="rounded-lg p-1 text-white/40 hover:bg-red-500/15 hover:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default McpConnectionSheet
