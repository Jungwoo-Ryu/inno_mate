import OpenAI from "openai"
import type { RegisteredAgent, WorkflowEvent } from "../../agent-spec/src/index"
import { buildToolsFromRegistry, findAgentByToolName } from "./tool-builder"
import { streamDatabricksInvoke } from "./databricks"

const MAX_ROUNDS = 8

export interface SuperAgentConfig {
  apiKey: string
  baseURL?: string
  model: string
  databricksToken?: string
  systemPrompt?: string
}

export interface SuperAgentRunInput {
  message: string
  /** data URL or base64 png for vision */
  imageDataUrls?: string[]
  agents: RegisteredAgent[]
  onEvent?: (event: WorkflowEvent | { type: "token"; text: string }) => void
  signal?: AbortSignal
}

export interface SuperAgentRunResult {
  status: "success" | "paused" | "error"
  message: string
  runId?: string
  agentId?: string
}

function buildUserContent(
  message: string,
  imageDataUrls?: string[]
): string | OpenAI.Chat.ChatCompletionContentPart[] {
  if (!imageDataUrls?.length) return message
  return [
    { type: "text", text: message || "스크린샷을 보고 적합한 업무 에이전트로 처리하세요." },
    ...imageDataUrls.map(
      (url) =>
        ({
          type: "image_url" as const,
          image_url: { url, detail: "high" as const }
        }) as OpenAI.Chat.ChatCompletionContentPart
    )
  ]
}

/**
 * Super Agent: 레지스트리 tools로 OpenAI tool-calling 후 Databricks 위임.
 * endpoint가 없거나 databricksToken이 없으면 로컬 텍스트 응답만 수행.
 */
export async function runSuperAgent(
  config: SuperAgentConfig,
  input: SuperAgentRunInput
): Promise<SuperAgentRunResult> {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL || undefined
  })

  const tools = buildToolsFromRegistry(input.agents)
  const system =
    config.systemPrompt ||
    `You are InnoMate Super Agent for LG Innotek.
Delegate domain HR/G-portal tasks to registered Databricks tools when available.
Respond in Korean (존댓말). If tools are available, prefer calling them.`

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    {
      role: "user",
      content: buildUserContent(input.message, input.imageDataUrls)
    }
  ]

  for (let round = 0; round < MAX_ROUNDS; round++) {
    input.signal?.throwIfAborted()

    const response = await client.chat.completions.create(
      {
        model: config.model,
        messages,
        tools: tools.length ? tools : undefined,
        tool_choice: tools.length ? "auto" : undefined
      },
      input.signal ? { signal: input.signal } : undefined
    )

    const msg = response.choices[0]?.message
    if (!msg) break
    messages.push(msg)

    if (msg.tool_calls?.length) {
      for (const call of msg.tool_calls) {
        if (call.type !== "function") continue
        const agent = findAgentByToolName(input.agents, call.function.name)
        const args = JSON.parse(call.function.arguments || "{}") as Record<
          string,
          unknown
        >

        if (!agent?.endpointUrl || !config.databricksToken) {
          const stub = JSON.stringify({
            status: "error",
            message_ko: agent
              ? `에이전트 '${agent.id}' endpoint 또는 Databricks 토큰이 없습니다.`
              : `알 수 없는 tool: ${call.function.name}`
          })
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: stub
          })
          continue
        }

        const runId = crypto.randomUUID()
        let toolSummary = ""
        let paused = false

        try {
          const result = await streamDatabricksInvoke({
            endpointUrl: agent.endpointUrl,
            token: config.databricksToken,
            body: {
              runId,
              prompt: String(args.prompt ?? input.message),
              collectedFields: args,
              sessionId: runId
            },
            onEvent: (ev) => input.onEvent?.(ev),
            signal: input.signal
          })
          paused = result.paused
          toolSummary = JSON.stringify({
            status: paused ? "paused" : "success",
            runId: result.runId ?? runId,
            message_ko: result.resultText ?? "에이전트 실행 완료"
          })
          if (paused) {
            messages.push({
              role: "tool",
              tool_call_id: call.id,
              content: toolSummary
            })
            return {
              status: "paused",
              message:
                "필수 정보가 부족해 워크플로가 일시 중지되었습니다. 누락 필드를 입력해 주세요.",
              runId: result.runId ?? runId,
              agentId: agent.id
            }
          }
        } catch (err) {
          toolSummary = JSON.stringify({
            status: "error",
            message_ko: err instanceof Error ? err.message : String(err)
          })
        }

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: toolSummary
        })
      }
      continue
    }

    const text = msg.content ?? ""
    if (text) input.onEvent?.({ type: "token", text })
    return { status: "success", message: text || "처리가 완료되었습니다." }
  }

  return { status: "error", message: "최대 tool 라운드에 도달했습니다." }
}
