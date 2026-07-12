import type { ChatCompletionTool } from "openai/resources/chat/completions"
import type { InputSchema, RegisteredAgent } from "../../agent-spec/src/index"

export function fieldsToJsonSchema(schema?: InputSchema): Record<string, unknown> {
  if (!schema?.fields?.length) return {}
  const properties: Record<string, unknown> = {}
  for (const f of schema.fields) {
    const prop: Record<string, unknown> = {
      description: f.label
    }
    if (f.type === "number") prop.type = "number"
    else if (f.type === "enum" && f.enumValues?.length) {
      prop.type = "string"
      prop.enum = f.enumValues
    } else {
      prop.type = "string"
    }
    properties[f.key] = prop
  }
  return properties
}

/** 웹 레지스트리 에이전트 → OpenAI function tools (Databricks runtime만) */
export function buildToolsFromRegistry(agents: RegisteredAgent[]): ChatCompletionTool[] {
  return agents
    .filter((a) => a.enabled && a.runtime === "databricks")
    .map((a) => {
      const toolName =
        a.toolName || `run_${a.id.replace(/-/g, "_")}_agent`
      const fieldProps = fieldsToJsonSchema(a.inputSchema)
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
              prompt: {
                type: "string",
                description: "사용자 요청 원문"
              },
              ...fieldProps
            },
            required: ["prompt"]
          }
        }
      }
    })
}

export function findAgentByToolName(
  agents: RegisteredAgent[],
  toolName: string
): RegisteredAgent | undefined {
  return agents.find(
    (a) =>
      a.toolName === toolName ||
      `run_${a.id.replace(/-/g, "_")}_agent` === toolName
  )
}
