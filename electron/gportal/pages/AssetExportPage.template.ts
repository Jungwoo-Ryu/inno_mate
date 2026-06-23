/**
 * TEMPLATE — 자산 반출 신청 페이지
 * `AssetExportPage.template.ts` → `AssetExportPage.ts` 복사 후 구현
 */

import type { Page } from "playwright"
import type { AssetExportParams, GPortalSelectors } from "../types"

export class AssetExportPage {
  constructor(
    private page: Page,
    private selectors: GPortalSelectors["assetExport"]
  ) {}

  async submit(params: AssetExportParams): Promise<string> {
    // TODO: 폼 입력 → 상신 → 결재번호 반환
    await this.page.fill(this.selectors.assetIdInput, params.assetId)
    await this.page.fill(this.selectors.reasonInput, params.reason)
    await this.page.fill(this.selectors.startDateInput, params.startDate)
    await this.page.fill(this.selectors.endDateInput, params.endDate)
    await this.page.fill(this.selectors.destinationInput, params.destination)
    await this.page.click(this.selectors.submitButton)
    await this.page.waitForSelector(this.selectors.successMessage)
    return (await this.page.locator(this.selectors.successMessage).textContent()) ?? ""
  }
}
