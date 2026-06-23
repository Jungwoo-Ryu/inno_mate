import React, { useState, useRef } from "react"
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

  return (
    <div
      ref={menuRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="flex items-center justify-center w-8 h-8 rounded-lg text-white/50 hover:text-white/90 hover:bg-white/10 transition-colors"
        aria-label="설정"
      >
        <Settings2 className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-56 z-50">
          <div className="absolute -top-2 right-0 w-full h-2" />
          <div className="p-2 rounded-xl border border-white/10 bg-black/90 backdrop-blur-xl shadow-xl text-xs text-white/90">
            <button
              type="button"
              onClick={() => window.electronAPI.openSettingsPortal()}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              설정 열기
            </button>
            {screenshotCount > 0 && (
              <button
                type="button"
                onClick={() => window.electronAPI.deleteLastScreenshot()}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                마지막 스크린샷 삭제
              </button>
            )}
            <div className="my-1 border-t border-white/10" />
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full text-left px-3 py-2 rounded-lg text-red-400 hover:bg-white/10 transition-colors"
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
