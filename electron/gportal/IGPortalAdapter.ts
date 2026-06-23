import type {
  AssetExportParams,
  GPortalToolResult,
  MeetingRoomReserveParams,
  MeetingRoomSearchParams,
  VacationApplyParams
} from "./types"

/**
 * G-portal 연동 인터페이스.
 * POC: PlaywrightGPortalAdapter
 * 이후 API 오픈 시: ApiGPortalAdapter (동일 인터페이스, 앱/Agent 변경 없음)
 */
export interface IGPortalAdapter {
  readonly mode: string

  ensureSession(): Promise<GPortalToolResult>
  navigate(menuPath: string): Promise<GPortalToolResult>
  searchMeetingRoom(params: MeetingRoomSearchParams): Promise<GPortalToolResult>
  reserveMeetingRoom(params: MeetingRoomReserveParams): Promise<GPortalToolResult>
  submitAssetExport(params: AssetExportParams): Promise<GPortalToolResult>
  applyVacation(params: VacationApplyParams): Promise<GPortalToolResult>
  dispose(): Promise<void>
}
