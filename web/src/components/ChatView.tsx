"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowUp, Bot, FileText, Image as ImageIcon, Paperclip, Square, X } from "lucide-react"
import type { AgentRecord, ChatAttachment, ChatMessage } from "@/lib/types"
import { fileToAttachment, formatBytes } from "@/lib/clientAttachments"
import type { ClientStreamEvent, WorkflowRunState } from "@/lib/workflow/types"
import WorkflowCard, { applyWorkflowEvent } from "@/components/workflow/WorkflowCard"

interface ChatViewProps {
  sessionId?: string
  initialMessages?: ChatMessage[]
  initialAgentId?: string
}

interface DisplayMessage {
  role: "user" | "assistant"
  content: string
  attachments?: Pick<ChatAttachment, "name" | "mimeType" | "size" | "kind">[]
  workflow?: WorkflowRunState | null
}

async function readSseStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onEvent: (event: ClientStreamEvent) => void
) {
  const decoder = new TextDecoder()
  let buffer = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split("\n\n")
    buffer = parts.pop() ?? ""
    for (const part of parts) {
      const line = part.split("\n").find((l) => l.startsWith("data:"))
      if (!line) continue
      const raw = line.replace(/^data:\s*/, "").trim()
      if (!raw) continue
      try {
        onEvent(JSON.parse(raw) as ClientStreamEvent)
      } catch {
        // ignore malformed
      }
    }
  }
}

export default function ChatView({
  sessionId: initialSessionId,
  initialMessages = [],
  initialAgentId = "super"
}: ChatViewProps) {
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId)
  const [messages, setMessages] = useState<DisplayMessage[]>(
    initialMessages.map((m) => ({
      role: m.role,
      content: m.content,
      attachments: m.attachments
    }))
  )
  const [input, setInput] = useState("")
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [agents, setAgents] = useState<AgentRecord[]>([])
  const [agentId, setAgentId] = useState(initialAgentId)
  const [error, setError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch("/api/agents?enabled=true")
      .then((res) => (res.ok ? res.json() : []))
      .then(setAgents)
      .catch(() => setAgents([]))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`
  }, [])

  const handleFiles = async (files: FileList | null) => {
    if (!files) return
    const converted = await Promise.all(Array.from(files).map(fileToAttachment))
    setAttachments((prev) => [...prev, ...converted])
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const stopStreaming = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsStreaming(false)
  }

  const patchLastAssistant = (updater: (msg: DisplayMessage) => DisplayMessage) => {
    setMessages((prev) => {
      const next = [...prev]
      const last = next[next.length - 1]
      if (last?.role === "assistant") {
        next[next.length - 1] = updater(last)
      }
      return next
    })
  }

  const handleResume = async (runId: string, fields: Record<string, string>) => {
    const res = await fetch(`/api/runs/${runId}/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields })
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      throw new Error(data?.error ?? "재개 실패")
    }

    const contentType = res.headers.get("content-type") || ""
    if (contentType.includes("text/event-stream") && res.body) {
      await readSseStream(res.body.getReader(), (event) => {
        if (event.type === "workflow") {
          patchLastAssistant((msg) => ({
            ...msg,
            workflow: applyWorkflowEvent(msg.workflow ?? null, event.event)
          }))
        }
        if (event.type === "token") {
          patchLastAssistant((msg) => ({
            ...msg,
            content: msg.content + event.text
          }))
        }
      })
      return
    }

    const data = (await res.json()) as {
      events?: Parameters<typeof applyWorkflowEvent>[1][]
      status?: string
    }
    if (data.events) {
      patchLastAssistant((msg) => {
        let wf = msg.workflow ?? null
        for (const ev of data.events!) {
          wf = applyWorkflowEvent(wf, ev)
        }
        return {
          ...msg,
          workflow: wf,
          // 결과는 WorkflowCard 안에서만 표시 (말풍선 content 중복 방지)
          content:
            wf?.result?.message_ko && data.status === "completed"
              ? ""
              : msg.content ||
                (data.status === "paused" ? "추가 정보가 필요합니다." : msg.content)
        }
      })
    }
  }

  const send = async () => {
    const text = input.trim()
    if ((!text && attachments.length === 0) || isStreaming) return

    setError(null)
    const sentAttachments = attachments
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: text,
        attachments: sentAttachments.map(({ name, mimeType, size, kind }) => ({
          name,
          mimeType,
          size,
          kind
        }))
      },
      { role: "assistant", content: "", workflow: null }
    ])
    setInput("")
    setAttachments([])
    setIsStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          agentId,
          message: text,
          attachments: sentAttachments
        }),
        signal: controller.signal
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? `요청 실패 (${res.status})`)
      }

      const newSessionId = res.headers.get("X-Session-Id")
      if (newSessionId && newSessionId !== sessionId) {
        setSessionId(newSessionId)
        window.history.replaceState(null, "", `/chat/${newSessionId}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error("응답 스트림을 열 수 없습니다")

      await readSseStream(reader, (event) => {
        if (event.type === "token") {
          patchLastAssistant((msg) => ({
            ...msg,
            content: msg.content + event.text
          }))
        }
        if (event.type === "workflow") {
          patchLastAssistant((msg) => ({
            ...msg,
            workflow: applyWorkflowEvent(msg.workflow ?? null, event.event)
          }))
        }
        if (event.type === "error") {
          setError(event.message)
        }
        if (event.type === "done" && event.status === "paused") {
          patchLastAssistant((msg) => ({
            ...msg,
            content:
              msg.content ||
              "필수 정보가 부족해 워크플로가 일시 중지되었습니다."
          }))
        }
      })
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        const msg = err instanceof Error ? err.message : "오류가 발생했습니다"
        setError(msg)
        setMessages((prev) => {
          const next = [...prev]
          if (
            next[next.length - 1]?.role === "assistant" &&
            !next[next.length - 1].content &&
            !next[next.length - 1].workflow
          ) {
            next.pop()
          }
          return next
        })
      }
    } finally {
      abortRef.current = null
      setIsStreaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="glass-panel flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-white/50" />
          <select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            disabled={messages.length > 0}
            className="rounded-lg border border-white/[0.1] bg-black/40 px-2 py-1 text-[12.5px] text-white/85 outline-none disabled:opacity-50"
          >
            {agents.length === 0 && <option value="super">Super Agent</option>}
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
                {agent.runtime === "databricks" ? " · DBX" : ""}
              </option>
            ))}
          </select>
        </div>
        <span className="text-[10px] uppercase tracking-[0.18em] text-white/25">
          InnoMate Web
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-white/[0.06]">
              <Bot className="h-7 w-7 text-red-500/80" />
            </div>
            <div>
              <p className="text-[15px] font-medium text-white/85">
                무엇을 도와드릴까요?
              </p>
              <p className="mt-1 text-[12.5px] text-white/40">
                업무 내용을 입력하거나 파일을 첨부해 주세요
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-[760px] space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[95%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed break-words ${
                    msg.role === "user"
                      ? "bg-white/[0.12] text-white whitespace-pre-wrap"
                      : "glass-inset text-white/90"
                  }`}
                >
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {msg.attachments.map((att, j) => (
                        <span
                          key={j}
                          className="inline-flex items-center gap-1 rounded-lg bg-black/30 px-2 py-1 text-[11px] text-white/60"
                        >
                          {att.kind === "image" ? (
                            <ImageIcon className="h-3 w-3" />
                          ) : (
                            <FileText className="h-3 w-3" />
                          )}
                          {att.name}
                        </span>
                      ))}
                    </div>
                  )}
                  {msg.workflow && (
                    <WorkflowCard
                      state={msg.workflow}
                      onResume={async (runId, fields) => {
                        try {
                          await handleResume(runId, fields)
                        } catch (err) {
                          setError(
                            err instanceof Error ? err.message : "재개 실패"
                          )
                        }
                      }}
                    />
                  )}
                  {msg.content &&
                  !(
                    msg.workflow?.status === "completed" &&
                    msg.workflow?.result?.message_ko
                  ) ? (
                    <p className="mt-1 whitespace-pre-wrap">{msg.content}</p>
                  ) : msg.role === "assistant" &&
                    isStreaming &&
                    i === messages.length - 1 &&
                    !msg.workflow ? (
                    <span className="inline-block h-4 w-2 animate-pulse rounded-sm bg-white/50" />
                  ) : null}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {error && (
        <div className="mx-5 mb-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
          {error}
        </div>
      )}

      <div className="border-t border-white/[0.07] p-4">
        <div className="mx-auto max-w-[760px]">
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {attachments.map((att, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.1] bg-white/[0.06] px-2.5 py-1.5 text-[11.5px] text-white/75"
                >
                  {att.kind === "image" ? (
                    <ImageIcon className="h-3.5 w-3.5 text-white/50" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 text-white/50" />
                  )}
                  <span className="max-w-[160px] truncate">{att.name}</span>
                  <span className="text-white/35">{formatBytes(att.size)}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setAttachments((prev) => prev.filter((_, j) => j !== i))
                    }
                    className="rounded p-0.5 text-white/40 hover:bg-white/10 hover:text-white/80"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 rounded-[18px] border border-white/[0.12] bg-black/40 px-3 py-2.5">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-shrink-0 rounded-xl p-2 text-white/45 transition-colors hover:bg-white/10 hover:text-white/80"
              title="파일 첨부"
            >
              <Paperclip className="h-[18px] w-[18px]" />
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                resizeTextarea()
              }}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="업무 내용을 입력하세요… (Shift+Enter 줄바꿈)"
              className="max-h-[180px] min-h-[24px] flex-1 resize-none bg-transparent text-[13.5px] leading-relaxed text-white placeholder-white/30 outline-none"
            />
            {isStreaming ? (
              <button
                type="button"
                onClick={stopStreaming}
                className="flex-shrink-0 rounded-xl bg-white/15 p-2 text-white transition-colors hover:bg-white/25"
                title="중지"
              >
                <Square className="h-[18px] w-[18px]" />
              </button>
            ) : (
              <button
                type="button"
                onClick={send}
                disabled={!input.trim() && attachments.length === 0}
                className="flex-shrink-0 rounded-xl bg-white p-2 text-black transition-all hover:bg-white/90 active:scale-95 disabled:opacity-30"
                title="전송"
              >
                <ArrowUp className="h-[18px] w-[18px]" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
