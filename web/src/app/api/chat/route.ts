import { NextRequest } from "next/server"
import { v4 as uuidv4 } from "uuid"
import { getDefaultModel, resolveOpenAICredentials } from "@/lib/openai"
import {
  addMessage,
  createSession,
  getAgent,
  getSession,
  listAgents,
  listMessages,
  upsertRun
} from "@/lib/db"
import { runWebSuperAgent } from "@/lib/superAgent/run"
import type { ChatAttachment } from "@/lib/types"
import type { ClientStreamEvent } from "@/lib/workflow/types"

export const runtime = "nodejs"

interface ChatRequestBody {
  sessionId?: string
  agentId?: string
  message: string
  attachments?: ChatAttachment[]
}

function encodeSse(event: ClientStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

export async function POST(req: NextRequest) {
  let body: ChatRequestBody
  try {
    body = (await req.json()) as ChatRequestBody
  } catch {
    return Response.json({ error: "잘못된 요청입니다" }, { status: 400 })
  }

  const message = body.message?.trim() ?? ""
  const attachments = body.attachments ?? []
  if (!message && attachments.length === 0) {
    return Response.json({ error: "메시지를 입력하세요" }, { status: 400 })
  }

  let credentials: ReturnType<typeof resolveOpenAICredentials>
  try {
    credentials = resolveOpenAICredentials()
  } catch (err) {
    return Response.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "OpenAI API Key가 없습니다. 사이드바 API 설정에서 등록하세요."
      },
      { status: 500 }
    )
  }

  const agentId = body.agentId || "super"
  const agent = getAgent(agentId)

  let sessionId = body.sessionId
  if (!sessionId || !getSession(sessionId)) {
    sessionId = uuidv4()
    const title =
      message.length > 0
        ? message.slice(0, 40) + (message.length > 40 ? "…" : "")
        : attachments[0]?.name ?? "새 대화"
    createSession(sessionId, title, agentId)
  }

  const history = listMessages(sessionId)
  addMessage(uuidv4(), sessionId, "user", message, attachments)

  const systemPrompt =
    agent?.guide?.trim() ||
    `You are InnoMate Super Agent for LG Innotek.
Delegate HR/G-portal tasks to registered Databricks tools when available.
Respond in Korean (존댓말).`

  const imageDataUrls = attachments
    .filter((a) => a.kind === "image" && a.content)
    .map((a) => a.content as string)

  const registryAgents = listAgents(true)
  const encoder = new TextEncoder()
  const capturedSessionId = sessionId
  const messageId = uuidv4()

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: ClientStreamEvent) => {
        controller.enqueue(encoder.encode(encodeSse(event)))

        if (event.type === "workflow") {
          const we = event.event
          if (we.type === "run_paused") {
            upsertRun({
              id: we.runId,
              sessionId: capturedSessionId,
              agentId: we.agentId,
              status: "paused",
              missingFields: we.missingFields,
              collectedFields: we.collectedFields
            })
          }
          if (we.type === "run_completed") {
            upsertRun({
              id: we.runId,
              sessionId: capturedSessionId,
              agentId: agentId,
              status: "completed",
              resultJson: JSON.stringify(we.result)
            })
          }
        }
      }

      try {
        const result = await runWebSuperAgent({
          apiKey: credentials.apiKey,
          baseURL: credentials.baseURL,
          model: agent?.model || credentials.model || getDefaultModel(),
          systemPrompt,
          message,
          imageDataUrls,
          history: history.map((m) => ({ role: m.role, content: m.content })),
          agents: registryAgents,
          databricksToken:
            process.env.DATABRICKS_TOKEN ||
            process.env.DATABRICKS_CLIENT_SECRET ||
            undefined,
          emit
        })

        if (result.message.trim()) {
          addMessage(messageId, capturedSessionId, "assistant", result.message)
        }

        emit({
          type: "done",
          sessionId: capturedSessionId,
          messageId,
          status: result.status,
          runId: result.runId
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : "실행 오류"
        emit({ type: "error", message: msg })
        emit({
          type: "done",
          sessionId: capturedSessionId,
          messageId,
          status: "error"
        })
      } finally {
        controller.close()
      }
    }
  })

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Session-Id": sessionId
    }
  })
}
