import React, { useState, useEffect } from "react"
import { Camera, Bot, Plug } from "lucide-react"
import { useToast } from "../../contexts/toast"
import { COMMAND_KEY } from "../../utils/platform"
import QueueSettingsMenu from "./QueueSettingsMenu"
import ChatComposer from "./ChatComposer"
import AgentManagerSheet from "./AgentManagerSheet"
import McpConnectionSheet from "./McpConnectionSheet"
import type { AttachmentFile } from "../../types/agents"

interface QueuePanelProps {
  screenshotCount: number
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-md bg-white/10 border border-white/10 text-[10px] font-medium text-white/75 leading-none">
      {children}
    </kbd>
  )
}

function ActionTile({
  icon,
  label,
  subLabel,
  onClick,
  active
}: {
  icon: React.ReactNode
  label: string
  subLabel?: string
  onClick: () => void
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 py-2.5 px-1 rounded-2xl transition-all active:scale-[0.97] ${
        active
          ? "bg-white/[0.12] ring-1 ring-white/20"
          : "bg-white/[0.06] hover:bg-white/[0.1]"
      }`}
    >
      <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/10">
        {icon}
      </span>
      <span className="text-[11px] font-medium text-white/90 leading-none">{label}</span>
      {subLabel && (
        <span className="text-[9px] text-white/35 leading-none">{subLabel}</span>
      )}
    </button>
  )
}

const QueuePanel: React.FC<QueuePanelProps> = ({ screenshotCount }) => {
  const { showToast } = useToast()
  const [prompt, setPrompt] = useState("")
  const [attachments, setAttachments] = useState<AttachmentFile[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [showAgents, setShowAgents] = useState(false)
  const [showMcp, setShowMcp] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      window.electronAPI.setUserPrompt(prompt.trim() || undefined)
      window.electronAPI.setAttachments(attachments.map((a) => a.path))
    }, 300)
    return () => clearTimeout(timer)
  }, [prompt, attachments])

  useEffect(() => {
    const cleanupFunctions = [
      window.electronAPI.onAgentRunStart(() => setIsRunning(true)),
      window.electronAPI.onAgentRunSuccess(() => setIsRunning(false)),
      window.electronAPI.onAgentRunError(() => setIsRunning(false)),
      window.electronAPI.onProcessingNoScreenshots(() => setIsRunning(false)),
      window.electronAPI.onResetView(() => setIsRunning(false))
    ]
    return () => cleanupFunctions.forEach((cleanup) => cleanup())
  }, [])

  const handleScreenshot = async () => {
    try {
      const result = await window.electronAPI.triggerScreenshot()
      if (!result.success) {
        showToast("오류", "스크린샷 촬영에 실패했습니다", "error")
      }
    } catch {
      showToast("오류", "스크린샷 촬영에 실패했습니다", "error")
    }
  }

  const handleRun = async () => {
    const trimmed = prompt.trim()
    const hasInput = trimmed.length > 0 || attachments.length > 0

    if (screenshotCount === 0 && !hasInput) {
      showToast("안내", "스크린샷, 파일, 또는 업무 내용을 입력하세요", "neutral")
      return
    }
    setIsRunning(true)
    try {
      await window.electronAPI.setUserPrompt(trimmed || undefined)
      await window.electronAPI.setAttachments(attachments.map((a) => a.path))
      const result = await window.electronAPI.triggerProcessScreenshots(trimmed || undefined)
      if (!result.success) {
        showToast("오류", "Agent 실행에 실패했습니다", "error")
      } else {
        setPrompt("")
        setAttachments([])
      }
    } catch {
      showToast("오류", "Agent 실행에 실패했습니다", "error")
    } finally {
      setIsRunning(false)
    }
  }

  const toggleAgents = () => {
    setShowAgents((v) => !v)
    setShowMcp(false)
  }

  const toggleMcp = () => {
    setShowMcp((v) => !v)
    setShowAgents(false)
  }

  return (
    <div className="innomate-panel mx-auto">
      <div className="relative rounded-[22px] border border-white/[0.12] bg-black/70 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden">
        {isRunning && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[22px] bg-black/60 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
              <p className="text-[11px] text-white/60">OCR 텍스트 추출 중…</p>
            </div>
          </div>
        )}
        <div className="absolute top-3 right-3 z-10">
          <QueueSettingsMenu screenshotCount={screenshotCount} />
        </div>

        {/* 주요 액션 — 3열 */}
        <div className="px-3 pt-4 pb-2">
          <div className="grid grid-cols-3 gap-1.5">
            <ActionTile
              icon={<Camera className="w-4 h-4 text-white/90" />}
              label="스크린샷"
              subLabel={`${COMMAND_KEY} H`}
              onClick={handleScreenshot}
            />
            <ActionTile
              icon={<Bot className="w-4 h-4 text-white/90" />}
              label="에이전트"
              subLabel="관리"
              onClick={toggleAgents}
              active={showAgents}
            />
            <ActionTile
              icon={<Plug className="w-4 h-4 text-white/90" />}
              label="MCP"
              subLabel="연결"
              onClick={toggleMcp}
              active={showMcp}
            />
          </div>
        </div>

        <AgentManagerSheet open={showAgents} onClose={() => setShowAgents(false)} />
        <McpConnectionSheet open={showMcp} onClose={() => setShowMcp(false)} />

        {/* 보조 단축키 */}
        <div className="px-3 pb-2 flex flex-wrap items-center justify-center gap-1.5">
          {[
            { label: "실행", keys: [COMMAND_KEY, "↵"] },
            { label: "창 숨김", keys: [COMMAND_KEY, "B"] },
            { label: "모니터", keys: [COMMAND_KEY, "\\"] },
            { label: "삭제", keys: [COMMAND_KEY, "L"] },
            { label: "초기화", keys: [COMMAND_KEY, "R"] }
          ].map(({ label, keys }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/[0.05] text-[10px] text-white/45"
            >
              {label}
              {keys.map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </span>
          ))}
          {screenshotCount > 0 && (
            <span className="inline-flex items-center px-2 py-1 rounded-full bg-emerald-500/10 text-[10px] text-emerald-400/90">
              {screenshotCount}장 캡처
            </span>
          )}
        </div>

        {/* 채팅 입력 */}
        <div className="px-3 pb-3 border-t border-white/[0.06] pt-3">
          <ChatComposer
            value={prompt}
            onChange={setPrompt}
            onSubmit={handleRun}
            attachments={attachments}
            onAttachmentsChange={setAttachments}
            isRunning={isRunning}
            placeholder="G-portal 업무 내용 입력…"
          />
        </div>
      </div>
    </div>
  )
}

export default QueuePanel
