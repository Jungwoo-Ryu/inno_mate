/**
 * TEMPLATE — 휴가 신청 페이지
 * `VacationPage.template.ts` → `VacationPage.ts` 복사 후 구현
 */

import type { Page } from "playwright"
import type { GPortalSelectors, VacationApplyParams } from "../types"

export class VacationPage {
  constructor(
    private page: Page,
    private selectors: GPortalSelectors["vacation"]
  ) {}

  async apply(params: VacationApplyParams): Promise<string> {
    // TODO: 휴가 종류/기간 입력 → 신청 → 완료 메시지 반환
    await this.page.selectOption(this.selectors.leaveTypeSelect, params.leaveType)
    await this.page.fill(this.selectors.startDateInput, params.startDate)
    await this.page.fill(this.selectors.endDateInput, params.endDate)
    if (params.reason) {
      await this.page.fill(this.selectors.reasonInput, params.reason)
    }
    if (params.substitute) {
      await this.page.fill(this.selectors.substituteInput, params.substitute)
    }
    await this.page.click(this.selectors.submitButton)
    await this.page.waitForSelector(this.selectors.successMessage)
    return (await this.page.locator(this.selectors.successMessage).textContent()) ?? ""
  }
}
