"""
Vacation LangGraph skeleton — intake → validate → (interrupt) → execute → confirm.

Deploy with Databricks Apps / ResponsesAgent (see AGENTS.md).
This module is a readable reference implementation; wire MLflow ResponsesAgent in agent.py.
"""

from __future__ import annotations

from typing import Any, TypedDict

# Optional: from langgraph.graph import StateGraph, END
# from langgraph.types import interrupt


class VacationState(TypedDict, total=False):
    prompt: str
    collected: dict[str, Any]
    missing: list[str]
    result: str


REQUIRED = ("startDate", "endDate", "leaveType")


def intake(state: VacationState) -> VacationState:
    """Extract fields from prompt/context (LLM or rules)."""
    collected = dict(state.get("collected") or {})
    # Placeholder: real impl calls LLM structured extract
    return {**state, "collected": collected}


def validate(state: VacationState) -> VacationState:
    collected = state.get("collected") or {}
    missing = [k for k in REQUIRED if not collected.get(k)]
    return {**state, "missing": missing}


def route_after_validate(state: VacationState) -> str:
    return "await_input" if state.get("missing") else "execute"


def await_input(state: VacationState) -> VacationState:
    """
    HITL pause. In LangGraph:
      values = interrupt({"missingFields": state["missing"], ...})
      merge into collected and return.
    """
    missing = state.get("missing") or []
    # interrupt() would pause the graph here in production
    raise RuntimeError(
        f"HITL required — missing fields: {', '.join(missing)}. "
        "Use LangGraph interrupt() + /resume in production."
    )


def execute(state: VacationState) -> VacationState:
    collected = state.get("collected") or {}
    msg = (
        f"휴가 신청 완료(stub): {collected.get('startDate')} ~ "
        f"{collected.get('endDate')} ({collected.get('leaveType')})"
    )
    return {**state, "result": msg}


def confirm(state: VacationState) -> VacationState:
    return state


def build_graph_notes() -> str:
    return "intake → validate → [await_input|execute] → confirm"
