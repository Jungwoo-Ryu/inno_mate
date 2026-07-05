"use client"

import { useState } from "react"
import { ArrowLeft, Save } from "lucide-react"
import type { AgentRecord } from "@/lib/types"

interface AgentEditorProps {
  agent: AgentRecord | null
  onClose: () => void
}

export default function AgentEditor({ agent, onClose }: AgentEditorProps) {
  const isNew = agent === null
  const [id, setId] = useState(agent?.id ?? "")
  const [name, setName] = useState(agent?.name ?? "")
  const [version, setVersion] = useState(agent?.version ?? "1.0.0")
  const [model, setModel] = useState(agent?.model ?? "gpt-5.5")
  const [classifierModel, setClassifierModel] = useState(
    agent?.classifierModel ?? "gpt-5.4-mini"
  )
  const [tools, setTools] = useState(agent?.tools.join("\n") ?? "")
  const [delegates, setDelegates] = useState(agent?.delegates.join(", ") ?? "")
  const [guide, setGuide] = useState(agent?.guide ?? "")
  const [enabled, setEnabled] = useState(agent?.enabled ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (!id.trim()) {
      setError("에이전트 ID를 입력하세요")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        id: id.trim(),
        name: name.trim() || id.trim(),
        version: version.trim() || "1.0.0",
        model: model.trim(),
        classifierModel: classifierModel.trim(),
        tools: tools
          .split("\n")
          .map((t) => t.trim())
          .filter(Boolean),
        delegates: delegates
          .split(",")
          .map((d) => d.trim())
          .filter(Boolean),
        guide,
        enabled
      }

      const res = await fetch(isNew ? "/api/agents" : `/api/agents/${agent.id}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? "저장에 실패했습니다")
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="glass-panel flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white/85"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h2 className="text-[16px] font-semibold text-white/90">
            {isNew ? "에이전트 등록" : `${agent.name} 편집`}
          </h2>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="glass-button-primary flex items-center gap-1.5"
        >
          <Save className="h-4 w-4" />
          {saving ? "저장 중…" : "저장"}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-[860px] space-y-5">
          {error && (
            <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-[12.5px] text-red-300">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-white/60">
                에이전트 ID (영문 소문자·하이픈)
              </span>
              <input
                value={id}
                onChange={(e) => setId(e.target.value)}
                disabled={!isNew}
                placeholder="purchase-order"
                className="glass-input w-full disabled:opacity-50"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-white/60">
                표시 이름
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="구매 발주"
                className="glass-input w-full"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-white/60">버전</span>
              <input
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="glass-input w-full"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-white/60">
                실행 모델
              </span>
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="gpt-5.5"
                className="glass-input w-full"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-white/60">
                분류 모델
              </span>
              <input
                value={classifierModel}
                onChange={(e) => setClassifierModel(e.target.value)}
                placeholder="gpt-5.4-mini"
                className="glass-input w-full"
              />
            </label>
            <label className="flex items-end gap-2 pb-1">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4 accent-emerald-500"
              />
              <span className="text-[13px] text-white/70">
                활성화 (데스크톱 앱에 동기화)
              </span>
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-white/60">
              도구 목록 (줄바꿈으로 구분 — 실행 구현은 데스크톱에 있어야 합니다)
            </span>
            <textarea
              value={tools}
              onChange={(e) => setTools(e.target.value)}
              rows={4}
              placeholder={"gportal.ensure_session\ngportal.navigate\nvacation.apply"}
              className="glass-input w-full resize-y font-mono text-[12px]"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-white/60">
              위임 에이전트 (쉼표로 구분 — Super Agent용)
            </span>
            <input
              value={delegates}
              onChange={(e) => setDelegates(e.target.value)}
              placeholder="meeting-room, vacation"
              className="glass-input w-full"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-white/60">
              GUIDE.md (시스템 프롬프트 — 역할·워크플로·출력 형식)
            </span>
            <textarea
              value={guide}
              onChange={(e) => setGuide(e.target.value)}
              rows={18}
              placeholder={"# Agent: my-agent\n\n## Role\n..."}
              className="glass-input w-full resize-y font-mono text-[12px] leading-relaxed"
            />
          </label>
        </div>
      </div>
    </div>
  )
}
