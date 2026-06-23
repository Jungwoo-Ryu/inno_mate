import { store } from "../store"

export interface McpServerConfig {
  id: string
  name: string
  url: string
  enabled: boolean
  lastStatus: "connected" | "disconnected" | "error"
  lastError?: string
}

const STORE_KEY = "mcpServers"

const DEFAULT_SERVERS: McpServerConfig[] = [
  {
    id: "gportal-tools",
    name: "G-portal Tools",
    url: "stdio://gportal",
    enabled: true,
    lastStatus: "connected"
  }
]

export function getMcpServers(): McpServerConfig[] {
  const saved = store.get(STORE_KEY) as McpServerConfig[] | undefined
  return saved?.length ? saved : DEFAULT_SERVERS
}

export function saveMcpServers(servers: McpServerConfig[]): McpServerConfig[] {
  store.set(STORE_KEY, servers)
  return servers
}

export async function testMcpConnection(
  server: McpServerConfig
): Promise<{ ok: boolean; error?: string }> {
  if (!server.url.trim()) {
    return { ok: false, error: "URL이 비어 있습니다" }
  }
  if (server.url.startsWith("stdio://")) {
    return { ok: true }
  }
  try {
    const parsed = new URL(server.url)
    if (!["http:", "https:", "ws:", "wss:"].includes(parsed.protocol)) {
      return { ok: false, error: "지원하지 않는 URL 형식입니다" }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: "유효하지 않은 URL입니다" }
  }
}
