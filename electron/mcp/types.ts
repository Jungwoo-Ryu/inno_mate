/**
 * InnoMate MCP server profile — Cursor mcp.json 호환 필드 포함
 */
export type McpTransport = "stdio" | "http" | "sse"

export interface McpServerConfig {
  id: string
  name: string
  /** @deprecated transport + command/url 사용. 하위호환용 */
  url: string
  enabled: boolean
  lastStatus: "connected" | "disconnected" | "error"
  lastError?: string
  /** 기본: url이 http(s)면 http, 아니면 stdio */
  transport?: McpTransport
  /** stdio: 실행 커맨드 (예: uv, npx, node) */
  command?: string
  /** stdio: 인자 배열 */
  args?: string[]
  /** stdio: 작업 디렉터리 */
  cwd?: string
  /** stdio: 추가 환경변수 */
  env?: Record<string, string>
  /** http/sse: 엔드포인트 URL */
  endpointUrl?: string
  description?: string
  /** tools/list 캐시 — Super Agent가 이 목록을 OpenAI tools로 노출 */
  cachedTools?: Array<{
    name: string
    description?: string
    inputSchema?: Record<string, unknown>
    paramKeys?: string[]
  }>
  toolsCachedAt?: string
}

export function resolveMcpTransport(server: McpServerConfig): McpTransport {
  const endpoint = (server.endpointUrl || server.url || "").trim()

  // URL이 http(s)면 transport 명시와 무관하게 원격으로 처리
  if (/^https?:\/\//i.test(endpoint)) {
    if (server.transport === "sse" || /\/sse\/?$/i.test(endpoint)) return "sse"
    // FastMCP streamable HTTP 기본 경로: /mcp
    return "http"
  }

  if (server.transport) return server.transport
  if (server.command?.trim()) return "stdio"
  if (endpoint.startsWith("stdio://")) return "stdio"
  return "stdio"
}

/** Cursor mcp.json 한 항목 → InnoMate 프로필 */
export function fromCursorMcpEntry(
  name: string,
  entry: {
    command?: string
    args?: string[]
    cwd?: string
    env?: Record<string, string>
    url?: string
  }
): Omit<McpServerConfig, "id" | "enabled" | "lastStatus"> {
  if (entry.command) {
    return {
      name,
      url: `stdio://${name}`,
      transport: "stdio",
      command: entry.command,
      args: entry.args ?? [],
      cwd: entry.cwd,
      env: entry.env,
      description: ""
    }
  }
  const endpoint = entry.url ?? ""
  return {
    name,
    url: endpoint,
    transport: endpoint.includes("/sse") ? "sse" : "http",
    endpointUrl: endpoint,
    description: ""
  }
}
