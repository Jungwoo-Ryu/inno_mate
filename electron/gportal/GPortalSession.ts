import { getGPortalAdapter } from "./adapterFactory"
import type { IGPortalAdapter } from "./IGPortalAdapter"
import type {
  AssetExportParams,
  GPortalToolResult,
  MeetingRoomReserveParams,
  MeetingRoomSearchParams,
  VacationApplyParams
} from "./types"

/**
 * Agent tool → G-portal 어댑터 브릿지.
 * 구현은 adapters/ 에서 교체 (stub | playwright | api).
 */
class GPortalSession {
  private get adapter(): IGPortalAdapter {
    return getGPortalAdapter()
  }

  async ensureSession(): Promise<GPortalToolResult> {
    return this.adapter.ensureSession()
  }

  async navigate(menuPath: string): Promise<GPortalToolResult> {
    return this.adapter.navigate(menuPath)
  }

  async searchMeetingRoom(
    params: Record<string, string>
  ): Promise<GPortalToolResult> {
    return this.adapter.searchMeetingRoom(params as unknown as MeetingRoomSearchParams)
  }

  async reserveMeetingRoom(
    params: Record<string, string>
  ): Promise<GPortalToolResult> {
    return this.adapter.reserveMeetingRoom(params as unknown as MeetingRoomReserveParams)
  }

  async submitAssetExport(
    params: Record<string, string>
  ): Promise<GPortalToolResult> {
    return this.adapter.submitAssetExport(params as unknown as AssetExportParams)
  }

  async applyVacation(
    params: Record<string, string>
  ): Promise<GPortalToolResult> {
    return this.adapter.applyVacation(params as unknown as VacationApplyParams)
  }
}

export const gportalSession = new GPortalSession()
