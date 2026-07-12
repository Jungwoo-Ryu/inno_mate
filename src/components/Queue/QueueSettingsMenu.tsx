import React, { useEffect, useRef, useState } from "react"
import { Settings2 } from "lucide-react"
import { useToast } from "../../contexts/toast"

interface QueueSettingsMenuProps {
  screenshotCount: number
}

const QueueSettingsMenu: React.FC<QueueSettingsMenuProps> = ({
  screenshotCount
}) => {
  const [open, setOpen] = useState(false)
  const { showToast } = useToast()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [open])

  const handleSignOut = async () => {
    try {
      localStorage.clear()
      sessionStorage.clear()
      await window.electronAPI.updateConfig({ apiKey: "" })
      showToast("완료", "로그아웃되었습니다", "success")
      setTimeout(() => window.location.reload(), 1500)
    } catch {
      showToast("오류", "로그아웃에 실패했습니다", "error")
    }
  }

  const handleOpenSettings = async () => {
    setOpen(false)
    try {
      await window.electronAPI.openSettingsPortal()
    } catch (err) {
      console.error("Failed to open settings:", err)
      showToast("오류", "설정을 열 수 없습니다", "error")
    }
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center w-8 h-8 rounded-lg text-white/50 hover:text-white/90 hover:bg-white/10 transition-colors"
        aria-label="설정"
        aria-expanded={open}
      >
        <Settings2 className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute top-full right-0 z-50 mt-1.5 w-56">
          <div className="rounded-xl border border-white/10 bg-black/95 p-2 text-xs text-white/90 shadow-xl backdrop-blur-xl">
            <button
              type="button"
              onClick={() => void handleOpenSettings()}
              className="w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/10"
            >
              설정 열기
            </button>
            {screenshotCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  void window.electronAPI.deleteLastScreenshot()
                }}
                className="w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/10"
              >
                마지막 스크린샷 삭제
              </button>
            )}
            <div className="my-1 border-t border-white/10" />
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="w-full rounded-lg px-3 py-2 text-left text-red-400 transition-colors hover:bg-white/10"
            >
              로그아웃
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default QueueSettingsMenu
