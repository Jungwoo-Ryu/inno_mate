import type { ChatCompletionTool } from "openai/resources/chat/completions"
import type { AgentRecord } from "@/lib/types"
import { fieldsToJsonSchema } from "@/lib/workflow/types"

export function buildToolsFromAgents(agents: AgentRecord[]): ChatCompletionTool[] {
  return agents
    .filter((a) => a.enabled && a.runtime === "databricks")
    .map((a) => {
      const toolName = a.toolName || `run_${a.id.replace(/-/g, "_")}_agent`
      return {
        type: "function" as const,
        function: {
          name: toolName,
          description:
            a.toolDescription ||
            a.description ||
            `${a.name} 업무를 Databricks 에이전트에 위임합니다.`,
          parameters: {
            type: "object",
            properties: {
              prompt: { type: "string", description: "사용자 요청 원문" },
              ...fieldsToJsonSchema(a.inputSchema)
            },
            required: ["prompt"]
          }
        }
      }
    })
}

export function findAgentByToolName(
  agents: AgentRecord[],
  toolName: string
): AgentRecord | undefined {
  return agents.find(
    (a) =>
      a.toolName === toolName ||
      `run_${a.id.replace(/-/g, "_")}_agent` === toolName
  )
}
