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

  const hasStdio = Boolean(body.command?.trim())
  const hasUrl = Boolean(body.url?.trim() || body.endpointUrl?.trim())

  if (!body.name?.trim()) {
    return Response.json({ error: "이름이 필요합니다" }, { status: 400 })
  }
  if (!hasStdio && !hasUrl) {
    return Response.json(
      { error: "stdio(command/args) 또는 http URL이 필요합니다" },
      { status: 400 }
    )
  }

  const transport = body.transport || (hasStdio ? "stdio" : "http")
  const url =
    body.url?.trim() ||
    body.endpointUrl?.trim() ||
    (hasStdio ? `stdio://${body.name.trim()}` : "")

  const server = upsertMcpServer({
    id: body.id?.trim() || uuidv4(),
    name: body.name.trim(),
    url,
    description: body.description?.trim() ?? "",
    enabled: body.enabled ?? true,
    transport,
    command: body.command?.trim(),
    args: body.args,
    cwd: body.cwd?.trim(),
    env: body.env,
    endpointUrl: body.endpointUrl?.trim() || (transport !== "stdio" ? url : undefined)
  })

  return Response.json(server)
}
