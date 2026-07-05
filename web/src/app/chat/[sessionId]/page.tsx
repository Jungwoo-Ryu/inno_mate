import { redirect } from "next/navigation"
import ChatView from "@/components/ChatView"
import { getSession, listMessages } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function ChatSessionPage({
  params
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params
  const session = getSession(sessionId)
  if (!session) redirect("/chat")

  const messages = listMessages(sessionId)

  return (
    <ChatView
      key={sessionId}
      sessionId={sessionId}
      initialMessages={messages}
      initialAgentId={session.agentId}
    />
  )
}
