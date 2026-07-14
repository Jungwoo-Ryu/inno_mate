"use client"

import { useCallback, useEffect, useState } from "react"
import { FileJson, Plug, Plus, Trash2 } from "lucide-react"
import type { McpServerRecord } from "@/lib/types"

export default function McpPage() {
  const [servers, setServers] = useState<McpServerRecord[]>([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("demo-mcp")
  const [transport, setTransport] = useState<"stdio" | "http" | "sse">("http")
  const [command, setCommand] = useState("uv")
  const [argsText, setArgsText] = useState(
    "run\n--directory\n/Users/wassabik/Desktop/innotek/mcp\ndemo-mcp"
  )
  const [cwd, setCwd] = useState("")
  const [url, setUrl] = useState("http://127.0.0.1:8000/mcp")
  const [description, setDescription] = useState("")
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch("/api/mcp")
    if (res.ok) setServers(await res.json())
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const add = async () => {
    setError(null)
    const args = argsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
    const res = await fetch("/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description,
        transport,
        command: transport === "stdio" ? command : undefined,
        args: transport === "stdio" ? args : undefined,
        cwd: transport === "stdio" ? cwd || undefined : undefined,
        url: transport === "stdio" ? `stdio://${name}` : url,
        endpointUrl: transport !== "stdio" ? url : undefined
      })
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      setError(data?.error ?? "추가에 실패했습니다")
      return
    }
    setShowForm(false)
    void load()
  }

  const importJson = async () => {
    const raw = window.prompt("Cursor mcp.json 붙여넣기")
    if (!raw?.trim()) return
    try {
      const parsed = JSON.parse(raw) as {
        mcpServers?: Record<
          string,
          { command?: string; args?: string[]; cwd?: string; url?: string }
        >
      }
      const entries = parsed.mcpServers ?? {}
      for (const [id, entry] of Object.entries(entries)) {
        await fetch("/api/mcp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: id,
            transport: entry.command ? "stdio" : "http",
            command: entry.command,
            args: entry.args,
            cwd: entry.cwd,
            url: entry.url || (entry.command ? `stdio://${id}` : ""),
            endpointUrl: entry.url,
            enabled: true
          })
        })
      }
      void load()
    } catch {
      setError("JSON 파싱 실패")
    }
  }

  const toggle = async (server: McpServerRecord) => {
    await fetch("/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...server, enabled: !server.enabled })
    })
    void load()
  }

  const remove = async (server: McpServerRecord) => {
    if (!confirm(`'${server.name}' 연결을 삭제할까요?`)) return
    await fetch(`/api/mcp/${server.id}`, { method: "DELETE" })
    void load()
  }

  return (
    <div className="glass-panel flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
        <div>
          <h2 className="text-[16px] font-semibold text-white/90">MCP 연결 관리</h2>
          <p className="mt-0.5 text-[12px] text-white/40">
            Cursor mcp.json 호환 (command/args/cwd 또는 URL) — 실행·테스트는 데스크톱에서
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void importJson()}
            className="glass-button flex items-center gap-1.5"
          >
            <FileJson className="h-4 w-4" />
            JSON 가져오기
          </button>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="glass-button-primary flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            연결 추가
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {showForm && (
          <div className="glass-inset mb-4 space-y-3 p-4">
            {error && (
              <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
                {error}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름 (예: demo-mcp)"
                className="glass-input"
              />
              <select
                value={transport}
                onChange={(e) =>
                  setTransport(e.target.value as "stdio" | "http" | "sse")
                }
                className="glass-input"
              >
                <option value="stdio">stdio (command/args)</option>
                <option value="http">http</option>
                <option value="sse">sse</option>
              </select>
            </div>
            {transport === "stdio" ? (
              <>
                <input
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="command (uv)"
                  className="glass-input font-mono text-[12px]"
                />
                <textarea
                  value={argsText}
                  onChange={(e) => setArgsText(e.target.value)}
                  rows={4}
                  placeholder={"args 줄바꿈\nrun\n--directory\n/path\ndemo-mcp"}
                  className="glass-input w-full font-mono text-[12px]"
                />
                <input
                  value={cwd}
                  onChange={(e) => setCwd(e.target.value)}
                  placeholder="cwd (선택)"
                  className="glass-input font-mono text-[12px]"
                />
              </>
            ) : (
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://127.0.0.1:8000/mcp"
                className="glass-input font-mono text-[12px]"
              />
            )}
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="설명 (선택)"
              className="glass-input w-full"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="glass-button">
                취소
              </button>
              <button type="button" onClick={() => void add()} className="glass-button-primary">
                저장
              </button>
            </div>
          </div>
        )}

        {servers.length === 0 ? (
          <p className="py-12 text-center text-[13px] text-white/35">
            등록된 MCP 연결이 없습니다
          </p>
        ) : (
          <div className="space-y-2.5">
            {servers.map((server) => (
              <div
                key={server.id}
                className="glass-inset flex items-center gap-3 px-4 py-3"
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.07]">
                  <Plug className="h-[18px] w-[18px] text-white/60" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-white/90">
                    {server.name}{" "}
                    <span className="text-[11px] font-normal text-white/35">
                      {server.transport || "stdio"}
                    </span>
                  </p>
                  <p className="truncate font-mono text-[11px] text-white/40">
                    {server.command
                      ? `${server.command} ${(server.args ?? []).join(" ")}`
                      : server.endpointUrl || server.url}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void toggle(server)}
                  className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
                    server.enabled ? "bg-emerald-500/80" : "bg-white/15"
                  }`}
                  title={server.enabled ? "활성" : "비활성"}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      server.enabled ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => void remove(server)}
                  className="flex-shrink-0 rounded-xl p-2 text-white/40 transition-colors hover:bg-red-500/15 hover:text-red-300"
                  title="삭제"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
