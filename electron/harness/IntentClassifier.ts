import { OpenAI } from "openai"
import type { IntentClassification, ScreenshotPayload } from "./types"
import { DEFAULT_MODELS } from "../aiModels"

const CLASSIFIER_PROMPT = `You classify G-portal HR screens for LG Innotek InnoMate automation.

Available agents:
- meeting-room: meeting room reservation screens
- asset-export: IT asset export / laptop checkout approval screens
- vacation: vacation / leave application screens
- super: unclear or multi-task requests

Analyze the screenshot(s) and return JSON only:
{
  "agentId": "meeting-room|asset-export|vacation|super",
  "confidence": 0.0-1.0,
  "extractedFields": { "field_name": "value" }
}

Extract any visible form values (dates, room names, asset IDs, leave types) into extractedFields.`

function throwIfAborted(signal?: AbortSignal): void {
  signal?.throwIfAborted()
}

export async function classifyIntent(
  client: OpenAI,
  screenshots: ScreenshotPayload[],
  model = DEFAULT_MODELS.openai.classifier,
  signal?: AbortSignal
): Promise<IntentClassification> {
  throwIfAborted(signal)
  const imageParts = screenshots.map((s) => ({
    type: "image_url" as const,
    image_url: { url: `data:image/png;base64,${s.data}`, detail: "high" as const }
  }))

  const response = await client.chat.completions.create(
    {
      model,
      messages: [
        { role: "system", content: CLASSIFIER_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Classify this G-portal screen and extract fields." },
            ...imageParts
          ]
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 500
    },
    signal ? { signal } : undefined
  )

  const raw = response.choices[0]?.message?.content ?? "{}"
  const parsed = JSON.parse(raw) as IntentClassification

  return {
    agentId: parsed.agentId ?? "super",
    confidence: parsed.confidence ?? 0.5,
    extractedFields: parsed.extractedFields ?? {}
  }
}
