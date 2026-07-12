import Database from "better-sqlite3"
import fs from "node:fs"
import path from "node:path"
import type {
  AgentRecord,
  ChatAttachment,
  ChatMessage,
  ChatSession,
  McpServerRecord
} from "./types"

let db: Database.Database | null = null

function getDb(): Database.Database {
  if (db) return db

  const dbPath =
    process.env.INNOMATE_DB_PATH || path.join(process.cwd(), "data", "innomate.db")
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })

  db = new Database(dbPath)
  db.pragma("journal_mode = WAL")

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      agent_id TEXT NOT NULL DEFAULT 'super',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      attachments_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at);

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      version TEXT NOT NULL DEFAULT '1.0.0',
      guide TEXT NOT NULL DEFAULT '',
      tools_json TEXT NOT NULL DEFAULT '[]',
      delegates_json TEXT NOT NULL DEFAULT '[]',
      model TEXT NOT NULL DEFAULT 'gpt-5.5',
      classifier_model TEXT NOT NULL DEFAULT 'gpt-5.4-mini',
      enabled INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mcp_servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      agent_id TEXT NOT NULL,
      status TEXT NOT NULL,
      missing_fields_json TEXT,
      collected_fields_json TEXT,
      result_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)

  migrateAgentColumns(db)
  seedAgentsIfEmpty(db)
  ensureVacationHitlDemo(db)
  return db
}

/** 데모용: vacation 에이전트에 HITL inputSchema + databricks runtime 보강 */
function ensureVacationHitlDemo(database: Database.Database): void {
  const row = database.prepare("SELECT * FROM agents WHERE id = ?").get("vacation") as
    | Record<string, unknown>
    | undefined
  if (!row) return
  if (row.input_schema_json) return

  const inputSchema = {
    fields: [
      { key: "startDate", label: "시작일", type: "date", required: true },
      { key: "endDate", label: "종료일", type: "date", required: true },
      {
        key: "leaveType",
        label: "휴가 유형",
        type: "enum",
        required: true,
        enumValues: ["연차", "반차", "병가", "경조사"]
      }
    ]
  }
  const graph = {
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

  database
    .prepare(
      `UPDATE agents SET
         runtime = 'databricks',
         tool_name = COALESCE(tool_name, 'run_vacation_agent'),
         tool_description = COALESCE(tool_description, '휴가/연차 신청을 처리합니다'),
         input_schema_json = ?,
         graph_json = ?,
         description = COALESCE(description, 'G-portal 휴가 신청'),
         updated_at = ?
       WHERE id = 'vacation'`
    )
    .run(JSON.stringify(inputSchema), JSON.stringify(graph), new Date().toISOString())
}

function migrateAgentColumns(database: Database.Database): void {
  const cols = database.prepare("PRAGMA table_info(agents)").all() as Array<{ name: string }>
  const names = new Set(cols.map((c) => c.name))
  const add = (col: string, ddl: string) => {
    if (!names.has(col)) database.exec(`ALTER TABLE agents ADD COLUMN ${ddl}`)
  }
  add("runtime", "runtime TEXT NOT NULL DEFAULT 'local'")
  add("template_id", "template_id TEXT")
  add("endpoint_url", "endpoint_url TEXT")
  add("tool_name", "tool_name TEXT")
  add("tool_description", "tool_description TEXT")
  add("input_schema_json", "input_schema_json TEXT")
  add("graph_json", "graph_json TEXT")
  add("description", "description TEXT")
}

/** 저장소가 비어 있으면 저장소 루트 agents/ 폴더에서 기본 에이전트 seed */
function seedAgentsIfEmpty(database: Database.Database): void {
  const count = database
    .prepare("SELECT COUNT(*) AS c FROM agents")
    .get() as { c: number }
  if (count.c > 0) return

  const repoAgentsDir = path.join(process.cwd(), "..", "agents")
  if (!fs.existsSync(repoAgentsDir)) return

  const names: Record<string, string> = {
    super: "Super Agent",
    "meeting-room": "회의실 예약",
    "asset-export": "자산 반출",
    vacation: "휴가 신청"
  }

  const insert = database.prepare(`
    INSERT INTO agents (id, name, version, guide, tools_json, delegates_json, model, classifier_model, enabled, updated_at)
    VALUES (@id, @name, @version, @guide, @tools, @delegates, @model, @classifierModel, 1, @now)
  `)

  for (const entry of fs.readdirSync(repoAgentsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith("_")) continue
    const harnessPath = path.join(repoAgentsDir, entry.name, "harness.json")
    const guidePath = path.join(repoAgentsDir, entry.name, "GUIDE.md")
    if (!fs.existsSync(harnessPath) || !fs.existsSync(guidePath)) continue

    try {
      const harness = JSON.parse(fs.readFileSync(harnessPath, "utf8"))
      insert.run({
        id: harness.id ?? entry.name,
        name: names[entry.name] ?? entry.name,
        version: harness.version ?? "1.0.0",
        guide: fs.readFileSync(guidePath, "utf8"),
        tools: JSON.stringify(harness.tools ?? []),
        delegates: JSON.stringify(harness.delegates ?? []),
        model: harness.model ?? "gpt-5.5",
        classifierModel: harness.classifierModel ?? "gpt-5.4-mini",
        now: new Date().toISOString()
      })
    } catch (err) {
      console.error(`Failed to seed agent ${entry.name}:`, err)
    }
  }
}

// ---------- Sessions ----------

export function listSessions(): ChatSession[] {
  const rows = getDb()
    .prepare("SELECT * FROM sessions ORDER BY updated_at DESC")
    .all() as Array<Record<string, string>>
  return rows.map(rowToSession)
}

export function getSession(id: string): ChatSession | null {
  const row = getDb().prepare("SELECT * FROM sessions WHERE id = ?").get(id) as
    | Record<string, string>
    | undefined
  return row ? rowToSession(row) : null
}

export function createSession(id: string, title: string, agentId: string): ChatSession {
  const now = new Date().toISOString()
  getDb()
    .prepare(
      "INSERT INTO sessions (id, title, agent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    )
    .run(id, title, agentId, now, now)
  return { id, title, agentId, createdAt: now, updatedAt: now }
}

export function touchSession(id: string): void {
  getDb()
    .prepare("UPDATE sessions SET updated_at = ? WHERE id = ?")
    .run(new Date().toISOString(), id)
}

export function renameSession(id: string, title: string): void {
  getDb().prepare("UPDATE sessions SET title = ? WHERE id = ?").run(title, id)
}

export function deleteSession(id: string): void {
  const database = getDb()
  database.prepare("DELETE FROM messages WHERE session_id = ?").run(id)
  database.prepare("DELETE FROM sessions WHERE id = ?").run(id)
}

function rowToSession(row: Record<string, string>): ChatSession {
  return {
    id: row.id,
    title: row.title,
    agentId: row.agent_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

// ---------- Messages ----------

export function listMessages(sessionId: string): ChatMessage[] {
  const rows = getDb()
    .prepare("SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC")
    .all(sessionId) as Array<Record<string, string>>
  return rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    role: row.role as "user" | "assistant",
    content: row.content,
    attachments: JSON.parse(row.attachments_json || "[]") as ChatAttachment[],
    createdAt: row.created_at
  }))
}

export function addMessage(
  id: string,
  sessionId: string,
  role: "user" | "assistant",
  content: string,
  attachments: ChatAttachment[] = []
): void {
  // 첨부 원본(base64)은 저장하지 않고 메타데이터만 기록
  const meta = attachments.map(({ name, mimeType, size, kind }) => ({
    name,
    mimeType,
    size,
    kind
  }))
  getDb()
    .prepare(
      "INSERT INTO messages (id, session_id, role, content, attachments_json, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(id, sessionId, role, content, JSON.stringify(meta), new Date().toISOString())
  touchSession(sessionId)
}

// ---------- Agents ----------

export function listAgents(enabledOnly = false): AgentRecord[] {
  const sql = enabledOnly
    ? "SELECT * FROM agents WHERE enabled = 1 ORDER BY id"
    : "SELECT * FROM agents ORDER BY id"
  const rows = getDb().prepare(sql).all() as Array<Record<string, unknown>>
  return rows.map(rowToAgent)
}

export function getAgent(id: string): AgentRecord | null {
  const row = getDb().prepare("SELECT * FROM agents WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined
  return row ? rowToAgent(row) : null
}

export function upsertAgent(agent: Omit<AgentRecord, "updatedAt">): AgentRecord {
  const now = new Date().toISOString()
  getDb()
    .prepare(
      `INSERT INTO agents (
         id, name, version, guide, tools_json, delegates_json, model, classifier_model,
         enabled, updated_at, runtime, template_id, endpoint_url, tool_name, tool_description,
         input_schema_json, graph_json, description
       ) VALUES (
         @id, @name, @version, @guide, @tools, @delegates, @model, @classifierModel,
         @enabled, @now, @runtime, @templateId, @endpointUrl, @toolName, @toolDescription,
         @inputSchema, @graph, @description
       )
       ON CONFLICT(id) DO UPDATE SET
         name = @name, version = @version, guide = @guide,
         tools_json = @tools, delegates_json = @delegates,
         model = @model, classifier_model = @classifierModel,
         enabled = @enabled, updated_at = @now,
         runtime = @runtime, template_id = @templateId, endpoint_url = @endpointUrl,
         tool_name = @toolName, tool_description = @toolDescription,
         input_schema_json = @inputSchema, graph_json = @graph, description = @description`
    )
    .run({
      id: agent.id,
      name: agent.name,
      version: agent.version,
      guide: agent.guide,
      tools: JSON.stringify(agent.tools),
      delegates: JSON.stringify(agent.delegates),
      model: agent.model,
      classifierModel: agent.classifierModel,
      enabled: agent.enabled ? 1 : 0,
      now,
      runtime: agent.runtime || "local",
      templateId: agent.templateId ?? null,
      endpointUrl: agent.endpointUrl ?? null,
      toolName: agent.toolName ?? null,
      toolDescription: agent.toolDescription ?? null,
      inputSchema: agent.inputSchema ? JSON.stringify(agent.inputSchema) : null,
      graph: agent.graph ? JSON.stringify(agent.graph) : null,
      description: agent.description ?? null
    })
  return { ...agent, runtime: agent.runtime || "local", updatedAt: now }
}

export function deleteAgent(id: string): void {
  getDb().prepare("DELETE FROM agents WHERE id = ?").run(id)
}

function rowToAgent(row: Record<string, unknown>): AgentRecord {
  return {
    id: row.id as string,
    name: row.name as string,
    version: row.version as string,
    guide: row.guide as string,
    tools: JSON.parse((row.tools_json as string) || "[]"),
    delegates: JSON.parse((row.delegates_json as string) || "[]"),
    model: row.model as string,
    classifierModel: row.classifier_model as string,
    enabled: Boolean(row.enabled),
    updatedAt: row.updated_at as string,
    runtime: ((row.runtime as string) || "local") as AgentRecord["runtime"],
    templateId: (row.template_id as string) || undefined,
    endpointUrl: (row.endpoint_url as string) || undefined,
    toolName: (row.tool_name as string) || undefined,
    toolDescription: (row.tool_description as string) || undefined,
    inputSchema: row.input_schema_json
      ? JSON.parse(row.input_schema_json as string)
      : undefined,
    graph: row.graph_json ? JSON.parse(row.graph_json as string) : undefined,
    description: (row.description as string) || undefined
  }
}

// ---------- MCP Servers ----------

export function listMcpServers(): McpServerRecord[] {
  const rows = getDb()
    .prepare("SELECT * FROM mcp_servers ORDER BY name")
    .all() as Array<Record<string, unknown>>
  return rows.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    url: row.url as string,
    description: (row.description as string) ?? "",
    enabled: Boolean(row.enabled),
    updatedAt: row.updated_at as string
  }))
}

export function upsertMcpServer(server: Omit<McpServerRecord, "updatedAt">): McpServerRecord {
  const now = new Date().toISOString()
  getDb()
    .prepare(
      `INSERT INTO mcp_servers (id, name, url, description, enabled, updated_at)
       VALUES (@id, @name, @url, @description, @enabled, @now)
       ON CONFLICT(id) DO UPDATE SET
         name = @name, url = @url, description = @description,
         enabled = @enabled, updated_at = @now`
    )
    .run({
      id: server.id,
      name: server.name,
      url: server.url,
      description: server.description,
      enabled: server.enabled ? 1 : 0,
      now
    })
  return { ...server, updatedAt: now }
}

export function deleteMcpServer(id: string): void {
  getDb().prepare("DELETE FROM mcp_servers WHERE id = ?").run(id)
}

// ---------- Runs (HITL) ----------

export function upsertRun(run: {
  id: string
  sessionId: string
  agentId: string
  status: "running" | "paused" | "completed" | "error"
  missingFields?: unknown
  collectedFields?: unknown
  resultJson?: string
}): void {
  const now = new Date().toISOString()
  getDb()
    .prepare(
      `INSERT INTO runs (
         id, session_id, agent_id, status, missing_fields_json, collected_fields_json, result_json, created_at, updated_at
       ) VALUES (@id, @sessionId, @agentId, @status, @missing, @collected, @result, @now, @now)
       ON CONFLICT(id) DO UPDATE SET
         status = @status,
         missing_fields_json = @missing,
         collected_fields_json = @collected,
         result_json = COALESCE(@result, result_json),
         updated_at = @now`
    )
    .run({
      id: run.id,
      sessionId: run.sessionId,
      agentId: run.agentId,
      status: run.status,
      missing: run.missingFields ? JSON.stringify(run.missingFields) : null,
      collected: run.collectedFields ? JSON.stringify(run.collectedFields) : null,
      result: run.resultJson ?? null,
      now
    })
}

export function getRun(id: string): {
  id: string
  sessionId: string
  agentId: string
  status: string
  missingFields?: unknown
  collectedFields?: Record<string, unknown>
  resultJson?: string
} | null {
  const row = getDb().prepare("SELECT * FROM runs WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined
  if (!row) return null
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    agentId: row.agent_id as string,
    status: row.status as string,
    missingFields: row.missing_fields_json
      ? JSON.parse(row.missing_fields_json as string)
      : undefined,
    collectedFields: row.collected_fields_json
      ? JSON.parse(row.collected_fields_json as string)
      : undefined,
    resultJson: (row.result_json as string) || undefined
  }
}

// ---------- App settings (OpenAI URL / Key 등) ----------

export function getSetting(key: string): string | null {
  const row = getDb()
    .prepare("SELECT value FROM app_settings WHERE key = ?")
    .get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .run(key, value, new Date().toISOString())
}

export function getOpenAISettings(): {
  baseUrl: string
  apiKey: string
  model: string
  hasApiKey: boolean
} {
  const baseUrl =
    getSetting("openai_base_url")?.trim() ||
    process.env.OPENAI_BASE_URL?.trim() ||
    ""
  const apiKey =
    getSetting("openai_api_key")?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    ""
  const model =
    getSetting("openai_model")?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-5.5"
  return { baseUrl, apiKey, model, hasApiKey: Boolean(apiKey) }
}

export function saveOpenAISettings(input: {
  baseUrl?: string
  apiKey?: string
  model?: string
}): void {
  if (input.baseUrl !== undefined) {
    setSetting("openai_base_url", input.baseUrl.trim())
  }
  if (input.apiKey !== undefined && input.apiKey.trim()) {
    // 빈 문자열이면 기존 키 유지 (UI에서 •••• 마스킹 후 미변경)
    setSetting("openai_api_key", input.apiKey.trim())
  }
  if (input.model !== undefined) {
    setSetting("openai_model", input.model.trim() || "gpt-5.5")
  }
}
