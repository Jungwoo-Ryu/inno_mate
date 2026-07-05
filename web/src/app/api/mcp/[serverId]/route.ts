import { NextRequest } from "next/server"
import { deleteMcpServer } from "@/lib/db"

export const runtime = "nodejs"

type Params = { params: Promise<{ serverId: string }> }

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { serverId } = await params
  deleteMcpServer(serverId)
  return Response.json({ success: true })
}
