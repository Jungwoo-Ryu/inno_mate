import OpenAI from "openai"

let client: OpenAI | null = null

export function getOpenAIClient(): OpenAI {
  if (client) return client

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY가 설정되지 않았습니다. web/.env.local을 확인하세요."
    )
  }

  client = new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || undefined
  })
  return client
}

export function getDefaultModel(): string {
  return process.env.OPENAI_MODEL || "gpt-5.5"
}
