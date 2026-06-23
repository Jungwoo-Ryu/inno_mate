import React, { useEffect, useState } from "react"
import { Bot, FolderOpen, RefreshCw, X } from "lucide-react"
import { useToast } from "../../contexts/toast"
import { AGENT_LABELS, type AgentSummary } from "../../types/agents"

interface AgentManagerSheetProps {
  open: boolean
  onClose: () => void
}

const AgentManagerSheet: React.FC<AgentManagerSheetProps> = ({ open, onClose }) => {
  const { showToast } = useToast()
  const [agents, setAgents] = useState<AgentSummary[]>([])
  const [loading, setLoading] = useState(false)

  const loadAgents = async () => {
    setLoading(true)
    try {
      const list = await window.electronAPI.listAgents()
      setAgents(list)
    } catch {
      showToast("오류", "에이전트 목록을 불러오지 못했습니다", "error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) loadAgents()
  }, [open])

  if (!open) return null

  return (
    <div className="border-t border-white/[0.08] bg-black/40 animate-in">
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-white/60" />
          <span className="text-[13px] font-medium text-white/90">에이전트 관리</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => window.electronAPI.openAgentsDirectory()}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/50"
            title="에이전트 폴더 열기"
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={loadAgents}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/50"
            title="새로고침"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/50"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="px-3 pb-3 space-y-2 max-h-[200px] overflow-y-auto">
        {agents.length === 0 && !loading && (
          <p className="text-center text-[12px] text-white/40 py-4">등록된 에이전트가 없습니다</p>
        )}
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-white/90 truncate">
                  {AGENT_LABELS[agent.id] ?? agent.id}
                </p>
                <p className="text-[10px] text-white/40 mt-0.5">
                  v{agent.version} · {agent.model} · 도구 {agent.tools.length}개
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const ok = await window.electronAPI.reloadAgent(agent.id)
                  showToast(
                    ok.success ? "완료" : "오류",
                    ok.success ? `${AGENT_LABELS[agent.id] ?? agent.id} 재로드됨` : "재로드 실패",
                    ok.success ? "success" : "error"
                  )
                }}
                className="flex-shrink-0 text-[10px] px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white/70"
              >
                재로드
              </button>
            </div>
            {agent.delegates.length > 0 && (
              <p className="text-[10px] text-white/35 mt-1.5 truncate">
                위임: {agent.delegates.join(", ")}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default AgentManagerSheet
