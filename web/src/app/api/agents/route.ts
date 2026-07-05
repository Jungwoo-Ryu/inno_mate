import { NextRequest } from "next/server"
import { listAgents, upsertAgent } from "@/lib/db"
import type { AgentRecord } from "@/lib/types"

export const runtime = "nodejs"

/**
 * GET /api/agents            — 전체 목록 (웹 관리용)
 * GET /api/agents?enabled=true — 활성 에이전트만 (데스크톱 sync용)
 */
export async function GET(req: NextRequest) {
  const enabledOnly = req.nextUrl.searchParams.get("enabled") === "true"
  return Response.json(listAgents(enabledOnly))
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<AgentRecord>

  const id = body.id?.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-")
  if (!id) {
    return Response.json({ error: "에이전트 ID가 필요합니다" }, { status: 400 })
  }

  const agent = upsertAgent({
    id,
    name: body.name?.trim() || id,
    version: body.version?.trim() || "1.0.0",
    guide: body.guide ?? "",
    tools: Array.isArray(body.tools) ? body.tools : [],
    delegates: Array.isArray(body.delegates) ? body.delegates : [],
    model: body.model?.trim() || "gpt-5.5",
    classifierModel: body.classifierModel?.trim() || "gpt-5.4-mini",
    enabled: body.enabled ?? true
  })

  return Response.json(agent)
}
