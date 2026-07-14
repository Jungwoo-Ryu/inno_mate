import OpenAI, { AzureOpenAI } from "openai"
import { getOpenAISettings } from "./db"

let client: OpenAI | null = null
let clientFingerprint = ""

function fingerprint(parts: string[]): string {
  return parts.join("::")
}

export function resetOpenAIClient(): void {
  client = null
  clientFingerprint = ""
}

export function getOpenAIClient(): OpenAI {
  const s = getOpenAISettings()
  if (!s.apiKey) {
    throw new Error(
      "API Key가 없습니다. 사이드바 설정에서 OpenAI 또는 Azure OpenAI를 등록하세요."
    )
  }

  if (s.provider === "azure") {
    if (!s.azureEndpoint) {
      throw new Error(
        "Azure Endpoint가 없습니다. 사이드바 API 설정에서 Endpoint URL을 입력하세요."
      )
    }
    const fp = fingerprint([
      "azure",
      s.azureEndpoint,
      s.azureApiVersion,
      s.apiKey.slice(0, 8),
      String(s.apiKey.length)
    ])
    if (client && clientFingerprint === fp) return client

    client = new AzureOpenAI({
      endpoint: s.azureEndpoint,
      apiKey: s.apiKey,
      apiVersion: s.azureApiVersion || "2024-10-21"
    })
    clientFingerprint = fp
    return client
  }

  const fp = fingerprint([
    "openai",
    s.baseUrl,
    s.apiKey.slice(0, 8),
    String(s.apiKey.length)
  ])
  if (client && clientFingerprint === fp) return client

  client = new OpenAI({
    apiKey: s.apiKey,
    baseURL: s.baseUrl || undefined
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
  provider: "openai" | "azure"
  azureEndpoint?: string
  azureApiVersion?: string
} {
  const s = getOpenAISettings()
  if (!s.apiKey) {
    throw new Error("API Key가 없습니다. 사이드바 설정에서 등록하세요.")
  }
  return {
    apiKey: s.apiKey,
    baseURL: s.provider === "openai" ? s.baseUrl || undefined : undefined,
    model: s.model,
    provider: s.provider,
    azureEndpoint: s.azureEndpoint || undefined,
    azureApiVersion: s.azureApiVersion || undefined
  }
}
