from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.schemas import AnalysisError
from app.services.supabase_gateway import SupabaseGateway
from app.services.supabase_repository import SupabaseRepository


def test_account_mode_requires_auth(tmp_path, monkeypatch):
    monkeypatch.setenv("STORAGE_MODE", "supabase")
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "public-test-key")
    with TestClient(create_app(tmp_path)) as client:
        for path in ("", f"/{uuid4()}", f"/{uuid4()}/statistics"):
            assert client.get("/api/v1/datasets" + path).status_code == 401


def test_incomplete_configuration_fails_closed(tmp_path, monkeypatch):
    monkeypatch.setenv("STORAGE_MODE", "supabase")
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    with pytest.raises(RuntimeError), TestClient(create_app(tmp_path)):
        pass


def test_verified_identity_and_user_headers(monkeypatch):
    owner = str(uuid4())
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "public-test-key")
    original = httpx.Client

    def respond(request):
        assert request.headers["authorization"] == "Bearer user-token"
        assert request.headers["apikey"] == "public-test-key"
        return httpx.Response(200, json={"id": owner})

    monkeypatch.setattr(
        httpx,
        "Client",
        lambda **kwargs: original(**kwargs, transport=httpx.MockTransport(respond)),
    )
    gateway = SupabaseGateway("user-token")
    assert gateway.owner == owner
    gateway.close()


def test_owner_filter_and_hidden_records(tmp_path):
    class Gateway:
        owner = str(uuid4())

        def call(self, method, path, **kwargs):
            assert kwargs["params"]["user_id"] == f"eq.{self.owner}"
            return httpx.Response(200, json=[])

    repo = SupabaseRepository(tmp_path, Gateway())
    with pytest.raises(AnalysisError) as error:
        repo.get(str(uuid4()))
    assert error.value.status == 404


def test_local_history_reopens(client):
    response = client.post("/api/v1/datasets", files={"file": ("data.csv", b"x\n1\n")})
    assert response.status_code == 201
    dataset_id = response.json()["id"]
    assert client.get("/api/v1/datasets").json()[0]["id"] == dataset_id
    assert client.get(f"/api/v1/datasets/{dataset_id}").json()["status"] == "ready"


def test_sheet_conflict_keeps_previous_version(tmp_path):
    dataset_id = str(uuid4())

    class Gateway:
        owner = str(uuid4())
        removed = []

        def call(self, method, path, **kwargs):
            if method == "PATCH":
                assert kwargs["params"]["version"] == "eq.1"
                assert kwargs["params"]["status"] == "neq.deleting"
                return httpx.Response(200, json=[])
            if method == "DELETE":
                self.removed.extend(kwargs["json"]["prefixes"])
            return httpx.Response(200, json={})

    gateway = Gateway()
    repo = SupabaseRepository(tmp_path, gateway)
    repo.versions[dataset_id] = 1
    metadata = {"id": dataset_id, "status": "ready"}
    with pytest.raises(AnalysisError) as error:
        repo.save(metadata, {"columns": [], "rows": [], "warnings": []})
    assert error.value.status == 409
    assert len(gateway.removed) == 1
    assert repo.versions[dataset_id] == 1


def test_proxy_mode_mismatch_rejected_before_upload(client):
    response = client.post("/api/v1/datasets", headers={"x-storage-mode": "supabase"})
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "mode_mismatch"


def test_remote_upload_includes_required_filename(tmp_path):
    class Gateway:
        owner = str(uuid4())
        inserted = None

        def call(self, method, path, **kwargs):
            if method == "POST" and path == "/rest/v1/datasets":
                self.inserted = kwargs["json"]
                assert self.inserted["filename"] == "data.csv"
            return httpx.Response(200, json=[{"id": "saved"}])

    gateway = Gateway()
    repo = SupabaseRepository(tmp_path, gateway)
    dataset_id, path = repo.create("data.csv")
    path.write_bytes(b"value\n10\n")
    payload = {
        "columns": [{"id": "c0", "label": "value", "dtype": "number"}],
        "rows": [[10]],
        "warnings": [],
    }
    metadata = repo.metadata(dataset_id, "data.csv", payload)
    repo.save(metadata, payload)
    assert gateway.inserted["user_id"] == gateway.owner
    assert repo.versions[dataset_id] == 1
