import type { AgentRecord, InputField } from "@/lib/types"

export function missingRequiredFromAgent(
  agent: AgentRecord,
  collected: Record<string, unknown>
): InputField[] {
  const fields = agent.inputSchema?.fields ?? []
  return fields.filter((f) => {
    if (!f.required) return false
    const v = collected[f.key]
    return v === undefined || v === null || String(v).trim() === ""
  })
}
