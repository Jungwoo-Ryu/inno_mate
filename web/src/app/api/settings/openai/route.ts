import { NextRequest } from "next/server"
import {
  getOpenAISettings,
  saveOpenAISettings
} from "@/lib/db"
import { resetOpenAIClient } from "@/lib/openai"

export const runtime = "nodejs"

function maskKey(key: string): string {
  if (!key) return ""
  if (key.length <= 8) return "••••••••"
  return `${key.slice(0, 3)}••••${key.slice(-4)}`
}

function toResponse() {
  const s = getOpenAISettings()
  return {
    provider: s.provider,
    baseUrl: s.baseUrl,
    azureEndpoint: s.azureEndpoint,
    azureApiVersion: s.azureApiVersion,
    model: s.model,
    hasApiKey: s.hasApiKey,
    apiKeyMasked: s.hasApiKey ? maskKey(s.apiKey) : ""
  }
}

export async function GET() {
  return Response.json(toResponse())
}

export async function PUT(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    provider?: "openai" | "azure"
    baseUrl?: string
    apiKey?: string
    model?: string
    azureEndpoint?: string
    azureApiVersion?: string
  }

  if (body.provider === "azure" && body.azureEndpoint !== undefined) {
    if (!body.azureEndpoint.trim() && !getOpenAISettings().azureEndpoint) {
      return Response.json(
        { error: "Azure Endpoint URL이 필요합니다" },
        { status: 400 }
      )
    }
  }

  saveOpenAISettings({
    provider: body.provider,
    baseUrl: body.baseUrl,
    apiKey: body.apiKey,
    model: body.model,
    azureEndpoint: body.azureEndpoint,
    azureApiVersion: body.azureApiVersion
  })
  resetOpenAIClient()

  return Response.json({
    success: true,
    ...toResponse()
  })
}
