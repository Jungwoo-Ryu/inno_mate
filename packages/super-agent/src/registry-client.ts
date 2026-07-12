import type { RegisteredAgent } from "../../agent-spec/src/index"

export async function fetchEnabledAgents(
  webBaseUrl: string
): Promise<RegisteredAgent[]> {
  const base = webBaseUrl.replace(/\/$/, "")
  const res = await fetch(`${base}/api/agents?enabled=true`, {
    signal: AbortSignal.timeout(15_000)
  })
  if (!res.ok) {
    throw new Error(`Agent registry error (${res.status})`)
  }
  const rows = (await res.json()) as Array<Record<string, unknown>>
  return rows.map(normalizeAgent)
}

function normalizeAgent(row: Record<string, unknown>): RegisteredAgent {
  return {
    id: String(row.id),
    name: String(row.name ?? row.id),
    version: String(row.version ?? "1.0.0"),
    description: row.description ? String(row.description) : undefined,
    guide: row.guide ? String(row.guide) : undefined,
    tools: Array.isArray(row.tools) ? (row.tools as string[]) : [],
    delegates: Array.isArray(row.delegates) ? (row.delegates as string[]) : [],
    model: String(row.model ?? "gpt-5.5"),
    classifierModel: row.classifierModel
      ? String(row.classifierModel)
      : undefined,
    enabled: row.enabled !== false && row.enabled !== 0,
    runtime: (row.runtime as RegisteredAgent["runtime"]) || "local",
    templateId: row.templateId ? String(row.templateId) : undefined,
    endpointUrl: row.endpointUrl ? String(row.endpointUrl) : undefined,
    toolName: row.toolName ? String(row.toolName) : undefined,
    toolDescription: row.toolDescription
      ? String(row.toolDescription)
      : undefined,
    inputSchema: row.inputSchema as RegisteredAgent["inputSchema"],
    graph: row.graph as RegisteredAgent["graph"],
    updatedAt: row.updatedAt ? String(row.updatedAt) : undefined
  }
}
