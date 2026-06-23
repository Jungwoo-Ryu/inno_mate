import { useEffect, type RefObject } from "react"

const PAD_X = 24
const PAD_Y = 16

export function useContentDimensions(
  ref: RefObject<HTMLElement | null>,
  deps: unknown[] = []
) {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    const update = () => {
      const { width, height } = el.getBoundingClientRect()
      window.electronAPI?.updateContentDimensions({
        width: Math.ceil(width) + PAD_X,
        height: Math.ceil(height) + PAD_Y
      })
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, deps)
}
