import OpenAI from "openai"
import { v4 as uuidv4 } from "uuid"
import type { AgentRecord, InputField } from "@/lib/types"
import {
  DEFAULT_HR_GRAPH,
  type ClientStreamEvent,
  type WorkflowEvent
} from "@/lib/workflow/types"
import { buildToolsFromAgents, findAgentByToolName } from "./tools"
import { streamDatabricksEndpoint } from "./databricks"

const MAX_ROUNDS = 8

function missingRequiredFields(
  agent: AgentRecord,
  collected: Record<string, unknown>
): InputField[] {
  const fields = agent.inputSchema?.fields ?? []
  return fields.filter((f) => {
    if (!f.required) return false
    const v = collected[f.key]
    return v === undefined || v === null || String(v).trim() === ""
  })
}

/** endpoint 없을 때 HITL/완료를 로컬에서 시뮬레이션 */
async function simulateAgentRun(
  agent: AgentRecord,
  args: Record<string, unknown>,
  userMessage: string,
  emit: (e: ClientStreamEvent) => void
): Promise<{ status: "paused" | "success"; message: string; runId: string }> {
  const runId = uuidv4()
  const graph = agent.graph ?? DEFAULT_HR_GRAPH
  const collected = { ...args }
  delete collected.prompt

  const send = (event: WorkflowEvent) => emit({ type: "workflow", event })

  send({ type: "run_started", runId, agentId: agent.id, graph })
  send({ type: "node_started", runId, nodeId: "intake", label: "Intake" })
  send({
    type: "node_log",
    runId,
    nodeId: "intake",
    level: "info",
    message: `프롬프트 수신: ${String(args.prompt ?? userMessage).slice(0, 120)}`
  })
  send({ type: "node_completed", runId, nodeId: "intake" })

  send({ type: "node_started", runId, nodeId: "validate", label: "Validate" })
  const missing = missingRequiredFields(agent, collected)
  send({
    type: "node_log",
    runId,
    nodeId: "validate",
    level: "info",
    message: missing.length
      ? `누락 필드 ${missing.length}개`
      : "필수 필드 충족"
  })
  send({ type: "node_completed", runId, nodeId: "validate" })

  if (missing.length > 0) {
    send({ type: "edge", runId, from: "validate", to: "await_input", condition: "missing" })
    send({ type: "node_started", runId, nodeId: "await_input", label: "Await" })
    const message_ko = `다음 정보가 필요합니다: ${missing.map((m) => m.label).join(", ")}`
    send({
      type: "run_paused",
      runId,
      agentId: agent.id,
      nodeId: "await_input",
      reason: "missing_fields",
      missingFields: missing,
      collectedFields: collected,
      message_ko
    })
    return { status: "paused", message: message_ko, runId }
  }

  send({ type: "edge", runId, from: "validate", to: "execute", condition: "ok" })
  send({ type: "node_started", runId, nodeId: "execute", label: "Execute" })
  send({
    type: "node_log",
    runId,
    nodeId: "execute",
    level: "info",
    message: `(로컬 stub) ${agent.name} 실행 — Databricks endpoint 미연결`
  })
  send({ type: "node_completed", runId, nodeId: "execute" })
  send({ type: "node_started", runId, nodeId: "confirm", label: "Confirm" })
  const resultText = `${agent.name} 처리 완료(stub). 수집 필드: ${JSON.stringify(collected)}`
  send({ type: "node_completed", runId, nodeId: "confirm" })
  send({
    type: "run_completed",
    runId,
    result: { message_ko: resultText, data: collected }
  })
  return { status: "success", message: resultText, runId }
}

export async function runWebSuperAgent(options: {
  apiKey: string
  baseURL?: string
  provider?: "openai" | "azure"
  azureEndpoint?: string
  azureApiVersion?: string
  model: string
  systemPrompt: string
  message: string
  imageDataUrls?: string[]
  history: Array<{ role: "user" | "assistant"; content: string }>
  agents: AgentRecord[]
  databricksToken?: string
  emit: (event: ClientStreamEvent) => void
  signal?: AbortSignal
}): Promise<{ status: "success" | "paused" | "error"; message: string; runId?: string }> {
  let client: OpenAI
  if (options.provider === "azure") {
    const { AzureOpenAI } = await import("openai")
    if (!options.azureEndpoint) {
      throw new Error("Azure Endpoint가 필요합니다")
    }
    client = new AzureOpenAI({
      endpoint: options.azureEndpoint,
      apiKey: options.apiKey,
      apiVersion: options.azureApiVersion || "2024-10-21"
    })
  } else {
    client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL || undefined
    })
  }

  const tools = buildToolsFromAgents(options.agents)
  const userContent: string | OpenAI.Chat.ChatCompletionContentPart[] =
    options.imageDataUrls?.length
      ? [
          {
            type: "text",
            text: options.message || "첨부 이미지를 보고 적합한 에이전트로 처리하세요."
          },
          ...options.imageDataUrls.map(
            (url) =>
              ({
                type: "image_url" as const,
                image_url: { url, detail: "high" as const }
              }) as OpenAI.Chat.ChatCompletionContentPart
          )
        ]
      : options.message

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: options.systemPrompt },
    ...options.history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userContent }
  ]

  // tools 없으면 기존처럼 토큰 스트리밍
  if (tools.length === 0) {
    const stream = await client.chat.completions.create(
      { model: options.model, messages, stream: true },
      options.signal ? { signal: options.signal } : undefined
    )
    let text = ""
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content
      if (delta) {
        text += delta
        options.emit({ type: "token", text: delta })
      }
    }
    return { status: "success", message: text || "응답이 비어 있습니다." }
  }

  for (let round = 0; round < MAX_ROUNDS; round++) {
    options.signal?.throwIfAborted()
    const response = await client.chat.completions.create(
      {
        model: options.model,
        messages,
        tools,
        tool_choice: "auto"
      },
      options.signal ? { signal: options.signal } : undefined
    )

    const msg = response.choices[0]?.message
    if (!msg) break
    messages.push(msg)

    if (msg.tool_calls?.length) {
      for (const call of msg.tool_calls) {
        if (call.type !== "function") continue
        const agent = findAgentByToolName(options.agents, call.function.name)
        const args = JSON.parse(call.function.arguments || "{}") as Record<
          string,
          unknown
        >

        if (!agent) {
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({
              status: "error",
              message_ko: `알 수 없는 tool: ${call.function.name}`
            })
          })
          continue
        }

        let toolPayload: string
        let paused = false
        let runId: string | undefined

        if (agent.endpointUrl && options.databricksToken) {
          try {
            const result = await streamDatabricksEndpoint({
              endpointUrl: agent.endpointUrl,
              token: options.databricksToken,
              body: {
                runId: uuidv4(),
                prompt: String(args.prompt ?? options.message),
                collectedFields: args
              },
              onEvent: (ev) => options.emit({ type: "workflow", event: ev }),
              signal: options.signal
            })
            paused = result.paused
            runId = result.runId
            toolPayload = JSON.stringify({
              status: paused ? "paused" : "success",
              runId,
              message_ko: result.resultText ?? "에이전트 실행 완료"
            })
          } catch (err) {
            toolPayload = JSON.stringify({
              status: "error",
              message_ko: err instanceof Error ? err.message : String(err)
            })
          }
        } else {
          const sim = await simulateAgentRun(
            agent,
            args,
            options.message,
            options.emit
          )
          paused = sim.status === "paused"
          runId = sim.runId
          toolPayload = JSON.stringify({
            status: sim.status,
            runId: sim.runId,
            message_ko: sim.message
          })
        }

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: toolPayload
        })

        if (paused) {
          return {
            status: "paused",
            message:
              "필수 정보가 부족해 워크플로가 일시 중지되었습니다. 아래 필드를 입력해 주세요.",
            runId
          }
        }
      }
      continue
    }

    const text = msg.content ?? ""
    if (text) options.emit({ type: "token", text })
    return { status: "success", message: text || "처리가 완료되었습니다." }
  }

  return { status: "error", message: "최대 tool 라운드에 도달했습니다." }
}
