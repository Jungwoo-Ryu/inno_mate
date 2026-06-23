/**
 * TEMPLATE — G-portal 로그인 페이지
 *
 * 사용법:
 * 1. `LoginPage.template.ts` → `LoginPage.ts` 로 복사
 * 2. PlaywrightGPortalAdapter 에서 import
 */

import type { Page } from "playwright"
import type { GPortalSelectors } from "../types"

export class LoginPage {
  constructor(
    private page: Page,
    private selectors: GPortalSelectors["login"]
  ) {}

  async goto(baseUrl: string): Promise<void> {
    const url = new URL(this.selectors.urlPath, baseUrl).href
    await this.page.goto(url, { waitUntil: "networkidle" })
  }

  async isLoggedIn(): Promise<boolean> {
    // TODO: loggedInIndicator selector 확인
    return this.page.locator(this.selectors.loggedInIndicator).isVisible()
  }

  async login(username: string, password: string): Promise<void> {
    // TODO: 구현
    await this.page.fill(this.selectors.usernameInput, username)
    await this.page.fill(this.selectors.passwordInput, password)
    await this.page.click(this.selectors.submitButton)
    await this.page.waitForSelector(this.selectors.loggedInIndicator)
  }
}
