"""Durable private storage with temporary local parsing and optimistic updates."""

import json
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from app.schemas import AnalysisError
from app.services.dataset_repository import DatasetRepository


class SupabaseRepository(DatasetRepository):
    def __init__(self, root, gateway):
        self.gateway = gateway
        self.versions = {}
        self.parsed_paths = {}
        super().__init__(root)

    def cleanup_expired(self):
        pass

    def _prefix(self, dataset_id):
        self._path(dataset_id)
        return f"{self.gateway.owner}/{dataset_id}"

    def _record(self, dataset_id, include_deleting=False):
        response = self.gateway.call(
            "GET",
            "/rest/v1/datasets",
            params={
                "id": f"eq.{dataset_id}",
                "user_id": f"eq.{self.gateway.owner}",
                "select": "*",
            },
        )
        records = response.json()
        if not records or (
            records[0]["status"] in {"deleting", "uploading"} and not include_deleting
        ):
            raise AnalysisError("dataset_not_found", "ไม่พบข้อมูล", 404)
        return records[0]

    def metadata(self, dataset_id, filename, payload):
        metadata = super().metadata(dataset_id, filename, payload)
        metadata.update(expires_at=None, created_at=datetime.now(UTC).isoformat())
        return metadata

    def get(self, dataset_id):
        record = self._record(dataset_id)
        self.versions[dataset_id] = record["version"]
        self.parsed_paths[dataset_id] = record["parsed_path"]
        metadata = record["metadata"]
        directory = self._path(dataset_id)
        directory.mkdir(exist_ok=True)
        (directory / "metadata.json").write_text(json.dumps(metadata), encoding="utf8")
        if record["parsed_path"]:
            data = self.gateway.call(
                "GET",
                "/storage/v1/object/authenticated/datasets/" + record["parsed_path"],
            ).content
            (directory / "parsed.json").write_bytes(data)
        return metadata

    def original(self, dataset_id, filename):
        path = self._path(dataset_id) / ("original" + Path(filename).suffix.lower())
        if not path.exists():
            data = self.gateway.call(
                "GET",
                "/storage/v1/object/authenticated/datasets/"
                + self._prefix(dataset_id)
                + "/"
                + path.name,
            ).content
            path.write_bytes(data)
        return path

    def save(self, metadata, parsed=None):
        dataset_id = metadata["id"]
        prefix = self._prefix(dataset_id)
        version = self.versions.get(dataset_id)
        new_path = self.parsed_paths.get(dataset_id)
        if version is None:
            self.gateway.call(
                "POST",
                "/rest/v1/datasets",
                json={
                    "id": dataset_id,
                    "user_id": self.gateway.owner,
                    "filename": metadata["filename"],
                    "metadata": metadata,
                    "status": "uploading",
                    "version": 0,
                },
            )
            version = 0
            original = self.original(dataset_id, metadata["filename"])
            self.gateway.call(
                "POST",
                "/storage/v1/object/datasets/" + prefix + "/" + original.name,
                content=original.read_bytes(),
                headers={"Content-Type": "application/octet-stream"},
            )
        if parsed is not None:
            new_path = prefix + "/parsed-" + str(uuid4()) + ".json"
            self.gateway.call(
                "POST",
                "/storage/v1/object/datasets/" + new_path,
                content=json.dumps(
                    parsed, ensure_ascii=False, allow_nan=False
                ).encode(),
                headers={"Content-Type": "application/json"},
            )
        record = dict(
            metadata=metadata, status=metadata["status"], parsed_path=new_path
        )
        record["version"] = version + 1
        response = self.gateway.call(
            "PATCH",
            "/rest/v1/datasets",
            params={
                "id": f"eq.{dataset_id}",
                "version": f"eq.{version}",
                "status": "neq.deleting",
            },
            headers={"Prefer": "return=representation"},
            json=record,
        )
        if not response.json():
            if parsed is not None:
                self.gateway.call(
                    "DELETE",
                    "/storage/v1/object/datasets",
                    json={"prefixes": [new_path]},
                )
            raise AnalysisError("dataset_conflict", "ข้อมูลถูกเปลี่ยนแล้ว กรุณาเปิดใหม่", 409)
        # Older immutable versions remain private and are removed on dataset deletion.
        self.versions[dataset_id] = 1 if version is None else version + 1
        super().save(metadata, parsed)

    def list(self, offset=0, limit=20):
        response = self.gateway.call(
            "GET",
            "/rest/v1/datasets",
            params={
                "select": "metadata,status",
                "user_id": f"eq.{self.gateway.owner}",
                "order": "created_at.desc,id.desc",
                "offset": offset,
                "limit": limit,
            },
        )
        return [
            {
                **{
                    key: value
                    for key, value in row["metadata"].items()
                    if key != "conversation"
                },
                "deleting": row["status"] in {"deleting", "uploading"},
            }
            for row in response.json()
        ]

    def delete(self, dataset_id):
        # Deleting is durable. A retry can finish an interrupted object cleanup.
        self.gateway.call(
            "PATCH",
            "/rest/v1/datasets",
            params={"id": f"eq.{dataset_id}"},
            json={"status": "deleting"},
        )
        prefix = self._prefix(dataset_id)
        while True:
            objects = self.gateway.call(
                "POST",
                "/storage/v1/object/list/datasets",
                json={"prefix": prefix, "limit": 100},
            ).json()
            if not objects:
                break
            self.gateway.call(
                "DELETE",
                "/storage/v1/object/datasets",
                json={"prefixes": [prefix + "/" + obj["name"] for obj in objects]},
            )
        self.gateway.call(
            "DELETE", "/rest/v1/datasets", params={"id": f"eq.{dataset_id}"}
        )
        super().delete(dataset_id)
