"use client"

import { useCallback, useEffect, useState } from "react"
import { Plug, Plus, Trash2 } from "lucide-react"
import type { McpServerRecord } from "@/lib/types"

export default function McpPage() {
  const [servers, setServers] = useState<McpServerRecord[]>([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("")
  const [url, setUrl] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch("/api/mcp")
    if (res.ok) setServers(await res.json())
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const add = async () => {
    setError(null)
    const res = await fetch("/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, url, description })
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      setError(data?.error ?? "추가에 실패했습니다")
      return
    }
    setName("")
    setUrl("")
    setDescription("")
    setShowForm(false)
    load()
  }

  const toggle = async (server: McpServerRecord) => {
    await fetch("/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...server, enabled: !server.enabled })
    })
    load()
  }

  const remove = async (server: McpServerRecord) => {
    if (!confirm(`'${server.name}' 연결을 삭제할까요?`)) return
    await fetch(`/api/mcp/${server.id}`, { method: "DELETE" })
    load()
  }

  return (
    <div className="glass-panel flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
        <div>
          <h2 className="text-[16px] font-semibold text-white/90">MCP 연결 관리</h2>
          <p className="mt-0.5 text-[12px] text-white/40">
            연결 프로필만 저장됩니다 — stdio 실행·자격증명은 데스크톱 앱 로컬에서 처리
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="glass-button-primary flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" />
          연결 추가
        </button>
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
                placeholder="이름 (예: Jira MCP)"
                className="glass-input"
              />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="URL (https://... 또는 stdio://...)"
                className="glass-input"
              />
            </div>
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
              <button type="button" onClick={add} className="glass-button-primary">
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
                  <Plug className="h-4.5 w-4.5 h-[18px] w-[18px] text-white/60" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-white/90">
                    {server.name}
                  </p>
                  <p className="truncate text-[11px] text-white/40">
                    {server.url}
                    {server.description ? ` — ${server.description}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(server)}
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
                  onClick={() => remove(server)}
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
