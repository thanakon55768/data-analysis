import json
import shutil
import threading
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID, uuid4

import pandas as pd

from app.config import TTL_HOURS
from app.schemas import AnalysisError


class DatasetRepository:
    def __init__(self, root: Path):
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self.lock = threading.RLock()
        self.cleanup_expired()

    def _path(self, dataset_id: str) -> Path:
        try:
            if str(UUID(dataset_id)) != dataset_id:
                raise ValueError()
        except ValueError:
            raise AnalysisError(
                "dataset_not_found", "ไม่พบข้อมูลหรือข้อมูลหมดอายุ กรุณาอัปโหลดใหม่", 404
            ) from None
        return self.root / dataset_id

    def cleanup_expired(self):
        with self.lock:
            for directory in self.root.iterdir():
                if not directory.is_dir() or directory.is_symlink():
                    continue
                try:
                    UUID(directory.name)
                    metadata = directory / "metadata.json"
                    if metadata.exists():
                        expired = datetime.fromisoformat(
                            json.loads(metadata.read_text(encoding="utf-8"))[
                                "expires_at"
                            ]
                        ) <= datetime.now(UTC)
                    else:
                        # Active upload/parse folders have no metadata yet; only clean abandoned ones.
                        expired = (
                            directory.stat().st_mtime
                            < datetime.now(UTC).timestamp() - TTL_HOURS * 3600
                        )
                    if expired:
                        shutil.rmtree(directory)
                except (ValueError, KeyError, OSError):
                    continue

    def create(self, filename: str) -> tuple[str, Path]:
        with self.lock:
            self.cleanup_expired()
            dataset_id = str(uuid4())
            directory = self.root / dataset_id
            directory.mkdir()
            return dataset_id, directory / ("original" + Path(filename).suffix.lower())

    def save(self, metadata: dict, parsed: dict | None = None):
        directory = self._path(metadata["id"])
        with self.lock:
            if parsed is not None:
                pending = directory / "parsed.pending"
                pending.write_text(
                    json.dumps(parsed, ensure_ascii=False, allow_nan=False),
                    encoding="utf-8",
                )
                pending.replace(directory / "parsed.json")
            pending = directory / "metadata.pending"
            pending.write_text(
                json.dumps(metadata, ensure_ascii=False), encoding="utf-8"
            )
            pending.replace(directory / "metadata.json")

    def metadata(self, dataset_id: str, filename: str, payload: dict) -> dict:
        is_workbook = "sheets" in payload
        return {
            "id": dataset_id,
            "filename": filename,
            "sheets": payload.get("sheets", []),
            "selected_sheet": None,
            "status": "needs_sheet" if is_workbook else "ready",
            "expires_at": (datetime.now(UTC) + timedelta(hours=TTL_HOURS)).isoformat(),
            "warnings": payload.get("warnings", []),
        }

    def get(self, dataset_id: str) -> dict:
        with self.lock:
            self.cleanup_expired()
            path = self._path(dataset_id) / "metadata.json"
            if not path.exists():
                raise AnalysisError(
                    "dataset_not_found", "ไม่พบข้อมูลหรือข้อมูลหมดอายุ กรุณาอัปโหลดใหม่", 404
                )
            return json.loads(path.read_text(encoding="utf-8"))

    def frame(self, dataset_id: str) -> tuple[pd.DataFrame, list, list]:
        with self.lock:
            metadata = self.get(dataset_id)
            if metadata["status"] != "ready":
                raise AnalysisError("sheet_required", "กรุณาเลือกชีตก่อนวิเคราะห์ข้อมูล", 409)
            payload = json.loads(
                (self._path(dataset_id) / "parsed.json").read_text(encoding="utf-8")
            )
            columns = payload["columns"]
            frame = pd.DataFrame(
                payload["rows"],
                columns=[column["id"] for column in columns],
                dtype=object,
            )
            return frame, columns, payload["warnings"]

    def delete(self, dataset_id: str):
        with self.lock:
            directory = self._path(dataset_id)
            if directory.exists():
                shutil.rmtree(directory)
