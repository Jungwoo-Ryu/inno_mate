import { useEffect, type RefObject } from "react"

const PAD_X = 24
const PAD_Y = 20
export const REMEASURE_LAYOUT_EVENT = "innomate-remeasure-layout"

function measureElement(el: HTMLElement): { width: number; height: number } {
  const rect = el.getBoundingClientRect()
  const width = Math.max(el.scrollWidth, rect.width)
  const height = Math.max(el.scrollHeight, rect.height)
  return { width, height }
}

export function useContentDimensions(
  ref: RefObject<HTMLElement | null>,
  deps: unknown[] = []
) {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    const update = async () => {
      const mode = await window.electronAPI?.getWindowLayoutMode?.()
      if (mode === "settings") return

      const { width, height } = measureElement(el)
      await window.electronAPI?.updateContentDimensions({
        width: Math.ceil(width) + PAD_X,
        height: Math.ceil(height) + PAD_Y
      })
    }

    update()
    const observer = new ResizeObserver(() => {
      void update()
    })
    observer.observe(el)

    const onRemeasure = () => {
      void update()
    }
    window.addEventListener(REMEASURE_LAYOUT_EVENT, onRemeasure)

    return () => {
      observer.disconnect()
      window.removeEventListener(REMEASURE_LAYOUT_EVENT, onRemeasure)
    }
  }, deps)
}

export function requestLayoutRemeasure(): void {
  window.dispatchEvent(new Event(REMEASURE_LAYOUT_EVENT))
}
