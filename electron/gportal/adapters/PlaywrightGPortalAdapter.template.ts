/**
 * TEMPLATE — Playwright G-portal 어댑터
 *
 * 사용법:
 * 1. 이 파일을 같은 폴더에 `PlaywrightGPortalAdapter.ts` 로 복사
 * 2. TODO 주석 부분 구현
 * 3. `npm install playwright` && `npx playwright install chromium`
 * 4. `.env` 에 `GPORTAL_ADAPTER=playwright` 추가
 * 5. `selectors.json` 생성 (selectors.template.json 참고)
 *
 * 가이드: agents/_shared/GPORTAL_PLAYWRIGHT_GUIDE.md
 */

import path from "node:path"
import fs from "node:fs"
import { app } from "electron"
import type { Browser, BrowserContext, Page } from "playwright"
import { chromium } from "playwright"
import { configHelper } from "../../ConfigHelper"
import type { IGPortalAdapter } from "../IGPortalAdapter"
import type {
  AssetExportParams,
  GPortalSelectors,
  GPortalToolResult,
  MeetingRoomReserveParams,
  MeetingRoomSearchParams,
  VacationApplyParams
} from "../types"
// import { LoginPage } from "../pages/LoginPage"
// import { MeetingRoomPage } from "../pages/MeetingRoomPage"
// import { AssetExportPage } from "../pages/AssetExportPage"
// import { VacationPage } from "../pages/VacationPage"

export class PlaywrightGPortalAdapter implements IGPortalAdapter {
  readonly mode = "playwright"

  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private page: Page | null = null
  private selectors: GPortalSelectors | null = null

  // ---------------------------------------------------------------------------
  // TODO: selectors.json 로드
  // ---------------------------------------------------------------------------
  private loadSelectors(): GPortalSelectors {
    if (this.selectors) return this.selectors

    const candidates = [
      path.join(app.getPath("userData"), "gportal", "selectors.json"),
      path.join(process.cwd(), "electron/gportal/selectors.json"),
      path.join(__dirname, "../selectors.json")
    ]

    for (const filePath of candidates) {
      if (fs.existsSync(filePath)) {
        this.selectors = JSON.parse(fs.readFileSync(filePath, "utf8"))
        return this.selectors!
      }
    }

    throw new Error(
      "selectors.json 을 찾을 수 없습니다. selectors.template.json 을 복사해 채워 주세요."
    )
  }

  // ---------------------------------------------------------------------------
  // TODO: 브라우저 세션 (persistent context 권장)
  // ---------------------------------------------------------------------------
  private async getPage(): Promise<Page> {
    if (this.page) return this.page

    const userDataDir = path.join(app.getPath("userData"), "gportal", "browser")
    fs.mkdirSync(userDataDir, { recursive: true })

    // TODO: headless 여부 — POC에서는 headless: false 로 디버깅 권장
    this.browser = await chromium.launch({ headless: true })
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 800 }
      // persistent: userDataDir  // launchPersistentContext 사용 시
    })
    this.page = await this.context.newPage()
    return this.page
  }

  // ---------------------------------------------------------------------------
  // TODO: 로그인 구현
  // ---------------------------------------------------------------------------
  async ensureSession(): Promise<GPortalToolResult> {
    const config = configHelper.loadConfig()
    const selectors = this.loadSelectors()
    const page = await this.getPage()

    try {
      const loginUrl = new URL(selectors.login.urlPath, config.gportalUrl).href
      await page.goto(loginUrl, { waitUntil: "networkidle" })

      // TODO: 이미 로그인된 경우 skip
      // if (await page.locator(selectors.login.loggedInIndicator).isVisible()) {
      //   return { success: true, message: "Already logged in" }
      // }

      // TODO: 로그인 폼 입력
      // await page.fill(selectors.login.usernameInput, config.gportalUsername)
      // await page.fill(selectors.login.passwordInput, config.gportalPassword)
      // await page.click(selectors.login.submitButton)
      // await page.waitForSelector(selectors.login.loggedInIndicator)

      // 임시 — 구현 전까지 실패 반환
      return {
        success: false,
        error: "PlaywrightGPortalAdapter.ensureSession() — TODO 구현 필요"
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // TODO: 메뉴 네비게이션 (menuPath: "시설관리 > 회의실 예약")
  // ---------------------------------------------------------------------------
  async navigate(menuPath: string): Promise<GPortalToolResult> {
    const session = await this.ensureSession()
    if (!session.success) return session

    const page = await this.getPage()
    const selectors = this.loadSelectors()
    const parts = menuPath.split(">").map((s) => s.trim())

    try {
      // TODO: 1단계 메뉴 클릭
      // await page.click(selectors.navigation.menuItem.replace("{name}", parts[0]))
      // TODO: 2단계 서브메뉴 클릭
      // if (parts[1]) {
      //   await page.click(selectors.navigation.submenuItem.replace("{name}", parts[1]))
      // }

      return {
        success: false,
        error: `PlaywrightGPortalAdapter.navigate() — TODO: "${menuPath}"`
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // TODO: 회의실 검색
  // ---------------------------------------------------------------------------
  async searchMeetingRoom(
    params: MeetingRoomSearchParams
  ): Promise<GPortalToolResult> {
    const nav = await this.navigate("시설관리 > 회의실 예약")
    if (!nav.success) return nav

    // const page = await this.getPage()
    // const s = this.loadSelectors().meetingRoom
    // await page.fill(s.dateInput, params.date)
    // await page.fill(s.startTimeInput, params.startTime)
    // await page.fill(s.endTimeInput, params.endTime)
    // await page.click(s.searchButton)

    return {
      success: false,
      error: "PlaywrightGPortalAdapter.searchMeetingRoom() — TODO 구현 필요",
      params
    }
  }

  // ---------------------------------------------------------------------------
  // TODO: 회의실 예약
  // ---------------------------------------------------------------------------
  async reserveMeetingRoom(
    params: MeetingRoomReserveParams
  ): Promise<GPortalToolResult> {
    // TODO: search → room 선택 → reserve → confirm
    return {
      success: false,
      error: "PlaywrightGPortalAdapter.reserveMeetingRoom() — TODO 구현 필요",
      params
    }
  }

  // ---------------------------------------------------------------------------
  // TODO: 자산 반출 상신
  // ---------------------------------------------------------------------------
  async submitAssetExport(
    params: AssetExportParams
  ): Promise<GPortalToolResult> {
    const nav = await this.navigate("IT자산 > 자산 반출 신청")
    if (!nav.success) return nav

    return {
      success: false,
      error: "PlaywrightGPortalAdapter.submitAssetExport() — TODO 구현 필요",
      params
    }
  }

  // ---------------------------------------------------------------------------
  // TODO: 휴가 신청
  // ---------------------------------------------------------------------------
  async applyVacation(params: VacationApplyParams): Promise<GPortalToolResult> {
    const nav = await this.navigate("HR > 휴가/근태 > 휴가 신청")
    if (!nav.success) return nav

    return {
      success: false,
      error: "PlaywrightGPortalAdapter.applyVacation() — TODO 구현 필요",
      params
    }
  }

  async dispose(): Promise<void> {
    await this.page?.close()
    await this.context?.close()
    await this.browser?.close()
    this.page = null
    this.context = null
    this.browser = null
  }
}
