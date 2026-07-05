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
  `)

  seedAgentsIfEmpty(db)
  return db
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
      `INSERT INTO agents (id, name, version, guide, tools_json, delegates_json, model, classifier_model, enabled, updated_at)
       VALUES (@id, @name, @version, @guide, @tools, @delegates, @model, @classifierModel, @enabled, @now)
       ON CONFLICT(id) DO UPDATE SET
         name = @name, version = @version, guide = @guide,
         tools_json = @tools, delegates_json = @delegates,
         model = @model, classifier_model = @classifierModel,
         enabled = @enabled, updated_at = @now`
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
      now
    })
  return { ...agent, updatedAt: now }
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
    updatedAt: row.updated_at as string
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
