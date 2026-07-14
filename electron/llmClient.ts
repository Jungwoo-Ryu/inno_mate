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

/** OpenAI / Azure OpenAI 클라이언트 생성. Anthropic은 미지원(null). */
export function createLlmClient(opts: LlmClientOptions): OpenAI | null {
  const key = opts.apiKey?.trim()
  if (!key) return null

  if (opts.apiProvider === "azure") {
    const endpoint = opts.azureEndpoint?.trim().replace(/\/$/, "")
    if (!endpoint) {
      console.warn("[llmClient] Azure OpenAI requires endpoint URL")
      return null
    }
    const apiVersion =
      opts.azureApiVersion?.trim() || DEFAULT_AZURE_API_VERSION
    return new AzureOpenAI({
      endpoint,
      apiKey: key,
      apiVersion
    })
  }

  if (opts.apiProvider === "openai") {
    const baseURL = opts.openaiBaseUrl?.trim().replace(/\/$/, "") || undefined
    return new OpenAI({
      apiKey: key,
      baseURL
    })
  }

  console.warn(
    `[llmClient] provider=${opts.apiProvider} is not supported via OpenAI SDK`
  )
  return null
}
