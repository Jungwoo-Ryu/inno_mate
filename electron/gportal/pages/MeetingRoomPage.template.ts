/**
 * TEMPLATE — 회의실 예약 페이지
 * `MeetingRoomPage.template.ts` → `MeetingRoomPage.ts` 복사 후 구현
 */

import type { Page } from "playwright"
import type { GPortalSelectors, MeetingRoomReserveParams, MeetingRoomSearchParams } from "../types"

export class MeetingRoomPage {
  constructor(
    private page: Page,
    private selectors: GPortalSelectors["meetingRoom"]
  ) {}

  async search(params: MeetingRoomSearchParams): Promise<string[]> {
    // TODO: 날짜/시간 입력 → 검색 → 가용 회의실 목록 반환
    await this.page.fill(this.selectors.dateInput, params.date)
    await this.page.fill(this.selectors.startTimeInput, params.startTime)
    await this.page.fill(this.selectors.endTimeInput, params.endTime)
    await this.page.click(this.selectors.searchButton)

    const rows = this.page.locator(this.selectors.roomRow)
    const count = await rows.count()
    const rooms: string[] = []
    for (let i = 0; i < count; i++) {
      rooms.push((await rows.nth(i).textContent()) ?? "")
    }
    return rooms
  }

  async reserve(params: MeetingRoomReserveParams): Promise<string> {
    // TODO: 회의실 선택 → 예약 → 확인 → 예약번호/메시지 반환
    await this.page.click(this.selectors.reserveButton)
    await this.page.click(this.selectors.confirmButton)
    await this.page.waitForSelector(this.selectors.successMessage)
    return (await this.page.locator(this.selectors.successMessage).textContent()) ?? ""
  }
}
