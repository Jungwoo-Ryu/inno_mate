"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Bot, MessageSquarePlus, Plug, Trash2 } from "lucide-react"
import type { ChatSession } from "@/lib/types"

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [sessions, setSessions] = useState<ChatSession[]>([])

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions")
      if (res.ok) setSessions(await res.json())
    } catch {
      // 목록 로드 실패는 조용히 무시
    }
  }, [])

  useEffect(() => {
    loadSessions()
  }, [loadSessions, pathname])

  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault()
    e.stopPropagation()
    await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" })
    setSessions((prev) => prev.filter((s) => s.id !== sessionId))
    if (pathname === `/chat/${sessionId}`) {
      router.push("/chat")
    }
  }

  const navItems = [
    { href: "/agents", label: "에이전트", icon: Bot },
    { href: "/mcp", label: "MCP 연결", icon: Plug }
  ]

  return (
    <aside className="glass-panel flex h-full w-[264px] flex-shrink-0 flex-col overflow-hidden">
      {/* 로고 */}
      <div className="px-5 pt-5 pb-3">
        <Link href="/chat" className="block">
          <h1 className="text-lg font-semibold tracking-tight">
            <span className="text-white/90">Inno</span>
            <span className="text-red-500">Mate</span>
          </h1>
          <p className="mt-0.5 text-[9px] tracking-[0.25em] text-white/35">
            LG INNOTEK · AI SUPER AGENT
          </p>
        </Link>
      </div>

      {/* 새 채팅 */}
      <div className="px-3 pb-2">
        <Link
          href="/chat"
          className="glass-button flex w-full items-center justify-center gap-2"
        >
          <MessageSquarePlus className="h-4 w-4" />
          새 채팅
        </Link>
      </div>

      {/* 세션 목록 */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-1">
        <p className="px-2 pb-1.5 pt-2 text-[10px] font-medium uppercase tracking-wider text-white/30">
          이전 대화
        </p>
        {sessions.length === 0 && (
          <p className="px-2 py-3 text-center text-[12px] text-white/30">
            대화 기록이 없습니다
          </p>
        )}
        <div className="space-y-0.5">
          {sessions.map((session) => {
            const active = pathname === `/chat/${session.id}`
            return (
              <Link
                key={session.id}
                href={`/chat/${session.id}`}
                className={`group flex items-center gap-2 rounded-xl px-2.5 py-2 text-[12.5px] transition-colors ${
                  active
                    ? "bg-white/[0.1] text-white"
                    : "text-white/60 hover:bg-white/[0.06] hover:text-white/85"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{session.title}</span>
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, session.id)}
                  className="flex-shrink-0 rounded-lg p-1 text-white/0 transition-colors hover:bg-white/10 hover:!text-white/70 group-hover:text-white/35"
                  title="대화 삭제"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </Link>
            )
          })}
        </div>
      </div>

      {/* 하단 관리 메뉴 */}
      <div className="border-t border-white/[0.07] p-3 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] transition-colors ${
                active
                  ? "bg-white/[0.1] text-white"
                  : "text-white/60 hover:bg-white/[0.06] hover:text-white/85"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          )
        })}
      </div>
    </aside>
  )
}
