import fs from "node:fs"
import { harnessLoader } from "./HarnessLoader"

type ChangeCallback = (agentId: string) => void

export class HarnessWatcher {
  private watchers: fs.FSWatcher[] = []
  private callback: ChangeCallback | null = null

  start(onChange: ChangeCallback): void {
    this.stop()
    this.callback = onChange
    const agentsDir = harnessLoader.getAgentsDir()

    if (!fs.existsSync(agentsDir)) return

    try {
      const watcher = fs.watch(agentsDir, { recursive: true }, (_event, filename) => {
        if (!filename || !this.callback) return
        if (filename.endsWith("GUIDE.md") || filename.endsWith("harness.json")) {
          const parts = filename.split(/[/\\]/)
          const agentId = parts[0]
          if (agentId && !agentId.startsWith("_")) {
            this.callback(agentId)
          }
        }
      })
      this.watchers.push(watcher)
    } catch (err) {
      console.warn("HarnessWatcher: could not watch agents dir", err)
    }
  }

  stop(): void {
    for (const w of this.watchers) w.close()
    this.watchers = []
    this.callback = null
  }
}

export const harnessWatcher = new HarnessWatcher()
