import React, { useRef } from "react"
import { Button } from "./ui/button"
import { useContentDimensions } from "../hooks/useContentDimensions"
import { COMMAND_KEY } from "../utils/platform"

interface WelcomeScreenProps {
  onOpenSettings: () => void
}

const SHORTCUTS = [
  { label: "창 표시/숨김", keys: [`${COMMAND_KEY}+B`] },
  { label: "스크린샷", keys: [`${COMMAND_KEY}+H`] },
  { label: "Agent 실행", keys: [`${COMMAND_KEY}+↵`] },
  { label: "스크린샷 삭제", keys: [`${COMMAND_KEY}+L`] },
  { label: "초기화", keys: [`${COMMAND_KEY}+R`] }
]

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onOpenSettings }) => {
  const contentRef = useRef<HTMLDivElement>(null)
  useContentDimensions(contentRef)

  return (
    <div ref={contentRef} className="app-content px-4 py-4">
      <div className="w-[clamp(300px,92vw,380px)] mx-auto rounded-[22px] border border-white/[0.12] bg-black/70 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden">
        <div className="flex flex-col items-center px-5 pt-6 pb-4 text-center">
          <img
            src="/innomate-icon.png"
            alt="InnoMate"
            className="w-16 h-16 rounded-[18px] mb-3 object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
          />
          <h1 className="text-xl font-semibold text-white tracking-tight">
            <span className="text-white/90">Inno</span>
            <span className="text-red-500">Mate</span>
          </h1>
          <p className="text-[10px] text-white/40 tracking-[0.2em] mt-1">AI SUPER AGENT</p>
        </div>

        <div className="px-5 pb-4 text-center">
          <p className="text-[13px] text-white/70 leading-relaxed">
            G-portal 업무를 AI Agent가 자동 처리합니다
          </p>
        </div>

        <div className="mx-4 mb-4 rounded-2xl bg-white/[0.04] border border-white/[0.06] px-4 py-3">
          <p className="text-[11px] font-medium text-white/60 text-center mb-2">단축키</p>
          <div className="flex flex-col gap-1.5">
            {SHORTCUTS.map(({ label, keys }) => (
              <div key={label} className="flex items-center justify-between text-[12px]">
                <span className="text-white/55">{label}</span>
                <span className="text-white/80 font-medium tabular-nums">{keys[0]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 pb-5">
          <Button
            className="w-full h-11 bg-white text-black rounded-2xl font-medium hover:bg-white/90 active:scale-[0.98] transition-all"
            onClick={onOpenSettings}
          >
            설정 열기
          </Button>
          <p className="mt-3 text-[10px] text-white/30 text-center leading-relaxed">
            .env 또는 설정에서 API 키를 입력하세요
          </p>
        </div>
      </div>
    </div>
  )
}
