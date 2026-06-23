import React, { useRef, useEffect, useCallback } from "react"
import { Plus, ArrowUp, X, Paperclip } from "lucide-react"
import { COMMAND_KEY } from "../../utils/platform"
import type { AttachmentFile } from "../../types/agents"
import { formatFileSize } from "../../types/agents"

const MIN_HEIGHT = 22
const MAX_HEIGHT = 120

interface ChatComposerProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  attachments: AttachmentFile[]
  onAttachmentsChange: (files: AttachmentFile[]) => void
  isRunning?: boolean
  placeholder?: string
}

const ChatComposer: React.FC<ChatComposerProps> = ({
  value,
  onChange,
  onSubmit,
  attachments,
  onAttachmentsChange,
  isRunning = false,
  placeholder = "업무 내용 입력…"
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    const next = Math.min(Math.max(el.scrollHeight, MIN_HEIGHT), MAX_HEIGHT)
    el.style.height = `${next}px`
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? "auto" : "hidden"
  }, [])

  useEffect(() => {
    adjustHeight()
  }, [value, adjustHeight])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      onSubmit()
    }
  }

  const handlePickFiles = async () => {
    try {
      const result = await window.electronAPI.pickAttachmentFiles()
      if (result.files?.length) {
        const merged = [...attachments]
        for (const f of result.files) {
          if (!merged.some((a) => a.path === f.path)) {
            merged.push(f)
          }
        }
        onAttachmentsChange(merged)
      }
    } catch {
      // dialog unavailable
    }
  }

  const removeAttachment = (path: string) => {
    onAttachmentsChange(attachments.filter((a) => a.path !== path))
  }

  return (
    <div className="space-y-2">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 justify-center px-1">
          {attachments.map((file) => (
            <div
              key={file.path}
              className="group flex items-center gap-1.5 pl-1.5 pr-1 py-1 rounded-xl bg-white/[0.06] border border-white/10 max-w-full"
            >
              {file.kind === "image" && file.preview ? (
                <img
                  src={file.preview}
                  alt=""
                  className="w-6 h-6 rounded-md object-cover flex-shrink-0"
                />
              ) : (
                <Paperclip className="w-3 h-3 text-white/40 flex-shrink-0 ml-0.5" />
              )}
              <span className="text-[11px] text-white/70 truncate max-w-[120px]">
                {file.name}
              </span>
              <span className="text-[9px] text-white/30 flex-shrink-0">
                {formatFileSize(file.size)}
              </span>
              <button
                type="button"
                onClick={() => removeAttachment(file.path)}
                className="p-0.5 rounded-md hover:bg-white/10 text-white/40 hover:text-white/70"
                aria-label="첨부 삭제"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] pl-1.5 pr-2 py-1.5 focus-within:border-white/20 focus-within:bg-white/[0.06] transition-colors">
        <button
          type="button"
          onClick={handlePickFiles}
          title="파일 첨부"
          className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/15 active:scale-95 transition-all mb-0.5"
        >
          <Plus className="w-4 h-4 text-white/70" />
        </button>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className="flex-1 resize-none bg-transparent text-[13px] text-white/90 placeholder:text-white/30 outline-none leading-[1.45] py-1.5"
          style={{ minHeight: MIN_HEIGHT, maxHeight: MAX_HEIGHT }}
        />

        <button
          type="button"
          onClick={onSubmit}
          disabled={isRunning}
          title={`${COMMAND_KEY}+Enter로 실행`}
          className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-white/12 hover:bg-white/20 active:scale-95 disabled:opacity-40 transition-all mb-0.5"
        >
          <ArrowUp className="w-3.5 h-3.5 text-white/80" />
        </button>
      </div>

      <p className="text-center text-[10px] text-white/28 leading-relaxed">
        Enter 줄바꿈 · {COMMAND_KEY}+Enter 실행 · + 파일 첨부
      </p>
    </div>
  )
}

export default ChatComposer
