/**
 * TEMPLATE — Harness 시나리오 회귀 테스트
 *
 * 사용법:
 * 1. `ScenarioRunner.template.ts` → `ScenarioRunner.ts` 복사
 * 2. `npm run test:scenarios` 스크립트 추가 (선택)
 * 3. agents/*/scenarios/*.md 파싱 후 HarnessRunner 실행
 */

import fs from "node:fs"
import path from "node:path"
import { harnessLoader } from "./HarnessLoader"
import { harnessRunner } from "./HarnessRunner"

interface ParsedScenario {
  agentId: string
  name: string
  expectedIntent: string
  expectedTools: string[]
  expectedOutputKo: string
}

export class ScenarioRunner {
  /** scenarios/happy-path.md 파싱 (간단한 마크다운 파서) */
  parseScenarioFile(content: string, agentId: string): ParsedScenario {
    const getSection = (heading: string): string => {
      const re = new RegExp(`## ${heading}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`)
      const match = content.match(re)
      return match?.[1]?.trim() ?? ""
    }

    const toolLines = getSection("Expected Tool Sequence")
      .split("\n")
      .filter((l) => /^\d+\./.test(l))
      .map((l) => l.replace(/^\d+\.\s*`?([^`]+)`?.*/, "$1").trim())

    return {
      agentId,
      name: getSection("Input") || "unnamed",
      expectedIntent: getSection("Expected Intent").replace(/`/g, ""),
      expectedTools: toolLines,
      expectedOutputKo: getSection("Expected Output (Korean)").replace(/"/g, "")
    }
  }

  async runAgentScenarios(agentId: string): Promise<void> {
    const harness = harnessLoader.loadHarness(agentId)
    if (!harness) {
      console.error(`Agent not found: ${agentId}`)
      return
    }

    for (const scenarioRel of harness.config.scenarios ?? []) {
      const scenarioPath = path.join(harness.dirPath, scenarioRel)
      if (!fs.existsSync(scenarioPath)) continue

      const content = fs.readFileSync(scenarioPath, "utf8")
      const scenario = this.parseScenarioFile(content, agentId)

      console.log(`\n--- Scenario: ${agentId} / ${scenarioRel} ---`)
      console.log("Expected intent:", scenario.expectedIntent)
      console.log("Expected tools:", scenario.expectedTools.join(" → "))
      console.log("Expected output:", scenario.expectedOutputKo)

      // TODO: mock 스크린샷 또는 fixture 이미지로 harnessRunner.runFromScreenshots 호출
      // TODO: 결과 message_ko 와 expectedOutputKo 비교
    }
  }
}

// CLI 실행 예시 (ScenarioRunner.ts 복사 후):
// if (require.main === module) {
//   const runner = new ScenarioRunner()
//   for (const id of harnessLoader.listAgentIds()) {
//     await runner.runAgentScenarios(id)
//   }
// }
