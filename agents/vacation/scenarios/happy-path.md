# Scenario: 휴가 신청 Happy Path

## Input

- Screenshot: G-portal 휴가 신청 화면
- User prompt: (없음)

## Expected Intent

`vacation`

## Expected Tool Sequence

1. `gportal.ensure_session`
2. `gportal.navigate` → "HR > 휴가/근태 > 휴가 신청"
3. `vacation.apply` → leaveType=연차, startDate, endDate

## Expected Output (Korean)

"연차 휴가 신청이 완료되었습니다."
