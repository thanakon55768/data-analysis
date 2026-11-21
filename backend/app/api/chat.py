import json
import threading
from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field

from app.schemas import AnalysisError
from app.services.chat_analysis import execute_plan, plan_question
from app.services.repository_access import get_repository

router = APIRouter(prefix="/api/v1/datasets")
chat_gate = threading.Lock()


class Question(BaseModel):
    model_config = ConfigDict(extra="forbid")
    question: str = Field(min_length=1, max_length=2000)
    share_with_gemini: bool = False


def current_conversation(metadata):
    conversation = metadata.get("conversation", {})
    return (
        conversation.get("turns", [])
        if conversation.get("sheet") == metadata["selected_sheet"]
        else []
    )


@router.get("/{dataset_id}/chat")
def history(dataset_id: UUID, repo: Annotated[object, Depends(get_repository)]):
    return current_conversation(repo.get(str(dataset_id)))


@router.post("/{dataset_id}/chat")
def ask(
    dataset_id: UUID, body: Question, repo: Annotated[object, Depends(get_repository)]
):
    if not body.question.strip():
        raise AnalysisError("empty_question", "กรุณาพิมพ์คำถาม")
    if not body.share_with_gemini:
        raise AnalysisError(
            "ai_consent_required", "กรุณายืนยันการส่งคำถามและชื่อคอลัมน์ไป Gemini", 422
        )
    if not chat_gate.acquire(blocking=False):
        raise AnalysisError("ai_busy", "AI กำลังตอบคำถามอื่น กรุณาลองอีกครั้ง", 503)
    try:
        with repo.lock:
            metadata = repo.get(str(dataset_id))
            frame, columns, warnings = repo.frame(str(dataset_id), metadata)
            turns = current_conversation(metadata)
            plan = plan_question(body.question.strip(), columns, turns)
            answer, evidence = execute_plan(plan, frame, columns)
            turn = {
                "id": str(uuid4()),
                "question": body.question.strip(),
                "answer": answer,
                "plan": plan.model_dump(),
                "evidence": evidence,
                "warnings": warnings,
                "created_at": datetime.now(UTC).isoformat(),
                "algorithm_version": "1",
            }
            if len(json.dumps(turn, ensure_ascii=False).encode()) > 100_000:
                raise AnalysisError(
                    "chat_result_too_large", "ผลลัพธ์ยาวเกินไป กรุณาเลือกคอลัมน์อื่น", 422
                )
            retained = (turns + [turn])[-20:]
            while len(json.dumps(retained, ensure_ascii=False).encode()) > 200_000:
                retained.pop(0)
            metadata["conversation"] = {
                "sheet": metadata["selected_sheet"],
                "turns": retained,
            }
            repo.save(metadata)
            return turn
    finally:
        chat_gate.release()
