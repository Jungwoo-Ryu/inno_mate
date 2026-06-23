# G-portal Playwright 연동 가이드 (InnoMate)

이 문서는 **직접 G-portal 자동화를 구현**할 때 따라갈 체크리스트입니다.
Agent GUIDE.md / harness.json 은 수정하지 않아도 됩니다 — **어댑터만** 교체합니다.

---

## 디렉터리 구조

```
electron/gportal/
  IGPortalAdapter.ts          # 인터페이스 (수정 금지 권장)
  adapterFactory.ts           # stub | playwright 선택
  GPortalSession.ts           # Agent tool 브릿지
  selectors.template.json     # → selectors.json 복사 후 수정
  adapters/
    StubGPortalAdapter.ts     # 현재 기본 (stub)
    PlaywrightGPortalAdapter.template.ts  # → .ts 복사 후 구현
  pages/
    LoginPage.template.ts     # → .ts 복사 후 구현
    MeetingRoomPage.template.ts
    AssetExportPage.template.ts
    VacationPage.template.ts
```

---

## 1단계: 환경 설정

```bash
# Playwright 설치 (구현 시)
npm install playwright
npx playwright install chromium
```

`.env`:

```env
GPORTAL_URL=https://your-gportal-url
GPORTAL_USERNAME=system_account
GPORTAL_PASSWORD=your_password
GPORTAL_ADAPTER=playwright   # stub → playwright 로 전환
```

---

## 2단계: Selector 정의

```bash
cp electron/gportal/selectors.template.json electron/gportal/selectors.json
# 또는 사용자 데이터 경로 (앱 실행 후):
# ~/Library/Application Support/innomate/gportal/selectors.json
```

Chrome DevTools로 G-portal 실제 DOM 확인 후 각 필드 수정:

| 섹션 | 채울 항목 |
|------|----------|
| `login` | 로그인 URL path, input/button selector |
| `navigation` | 메뉴/서브메뉴 클릭 패턴 |
| `meetingRoom` | 날짜, 시간, 검색, 예약 버튼 |
| `assetExport` | 자산번호, 사유, 기간, 상신 |
| `vacation` | 휴가종류, 기간, 신청 |

**팁:** `data-testid` 가 없으면 `text=회의실 예약` 같은 Playwright text selector 사용.

---

## 3단계: Playwright 어댑터 구현

```bash
cp electron/gportal/adapters/PlaywrightGPortalAdapter.template.ts \
   electron/gportal/adapters/PlaywrightGPortalAdapter.ts
```

구현 순서 (TODO 주석 순):

1. `loadSelectors()` — selectors.json 로드 확인
2. `ensureSession()` — 로그인
3. `navigate(menuPath)` — `"A > B"` 형식 메뉴 이동
4. `searchMeetingRoom` / `reserveMeetingRoom`
5. `submitAssetExport`
6. `applyVacation`

### 페이지 클래스 분리 (권장)

```bash
cp electron/gportal/pages/LoginPage.template.ts electron/gportal/pages/LoginPage.ts
# MeetingRoom, AssetExport, Vacation 동일
```

`PlaywrightGPortalAdapter.ts` 에서 Page 클래스를 import 해 사용.

---

## 4단계: 테스트

1. `.env` 설정 후 `GPORTAL_ADAPTER=playwright`
2. `npm run dev`
3. G-portal 화면 캡처 → **Cmd+Enter**
4. 콘솔에서 `[GPortal] Using PlaywrightGPortalAdapter` 확인

디버깅 시 `headless: false` 로 브라우저 표시.

---

## 5단계: Agent 시나리오 검증 (선택)

```bash
cp electron/harness/ScenarioRunner.template.ts electron/harness/ScenarioRunner.ts
```

`agents/*/scenarios/happy-path.md` 의 Expected Tool Sequence 와 실제 tool 호출 비교.

---

## API 전환 시 (나중에)

```bash
cp electron/gportal/adapters/ApiGPortalAdapter.template.ts \
   electron/gportal/adapters/ApiGPortalAdapter.ts
```

`.env` 에 `GPORTAL_ADAPTER=api` 추가.
Agent GUIDE.md / harness.json / UI **변경 불필요**.

---

## 메뉴 경로 참고

| 업무 | menuPath (navigate 인자) |
|------|--------------------------|
| 회의실 | `시설관리 > 회의실 예약` |
| 자산 반출 | `IT자산 > 자산 반출 신청` |
| 휴가 | `HR > 휴가/근태 > 휴가 신청` |

실제 G-portal 메뉴명이 다르면 `GPORTAL_NAVIGATION.md` 와 Agent GUIDE.md 의 Workflow 섹션만 수정.

---

## 주의사항

- 비밀번호는 `.env` 에만 (`GPORTAL_PASSWORD`)
- POC 범위: **상신/신청 완료**까지, 승인 자동화는 하지 않음
- UI 변경 시 `selectors.json` 만 업데이트 (앱 재배포 불필요 — userData 경로 사용 시)
