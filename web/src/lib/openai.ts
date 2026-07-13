import OpenAI from "openai"
import { getOpenAISettings } from "./db"

let client: OpenAI | null = null
let clientFingerprint = ""

function fingerprint(apiKey: string, baseUrl: string): string {
  return `${baseUrl}::${apiKey.slice(0, 8)}::${apiKey.length}`
}

export function resetOpenAIClient(): void {
  client = null
  clientFingerprint = ""
}

export function getOpenAIClient(): OpenAI {
  const { apiKey, baseUrl } = getOpenAISettings()
  if (!apiKey) {
    throw new Error(
      "OpenAI API Key가 없습니다. 사이드바 설정에서 등록하거나 web/.env.local을 확인하세요."
    )
  }

  const fp = fingerprint(apiKey, baseUrl)
  if (client && clientFingerprint === fp) return client

  const isAzure = (baseUrl || "").includes(".openai.azure.com")
  client = new OpenAI({
    apiKey,
    baseURL: baseUrl || undefined,
    ...(isAzure && {
      defaultQuery: { "api-version": process.env.OPENAI_API_VERSION || "2025-01-01-preview" },
      defaultHeaders: { "api-key": apiKey }
    })
  })
  clientFingerprint = fp
  return client
}

export function getDefaultModel(): string {
  return getOpenAISettings().model
}

export function resolveOpenAICredentials(): {
  apiKey: string
  baseURL?: string
  model: string
} {
  const s = getOpenAISettings()
  if (!s.apiKey) {
    throw new Error(
      "OpenAI API Key가 없습니다. 사이드바 설정에서 등록하세요."
    )
  }
  return {
    apiKey: s.apiKey,
    baseURL: s.baseUrl || undefined,
    model: s.model
  }
}
