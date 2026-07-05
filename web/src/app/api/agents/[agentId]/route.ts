import { NextRequest } from "next/server"
import { deleteAgent, getAgent, upsertAgent } from "@/lib/db"
import type { AgentRecord } from "@/lib/types"

export const runtime = "nodejs"

type Params = { params: Promise<{ agentId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { agentId } = await params
  const agent = getAgent(agentId)
  if (!agent) {
    return Response.json({ error: "에이전트를 찾을 수 없습니다" }, { status: 404 })
  }
  return Response.json(agent)
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { agentId } = await params
  const existing = getAgent(agentId)
  if (!existing) {
    return Response.json({ error: "에이전트를 찾을 수 없습니다" }, { status: 404 })
  }

  const body = (await req.json()) as Partial<AgentRecord>
  const agent = upsertAgent({
    id: agentId,
    name: body.name?.trim() || existing.name,
    version: body.version?.trim() || existing.version,
    guide: body.guide ?? existing.guide,
    tools: Array.isArray(body.tools) ? body.tools : existing.tools,
    delegates: Array.isArray(body.delegates) ? body.delegates : existing.delegates,
    model: body.model?.trim() || existing.model,
    classifierModel: body.classifierModel?.trim() || existing.classifierModel,
    enabled: body.enabled ?? existing.enabled
  })

  return Response.json(agent)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { agentId } = await params
  deleteAgent(agentId)
  return Response.json({ success: true })
}
