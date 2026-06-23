// file: src/components/SubscribedApp.tsx
import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import Queue from "../_pages/Queue"
import TaskResult from "../_pages/TaskResult"
import { useToast } from "../contexts/toast"

interface SubscribedAppProps {
  credits: number
  currentLanguage: string
  setLanguage: (language: string) => void
}

const SubscribedApp: React.FC<SubscribedAppProps> = ({
  credits,
  currentLanguage,
  setLanguage
}) => {
  const queryClient = useQueryClient()
  const [view, setView] = useState<"queue" | "solutions" | "debug">("queue")
  const { showToast } = useToast()

  useEffect(() => {
    const cleanup = window.electronAPI.onResetView(() => {
      queryClient.invalidateQueries({ queryKey: ["screenshots"] })
      queryClient.invalidateQueries({ queryKey: ["problem_statement"] })
      queryClient.invalidateQueries({ queryKey: ["solution"] })
      queryClient.invalidateQueries({ queryKey: ["new_solution"] })
      setView("queue")
    })
    return () => cleanup()
  }, [queryClient])

  useEffect(() => {
    const cleanupFunctions = [
      window.electronAPI.onSolutionStart(() => setView("solutions")),
      window.electronAPI.onUnauthorized(() => {
        queryClient.removeQueries({ queryKey: ["screenshots"] })
        queryClient.removeQueries({ queryKey: ["solution"] })
        queryClient.removeQueries({ queryKey: ["problem_statement"] })
        setView("queue")
      }),
      window.electronAPI.onResetView(() => {
        queryClient.removeQueries({ queryKey: ["screenshots"] })
        queryClient.removeQueries({ queryKey: ["solution"] })
        queryClient.removeQueries({ queryKey: ["problem_statement"] })
        queryClient.setQueryData(["problem_statement"], null)
        setView("queue")
      }),
      window.electronAPI.onProblemExtracted((data: unknown) => {
        if (view === "queue") {
          queryClient.invalidateQueries({ queryKey: ["problem_statement"] })
          queryClient.setQueryData(["problem_statement"], data)
        }
      }),
      window.electronAPI.onSolutionError((error: string) => {
        showToast("오류", error, "error")
      })
    ]
    return () => cleanupFunctions.forEach((fn) => fn())
  }, [view, queryClient, showToast])

  return (
    <>
      {view === "queue" ? (
        <Queue
          setView={setView}
          credits={credits}
          currentLanguage={currentLanguage}
          setLanguage={setLanguage}
        />
      ) : view === "solutions" ? (
        <TaskResult setView={setView} />
      ) : null}
    </>
  )
}

export default SubscribedApp
