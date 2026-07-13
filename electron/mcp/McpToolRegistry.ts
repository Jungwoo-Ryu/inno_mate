import type { ChatCompletionTool } from "openai/resources/chat/completions"
import type { McpServerConfig } from "./types"
import type { McpToolSummary } from "./McpClient"
import { callMcpTool } from "./McpClient"
import { getMcpServers } from "./McpStore"

/** OpenAI function.name: ^[a-zA-Z0-9_-]+$ */
export function toOpenAiMcpToolName(serverName: string, toolName: string): string {
  const s = serverName.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 24) || "srv"
  const t = toolName.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 48) || "tool"
  return `mcp_${s}_${t}`
}

export interface ResolvedMcpTool {
  openAiName: string
  server: McpServerConfig
  tool: McpToolSummary
}

/**
 * 활성화된 MCP 서버의 캐시된 tools → Super Agent용 OpenAI tools
 */
export function getCachedMcpToolsForSuper(): {
  tools: ChatCompletionTool[]
  resolve: (openAiName: string) => ResolvedMcpTool | null
} {
  const servers = getMcpServers().filter((s) => s.enabled)
  const byName = new Map<string, ResolvedMcpTool>()
  const tools: ChatCompletionTool[] = []

  for (const server of servers) {
    for (const tool of server.cachedTools ?? []) {
      const openAiName = toOpenAiMcpToolName(server.name, tool.name)
      if (byName.has(openAiName)) continue

      const parameters =
        tool.inputSchema &&
        typeof tool.inputSchema === "object" &&
        (tool.inputSchema as { type?: string }).type === "object"
          ? tool.inputSchema
          : {
              type: "object",
              properties:
                (tool.inputSchema as { properties?: Record<string, unknown> })
                  ?.properties ?? {},
              additionalProperties: true
            }

      const resolved: ResolvedMcpTool = { openAiName, server, tool }
      byName.set(openAiName, resolved)

      tools.push({
        type: "function",
        function: {
          name: openAiName,
          description:
            tool.description?.trim() ||
            `MCP tool "${tool.name}" from server "${server.name}"`,
          parameters: parameters as Record<string, unknown>
        }
      })
    }
  }

  return {
    tools,
    resolve: (openAiName: string) => byName.get(openAiName) ?? null
  }
}

export async function executeCachedMcpTool(
  openAiName: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { resolve } = getCachedMcpToolsForSuper()
  const hit = resolve(openAiName)
  if (!hit) {
    return { success: false, error: `Unknown MCP tool: ${openAiName}` }
  }

  const result = await callMcpTool(hit.server, hit.tool.name, args)
  if (!result.ok) {
    return {
      success: false,
      error: result.error ?? "MCP tool call failed",
      server: hit.server.name,
      tool: hit.tool.name
    }
  }
  return {
    success: true,
    server: hit.server.name,
    tool: hit.tool.name,
    content: result.content
  }
}

export function summarizeCachedMcpTools(): Array<{
  serverId: string
  serverName: string
  toolCount: number
  tools: Array<{ name: string; description?: string; openAiName: string }>
}> {
  return getMcpServers()
    .filter((s) => s.enabled)
    .map((s) => ({
      serverId: s.id,
      serverName: s.name,
      toolCount: s.cachedTools?.length ?? 0,
      tools: (s.cachedTools ?? []).map((t) => ({
        name: t.name,
        description: t.description,
        openAiName: toOpenAiMcpToolName(s.name, t.name)
      }))
    }))
}
