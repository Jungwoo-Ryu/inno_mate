# InnoMate 기여 가이드

LG이노텍 InnoMate Super Agent 프로젝트에 기여해 주셔서 감사합니다.

## 개발 환경

```bash
git clone <repository-url>
cd inno_mate
npm install
cp .env.example .env
npm start
```

## 에이전트 추가

1. `agents/<agent-id>/` 폴더 생성
2. `GUIDE.md` — 역할, 워크플로, 출력 형식 정의
3. `harness.json` — 모델, tools, delegates 설정
4. Super Agent `harness.json`의 `delegates`에 등록

## 코드 스타일

- TypeScript strict 준수
- UI 텍스트는 한국어(존댓말)
- 에이전트 GUIDE/프롬프트는 영어, 사용자 메시지는 한국어

## PR 가이드

- 변경 범위를 작게 유지
- 에이전트 변경 시 해당 `scenarios/` 테스트 시나리오 포함
- API 키·비밀번호 등 민감 정보 커밋 금지

## 문의

내부 InnoMate 프로젝트 담당자에게 연락해 주세요.
