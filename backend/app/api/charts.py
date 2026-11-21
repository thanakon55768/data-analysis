from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.schemas import AnalysisError
from app.services.chat_analysis import AnalysisPlan, execute_plan
from app.services.repository_access import get_repository

router = APIRouter(prefix="/api/v1/datasets")


@router.get("/{dataset_id}/chart")
def chart(
    dataset_id: UUID,
    repo: Annotated[object, Depends(get_repository)],
    group_id: str = Query(min_length=1, max_length=10),
    value_id: str | None = Query(default=None, max_length=10),
    expected_sheet: str | None = Query(default=None, max_length=31),
    metric: Literal["sum", "mean", "median", "min", "max", "count"] = "count",
):
    metadata = repo.get(str(dataset_id))
    if expected_sheet is not None and expected_sheet != (
        metadata["selected_sheet"] or ""
    ):
        raise AnalysisError(
            "dataset_changed", "ชีตถูกเปลี่ยนในอีกหน้าต่าง กรุณาเปิดไฟล์จากรายการด้านซ้ายใหม่", 409
        )
    frame, columns, warnings = repo.frame(str(dataset_id), metadata)
    plan = AnalysisPlan(
        action="group", group_id=group_id, column_id=value_id, metric=metric
    )
    message, result = execute_plan(plan, frame, columns)
    if result is None:
        raise AnalysisError("invalid_chart", message)
    result["warnings"] = warnings
    return result
