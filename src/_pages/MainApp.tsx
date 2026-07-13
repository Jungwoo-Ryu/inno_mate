import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import Queue from "./Queue"
import { useToast } from "../contexts/toast"

/** 데스크톱은 단일 Queue 화면에서 채팅 로그 + HITL을 처리한다. */
const MainApp: React.FC = () => {
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  useEffect(() => {
    const cleanup = window.electronAPI.onResetView(() => {
      queryClient.invalidateQueries({ queryKey: ["screenshots"] })
      queryClient.removeQueries({ queryKey: ["task_result"] })
    })
    return () => cleanup()
  }, [queryClient])

  useEffect(() => {
    const cleanupFunctions = [
      window.electronAPI.onAgentRunError((error: string) => {
        // QueuePanel 채팅 로그에도 쌓이지만, 눈에 띄게 toast도 유지
        if (error) showToast("오류", error, "error")
      })
    ]
    return () => cleanupFunctions.forEach((fn) => fn())
  }, [showToast])

  return <Queue setView={() => {}} />
}

export default MainApp
