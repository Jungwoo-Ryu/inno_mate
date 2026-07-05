import fs from "node:fs"
import path from "node:path"
import { harnessLoader } from "./harness/HarnessLoader"

/** 웹 레지스트리(/api/agents)의 에이전트 레코드 */
interface WebAgentRecord {
  id: string
  name: string
  version: string
  guide: string
  tools: string[]
  delegates: string[]
  model: string
  classifierModel: string
  enabled: boolean
  updatedAt: string
}

export function getWebBaseUrl(): string {
  return (
    process.env.INNOMATE_WEB_URL?.trim().replace(/\/$/, "") ||
    "http://localhost:3000"
  )
}

export interface SyncResult {
  success: boolean
  synced: string[]
  error?: string
}

/**
 * 웹 레지스트리에서 활성 에이전트를 받아 userData/agents에 materialize.
 * GUIDE.md + harness.json 형태로 저장되어 기존 HarnessLoader가 그대로 로드한다.
 */
export async function syncAgentsFromWeb(): Promise<SyncResult> {
  const baseUrl = getWebBaseUrl()

  let agents: WebAgentRecord[]
  try {
    const res = await fetch(`${baseUrl}/api/agents?enabled=true`, {
      signal: AbortSignal.timeout(10_000)
    })
    if (!res.ok) {
      return {
        success: false,
        synced: [],
        error: `웹 레지스트리 응답 오류 (${res.status})`
      }
    }
    agents = (await res.json()) as WebAgentRecord[]
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      synced: [],
      error: `웹 레지스트리에 연결할 수 없습니다 (${baseUrl}): ${msg}`
    }
  }

  const agentsDir = harnessLoader.getAgentsDir()
  const synced: string[] = []

  for (const agent of agents) {
    if (!agent.id || !/^[a-z0-9-]+$/.test(agent.id)) continue

    try {
      const dir = path.join(agentsDir, agent.id)
      fs.mkdirSync(dir, { recursive: true })

      fs.writeFileSync(path.join(dir, "GUIDE.md"), agent.guide ?? "", "utf8")
      fs.writeFileSync(
        path.join(dir, "harness.json"),
        JSON.stringify(
          {
            id: agent.id,
            version: agent.version ?? "1.0.0",
            guide: "GUIDE.md",
            tools: agent.tools ?? [],
            model: agent.model ?? "gpt-5.5",
            classifierModel: agent.classifierModel ?? "gpt-5.4-mini",
            delegates: agent.delegates ?? [],
            scenarios: []
          },
          null,
          2
        ),
        "utf8"
      )

      harnessLoader.reloadHarness(agent.id)
      synced.push(agent.id)
    } catch (err) {
      console.error(`[WebRegistry] Failed to sync agent ${agent.id}:`, err)
    }
  }

  console.log(`[WebRegistry] Synced ${synced.length} agents from ${baseUrl}`)
  return { success: true, synced }
}
