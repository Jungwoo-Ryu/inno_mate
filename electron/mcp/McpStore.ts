import { store } from "../store"
import type { McpServerConfig } from "./types"
import { fromCursorMcpEntry, resolveMcpTransport } from "./types"
import { probeMcpServer, type McpToolSummary } from "./McpClient"

export type { McpServerConfig } from "./types"
export { fromCursorMcpEntry, resolveMcpTransport } from "./types"

const STORE_KEY = "mcpServers"

const DEFAULT_SERVERS: McpServerConfig[] = []

function normalizeServer(raw: McpServerConfig): McpServerConfig {
  const transport = resolveMcpTransport(raw)
  return {
    ...raw,
    transport,
    args: raw.args ?? [],
    url: raw.url || raw.endpointUrl || (raw.command ? `stdio://${raw.name}` : ""),
    endpointUrl: raw.endpointUrl || (transport !== "stdio" ? raw.url : undefined),
    cachedTools: raw.cachedTools ?? [],
    toolsCachedAt: raw.toolsCachedAt
  }
}

export function getMcpServers(): McpServerConfig[] {
  const saved = store.get(STORE_KEY) as McpServerConfig[] | undefined
  if (!saved?.length) return DEFAULT_SERVERS
  return saved.map(normalizeServer)
}

export function saveMcpServers(servers: McpServerConfig[]): McpServerConfig[] {
  const normalized = servers.map(normalizeServer)
  store.set(STORE_KEY, normalized)
  return normalized
}

function upsertServerTools(
  serverId: string,
  tools: McpToolSummary[],
  status: "connected" | "error",
  error?: string
): McpServerConfig[] {
  const servers = getMcpServers()
  const next = servers.map((s) =>
    s.id === serverId
      ? {
          ...s,
          cachedTools: tools,
          toolsCachedAt: new Date().toISOString(),
          lastStatus: status,
          lastError: error
        }
      : s
  )
  return saveMcpServers(next)
}

/** Cursor mcp.json 전체 import */
export function importCursorMcpJson(json: {
  mcpServers?: Record<
    string,
    {
      command?: string
      args?: string[]
      cwd?: string
      env?: Record<string, string>
      url?: string
    }
  >
}): McpServerConfig[] {
  const entries = json.mcpServers ?? {}
  const existing = getMcpServers()
  const byName = new Map(existing.map((s) => [s.name, s]))

  for (const [name, entry] of Object.entries(entries)) {
    const profile = fromCursorMcpEntry(name, entry)
    const prev = byName.get(name)
    byName.set(name, {
      id: prev?.id ?? `mcp-${name}-${Date.now()}`,
      enabled: prev?.enabled ?? true,
      lastStatus: "disconnected",
      cachedTools: prev?.cachedTools ?? [],
      toolsCachedAt: prev?.toolsCachedAt,
      ...profile
    })
  }

  return saveMcpServers([...byName.values()])
}

export async function testMcpConnection(
  server: McpServerConfig
): Promise<{
  ok: boolean
  error?: string
  tools?: McpToolSummary[]
}> {
  const normalized = normalizeServer(server)
  if (resolveMcpTransport(normalized) === "stdio" && !normalized.command?.trim()) {
    return {
      ok: false,
      error:
        "stdio MCP는 command/args가 필요합니다. 예: command=uv, args=[run,--directory,/path,demo-mcp]"
    }
  }

  const result = await probeMcpServer(normalized)

  // 서버가 이미 저장돼 있으면 Super용 캐시에 반영
  const exists = getMcpServers().some((s) => s.id === normalized.id)
  if (exists) {
    if (result.ok) {
      upsertServerTools(normalized.id, result.tools ?? [], "connected")
    } else {
      upsertServerTools(normalized.id, [], "error", result.error)
    }
  }

  return result
}

/**
 * 활성화된 모든 MCP 서버에 tools/list 재조회 → Super Agent 캐시 갱신
 */
export async function refreshAllMcpToolCaches(): Promise<{
  ok: boolean
  refreshed: Array<{ id: string; name: string; toolCount: number; error?: string }>
}> {
  const servers = getMcpServers().filter((s) => s.enabled)
  const refreshed: Array<{
    id: string
    name: string
    toolCount: number
    error?: string
  }> = []

  for (const server of servers) {
    const result = await probeMcpServer(server)
    if (result.ok) {
      upsertServerTools(server.id, result.tools ?? [], "connected")
      refreshed.push({
        id: server.id,
        name: server.name,
        toolCount: result.tools?.length ?? 0
      })
      console.log(
        `[MCP] cached ${result.tools?.length ?? 0} tools for Super from "${server.name}"`
      )
    } else {
      upsertServerTools(server.id, [], "error", result.error)
      refreshed.push({
        id: server.id,
        name: server.name,
        toolCount: 0,
        error: result.error
      })
      console.warn(`[MCP] cache refresh failed for "${server.name}":`, result.error)
    }
  }

  return { ok: refreshed.every((r) => !r.error), refreshed }
}
