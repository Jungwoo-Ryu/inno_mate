import { NextRequest } from "next/server"
import { v4 as uuidv4 } from "uuid"
import type OpenAI from "openai"
import { getOpenAIClient, getDefaultModel } from "@/lib/openai"
import {
  addMessage,
  createSession,
  getAgent,
  getSession,
  listMessages
} from "@/lib/db"
import type { ChatAttachment } from "@/lib/types"

export const runtime = "nodejs"

interface ChatRequestBody {
  sessionId?: string
  agentId?: string
  message: string
  attachments?: ChatAttachment[]
}

const MAX_INLINE_TEXT_CHARS = 30_000

function buildUserContent(
  message: string,
  attachments: ChatAttachment[]
): string | OpenAI.Chat.ChatCompletionContentPart[] {
  if (attachments.length === 0) return message

  const parts: OpenAI.Chat.ChatCompletionContentPart[] = [
    { type: "text", text: message || "(첨부 파일을 확인해 주세요)" }
  ]

  for (const att of attachments) {
    if (att.kind === "text" && att.content) {
      const clipped =
        att.content.length > MAX_INLINE_TEXT_CHARS
          ? `${att.content.slice(0, MAX_INLINE_TEXT_CHARS)}\n...(잘림)`
          : att.content
      parts.push({
        type: "text",
        text: `\n\n[첨부 파일: ${att.name}]\n${clipped}`
      })
    } else if (att.kind === "image" && att.content) {
      parts.push({ type: "text", text: `\n\n[첨부 이미지: ${att.name}]` })
      parts.push({
        type: "image_url",
        image_url: { url: att.content, detail: "high" }
      })
    } else {
      parts.push({
        type: "text",
        text: `\n\n[첨부 파일(내용 미포함): ${att.name} · ${att.mimeType} · ${att.size} bytes]`
      })
    }
  }

  return parts
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

  const agentId = body.agentId || "super"
  const agent = getAgent(agentId)

  // 세션 확보 (없으면 생성, 제목 = 첫 메시지 요약)
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
    "You are InnoMate, LG Innotek's AI Super Agent. Respond in Korean (존댓말)."

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({
      role: m.role,
      content: m.content
    })),
    { role: "user", content: buildUserContent(message, attachments) }
  ]

  let client: ReturnType<typeof getOpenAIClient>
  try {
    client = getOpenAIClient()
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "OpenAI 설정 오류" },
      { status: 500 }
    )
  }

  const model = agent?.model || getDefaultModel()

  try {
    const stream = await client.chat.completions.create({
      model,
      messages,
      stream: true
    })

    const encoder = new TextEncoder()
    let assistantText = ""
    const capturedSessionId = sessionId

    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content
            if (delta) {
              assistantText += delta
              controller.enqueue(encoder.encode(delta))
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "스트리밍 오류"
          controller.enqueue(encoder.encode(`\n\n[오류] ${msg}`))
        } finally {
          if (assistantText.trim()) {
            addMessage(uuidv4(), capturedSessionId, "assistant", assistantText)
          }
          controller.close()
        }
      }
    })

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Session-Id": sessionId
      }
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "OpenAI 호출 실패"
    return Response.json({ error: msg }, { status: 502 })
  }
}
