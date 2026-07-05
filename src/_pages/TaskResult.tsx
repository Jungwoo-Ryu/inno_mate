import React, { useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { COMMAND_KEY } from "../utils/platform"
import { useContentDimensions } from "../hooks/useContentDimensions"

export interface TaskResultData {
  agentId: string
  status: string
  message_ko: string
  data?: Record<string, unknown>
  missingFields?: string[]
}

interface TaskResultProps {
  setView: (view: "queue" | "result") => void
}

const AGENT_LABELS: Record<string, string> = {
  "local-ocr": "로컬 OCR (PoC)",
  "meeting-room": "회의실 예약",
  "asset-export": "자산 반출",
  vacation: "휴가 신청",
  super: "Super Agent"
}

const TaskResult: React.FC<TaskResultProps> = ({ setView }) => {
  const queryClient = useQueryClient()
  const containerRef = useRef<HTMLDivElement>(null)

  const taskResult =
    (queryClient.getQueryData(["task_result"]) as TaskResultData | null) ?? null

  useContentDimensions(containerRef, [taskResult?.message_ko, taskResult?.status])

  useEffect(() => {
    const unsub = window.electronAPI.onAgentRunSuccess((data: TaskResultData) => {
      queryClient.setQueryData(["task_result"], data)
    })
    return () => unsub()
  }, [queryClient])

  if (!taskResult) {
    return (
      <div ref={containerRef} className="app-content px-4 py-4">
        <p className="text-white/50 text-sm text-center">처리 결과를 불러오는 중...</p>
      </div>
    )
  }

  const agentLabel = AGENT_LABELS[taskResult.agentId] ?? taskResult.agentId
  const isSuccess = taskResult.status === "success"
  const isNeedsInput = taskResult.status === "needs_input"
  const isOcrResult = taskResult.agentId === "local-ocr"

  return (
    <div ref={containerRef} className="app-content px-3 py-3">
      <div className="innomate-panel mx-auto rounded-[22px] border border-white/[0.12] bg-black/70 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden">
        <div className="px-4 py-4 border-b border-white/[0.06] text-center">
          <p className="text-[10px] text-white/40 uppercase tracking-[0.15em]">
            InnoMate AI Super Agent
          </p>
          <h2 className="text-[15px] font-semibold text-white mt-1">{agentLabel}</h2>
          <span
            className={`inline-block mt-2 text-[10px] px-2.5 py-0.5 rounded-full ${
              isSuccess
                ? "bg-emerald-500/15 text-emerald-300"
                : isNeedsInput
                ? "bg-amber-500/15 text-amber-300"
                : "bg-red-500/15 text-red-300"
            }`}
          >
            {isSuccess ? "완료" : isNeedsInput ? "입력 필요" : "오류"}
          </span>
        </div>

        <div className="px-4 py-4 max-h-[60vh] overflow-y-auto">
          <p
            className={`text-[13px] leading-relaxed text-white/85 whitespace-pre-wrap break-words ${
              isOcrResult ? "text-left font-mono text-[12px]" : "text-center"
            }`}
          >
            {taskResult.message_ko}
          </p>
          {taskResult.missingFields && taskResult.missingFields.length > 0 && (
            <p className="mt-3 text-[11px] text-white/45 text-center">
              추가 입력: {taskResult.missingFields.join(", ")}
            </p>
          )}
        </div>

        <div className="px-4 pb-4 flex justify-center">
          <button
            onClick={() => setView("queue")}
            className="text-[12px] px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 active:scale-[0.97] text-white/80 transition-all"
          >
            새 업무 ({COMMAND_KEY}+R)
          </button>
        </div>
      </div>
    </div>
  )
}

export default TaskResult
