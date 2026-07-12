import { NextRequest } from "next/server"
import { v4 as uuidv4 } from "uuid"
import { getAgent, getRun, upsertRun, addMessage } from "@/lib/db"
import { DEFAULT_HR_GRAPH, type ClientStreamEvent, type WorkflowEvent } from "@/lib/workflow/types"
import { streamDatabricksEndpoint } from "@/lib/superAgent/databricks"
import { missingRequiredFromAgent } from "@/lib/superAgent/hitl"

export const runtime = "nodejs"

type Params = { params: Promise<{ runId: string }> }

function encodeSse(event: ClientStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

export async function POST(req: NextRequest, { params }: Params) {
  const { runId } = await params
  const body = (await req.json().catch(() => ({}))) as {
    fields?: Record<string, unknown>
  }

  if (!body.fields || Object.keys(body.fields).length === 0) {
    return Response.json(
      { error: "fields 객체가 필요합니다" },
      { status: 400 }
    )
  }

  const run = getRun(runId)
  if (!run) {
    return Response.json({ error: "run을 찾을 수 없습니다" }, { status: 404 })
  }

  const agent = getAgent(run.agentId)
  const collected = { ...(run.collectedFields ?? {}), ...body.fields }
  const graph = agent?.graph ?? DEFAULT_HR_GRAPH

  // Databricks endpoint가 있으면 resume 스트림
  if (agent?.endpointUrl && (process.env.DATABRICKS_TOKEN || process.env.DATABRICKS_CLIENT_SECRET)) {
    const token =
      process.env.DATABRICKS_TOKEN || process.env.DATABRICKS_CLIENT_SECRET!
    const encoder = new TextEncoder()
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        const emit = (event: ClientStreamEvent) => {
          controller.enqueue(encoder.encode(encodeSse(event)))
        }
        try {
          emit({
            type: "workflow",
            event: {
              type: "run_resumed",
              runId,
              addedFields: body.fields!
            }
          })
          const result = await streamDatabricksEndpoint({
            endpointUrl: agent.endpointUrl!,
            token,
            body: { runId, fields: body.fields, collectedFields: collected },
            onEvent: (ev) => emit({ type: "workflow", event: ev })
          })
          upsertRun({
            id: runId,
            sessionId: run.sessionId,
            agentId: run.agentId,
            status: result.paused ? "paused" : "completed",
            collectedFields: collected,
            resultJson: result.resultText
              ? JSON.stringify({ message_ko: result.resultText })
              : undefined
          })
          if (result.resultText && run.sessionId) {
            addMessage(uuidv4(), run.sessionId, "assistant", result.resultText)
          }
          emit({
            type: "done",
            sessionId: run.sessionId,
            messageId: uuidv4(),
            status: result.paused ? "paused" : "success",
            runId
          })
        } catch (err) {
          emit({
            type: "error",
            message: err instanceof Error ? err.message : String(err)
          })
        } finally {
          controller.close()
        }
      }
    })
    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache"
      }
    })
  }

  // 로컬 시뮬레이션 resume
  const stillMissing = agent ? missingRequiredFromAgent(agent, collected) : []
  const events: WorkflowEvent[] = [
    { type: "run_resumed", runId, addedFields: body.fields }
  ]

  if (stillMissing.length > 0) {
    events.push({
      type: "run_paused",
      runId,
      agentId: run.agentId,
      nodeId: "await_input",
      reason: "missing_fields",
      missingFields: stillMissing,
      collectedFields: collected,
      message_ko: `아직 부족한 정보: ${stillMissing.map((m) => m.label).join(", ")}`
    })
    upsertRun({
      id: runId,
      sessionId: run.sessionId,
      agentId: run.agentId,
      status: "paused",
      missingFields: stillMissing,
      collectedFields: collected
    })
  } else {
    events.push(
      { type: "node_started", runId, nodeId: "execute", label: "Execute" },
      {
        type: "node_log",
        runId,
        nodeId: "execute",
        level: "info",
        message: `(로컬 stub) ${agent?.name ?? run.agentId} resume 실행`
      },
      { type: "node_completed", runId, nodeId: "execute" },
      {
        type: "run_completed",
        runId,
        result: {
          message_ko: `${agent?.name ?? run.agentId} 처리 완료. ${JSON.stringify(collected)}`,
          data: collected
        }
      }
    )
    const resultText = `${agent?.name ?? run.agentId} 처리 완료. ${JSON.stringify(collected)}`
    upsertRun({
      id: runId,
      sessionId: run.sessionId,
      agentId: run.agentId,
      status: "completed",
      collectedFields: collected,
      resultJson: JSON.stringify({ message_ko: resultText })
    })
    if (run.sessionId) {
      addMessage(uuidv4(), run.sessionId, "assistant", resultText)
    }
  }

  // JSON 응답 (폼 제출용) — UI가 SSE 또는 JSON 둘 다 처리 가능
  return Response.json({
    success: true,
    runId,
    status: stillMissing.length ? "paused" : "completed",
    events,
    graph,
    collectedFields: collected,
    missingFields: stillMissing
  })
}
