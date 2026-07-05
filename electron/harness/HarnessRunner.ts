import { OpenAI } from "openai"
import type { ChatCompletionTool } from "openai/resources/chat/completions"
import { harnessLoader } from "./HarnessLoader"
import { classifyIntent, classifyIntentFromText } from "./IntentClassifier"
import type { AgentRunResult, AttachmentPayload, LoadedHarness, ScreenshotPayload } from "./types"
import { getGPortalTools, executeGPortalTool } from "../gportal/tools"
import { configHelper } from "../ConfigHelper"
import { DEFAULT_MODELS } from "../aiModels"

const MAX_TOOL_ROUNDS = 8

function throwIfAborted(signal?: AbortSignal): void {
  signal?.throwIfAborted()
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === "AbortError") ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error as { name: string }).name === "AbortError")
  )
}

function buildTools(harness: LoadedHarness): ChatCompletionTool[] {
  const allTools = getGPortalTools()
  return harness.config.tools
    .map((name) => allTools.find((t) => t.function.name === name))
    .filter((t): t is ChatCompletionTool => t !== undefined)
}

export class HarnessRunner {
  private client: OpenAI | null = null

  setClient(client: OpenAI | null): void {
    this.client = client
  }

  async runFromScreenshots(
    screenshots: ScreenshotPayload[],
    userPrompt?: string,
    attachments: AttachmentPayload[] = [],
    signal?: AbortSignal
  ): Promise<AgentRunResult> {
    throwIfAborted(signal)
    if (!this.client) {
      return {
        status: "error",
        agentId: "unknown",
        message_ko: "OpenAI API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해 주세요."
      }
    }

    let agentId: string
    let extractedFields: Record<string, string> = {}

    if (userPrompt?.trim() || attachments.length > 0) {
      agentId = "super"
    } else if (screenshots.length === 0) {
      return {
        status: "needs_input",
        agentId: "super",
        message_ko: "스크린샷, 파일 첨부, 또는 업무 내용 입력 중 하나 이상이 필요합니다."
      }
    } else {
      const config = configHelper.loadConfig()
      const classification = await classifyIntent(
        this.client,
        screenshots,
        config.extractionModel || DEFAULT_MODELS.openai.classifier,
        signal
      )
      agentId =
        classification.agentId === "super"
          ? "meeting-room"
          : classification.agentId
      extractedFields = classification.extractedFields

      if (classification.confidence < 0.4) {
        return {
          status: "needs_input",
          agentId: classification.agentId,
          message_ko:
            "화면을 정확히 파악하지 못했습니다. G-portal 업무 화면을 캡처했는지 확인하거나, 프롬프트를 입력해 주세요.",
          missingFields: Object.keys(extractedFields)
        }
      }
    }

    const harness = harnessLoader.loadHarness(agentId)
    if (!harness) {
      return {
        status: "error",
        agentId,
        message_ko: `에이전트 '${agentId}' 설정을 찾을 수 없습니다.`
      }
    }

    return this.runHarness(harness, screenshots, userPrompt, extractedFields, attachments, signal)
  }

  /**
   * PoC OCR 파이프라인: OCR 텍스트를 프롬프트로 만들어 Super Agent(사내 OpenAI API)에 전송,
   * 적합한 서브 에이전트로 라우팅한 뒤 해당 harness를 실행한다. 이미지는 전송하지 않는다.
   */
  async runFromOcrText(
    ocrText: string,
    userPrompt?: string,
    signal?: AbortSignal
  ): Promise<AgentRunResult & { routedFrom?: string }> {
    throwIfAborted(signal)
    if (!this.client) {
      return {
        status: "error",
        agentId: "super",
        message_ko: "OpenAI API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해 주세요."
      }
    }

    // 1) Super Agent 라우팅: OCR 텍스트로 의도 분류 → 서브 에이전트 할당
    const config = configHelper.loadConfig()
    const classification = await classifyIntentFromText(
      this.client,
      ocrText,
      userPrompt,
      config.extractionModel || DEFAULT_MODELS.openai.classifier,
      signal
    )
    console.log(
      `[HarnessRunner] OCR routing → ${classification.agentId} (confidence ${classification.confidence})`
    )

    if (classification.confidence < 0.4) {
      return {
        status: "needs_input",
        agentId: classification.agentId,
        message_ko:
          "OCR 텍스트로 업무 유형을 파악하지 못했습니다. G-portal 업무 화면인지 확인하거나 프롬프트를 함께 입력해 주세요.",
        data: { ocrText }
      }
    }

    const agentId = classification.agentId
    const harness = harnessLoader.loadHarness(agentId)
    if (!harness) {
      return {
        status: "error",
        agentId,
        message_ko: `에이전트 '${agentId}' 설정을 찾을 수 없습니다.`
      }
    }

    // 2) 서브 에이전트 실행: OCR 텍스트를 컨텍스트로 전달
    const ocrPromptText = [
      userPrompt?.trim() ? `User request: ${userPrompt.trim()}` : null,
      `Execute the task based on the following OCR text extracted from the user's G-portal screen capture. The text may contain OCR errors — interpret robustly.`,
      `[OCR text]\n${ocrText}`,
      Object.keys(classification.extractedFields).length > 0
        ? `Extracted fields: ${JSON.stringify(classification.extractedFields)}`
        : null
    ]
      .filter(Boolean)
      .join("\n\n")

    const result = await this.runHarnessWithText(harness, ocrPromptText, signal)
    return { ...result, routedFrom: "super", data: { ...result.data, ocrText } }
  }

  /** 텍스트 전용 harness 실행 (이미지 미전송) */
  private async runHarnessWithText(
    harness: LoadedHarness,
    userText: string,
    signal?: AbortSignal
  ): Promise<AgentRunResult> {
    if (!this.client) {
      return {
        status: "error",
        agentId: harness.config.id,
        message_ko: "OpenAI 클라이언트가 초기화되지 않았습니다."
      }
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: harness.guideContent },
      { role: "user", content: userText }
    ]

    return this.runToolLoop(harness, messages, signal)
  }

  private buildUserContent(
    screenshots: ScreenshotPayload[],
    userPrompt?: string,
    extractedFields?: Record<string, string>,
    attachments: AttachmentPayload[] = []
  ): OpenAI.Chat.ChatCompletionContentPart[] {
    const contextNote =
      extractedFields && Object.keys(extractedFields).length > 0
        ? `\n\nExtracted fields from screenshot: ${JSON.stringify(extractedFields)}`
        : ""

    const parts: OpenAI.Chat.ChatCompletionContentPart[] = [
      {
        type: "text",
        text: userPrompt?.trim()
          ? `User request: ${userPrompt}${contextNote}`
          : attachments.length > 0
          ? `Analyze the attached file(s) and G-portal screenshot(s) to execute the task.${contextNote}`
          : `Execute the task based on the G-portal screenshot(s). No user prompt — infer intent from the screen.${contextNote}`
      }
    ]

    for (const att of attachments) {
      if (att.kind === "text") {
        parts.push({
          type: "text",
          text: `\n\n[첨부 파일: ${att.name}]\n${att.content}`
        })
      } else if (att.kind === "image") {
        parts.push({ type: "text", text: `\n\n[첨부 이미지: ${att.name}]` })
        parts.push({
          type: "image_url",
          image_url: {
            url: `data:${att.mimeType};base64,${att.content}`,
            detail: "high"
          }
        })
      } else {
        parts.push({ type: "text", text: `\n\n${att.content}` })
      }
    }

    for (const s of screenshots) {
      parts.push({
        type: "image_url",
        image_url: {
          url: `data:image/png;base64,${s.data}`,
          detail: "high"
        }
      })
    }

    return parts
  }

  private async runHarness(
    harness: LoadedHarness,
    screenshots: ScreenshotPayload[],
    userPrompt?: string,
    extractedFields?: Record<string, string>,
    attachments: AttachmentPayload[] = [],
    signal?: AbortSignal
  ): Promise<AgentRunResult> {
    if (!this.client) {
      return {
        status: "error",
        agentId: harness.config.id,
        message_ko: "OpenAI 클라이언트가 초기화되지 않았습니다."
      }
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: harness.guideContent },
      {
        role: "user",
        content: this.buildUserContent(
          screenshots,
          userPrompt,
          extractedFields,
          attachments
        )
      }
    ]

    return this.runToolLoop(harness, messages, signal)
  }

  /** 공용 툴 실행 루프: harness의 도구를 호출하며 최종 결과를 반환 */
  private async runToolLoop(
    harness: LoadedHarness,
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    signal?: AbortSignal
  ): Promise<AgentRunResult> {
    if (!this.client) {
      return {
        status: "error",
        agentId: harness.config.id,
        message_ko: "OpenAI 클라이언트가 초기화되지 않았습니다."
      }
    }

    const tools = buildTools(harness)
    const config = configHelper.loadConfig()
    const model =
      config.agentModel ||
      config.solutionModel ||
      harness.config.model ||
      DEFAULT_MODELS.openai.agent

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      throwIfAborted(signal)

      const response = await this.client.chat.completions.create(
        {
          model,
          messages,
          tools: tools.length > 0 ? tools : undefined,
          tool_choice: tools.length > 0 ? "auto" : undefined
        },
        signal ? { signal } : undefined
      )

      const choice = response.choices[0]
      if (!choice) break

      const msg = choice.message
      messages.push(msg)

      if (msg.tool_calls?.length) {
        for (const call of msg.tool_calls) {
          throwIfAborted(signal)
          if (call.type !== "function") continue
          const args = JSON.parse(call.function.arguments || "{}")
          const toolResult = await executeGPortalTool(call.function.name, args)
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(toolResult)
          })
        }
        continue
      }

      const text = msg.content ?? ""
      try {
        const parsed = JSON.parse(text) as AgentRunResult
        if (parsed.message_ko) {
          return { ...parsed, agentId: harness.config.id }
        }
      } catch {
        // plain text fallback
      }

      return {
        status: "success",
        agentId: harness.config.id,
        message_ko: text || "업무 처리가 완료되었습니다."
      }
    }

    return {
      status: "error",
      agentId: harness.config.id,
      message_ko: "에이전트 실행 중 최대 반복 횟수에 도달했습니다."
    }
  }
}

export const harnessRunner = new HarnessRunner()

export { isAbortError }
