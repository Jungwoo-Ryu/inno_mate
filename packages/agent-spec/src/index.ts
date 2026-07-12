/** InnoMate shared agent / workflow contracts (web · desktop · CLI · Databricks) */

export type FieldType = "string" | "date" | "enum" | "number"

export interface InputField {
  key: string
  label: string
  type: FieldType
  required: boolean
  enumValues?: string[]
  extractHints?: string[]
}

export interface InputSchema {
  fields: InputField[]
}

export interface GraphNode {
  id: string
  label: string
  description?: string
}

export interface GraphEdge {
  from: string
  to: string
  kind: "always" | "conditional"
  condition?: string
}

export interface GraphSpec {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export type AgentRuntime = "local" | "databricks"

export interface AgentTemplateSpec {
  templateId: string
  agentId: string
  name: string
  description: string
  toolName: string
  endpointUrl: string
  inputSchema: InputSchema
  graph: GraphSpec
  runtime?: AgentRuntime
  enabled?: boolean
}

/** Registry record used by Super Agent tool builder */
export interface RegisteredAgent {
  id: string
  name: string
  version: string
  description?: string
  guide?: string
  tools: string[]
  delegates: string[]
  model: string
  classifierModel?: string
  enabled: boolean
  runtime: AgentRuntime
  templateId?: string
  endpointUrl?: string
  toolName?: string
  toolDescription?: string
  inputSchema?: InputSchema
  graph?: GraphSpec
  updatedAt?: string
}

export type WorkflowEvent =
  | { type: "run_started"; runId: string; agentId: string; graph: GraphSpec }
  | { type: "node_started"; runId: string; nodeId: string; label: string }
  | {
      type: "node_log"
      runId: string
      nodeId: string
      level: "info" | "debug" | "warn" | "error"
      message: string
      payload?: unknown
    }
  | { type: "node_completed"; runId: string; nodeId: string; output?: unknown }
  | {
      type: "edge"
      runId: string
      from: string
      to: string
      condition?: string
    }
  | {
      type: "run_paused"
      runId: string
      agentId: string
      nodeId: string
      reason: "missing_fields"
      missingFields: InputField[]
      collectedFields: Record<string, unknown>
      message_ko: string
    }
  | {
      type: "run_resumed"
      runId: string
      addedFields: Record<string, unknown>
    }
  | {
      type: "run_completed"
      runId: string
      result: { message_ko: string; data?: unknown }
    }
  | { type: "run_error"; runId: string; message: string }

export type RunStatus = "running" | "paused" | "completed" | "error"

export const DEFAULT_HR_GRAPH: GraphSpec = {
  nodes: [
    { id: "intake", label: "Intake", description: "프롬프트·컨텍스트에서 필드 추출" },
    { id: "validate", label: "Validate", description: "필수 입력 검증" },
    { id: "await_input", label: "Await", description: "누락 필드 대기 (HITL)" },
    { id: "execute", label: "Execute", description: "업무 실행" },
    { id: "confirm", label: "Confirm", description: "결과 확인" }
  ],
  edges: [
    { from: "intake", to: "validate", kind: "always" },
    { from: "validate", to: "await_input", kind: "conditional", condition: "missing" },
    { from: "validate", to: "execute", kind: "conditional", condition: "ok" },
    { from: "await_input", to: "validate", kind: "always" },
    { from: "execute", to: "confirm", kind: "always" }
  ]
}
