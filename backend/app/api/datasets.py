import json
from pathlib import Path
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, File, Query, Request, Response, UploadFile

from app.config import MAX_FILE_BYTES
from app.schemas import AnalysisError, DatasetResponse, SheetSelection
from app.services.file_validation import upload_kind
from app.services.parsing import run_parse
from app.services.statistics import build_preview, compute_statistics

router = APIRouter(prefix="/api/v1/datasets")


def acquire_gate(request: Request):
    if not request.app.state.parse_gate.acquire(blocking=False):
        raise AnalysisError(
            "parser_busy", "ระบบกำลังอ่านไฟล์อื่น กรุณาลองอีกครั้งเมื่อประมวลผลเสร็จ", 503
        )


@router.post("", status_code=201, response_model=DatasetResponse)
def upload_dataset(request: Request, file: Annotated[UploadFile, File()]):
    repo = request.app.state.repository
    acquire_gate(request)
    dataset_id = None
    try:
        filename = (file.filename or "data").replace("\\", "/").split("/")[-1][:255]
        upload_kind(filename)
        dataset_id, path = repo.create(filename)
        length = 0
        with path.open("wb") as stream:
            while chunk := file.file.read(64 * 1024):
                length += len(chunk)
                if length > MAX_FILE_BYTES:
                    raise AnalysisError("file_too_large", "ไฟล์ต้องมีขนาดไม่เกิน 10 MB", 413)
                stream.write(chunk)
        payload = run_parse(path, filename, None)
        metadata = repo.metadata(dataset_id, filename, payload)
        repo.save(metadata, None if "sheets" in payload else payload)
        return metadata
    except Exception:
        if dataset_id is not None:
            repo.delete(dataset_id)
        raise
    finally:
        request.app.state.parse_gate.release()
        file.file.close()


@router.post("/{dataset_id}/sheet", response_model=DatasetResponse)
def select_sheet(dataset_id: UUID, selection: SheetSelection, request: Request):
    repo = request.app.state.repository
    acquire_gate(request)
    try:
        with repo.lock:
            metadata = repo.get(str(dataset_id))
            if selection.sheet_name not in [
                sheet["name"] for sheet in metadata["sheets"]
            ]:
                raise AnalysisError("unknown_sheet", "ไม่พบชีตที่เลือก")
            payload = run_parse(
                repo.root
                / str(dataset_id)
                / ("original" + Path(metadata["filename"]).suffix.lower()),
                metadata["filename"],
                selection.sheet_name,
            )
            metadata.update(
                selected_sheet=selection.sheet_name,
                status="ready",
                warnings=payload["warnings"],
            )
            repo.save(metadata, payload)
            return metadata
    finally:
        request.app.state.parse_gate.release()


@router.get("/{dataset_id}/preview")
def preview(
    dataset_id: UUID,
    request: Request,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: str = Query("", max_length=200),
):
    frame, columns, _ = request.app.state.repository.frame(str(dataset_id))
    result = build_preview(frame, columns, offset, limit, search)
    if len(json.dumps(result, ensure_ascii=False).encode("utf-8")) > 2 * 1024 * 1024:
        raise AnalysisError(
            "preview_too_large", "ข้อมูลตัวอย่างใหญ่เกินไป กรุณาลดจำนวนแถวที่แสดง", 413
        )
    return result


@router.get("/{dataset_id}/statistics")
def statistics(dataset_id: UUID, request: Request):
    frame, columns, warnings = request.app.state.repository.frame(str(dataset_id))
    result = compute_statistics(frame, columns)
    result["warnings"] = warnings + result["warnings"]
    return result


@router.delete("/{dataset_id}", status_code=204)
def delete_dataset(dataset_id: UUID, request: Request):
    repo = request.app.state.repository
    with repo.lock:
        repo.get(str(dataset_id))
        repo.delete(str(dataset_id))
    return Response(status_code=204)
