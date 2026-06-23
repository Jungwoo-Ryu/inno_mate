# G-portal Navigation Reference

> **구현 가이드 (한국어):** [GPORTAL_PLAYWRIGHT_GUIDE.md](./GPORTAL_PLAYWRIGHT_GUIDE.md)  
> **Selector 템플릿:** `electron/gportal/selectors.template.json` → `selectors.json`  
> **어댑터 템플릿:** `electron/gportal/adapters/PlaywrightGPortalAdapter.template.ts`

## Base URL

`.env` → `GPORTAL_URL`

## Adapter Modes

| `GPORTAL_ADAPTER` | 설명 |
|-------------------|------|
| `stub` (기본) | 브라우저 없이 mock 응답 |
| `playwright` | PlaywrightGPortalAdapter.ts 구현 후 |
| `api` | ApiGPortalAdapter.ts 구현 후 (HR API 오픈 시) |

## Menu Paths

| Task | menuPath |
|------|----------|
| Meeting room | `시설관리 > 회의실 예약` |
| Asset export | `IT자산 > 자산 반출 신청` |
| Vacation | `HR > 휴가/근태 > 휴가 신청` |

## POC Constraints

- SSO not available; use system account via `.env`
- Submit approval requests only; do not auto-approve
- Update `selectors.json` when G-portal UI changes (no app redeploy needed)
