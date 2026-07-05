# InnoMate Web

LG이노텍 InnoMate AI Super Agent **웹 포털**입니다.  
채팅, 에이전트 레지스트리, MCP 연결 관리를 담당하며, 데스크톱 앱이 여기 등록된 에이전트를 동기화해 사용합니다.

## 역할 분담

| 기능 | 웹 (여기) | 데스크톱 앱 |
|---|---|---|
| 채팅 + 이전 대화 기록 | ✅ | compact 실행만 |
| 에이전트 등록/편집 (GUIDE + harness) | ✅ | 동기화(pull)만 |
| MCP 연결 프로필 | ✅ | 로컬 실행 |
| G-portal 자동화·스크린샷·OCR | ❌ | ✅ |

## 시작하기

```bash
cd web
npm install
cp .env.example .env.local   # OpenAI 사내 URL·키 입력
npm run dev                  # http://localhost:3000
```

### .env.local

```env
OPENAI_BASE_URL=https://ai-gateway.example.com/v1   # 사내 프록시 URL
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.5
```

## 데스크톱 앱 연동

1. 웹 실행 (`npm run dev`)
2. 데스크톱 앱 `.env`에 `INNOMATE_WEB_URL=http://localhost:3000` (기본값)
3. 앱의 **에이전트 관리 → 클라우드 아이콘**으로 활성 에이전트 동기화

동기화된 에이전트는 `userData/agents/<id>/`에 `GUIDE.md` + `harness.json`으로 저장되어
기존 HarnessLoader/Super Agent가 그대로 사용합니다.

## API

| 엔드포인트 | 설명 |
|---|---|
| `POST /api/chat` | 스트리밍 채팅 (세션 자동 생성) |
| `GET /api/sessions` | 세션 목록 |
| `GET/PATCH/DELETE /api/sessions/:id` | 세션 조회/이름변경/삭제 |
| `GET /api/agents?enabled=true` | 활성 에이전트 (데스크톱 sync용) |
| `POST /api/agents`, `PUT/DELETE /api/agents/:id` | 에이전트 CRUD |
| `GET/POST /api/mcp`, `DELETE /api/mcp/:id` | MCP 프로필 |

## 저장소

SQLite (`web/data/innomate.db`, 자동 생성).  
최초 실행 시 저장소 루트 `agents/` 폴더의 기본 에이전트 4개를 자동 seed합니다.

## 파일 첨부

- 이미지 → vision 입력 (base64)
- 텍스트류(txt, md, csv, json, 코드 등) → 본문 인라인
- 그 외(pdf, xlsx 등) → 파일명·메타데이터만 전달 (PoC)
- 파일당 최대 8MB
