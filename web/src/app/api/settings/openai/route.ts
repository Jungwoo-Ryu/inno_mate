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

export async function GET() {
  const s = getOpenAISettings()
  return Response.json({
    baseUrl: s.baseUrl,
    model: s.model,
    hasApiKey: s.hasApiKey,
    apiKeyMasked: s.hasApiKey ? maskKey(s.apiKey) : ""
  })
}

export async function PUT(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    baseUrl?: string
    apiKey?: string
    model?: string
  }

  saveOpenAISettings({
    baseUrl: body.baseUrl,
    apiKey: body.apiKey,
    model: body.model
  })
  resetOpenAIClient()

  const s = getOpenAISettings()
  return Response.json({
    success: true,
    baseUrl: s.baseUrl,
    model: s.model,
    hasApiKey: s.hasApiKey,
    apiKeyMasked: s.hasApiKey ? maskKey(s.apiKey) : ""
  })
}
