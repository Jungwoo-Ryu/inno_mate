# InnoMate

**LG이노텍 G-portal AI Super Agent 웹앱**

InnoMate는 사내 G-portal 업무(회의실 예약, 휴가 신청, 자산 반출 등)를 AI Agent가 자동 처리하는 Super Agent 플랫폼입니다. 사용자는 프롬프트 엔지니어링 없이 업무 한 줄과 스크린샷만으로 요청할 수 있습니다.

## 주요 기능

- **Super Agent** — 사용자 요청을 분석해 `meeting-room`, `vacation`, `asset-export` 등 sub-agent로 위임
- **Harness 기반 에이전트** — `agents/` 폴더의 `GUIDE.md` + `harness.json`으로 업무 시나리오 패키징
- **G-portal 연동** — Playwright/API/stub 어댑터로 사내 포털 자동화
- **MCP 지원** — 외부 도구·API를 MCP 서버로 연결
- **멀티모달 입력** — 스크린샷, 파일 첨부, 텍스트 프롬프트

## 아키텍처

```
React 웹 UI (Vite)
       ↕ IPC
Electron Main Process
  ├── AgentOrchestrator
  ├── HarnessRunner / HarnessLoader
  ├── G-portal Adapter
  └── MCP Store
```

## 빠른 시작

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

```bash
cp .env.example .env
```

`.env`에 AI API 키와 G-portal 자격증명을 입력합니다.

```env
OPENAI_API_KEY=sk-your-key
GPORTAL_URL=https://gportal.example.com
GPORTAL_USERNAME=your_system_account
GPORTAL_PASSWORD=your_password
```

### 3. 개발 실행

```bash
npm start
```

브라우저 UI는 `http://localhost:54321`에서 제공되며, Electron 셸과 함께 실행됩니다.

### 4. 프로덕션 빌드

```bash
npm run build
npm run run-prod
```

## 에이전트 구조

| 에이전트 | 역할 |
|---|---|
| `super` | 요청 라우팅 및 sub-agent 오케스트레이션 |
| `meeting-room` | 회의실 예약 |
| `vacation` | 휴가/연차 신청 |
| `asset-export` | 자산 반출 |

각 에이전트는 `agents/<name>/` 아래에 있습니다.

```
agents/
  super/
    GUIDE.md
    harness.json
  meeting-room/
  vacation/
  asset-export/
```

## 단축키

| 단축키 | 동작 |
|---|---|
| `Cmd/Ctrl + B` | 창 표시/숨김 |
| `Cmd/Ctrl + H` | 스크린샷 |
| `Cmd/Ctrl + Enter` | Agent 실행 |
| `Cmd/Ctrl + L` | 마지막 스크린샷 삭제 |
| `Cmd/Ctrl + R` | 초기화 |

## 설정

설정 UI 또는 `.env`에서 다음을 구성합니다.

- **API Provider** — OpenAI / Gemini / Anthropic
- **Super Agent 모델** — 업무 실행용
- **의도 분류 모델** — 스크린샷 업무 유형 분류용
- **G-portal** — URL, 시스템 계정

API 키는 로컬 `.env`에만 저장되며 외부 서버로 전송되지 않습니다.

## 라이선스

AGPL-3.0-or-later — LG Innotek
