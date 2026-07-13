import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import type { McpServerConfig } from "./types"
import { resolveMcpTransport } from "./types"

export interface McpToolSummary {
  name: string
  description?: string
  /** JSON Schema — LLM function calling에 필수 */
  inputSchema?: Record<string, unknown>
  /** 스키마에서 뽑은 파라미터 키 (UI 미리보기용) */
  paramKeys?: string[]
}

export interface McpProbeResult {
  ok: boolean
  error?: string
  tools?: McpToolSummary[]
  serverName?: string
}

function buildStdioEnv(extra?: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === "string") env[k] = v
  }
  if (extra) Object.assign(env, extra)
  return env
}

/**
 * MCP 서버에 실제로 연결해 tools/list 까지 확인 후 종료
 */
export async function probeMcpServer(
  server: McpServerConfig
): Promise<McpProbeResult> {
  const transportKind = resolveMcpTransport(server)
  const endpoint = (server.endpointUrl || server.url || "").trim()

  // http 실패 시 같은 호스트 /sse 폴백은 FastMCP 구버전 호환용
  const attempts: Array<"http" | "sse" | "stdio"> =
    transportKind === "http"
      ? ["http", "sse"]
      : transportKind === "sse"
        ? ["sse", "http"]
        : ["stdio"]

  let lastError = "연결 실패"
  for (const kind of attempts) {
    if (kind !== "stdio" && !/^https?:\/\//i.test(endpoint)) continue
    const result = await probeOnce(server, kind)
    if (result.ok) return result
    lastError = result.error ?? lastError
  }
  return { ok: false, error: lastError }
}

async function probeOnce(
  server: McpServerConfig,
  transportKind: "stdio" | "http" | "sse"
): Promise<McpProbeResult> {
  const client = new Client({
    name: "innomate",
    version: "1.0.0"
  })

  let transport:
    | StdioClientTransport
    | SSEClientTransport
    | StreamableHTTPClientTransport
    | null = null

  try {
    if (transportKind === "stdio") {
      const command = server.command?.trim()
      if (!command) {
        return {
          ok: false,
          error:
            "stdio 서버는 command가 필요합니다 (예: uv). Cursor mcp.json의 command/args를 입력하세요."
        }
      }
      transport = new StdioClientTransport({
        command,
        args: server.args ?? [],
        cwd: server.cwd || undefined,
        env: buildStdioEnv(server.env),
        stderr: "pipe"
      })
    } else {
      let endpoint = (server.endpointUrl || server.url || "").trim()
      if (!endpoint || !/^https?:\/\//i.test(endpoint)) {
        return {
          ok: false,
          error: "http/sse 서버는 https://... endpoint URL이 필요합니다"
        }
      }
      // FastMCP: streamable HTTP=/mcp , legacy SSE=/sse
      if (transportKind === "sse" && /\/mcp\/?$/i.test(endpoint)) {
        endpoint = endpoint.replace(/\/mcp\/?$/i, "/sse")
      }
      if (transportKind === "http" && /\/sse\/?$/i.test(endpoint)) {
        endpoint = endpoint.replace(/\/sse\/?$/i, "/mcp")
      }
      const url = new URL(endpoint)
      console.log(`[MCP] probe transport=${transportKind} url=${url.href}`)
      if (transportKind === "sse") {
        transport = new SSEClientTransport(url)
      } else {
        transport = new StreamableHTTPClientTransport(url)
      }
    }

    await client.connect(transport)
    const listed = await client.listTools()
    const tools: McpToolSummary[] = (listed.tools ?? []).map((t) => {
      const schema = (t.inputSchema ?? undefined) as
        | Record<string, unknown>
        | undefined
      const props =
        schema &&
        typeof schema === "object" &&
        schema.properties &&
        typeof schema.properties === "object"
          ? (schema.properties as Record<string, unknown>)
          : undefined
      return {
        name: t.name,
        description: t.description,
        inputSchema: schema,
        paramKeys: props ? Object.keys(props) : undefined
      }
    })

    console.log(
      `[MCP] tools/list ok (${transportKind}): ${tools.length} tools — ${tools
        .map((t) => t.name)
        .join(", ")}`
    )

    return {
      ok: true,
      tools,
      serverName: server.name
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[MCP] probe failed (${transportKind}):`, message)
    return { ok: false, error: message.slice(0, 400) }
  } finally {
    try {
      await client.close()
    } catch {
      /* ignore */
    }
    try {
      await transport?.close()
    } catch {
      /* ignore */
    }
  }
}

/**
 * 도구 호출 (연결 → call → 종료). Super Agent 연동용.
 */
export async function callMcpTool(
  server: McpServerConfig,
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<{ ok: boolean; content?: unknown; error?: string }> {
  const transportKind = resolveMcpTransport(server)
  const client = new Client({ name: "innomate", version: "1.0.0" })
  let transport:
    | StdioClientTransport
    | SSEClientTransport
    | StreamableHTTPClientTransport
    | null = null

  try {
    if (transportKind === "stdio") {
      const command = server.command?.trim()
      if (!command) return { ok: false, error: "command가 없습니다" }
      transport = new StdioClientTransport({
        command,
        args: server.args ?? [],
        cwd: server.cwd || undefined,
        env: buildStdioEnv(server.env),
        stderr: "pipe"
      })
    } else {
      const endpoint = (server.endpointUrl || server.url || "").trim()
      if (!endpoint) return { ok: false, error: "endpoint URL이 없습니다" }
      const url = new URL(endpoint)
      transport =
        transportKind === "sse"
          ? new SSEClientTransport(url)
          : new StreamableHTTPClientTransport(url)
    }

    await client.connect(transport)
    const result = await client.callTool({ name: toolName, arguments: args })
    return { ok: true, content: result.content }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err)
    }
  } finally {
    try {
      await client.close()
    } catch {
      /* ignore */
    }
    try {
      await transport?.close()
    } catch {
      /* ignore */
    }
  }
}
