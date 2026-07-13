# Scenario: 회의실 예약 Happy Path

## Input

- Screenshot: G-portal 회의실 예약 화면
- User prompt: (없음 — 무프롬프트 모드)

## Expected Intent

`meeting-room`

## Expected Tool Sequence

1. `gportal_ensure_session`
2. `gportal_navigate` → "시설관리 > 회의실 예약"
3. `meeting_room_search` → date=내일, startTime=14:00, endTime=15:00
4. `meeting_room_reserve` → room="3층 회의실A"

## Expected Output (Korean)

"3층 회의실A가 내일 14:00~15:00에 예약되었습니다."
