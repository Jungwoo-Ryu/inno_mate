import type {
  GraphSpec,
  InputField,
  InputSchema,
  AgentRecord
} from "@/lib/types"

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
  | { type: "edge"; runId: string; from: string; to: string; condition?: string }
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

export type ClientStreamEvent =
  | { type: "token"; text: string }
  | { type: "workflow"; event: WorkflowEvent }
  | {
      type: "done"
      sessionId: string
      messageId: string
      status: "success" | "paused" | "error"
      runId?: string
    }
  | { type: "error"; message: string }

export const DEFAULT_HR_GRAPH: GraphSpec = {
  nodes: [
    { id: "intake", label: "Intake", description: "요청·컨텍스트 수집" },
    { id: "validate", label: "Validate", description: "필수 입력 검증" },
    { id: "await_input", label: "Await", description: "누락 필드 대기" },
    { id: "execute", label: "Execute", description: "업무 실행" },
    { id: "confirm", label: "Confirm", description: "결과 확인" }
  ],
  edges: [
    { from: "intake", to: "validate", kind: "always" },
    { from: "validate", to: "await_input", kind: "conditional" },
    { from: "validate", to: "execute", kind: "conditional" },
    { from: "await_input", to: "validate", kind: "always" },
    { from: "execute", to: "confirm", kind: "always" }
  ]
}

export function toRegisteredTools(agents: AgentRecord[]) {
  return agents.filter((a) => a.enabled && a.runtime === "databricks")
}

export function fieldsToJsonSchema(schema?: InputSchema): Record<string, unknown> {
  if (!schema?.fields?.length) return {}
  const properties: Record<string, unknown> = {}
  for (const f of schema.fields) {
    const prop: Record<string, unknown> = { description: f.label }
    if (f.type === "number") prop.type = "number"
    else if (f.type === "enum" && f.enumValues?.length) {
      prop.type = "string"
      prop.enum = f.enumValues
    } else prop.type = "string"
    properties[f.key] = prop
  }
  return properties
}

export type WorkflowRunState = {
  runId: string
  agentId: string
  status: "running" | "paused" | "completed" | "error"
  graph: GraphSpec
  nodeStatus: Record<string, "pending" | "running" | "done" | "error" | "paused">
  logs: Record<string, Array<{ level: string; message: string; at: string }>>
  activeNodeId: string | null
  missingFields?: InputField[]
  collectedFields?: Record<string, unknown>
  result?: { message_ko: string }
}

export function createInitialRunState(
  runId: string,
  agentId: string,
  graph: GraphSpec
): WorkflowRunState {
  const nodeStatus: WorkflowRunState["nodeStatus"] = {}
  for (const n of graph.nodes) nodeStatus[n.id] = "pending"
  return {
    runId,
    agentId,
    status: "running",
    graph,
    nodeStatus,
    logs: {},
    activeNodeId: null
  }
}

export function reduceWorkflow(
  state: WorkflowRunState,
  event: WorkflowEvent
): WorkflowRunState {
  const next = { ...state, nodeStatus: { ...state.nodeStatus }, logs: { ...state.logs } }
  switch (event.type) {
    case "run_started":
      next.graph = event.graph
      next.status = "running"
      break
    case "node_started":
      next.nodeStatus[event.nodeId] = "running"
      next.activeNodeId = event.nodeId
      break
    case "node_log": {
      const list = [...(next.logs[event.nodeId] ?? [])]
      list.push({
        level: event.level,
        message: event.message,
        at: new Date().toISOString()
      })
      next.logs[event.nodeId] = list
      break
    }
    case "node_completed":
      next.nodeStatus[event.nodeId] = "done"
      break
    case "run_paused":
      next.status = "paused"
      next.nodeStatus[event.nodeId] = "paused"
      next.activeNodeId = event.nodeId
      next.missingFields = event.missingFields
      next.collectedFields = event.collectedFields
      break
    case "run_resumed":
      next.status = "running"
      next.collectedFields = {
        ...(next.collectedFields ?? {}),
        ...event.addedFields
      }
      break
    case "run_completed":
      next.status = "completed"
      next.result = event.result
      break
    case "run_error":
      next.status = "error"
      break
  }
  return next
}
