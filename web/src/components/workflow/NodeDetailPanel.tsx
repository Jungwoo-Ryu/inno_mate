"use client"

import { AnimatePresence, motion } from "framer-motion"
import type { WorkflowRunState } from "@/lib/workflow/types"

export default function NodeDetailPanel({
  state,
  nodeId
}: {
  state: WorkflowRunState
  nodeId: string | null
}) {
  const node = state.graph.nodes.find((n) => n.id === nodeId)
  const logs = nodeId ? state.logs[nodeId] ?? [] : []
  const idx = state.graph.nodes.findIndex((n) => n.id === nodeId)

  return (
    <AnimatePresence mode="wait">
      {!node ? (
        <motion.div
          key="empty"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="rounded-xl border border-white/[0.08] bg-black/30 px-4 py-6 text-center text-[12px] text-white/35"
        >
          스텝을 선택하면 상세 로그가 표시됩니다
        </motion.div>
      ) : (
        <motion.div
          key={node.id}
          initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-black/40"
        >
          <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-3.5 py-3">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-white/90">
                <span className="mr-1.5 tabular-nums text-white/35">{idx + 1}</span>
                {node.label}
              </p>
              {node.description && (
                <p className="mt-0.5 text-[12px] leading-snug text-white/45">
                  {node.description}
                </p>
              )}
            </div>
            <motion.span
              key={state.nodeStatus[node.id]}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex-shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/45"
            >
              {state.nodeStatus[node.id]}
            </motion.span>
          </div>
          <div className="max-h-[168px] overflow-y-auto px-3.5 py-3 font-mono text-[11px] leading-relaxed text-white/65">
            {logs.length === 0 ? (
              <p className="text-white/30">로그 없음</p>
            ) : (
              <ul className="space-y-1.5">
                <AnimatePresence initial={false}>
                  {logs.map((line, i) => (
                    <motion.li
                      key={`${line.at}-${i}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.22, delay: Math.min(i * 0.03, 0.2) }}
                      className="break-words"
                    >
                      <span className="text-white/25">[{line.level}]</span>{" "}
                      {line.message}
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
