import zipfile
from pathlib import Path
from typing import Literal

from app.config import MAX_ARCHIVE_MEMBERS, MAX_EXPANDED_BYTES, MAX_FILE_BYTES
from app.schemas import AnalysisError


def validate_upload(path: Path, original_name: str) -> Literal["csv", "xlsx"]:
    kind = Path(original_name).suffix.lower().lstrip(".")
    if kind not in {"csv", "xlsx"}:
        raise AnalysisError("unsupported_format", "รองรับเฉพาะไฟล์ .csv และ .xlsx", 415)
    if path.stat().st_size > MAX_FILE_BYTES:
        raise AnalysisError("file_too_large", "ไฟล์ต้องมีขนาดไม่เกิน 10 MB", 413)
    if not path.stat().st_size:
        raise AnalysisError("empty_file", "ไฟล์ว่าง กรุณาเลือกไฟล์ที่มีข้อมูล")
    if kind == "xlsx":
        try:
            with zipfile.ZipFile(path) as archive:
                members = archive.infolist()
                if (
                    len(members) > MAX_ARCHIVE_MEMBERS
                    or sum(item.file_size for item in members) > MAX_EXPANDED_BYTES
                    or any(item.flag_bits & 1 for item in members)
                ):
                    raise AnalysisError(
                        "archive_limit",
                        "ไฟล์ Excel เกินขอบเขต: ขนาดหลังคลายไม่เกิน 100 MB และไม่เกิน 2,000 รายการภายใน หรือไฟล์มีการเข้ารหัส",
                    )
        except (zipfile.BadZipFile, OSError):
            raise AnalysisError(
                "invalid_workbook", "ไฟล์ Excel ไม่ถูกต้องหรือเสียหาย"
            ) from None
    return kind
