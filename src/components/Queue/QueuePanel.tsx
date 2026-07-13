import React, { useState, useEffect, useCallback } from "react"
import { Camera, Bot, Plug } from "lucide-react"
import { useToast } from "../../contexts/toast"
import { COMMAND_KEY } from "../../utils/platform"
import QueueSettingsMenu from "./QueueSettingsMenu"
import ChatComposer from "./ChatComposer"
import ChatLog from "./ChatLog"
import AgentManagerSheet from "./AgentManagerSheet"
import McpConnectionSheet from "./McpConnectionSheet"
import type { AttachmentFile } from "../../types/agents"
import type { AgentTaskResult, DisplayMessage } from "../../types/chat"

interface QueuePanelProps {
  screenshotCount: number
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-md border border-white/10 bg-white/10 px-1 text-[10px] font-medium leading-none text-white/75">
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
      className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2.5 transition-all active:scale-[0.97] ${
        active
          ? "bg-white/[0.12] ring-1 ring-white/20"
          : "bg-white/[0.06] hover:bg-white/[0.1]"
      }`}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10">
        {icon}
      </span>
      <span className="text-[11px] font-medium leading-none text-white/90">
        {label}
      </span>
      {subLabel && (
        <span className="text-[9px] leading-none text-white/35">{subLabel}</span>
      )}
    </button>
  )
}

let msgSeq = 0
function nextMsgId(prefix: string): string {
  msgSeq += 1
  return `${prefix}-${Date.now()}-${msgSeq}`
}

const QueuePanel: React.FC<QueuePanelProps> = ({ screenshotCount }) => {
  const { showToast } = useToast()
  const [prompt, setPrompt] = useState("")
  const [attachments, setAttachments] = useState<AttachmentFile[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [resuming, setResuming] = useState(false)
  const [showAgents, setShowAgents] = useState(false)
  const [showMcp, setShowMcp] = useState(false)
  const [messages, setMessages] = useState<DisplayMessage[]>([])

  useEffect(() => {
    const timer = setTimeout(() => {
      window.electronAPI.setUserPrompt(prompt.trim() || undefined)
      window.electronAPI.setAttachments(attachments.map((a) => a.path))
    }, 300)
    return () => clearTimeout(timer)
  }, [prompt, attachments])

  const appendUserFromTurn = useCallback(
    (data: {
      content?: string
      screenshotCount?: number
      attachmentCount?: number
      hitlResume?: boolean
    }) => {
      // 글로벌 Cmd+Enter 경로에서도 입력창 비움
      if (!data.hitlResume) {
        setPrompt("")
        setAttachments([])
      }

      const parts: string[] = []
      if (data.hitlResume) {
        parts.push(`추가 입력: ${data.content || ""}`)
      } else if (data.content?.trim()) {
        parts.push(data.content.trim())
      }
      if (!data.hitlResume && data.screenshotCount && data.screenshotCount > 0) {
        parts.push(`[스크린샷 ${data.screenshotCount}장]`)
      }
      if (!data.hitlResume && data.attachmentCount && data.attachmentCount > 0) {
        parts.push(`[첨부 ${data.attachmentCount}개]`)
      }
      const content = parts.filter(Boolean).join("\n")
      if (!content) return

      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last?.role === "user" && last.content === content) return prev
        return [
          ...prev,
          {
            id: nextMsgId("u"),
            role: "user",
            content
          }
        ]
      })
    },
    []
  )

  useEffect(() => {
    const cleanupFunctions = [
      window.electronAPI.onAgentUserTurn(appendUserFromTurn),
      window.electronAPI.onAgentRunStart(() => setIsRunning(true)),
      window.electronAPI.onAgentRunSuccess((raw: unknown) => {
        setIsRunning(false)
        setResuming(false)
        const data = raw as AgentTaskResult
        const missingFieldDefs =
          data.missingFieldDefs ??
          (data.missingFields ?? []).map((key) => ({
            key,
            label: key,
            type: "string" as const,
            required: true
          }))

        setMessages((prev) => {
          // 이전 needs_input 폼은 닫기 (재개 후 새 응답으로 교체)
          const closed = prev.map((m) =>
            m.status === "needs_input" && m.hitl
              ? { ...m, hitl: null, status: "needs_input" as const }
              : m
          )
          return [
            ...closed,
            {
              id: nextMsgId("a"),
              role: "assistant" as const,
              content: data.message_ko || "(응답 없음)",
              status: (data.status as DisplayMessage["status"]) || "success",
              agentId: data.agentId,
              hitl:
                data.status === "needs_input" && missingFieldDefs.length
                  ? {
                      runId: data.runId,
                      agentId: data.agentId,
                      missingFieldDefs,
                      collectedFields: data.collectedFields ?? {}
                    }
                  : null
            }
          ]
        })
      }),
      window.electronAPI.onAgentRunError((error: string) => {
        setIsRunning(false)
        setResuming(false)
        setMessages((prev) => [
          ...prev,
          {
            id: nextMsgId("e"),
            role: "assistant",
            content: error,
            status: "error"
          }
        ])
      }),
      window.electronAPI.onProcessingNoScreenshots(() => {
        setIsRunning(false)
        showToast("안내", "스크린샷, 파일, 또는 업무 내용을 입력하세요", "neutral")
      }),
      window.electronAPI.onResetView(() => {
        setIsRunning(false)
        setResuming(false)
        setMessages([])
        setPrompt("")
        setAttachments([])
      })
    ]
    return () => cleanupFunctions.forEach((cleanup) => cleanup())
  }, [appendUserFromTurn, showToast])

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
    const attachmentPaths = attachments.map((a) => a.path)
    const hasInput = trimmed.length > 0 || attachmentPaths.length > 0

    if (screenshotCount === 0 && !hasInput) {
      showToast("안내", "스크린샷, 파일, 또는 업무 내용을 입력하세요", "neutral")
      return
    }

    // 메신저처럼 전송 즉시 입력창 비움
    setPrompt("")
    setAttachments([])
    setIsRunning(true)

    try {
      await window.electronAPI.setUserPrompt(trimmed || undefined)
      await window.electronAPI.setAttachments(attachmentPaths)
      const result = await window.electronAPI.triggerProcessScreenshots(
        trimmed || undefined
      )
      if (!result.success) {
        showToast("오류", "Agent 실행에 실패했습니다", "error")
        setIsRunning(false)
      }
    } catch {
      showToast("오류", "Agent 실행에 실패했습니다", "error")
      setIsRunning(false)
    }
  }

  const handleResume = async (
    _runId: string | undefined,
    fields: Record<string, string>
  ) => {
    setResuming(true)
    setIsRunning(true)
    try {
      const result = await window.electronAPI.resumeAgentRun(fields)
      if (!result.success) {
        showToast("오류", result.error || "HITL 재개에 실패했습니다", "error")
        setResuming(false)
        setIsRunning(false)
      }
    } catch {
      showToast("오류", "HITL 재개에 실패했습니다", "error")
      setResuming(false)
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
    <div className="innomate-panel relative mx-auto">
      <div className="absolute top-3 right-3 z-30">
        <QueueSettingsMenu screenshotCount={screenshotCount} />
      </div>

      <div className="relative overflow-hidden rounded-[22px] border border-white/[0.12] bg-black/70 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
        {/* 로고 — 상단 중앙 */}
        <div className="flex flex-col items-center px-3 pt-4 pb-3">
          <img
            src="/innomate-icon.png"
            alt="InnoMate"
            className="mb-1.5 h-11 w-11 rounded-[14px] object-cover"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = "none"
            }}
          />
          <p className="text-[15px] font-semibold tracking-tight text-white">
            <span className="text-white/90">Inno</span>
            <span className="text-red-500">Mate</span>
          </p>
        </div>

        {/* 주요 액션 */}
        <div className="px-3 pb-2">
          <div className="grid grid-cols-3 gap-1.5">
            <ActionTile
              icon={<Camera className="h-4 w-4 text-white/90" />}
              label="스크린샷"
              subLabel={`${COMMAND_KEY} H`}
              onClick={handleScreenshot}
            />
            <ActionTile
              icon={<Bot className="h-4 w-4 text-white/90" />}
              label="에이전트"
              subLabel="관리"
              onClick={toggleAgents}
              active={showAgents}
            />
            <ActionTile
              icon={<Plug className="h-4 w-4 text-white/90" />}
              label="MCP"
              subLabel="연결"
              onClick={toggleMcp}
              active={showMcp}
            />
          </div>
        </div>

        <AgentManagerSheet
          open={showAgents}
          onClose={() => setShowAgents(false)}
        />
        <McpConnectionSheet open={showMcp} onClose={() => setShowMcp(false)} />

        {/* 보조 단축키 */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 px-3 pb-2">
          {[
            { label: "실행", keys: [COMMAND_KEY, "↵"] },
            { label: "창 숨김", keys: [COMMAND_KEY, "B"] },
            { label: "모니터", keys: [COMMAND_KEY, "\\"] },
            { label: "삭제", keys: [COMMAND_KEY, "L"] },
            { label: "초기화", keys: [COMMAND_KEY, "R"] }
          ].map(({ label, keys }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-2 py-1 text-[10px] text-white/45"
            >
              {label}
              {keys.map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </span>
          ))}
          {screenshotCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-400/90">
              {screenshotCount}장 캡처
            </span>
          )}
        </div>

        {/* 채팅 로그 + HITL */}
        {(messages.length > 0 || isRunning) && (
          <div className="border-t border-white/[0.06] px-3 py-2">
            <ChatLog
              messages={messages}
              isRunning={isRunning}
              onResume={handleResume}
              resuming={resuming}
            />
          </div>
        )}

        {/* 채팅 입력 */}
        <div className="border-t border-white/[0.06] px-3 pb-3 pt-3">
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
