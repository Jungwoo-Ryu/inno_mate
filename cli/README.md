# InnoMate CLI

웹 Agent Registry + `/api/chat`를 사용하는 터미널 클라이언트입니다.

```bash
cd cli
npm install
cp ../.env.example ../.env   # OPENAI_* 는 웹 서버에, CLI는 INNOMATE_WEB_URL만 필수

# 개발 실행
npm run dev -- agents
npm run dev -- run "내일 연차 신청해줘"
npm run dev -- run -i ./shot.png "이 화면 기준으로 처리"
npm run dev -- resume <runId> -f startDate=2026-07-20 -f endDate=2026-07-21
```

환경변수:

```env
INNOMATE_WEB_URL=http://localhost:3000
```

웹 서버(`cd web && npm run dev`)가 떠 있어야 합니다.
