/**
 * TEMPLATE — G-portal HR API 어댑터 (API 오픈 후)
 *
 * 사용법:
 * 1. `ApiGPortalAdapter.template.ts` → `ApiGPortalAdapter.ts` 복사
 * 2. adapterFactory.ts 에 api 분기 추가
 * 3. `.env` 에 GPORTAL_ADAPTER=api, GPORTAL_API_BASE_URL=...
 */

import type { IGPortalAdapter } from "../IGPortalAdapter"
import type {
  AssetExportParams,
  GPortalToolResult,
  MeetingRoomReserveParams,
  MeetingRoomSearchParams,
  VacationApplyParams
} from "../types"

export class ApiGPortalAdapter implements IGPortalAdapter {
  readonly mode = "api"
  private baseUrl = process.env.GPORTAL_API_BASE_URL ?? ""
  private token = ""

  // ---------------------------------------------------------------------------
  // TODO: API 인증 (Bearer / 사내 토큰)
  // ---------------------------------------------------------------------------
  async ensureSession(): Promise<GPortalToolResult> {
    if (!this.baseUrl) {
      return { success: false, error: "GPORTAL_API_BASE_URL 이 설정되지 않았습니다." }
    }
    // TODO: POST /auth/login 또는 SSO 토큰 교환
    return { success: false, error: "ApiGPortalAdapter.ensureSession() — TODO" }
  }

  async navigate(_menuPath: string): Promise<GPortalToolResult> {
    // API 모드에서는 navigate 불필요 — no-op
    return { success: true, message: "API mode: navigate skipped" }
  }

  async searchMeetingRoom(
    params: MeetingRoomSearchParams
  ): Promise<GPortalToolResult> {
    // TODO: GET /api/meeting-rooms?date=&start=&end=
    return { success: false, error: "TODO", params }
  }

  async reserveMeetingRoom(
    params: MeetingRoomReserveParams
  ): Promise<GPortalToolResult> {
    // TODO: POST /api/meeting-rooms/reservations
    return { success: false, error: "TODO", params }
  }

  async submitAssetExport(
    params: AssetExportParams
  ): Promise<GPortalToolResult> {
    // TODO: POST /api/asset-exports
    return { success: false, error: "TODO", params }
  }

  async applyVacation(params: VacationApplyParams): Promise<GPortalToolResult> {
    // TODO: POST /api/vacations
    return { success: false, error: "TODO", params }
  }

  async dispose(): Promise<void> {
    this.token = ""
  }
}
