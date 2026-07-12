import type { WorkflowEvent } from "../../agent-spec/src/index"

export type WorkflowEventHandler = (event: WorkflowEvent) => void

/**
 * Databricks Apps /invoke 또는 /resume SSE를 파싱해 WorkflowEvent로 전달.
 * 응답이 NDJSON/SSE(event: workflow) 형태라고 가정.
 */
export async function streamDatabricksInvoke(options: {
  endpointUrl: string
  token: string
  body: Record<string, unknown>
  onEvent: WorkflowEventHandler
  signal?: AbortSignal
}): Promise<{ paused: boolean; completed: boolean; resultText?: string; runId?: string }> {
  const res = await fetch(options.endpointUrl, {
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
    throw new Error(`Databricks invoke failed (${res.status}): ${text.slice(0, 200)}`)
  }

  const reader = res.body?.getReader()
  if (!reader) {
    throw new Error("No response body from Databricks endpoint")
  }

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

    const chunks = buffer.split("\n\n")
    buffer = chunks.pop() ?? ""

    for (const chunk of chunks) {
      const dataLine = chunk
        .split("\n")
        .find((l) => l.startsWith("data:"))
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
        if (event.type === "run_error") {
          throw new Error(event.message)
        }
      } catch (err) {
        if (err instanceof SyntaxError) continue
        throw err
      }
    }
  }

  return { paused, completed, resultText, runId }
}
