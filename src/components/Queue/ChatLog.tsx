import React, { useEffect, useRef } from "react"
import type { DisplayMessage } from "../../types/chat"
import MissingFieldsForm from "./MissingFieldsForm"

const AGENT_LABELS: Record<string, string> = {
  super: "Super Agent",
  "meeting-room": "회의실",
  "asset-export": "자산 반출",
  vacation: "휴가"
}

export default function ChatLog({
  messages,
  isRunning,
  onResume,
  resuming
}: {
  messages: DisplayMessage[]
  isRunning?: boolean
  onResume: (runId: string | undefined, fields: Record<string, string>) => void
  resuming?: boolean
}) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, isRunning])

  if (!messages.length && !isRunning) return null

  return (
    <div className="max-h-[220px] space-y-2 overflow-y-auto px-1 py-1">
      {messages.map((msg) => {
        const isUser = msg.role === "user"
        const showHitl =
          msg.role === "assistant" &&
          msg.status === "needs_input" &&
          msg.hitl?.missingFieldDefs?.length

        return (
          <div
            key={msg.id}
            className={`flex ${isUser ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[92%] rounded-2xl px-3 py-2 text-[12px] leading-relaxed ${
                isUser
                  ? "bg-white/15 text-white/90"
                  : msg.status === "error"
                  ? "bg-red-500/10 text-red-100/90 ring-1 ring-red-400/20"
                  : msg.status === "needs_input"
                  ? "bg-amber-500/10 text-white/85 ring-1 ring-amber-400/20"
                  : "bg-white/[0.07] text-white/85"
              }`}
            >
              {!isUser && msg.agentId && (
                <p className="mb-1 text-[9px] uppercase tracking-wider text-white/35">
                  {AGENT_LABELS[msg.agentId] ?? msg.agentId}
                  {msg.status === "needs_input"
                    ? " · 입력 필요"
                    : msg.status === "success"
                    ? " · 완료"
                    : ""}
                </p>
              )}
              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
              {showHitl && msg.hitl && (
                <MissingFieldsForm
                  fields={msg.hitl.missingFieldDefs}
                  initial={msg.hitl.collectedFields}
                  submitting={resuming}
                  onSubmit={(values) => onResume(msg.hitl?.runId, values)}
                />
              )}
            </div>
          </div>
        )
      })}
      {isRunning && (
        <div className="flex justify-start">
          <div className="rounded-2xl bg-white/[0.07] px-3 py-2 text-[11px] text-white/50">
            Super Agent 실행 중…
          </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  )
}
