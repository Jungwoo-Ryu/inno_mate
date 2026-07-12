# Databricks Agents (InnoMate)

LangGraph 서브 에이전트를 Databricks Apps로 배포하는 모노레포 영역입니다.

## 구조

```text
databricks-agents/
  AGENTS.md
  shared/                 # 공통 HITL / 이벤트 헬퍼 (추후)
  templates/hr_form_v1/   # 복제용 스캐폴드
  instances/vacation/     # 배포 단위 예시
```

## 새 에이전트 추가

1. `templates/hr_form_v1` → `instances/<id>` 복사
2. `agent.yaml` / `agent_server/graph.py` 수정
3. `databricks bundle deploy && databricks bundle run`
4. InnoMate 웹 `/agents`에 endpoint URL 등록 (`runtime=databricks`)

## 참고

- [Author an AI agent on Databricks Apps](https://docs.databricks.com/aws/en/agents/agent-framework/author-agent)
- ResponsesAgent + LangGraph 권장
