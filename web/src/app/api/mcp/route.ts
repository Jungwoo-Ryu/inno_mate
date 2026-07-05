import { NextRequest } from "next/server"
import { v4 as uuidv4 } from "uuid"
import { listMcpServers, upsertMcpServer } from "@/lib/db"
import type { McpServerRecord } from "@/lib/types"

export const runtime = "nodejs"

export async function GET() {
  return Response.json(listMcpServers())
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<McpServerRecord>

  if (!body.name?.trim() || !body.url?.trim()) {
    return Response.json({ error: "이름과 URL이 필요합니다" }, { status: 400 })
  }

  const server = upsertMcpServer({
    id: body.id?.trim() || uuidv4(),
    name: body.name.trim(),
    url: body.url.trim(),
    description: body.description?.trim() ?? "",
    enabled: body.enabled ?? true
  })

  return Response.json(server)
}
