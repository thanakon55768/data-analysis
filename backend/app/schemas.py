from typing import Literal

from pydantic import BaseModel, Field


class AnalysisError(Exception):
    def __init__(self, code: str, message: str, status: int = 422):
        self.code, self.message, self.status = code, message, status
        super().__init__(message)


class SheetSelection(BaseModel):
    sheet_name: str = Field(min_length=1, max_length=31)


class DatasetResponse(BaseModel):
    id: str
    filename: str
    sheets: list[dict[str, str]]
    selected_sheet: str | None
    status: Literal["needs_sheet", "ready"]
    expires_at: str
    warnings: list[str]
