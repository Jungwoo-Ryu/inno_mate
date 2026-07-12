import type { WorkflowEvent } from "@/lib/workflow/types"

export async function streamDatabricksEndpoint(options: {
  endpointUrl: string
  token: string
  body: Record<string, unknown>
  onEvent: (event: WorkflowEvent) => void
  signal?: AbortSignal
  path?: "invoke" | "resume"
}): Promise<{
  paused: boolean
  completed: boolean
  resultText?: string
  runId?: string
}> {
  const url = options.endpointUrl.replace(/\/$/, "")
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.token}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream"
    },
    body: JSON.stringify(options.body),
    signal: options.signal
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Databricks 호출 실패 (${res.status}): ${text.slice(0, 200)}`)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error("Databricks 응답 스트림이 없습니다")

  const decoder = new TextDecoder()
  let buffer = ""
  let paused = false
  let completed = false
  let resultText: string | undefined
  let runId: string | undefined

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split("\n\n")
    buffer = parts.pop() ?? ""
    for (const part of parts) {
      const dataLine = part.split("\n").find((l) => l.startsWith("data:"))
      if (!dataLine) continue
      const raw = dataLine.replace(/^data:\s*/, "").trim()
      if (!raw || raw === "[DONE]") continue
      try {
        const event = JSON.parse(raw) as WorkflowEvent
        options.onEvent(event)
        if ("runId" in event && event.runId) runId = event.runId
        if (event.type === "run_paused") paused = true
        if (event.type === "run_completed") {
          completed = true
          resultText = event.result.message_ko
        }
        if (event.type === "run_error") throw new Error(event.message)
      } catch (err) {
        if (err instanceof SyntaxError) continue
        throw err
      }
    }
  }

  return { paused, completed, resultText, runId }
}
