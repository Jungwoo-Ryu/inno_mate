"use client"

import { motion } from "framer-motion"
import clsx from "clsx"
import type { WorkflowRunState } from "@/lib/workflow/types"

export default function StepTimeline({
  state,
  onSelect
}: {
  state: WorkflowRunState
  onSelect: (nodeId: string) => void
}) {
  const nodes = state.graph.nodes

  return (
    <div className="relative w-full px-1 py-2">
      <div className="flex w-full items-start">
        {nodes.map((node, i) => {
          const status = state.nodeStatus[node.id] ?? "pending"
          const active = state.activeNodeId === node.id
          const done = status === "done"
          const running = status === "running"
          const paused = status === "paused"
          const lit = done || running || paused || active

          const prevDone =
            i === 0
              ? true
              : ["done", "running", "paused"].includes(
                  state.nodeStatus[nodes[i - 1].id] ?? ""
                ) || lit

          return (
            <div
              key={node.id}
              className="flex min-w-0 flex-1 flex-col items-center"
            >
              {/* circle row: left line | circle | right line — lines vertically centered to circle */}
              <div className="flex h-9 w-full items-center">
                <div
                  className={clsx(
                    "h-px flex-1 transition-colors duration-300",
                    i === 0
                      ? "bg-transparent"
                      : prevDone || lit
                        ? paused
                          ? "bg-amber-400/50"
                          : "bg-white/40"
                        : "bg-white/10"
                  )}
                />
                <button
                  type="button"
                  onClick={() => onSelect(node.id)}
                  className="relative z-[1] flex-shrink-0"
                  title={node.label}
                >
                  <motion.span
                    className={clsx(
                      "relative flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-semibold border",
                      paused &&
                        "border-amber-400/80 bg-amber-400/15 text-amber-100",
                      (running || active) &&
                        !paused &&
                        "border-red-400/70 bg-red-500/20 text-white",
                      done &&
                        !paused &&
                        !running &&
                        !active &&
                        "border-white/35 bg-white/15 text-white",
                      !lit && "border-white/10 bg-white/[0.04] text-white/30"
                    )}
                    animate={
                      running || (active && state.status === "running")
                        ? {
                            boxShadow: [
                              "0 0 0px rgba(239,68,68,0)",
                              "0 0 16px rgba(239,68,68,0.5)",
                              "0 0 0px rgba(239,68,68,0)"
                            ],
                            scale: [1, 1.05, 1]
                          }
                        : paused
                          ? {
                              boxShadow: [
                                "0 0 6px rgba(251,191,36,0.2)",
                                "0 0 14px rgba(251,191,36,0.5)",
                                "0 0 6px rgba(251,191,36,0.2)"
                              ]
                            }
                          : { boxShadow: "0 0 0px transparent", scale: 1 }
                    }
                    transition={
                      running || paused
                        ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
                        : { duration: 0.3 }
                    }
                  >
                    {i + 1}
                  </motion.span>
                </button>
                <div
                  className={clsx(
                    "h-px flex-1 transition-colors duration-300",
                    i === nodes.length - 1
                      ? "bg-transparent"
                      : lit
                        ? "bg-white/40"
                        : "bg-white/10"
                  )}
                />
              </div>

              <button
                type="button"
                onClick={() => onSelect(node.id)}
                className={clsx(
                  "mt-1.5 max-w-full truncate px-0.5 text-center text-[10px]",
                  lit ? "text-white/85" : "text-white/30"
                )}
              >
                {node.label}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
