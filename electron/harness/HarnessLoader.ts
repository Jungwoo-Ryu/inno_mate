import fs from "node:fs"
import path from "node:path"
import { app } from "electron"
import type { HarnessConfig, LoadedHarness } from "./types"

const AGENT_IDS = ["super", "meeting-room", "asset-export", "vacation"] as const

export class HarnessLoader {
  private _agentsDir: string | null = null
  private _bundledAgentsDir: string | null = null
  private _seeded = false

  private get agentsDir(): string {
    if (!this._agentsDir) {
      this._agentsDir = path.join(app.getPath("userData"), "agents")
    }
    return this._agentsDir
  }

  private get bundledAgentsDir(): string {
    if (!this._bundledAgentsDir) {
      this._bundledAgentsDir = path.join(
        app.isPackaged ? process.resourcesPath : process.cwd(),
        "agents"
      )
    }
    return this._bundledAgentsDir
  }

  constructor() {
    // paths are initialized lazily on first access
  }

  /** Must be called after app.whenReady() */
  initialize(): void {
    if (!this._seeded) {
      this._seeded = true
      this.seedAgentsIfNeeded()
    }
  }

  getAgentsDir(): string {
    return this.agentsDir
  }

  private seedAgentsIfNeeded(): void {
    if (!fs.existsSync(this.agentsDir)) {
      fs.mkdirSync(this.agentsDir, { recursive: true })
    }

    for (const id of AGENT_IDS) {
      const targetDir = path.join(this.agentsDir, id)
      const bundledDir = path.join(this.bundledAgentsDir, id)

      if (!fs.existsSync(targetDir) && fs.existsSync(bundledDir)) {
        this.copyDir(bundledDir, targetDir)
      } else if (fs.existsSync(bundledDir) && fs.existsSync(targetDir)) {
        // inputSchema 등 번들 harness 메타를 기존 설치에 병합
        this.mergeHarnessFromBundled(id)
      }
    }

    const sharedTarget = path.join(this.agentsDir, "_shared")
    const sharedBundled = path.join(this.bundledAgentsDir, "_shared")
    if (!fs.existsSync(sharedTarget) && fs.existsSync(sharedBundled)) {
      this.copyDir(sharedBundled, sharedTarget)
    }
  }

  private mergeHarnessFromBundled(agentId: string): void {
    const bundledPath = path.join(this.bundledAgentsDir, agentId, "harness.json")
    const localPath = path.join(this.agentsDir, agentId, "harness.json")
    if (!fs.existsSync(bundledPath) || !fs.existsSync(localPath)) return
    try {
      const bundled = JSON.parse(fs.readFileSync(bundledPath, "utf8")) as HarnessConfig
      const local = JSON.parse(fs.readFileSync(localPath, "utf8")) as HarnessConfig
      if (!local.inputSchema && bundled.inputSchema) {
        local.inputSchema = bundled.inputSchema
        // 도구 이름 마이그레이션(점→밑줄)도 번들 기준으로 맞춤
        if (bundled.tools?.length) local.tools = bundled.tools
        fs.writeFileSync(localPath, JSON.stringify(local, null, 2), "utf8")
        console.log(`[HarnessLoader] Merged inputSchema into ${agentId}`)
      } else if (bundled.tools?.length) {
        const needsToolFix = (local.tools ?? []).some((t) => t.includes("."))
        if (needsToolFix) {
          local.tools = bundled.tools
          if (bundled.inputSchema) local.inputSchema = bundled.inputSchema
          fs.writeFileSync(localPath, JSON.stringify(local, null, 2), "utf8")
        }
      }
    } catch (err) {
      console.warn(`[HarnessLoader] mergeHarnessFromBundled(${agentId}) failed:`, err)
    }
  }

  private copyDir(src: string, dest: string): void {
    fs.mkdirSync(dest, { recursive: true })
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)
      if (entry.isDirectory()) {
        this.copyDir(srcPath, destPath)
      } else {
        fs.copyFileSync(srcPath, destPath)
      }
    }
  }

  listAgentIds(): string[] {
    if (!fs.existsSync(this.agentsDir)) return []
    return fs
      .readdirSync(this.agentsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
      .map((d) => d.name)
  }

  loadHarness(agentId: string): LoadedHarness | null {
    const dirPath = path.join(this.agentsDir, agentId)
    const harnessPath = path.join(dirPath, "harness.json")
    const guidePath = path.join(dirPath, "GUIDE.md")

    if (!fs.existsSync(harnessPath) || !fs.existsSync(guidePath)) {
      console.warn(`Harness not found for agent: ${agentId}`)
      return null
    }

    const config = JSON.parse(
      fs.readFileSync(harnessPath, "utf8")
    ) as HarnessConfig

    const sharedOutput = path.join(this.agentsDir, "_shared", "OUTPUT_SCHEMA.md")
    let guideContent = fs.readFileSync(guidePath, "utf8")
    if (fs.existsSync(sharedOutput)) {
      guideContent += `\n\n---\n\n${fs.readFileSync(sharedOutput, "utf8")}`
    }

    return { config, guideContent, dirPath }
  }

  reloadHarness(agentId: string): LoadedHarness | null {
    return this.loadHarness(agentId)
  }
}

export const harnessLoader = new HarnessLoader()
