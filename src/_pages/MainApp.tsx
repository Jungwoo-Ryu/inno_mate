import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import Queue from "./Queue"
import TaskResult from "./TaskResult"
import { useToast } from "../contexts/toast"

const MainApp: React.FC = () => {
  const queryClient = useQueryClient()
  const [view, setView] = useState<"queue" | "result">("queue")
  const { showToast } = useToast()

  useEffect(() => {
    const cleanup = window.electronAPI.onResetView(() => {
      queryClient.invalidateQueries({ queryKey: ["screenshots"] })
      queryClient.removeQueries({ queryKey: ["task_result"] })
      setView("queue")
    })
    return () => cleanup()
  }, [queryClient])

  useEffect(() => {
    const cleanupFunctions = [
      window.electronAPI.onAgentRunSuccess((data: unknown) => {
        queryClient.setQueryData(["task_result"], data)
        setView("result")
      }),
      window.electronAPI.onAgentRunError((error: string) => {
        showToast("오류", error, "error")
        setView("queue")
      })
    ]
    return () => cleanupFunctions.forEach((fn) => fn())
  }, [queryClient, showToast])

  if (view === "result") {
    return <TaskResult setView={setView} />
  }

  return <Queue setView={setView} />
}

export default MainApp
