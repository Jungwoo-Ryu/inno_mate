"use client"

import { useCallback, useEffect, useState } from "react"
import { Bot, Pencil, Plus, Trash2 } from "lucide-react"
import type { AgentRecord } from "@/lib/types"
import AgentEditor from "@/components/AgentEditor"

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentRecord[]>([])
  const [editing, setEditing] = useState<AgentRecord | "new" | null>(null)

  const load = useCallback(async () => {
    const res = await fetch("/api/agents")
    if (res.ok) setAgents(await res.json())
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const toggleEnabled = async (agent: AgentRecord) => {
    await fetch(`/api/agents/${agent.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !agent.enabled })
    })
    load()
  }

  const remove = async (agent: AgentRecord) => {
    if (!confirm(`'${agent.name}' 에이전트를 삭제할까요?`)) return
    await fetch(`/api/agents/${agent.id}`, { method: "DELETE" })
    load()
  }

  if (editing) {
    return (
      <AgentEditor
        agent={editing === "new" ? null : editing}
        onClose={() => {
          setEditing(null)
          load()
        }}
      />
    )
  }

  return (
    <div className="glass-panel flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
        <div>
          <h2 className="text-[16px] font-semibold text-white/90">에이전트 레지스트리</h2>
          <p className="mt-0.5 text-[12px] text-white/40">
            여기 등록된 에이전트를 데스크톱 앱의 Super Agent가 동기화해 사용합니다
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="glass-button-primary flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" />
          에이전트 등록
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {agents.length === 0 ? (
          <p className="py-12 text-center text-[13px] text-white/35">
            등록된 에이전트가 없습니다
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {agents.map((agent) => (
              <div key={agent.id} className="glass-inset p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.07]">
                      <Bot className="h-5 w-5 text-red-500/80" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-white/90">
                        {agent.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-white/40">
                        {agent.id} · v{agent.version} · {agent.model}
                      </p>
                    </div>
                  </div>
                  {/* 활성 토글 */}
                  <button
                    type="button"
                    onClick={() => toggleEnabled(agent)}
                    className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
                      agent.enabled ? "bg-emerald-500/80" : "bg-white/15"
                    }`}
                    title={agent.enabled ? "활성" : "비활성"}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                        agent.enabled ? "left-[22px]" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {agent.tools.slice(0, 4).map((tool) => (
                    <span
                      key={tool}
                      className="rounded-lg bg-black/30 px-2 py-0.5 text-[10.5px] text-white/50"
                    >
                      {tool}
                    </span>
                  ))}
                  {agent.tools.length > 4 && (
                    <span className="rounded-lg bg-black/30 px-2 py-0.5 text-[10.5px] text-white/35">
                      +{agent.tools.length - 4}
                    </span>
                  )}
                </div>

                {agent.delegates.length > 0 && (
                  <p className="mt-2 truncate text-[11px] text-white/35">
                    위임: {agent.delegates.join(", ")}
                  </p>
                )}

                <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-white/[0.06] pt-3">
                  <button
                    type="button"
                    onClick={() => setEditing(agent)}
                    className="glass-button flex items-center gap-1.5 !py-1.5 text-[12px]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    편집
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(agent)}
                    className="rounded-xl p-2 text-white/40 transition-colors hover:bg-red-500/15 hover:text-red-300"
                    title="삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
