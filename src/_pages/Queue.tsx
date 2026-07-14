import React, { useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import ScreenshotQueue from "../components/Queue/ScreenshotQueue"
import QueuePanel from "../components/Queue/QueuePanel"
import { useToast } from "../contexts/toast"
import { useContentDimensions } from "../hooks/useContentDimensions"
import { Screenshot } from "../types/screenshots"

async function fetchScreenshots(): Promise<Screenshot[]> {
  try {
    return await window.electronAPI.getScreenshots()
  } catch (error) {
    console.error("Error loading screenshots:", error)
    throw error
  }
}

interface QueueProps {
  setView: (view: "queue" | "result") => void
}

const Queue: React.FC<QueueProps> = ({ setView }) => {
  const { showToast } = useToast()
  const contentRef = useRef<HTMLDivElement>(null)

  const { data: screenshots = [], refetch } = useQuery<Screenshot[]>({
    queryKey: ["screenshots"],
    queryFn: fetchScreenshots,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false
  })

  useContentDimensions(contentRef, [screenshots.length])

  const handleDeleteScreenshot = async (index: number) => {
    const screenshotToDelete = screenshots[index]
    try {
      const response = await window.electronAPI.deleteScreenshot(screenshotToDelete.path)
      if (response.success) {
        refetch()
      } else {
        showToast("오류", "스크린샷 삭제에 실패했습니다", "error")
      }
    } catch (error) {
      console.error("Error deleting screenshot:", error)
    }
  }

  useEffect(() => {
    const cleanupFunctions = [
      window.electronAPI.onScreenshotTaken(() => refetch()),
      window.electronAPI.onResetView(() => refetch()),
      window.electronAPI.onDeleteLastScreenshot(async () => {
        if (screenshots.length > 0) {
          await handleDeleteScreenshot(screenshots.length - 1)
        } else {
          showToast("안내", "삭제할 스크린샷이 없습니다", "neutral")
        }
      }),
      window.electronAPI.onAgentRunError((error: string) => {
        setView("queue")
        console.error("Agent error:", error)
      }),
      window.electronAPI.onProcessingNoScreenshots(() => {
        showToast("안내", "처리할 스크린샷이 없습니다", "neutral")
      })
    ]
    return () => cleanupFunctions.forEach((cleanup) => cleanup())
  }, [screenshots, setView, showToast])

  return (
    <div ref={contentRef} className="app-content px-3 py-3">
      <div className="flex flex-col items-center gap-3 w-fit">
        {screenshots.length > 0 && (
          <ScreenshotQueue
            isLoading={false}
            screenshots={screenshots}
            onDeleteScreenshot={handleDeleteScreenshot}
          />
        )}
        <QueuePanel screenshotCount={screenshots.length} />
      </div>
    </div>
  )
}

export default Queue
