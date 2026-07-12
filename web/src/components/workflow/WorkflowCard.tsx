"use client"

import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import clsx from "clsx"
import type { WorkflowEvent, WorkflowRunState } from "@/lib/workflow/types"
import {
  createInitialRunState,
  DEFAULT_HR_GRAPH,
  reduceWorkflow
} from "@/lib/workflow/types"
import StepTimeline from "./StepTimeline"
import NodeDetailPanel from "./NodeDetailPanel"
import MissingFieldsForm from "./MissingFieldsForm"

export function applyWorkflowEvent(
  prev: WorkflowRunState | null,
  event: WorkflowEvent
): WorkflowRunState {
  if (event.type === "run_started") {
    return createInitialRunState(event.runId, event.agentId, event.graph)
  }
  if (!prev) {
    return reduceWorkflow(
      createInitialRunState(
        "runId" in event ? event.runId : "unknown",
        "agentId" in event &&
          typeof (event as { agentId?: string }).agentId === "string"
          ? (event as { agentId: string }).agentId
          : "unknown",
        DEFAULT_HR_GRAPH
      ),
      event
    )
  }
  return reduceWorkflow(prev, event)
}

export default function WorkflowCard({
  state,
  onResume
}: {
  state: WorkflowRunState
  onResume?: (runId: string, fields: Record<string, string>) => Promise<void>
}) {
  const [selected, setSelected] = useState<string | null>(
    state.activeNodeId ?? state.graph.nodes[0]?.id ?? null
  )
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (state.activeNodeId) setSelected(state.activeNodeId)
  }, [state.activeNodeId])

  const statusLabel = useMemo(() => {
    switch (state.status) {
      case "paused":
        return "일시 중지 — 입력 대기"
      case "completed":
        return "완료"
      case "error":
        return "오류"
      default:
        return "실행 중"
    }
  }, [state.status])

  const doneCount = Object.values(state.nodeStatus).filter((s) => s === "done").length
  const progress = state.graph.nodes.length
    ? doneCount / state.graph.nodes.length
    : 0

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="relative mt-2 w-full max-w-[720px] overflow-hidden rounded-2xl border border-white/[0.1] bg-white/[0.04] p-3 backdrop-blur-xl"
    >
      {/* ambient glow */}
      <motion.div
        className="pointer-events-none absolute -top-16 left-1/3 h-32 w-32 rounded-full blur-3xl"
        animate={{
          backgroundColor:
            state.status === "paused"
              ? "rgba(251,191,36,0.18)"
              : state.status === "completed"
                ? "rgba(52,211,153,0.14)"
                : "rgba(239,68,68,0.16)",
          x: [0, 24, 0],
          opacity: [0.45, 0.75, 0.45]
        }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative mb-2 flex items-center justify-between gap-3 px-0.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/40">
          Workflow · {state.agentId}
        </p>
        <motion.p
          key={statusLabel}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className={clsx(
            "text-[11px] flex-shrink-0",
            state.status === "paused" && "text-amber-300/90",
            state.status === "completed" && "text-emerald-300/90",
            state.status === "error" && "text-red-300/90",
            state.status === "running" && "text-white/45"
          )}
        >
          {statusLabel}
        </motion.p>
      </div>

      {/* full-width progress track */}
      <div className="relative mb-1 h-0.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
        <motion.div
          className={clsx(
            "h-full rounded-full",
            state.status === "paused"
              ? "bg-amber-400/80"
              : state.status === "completed"
                ? "bg-emerald-400/70"
                : "bg-red-400/70"
          )}
          initial={{ width: 0 }}
          animate={{
            width: `${
              state.status === "completed"
                ? 100
                : Math.max(progress * 100, state.status === "running" ? 12 : 0)
            }%`
          }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        />
        {state.status === "running" && (
          <motion.div
            className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/35 to-transparent"
            animate={{ left: ["-20%", "120%"] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
          />
        )}
      </div>

      <StepTimeline state={state} onSelect={(id) => setSelected(id)} />

      <div className="mt-1">
        <NodeDetailPanel state={state} nodeId={selected || state.activeNodeId} />
      </div>

      <AnimatePresence>
        {state.status === "paused" &&
          state.missingFields &&
          state.missingFields.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <MissingFieldsForm
                fields={state.missingFields}
                initial={state.collectedFields}
                submitting={submitting}
                onSubmit={async (values) => {
                  if (!onResume) return
                  setSubmitting(true)
                  try {
                    await onResume(state.runId, values)
                  } finally {
                    setSubmitting(false)
                  }
                }}
              />
            </motion.div>
          )}
      </AnimatePresence>

      <AnimatePresence>
        {state.result?.message_ko && state.status === "completed" && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 mb-0.5 px-0.5 text-[12.5px] leading-relaxed text-white/75 whitespace-pre-wrap"
          >
            {state.result.message_ko}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
