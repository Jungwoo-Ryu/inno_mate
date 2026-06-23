import type { IGPortalAdapter } from "./IGPortalAdapter"
import type { GPortalAdapterMode } from "./types"
import { StubGPortalAdapter } from "./adapters/StubGPortalAdapter"

let adapterInstance: IGPortalAdapter | null = null

/**
 * 어댑터 선택:
 * - .env GPORTAL_ADAPTER=playwright  → PlaywrightGPortalAdapter (구현 후)
 * - 기본값 stub
 *
 * Playwright 활성화 방법:
 * 1. PlaywrightGPortalAdapter.template.ts 를 PlaywrightGPortalAdapter.ts 로 복사
 * 2. TODO 섹션 구현
 * 3. 아래 import 주석 해제
 * 4. .env 에 GPORTAL_ADAPTER=playwright
 */
export function getGPortalAdapter(): IGPortalAdapter {
  if (adapterInstance) return adapterInstance

  const mode = (process.env.GPORTAL_ADAPTER ?? "stub") as GPortalAdapterMode

  if (mode === "playwright") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PlaywrightGPortalAdapter } = require("./adapters/PlaywrightGPortalAdapter")
      adapterInstance = new PlaywrightGPortalAdapter()
      console.log("[GPortal] Using PlaywrightGPortalAdapter")
      return adapterInstance
    } catch {
      console.warn(
        "[GPortal] PlaywrightGPortalAdapter.ts 가 없습니다. Stub으로 폴백합니다. " +
          "템플릿: electron/gportal/adapters/PlaywrightGPortalAdapter.template.ts"
      )
    }
  }

  adapterInstance = new StubGPortalAdapter()
  console.log("[GPortal] Using StubGPortalAdapter")
  return adapterInstance
}

export async function resetGPortalAdapter(): Promise<void> {
  await adapterInstance?.dispose()
  adapterInstance = null
}
