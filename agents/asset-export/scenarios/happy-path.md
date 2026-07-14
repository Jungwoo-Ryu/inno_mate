# Scenario: 자산 반출 Happy Path

## Input

- Screenshot: G-portal 자산 반출 신청 화면
- User prompt: (없음)

## Expected Intent

`asset-export`

## Expected Tool Sequence

1. `gportal_ensure_session`
2. `gportal_navigate` → "IT자산 > 자산 반출 신청"
3. `asset_export_submit` → assetId, reason, dates, destination

## Expected Output (Korean)

"노트북 자산 반출 결재가 상신되었습니다. 승인 완료 후 반출 가능합니다."
