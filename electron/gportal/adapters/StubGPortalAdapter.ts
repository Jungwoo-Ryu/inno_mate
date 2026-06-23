import { configHelper } from "../../ConfigHelper"
import { hasEnvGportalConfig } from "../../envConfig"
import type { IGPortalAdapter } from "../IGPortalAdapter"
import type {
  AssetExportParams,
  GPortalToolResult,
  MeetingRoomReserveParams,
  MeetingRoomSearchParams,
  VacationApplyParams
} from "../types"

/**
 * 기본 stub 어댑터 — Playwright 구현 전까지 Agent 파이프라인 테스트용.
 * .env 에 GPORTAL_* 가 있어도 실제 브라우저는 열지 않음.
 */
export class StubGPortalAdapter implements IGPortalAdapter {
  readonly mode = "stub"
  private loggedIn = false

  async ensureSession(): Promise<GPortalToolResult> {
    const config = configHelper.loadConfig()

    if (!config.gportalUrl) {
      return {
        success: false,
        error:
          "G-portal URL이 없습니다. `.env`에 GPORTAL_URL을 설정하거나 Playwright 어댑터를 구현하세요."
      }
    }

    if (!config.gportalUsername || !config.gportalPassword) {
      return {
        success: false,
        error:
          "G-portal 계정이 없습니다. `.env`에 GPORTAL_USERNAME, GPORTAL_PASSWORD를 설정하세요."
      }
    }

    console.log(
      `[StubGPortal] ${config.gportalUsername} @ ${config.gportalUrl}` +
        (hasEnvGportalConfig() ? " (.env)" : "")
    )

    this.loggedIn = true
    return { success: true, message: "Stub session (Playwright 미구현)", poc: true }
  }

  async navigate(menuPath: string): Promise<GPortalToolResult> {
    if (!this.loggedIn) await this.ensureSession()
    console.log("[StubGPortal] navigate:", menuPath)
    return { success: true, menuPath, poc: true }
  }

  async searchMeetingRoom(
    params: MeetingRoomSearchParams
  ): Promise<GPortalToolResult> {
    console.log("[StubGPortal] meeting-room.search:", params)
    return {
      success: true,
      rooms: [{ name: "3층 회의실A", available: true }],
      poc: true
    }
  }

  async reserveMeetingRoom(
    params: MeetingRoomReserveParams
  ): Promise<GPortalToolResult> {
    console.log("[StubGPortal] meeting-room.reserve:", params)
    return {
      success: true,
      reservationId: `RES-STUB-${Date.now()}`,
      ...params,
      poc: true
    }
  }

  async submitAssetExport(
    params: AssetExportParams
  ): Promise<GPortalToolResult> {
    console.log("[StubGPortal] asset-export.submit:", params)
    return {
      success: true,
      approvalId: `APR-STUB-${Date.now()}`,
      status: "submitted",
      poc: true
    }
  }

  async applyVacation(params: VacationApplyParams): Promise<GPortalToolResult> {
    console.log("[StubGPortal] vacation.apply:", params)
    return {
      success: true,
      applicationId: `LV-STUB-${Date.now()}`,
      ...params,
      poc: true
    }
  }

  async dispose(): Promise<void> {
    this.loggedIn = false
  }
}
