import { NextRequest } from "next/server"
import { deleteSession, getSession, listMessages, renameSession } from "@/lib/db"

export const runtime = "nodejs"

type Params = { params: Promise<{ sessionId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { sessionId } = await params
  const session = getSession(sessionId)
  if (!session) {
    return Response.json({ error: "세션을 찾을 수 없습니다" }, { status: 404 })
  }
  return Response.json({ session, messages: listMessages(sessionId) })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { sessionId } = await params
  const body = (await req.json()) as { title?: string }
  if (body.title?.trim()) {
    renameSession(sessionId, body.title.trim())
  }
  return Response.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { sessionId } = await params
  deleteSession(sessionId)
  return Response.json({ success: true })
}
