import { OpenAI, AzureOpenAI } from "openai"
import type { APIProvider } from "./aiModels"
import { DEFAULT_AZURE_API_VERSION } from "./aiModels"

export interface LlmClientOptions {
  apiProvider: APIProvider
  apiKey: string
  openaiBaseUrl?: string
  azureEndpoint?: string
  azureApiVersion?: string
}

function normalizeAzureStyleUrl(rawUrl: string): {
  normalizedUrl: string
  endpointRoot?: string
  apiVersion?: string
  isAzure: boolean
} {
  const trimmed = rawUrl.trim().replace(/\/$/, "")
  if (!trimmed) {
    return { normalizedUrl: "", isAzure: false }
  }

  const isAzure = trimmed.includes(".openai.azure.com")
  if (!isAzure) {
    return { normalizedUrl: trimmed, isAzure: false }
  }

  try {
    const u = new URL(trimmed)
    let pathname = u.pathname.replace(/\/$/, "")
    if (pathname.endsWith("/chat/completions")) {
      pathname = pathname.slice(0, -"/chat/completions".length)
    }
    const normalizedUrl = `${u.origin}${pathname}`
    return {
      normalizedUrl,
      endpointRoot: u.origin,
      apiVersion: u.searchParams.get("api-version") || undefined,
      isAzure: true
    }
  } catch {
    return { normalizedUrl: trimmed, isAzure: true }
  }
}

/** OpenAI / Azure OpenAI 클라이언트 생성. Anthropic은 미지원(null). */
export function createLlmClient(opts: LlmClientOptions): OpenAI | null {
  const key = opts.apiKey?.trim()
  if (!key) return null

  if (opts.apiProvider === "azure") {
    const normalized = normalizeAzureStyleUrl(opts.azureEndpoint || "")
    const endpoint =
      normalized.endpointRoot || normalized.normalizedUrl || undefined
    if (!endpoint) {
      console.warn("[llmClient] Azure OpenAI requires endpoint URL")
      return null
    }
    const apiVersion =
      opts.azureApiVersion?.trim() ||
      normalized.apiVersion ||
      DEFAULT_AZURE_API_VERSION
    return new AzureOpenAI({
      endpoint,
      apiKey: key,
      apiVersion
    })
  }

  if (opts.apiProvider === "openai") {
    const normalized = normalizeAzureStyleUrl(opts.openaiBaseUrl || "")
    const baseURL = normalized.normalizedUrl || undefined
    const azureApiVersion =
      normalized.apiVersion || process.env.OPENAI_API_VERSION || DEFAULT_AZURE_API_VERSION
    return new OpenAI({
      apiKey: key,
      baseURL,
      ...(normalized.isAzure && {
        defaultQuery: { "api-version": azureApiVersion },
        defaultHeaders: { "api-key": key }
      })
    })
  }

  console.warn(
    `[llmClient] provider=${opts.apiProvider} is not supported via OpenAI SDK`
  )
  return null
}
