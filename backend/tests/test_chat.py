import json

import httpx
import pandas as pd
import pytest
from pydantic import ValidationError

from app.schemas import AnalysisError
from app.services.chat_analysis import AnalysisPlan, execute_plan, plan_question

COLUMNS = [
    {"id": "c0", "label": "group", "dtype": "text"},
    {"id": "c1", "label": "amount", "dtype": "number"},
]


def test_group_sum_preserves_missing_and_empty():
    frame = pd.DataFrame(
        [["A", 10], ["A", None], [None, 20], ["B", None]],
        columns=["c0", "c1"],
        dtype=object,
    )
    _, evidence = execute_plan(
        AnalysisPlan(action="group", group_id="c0", column_id="c1"), frame, COLUMNS
    )
    assert {row["group"]: row["value"] for row in evidence["groups"]} == {
        "A": 10.0,
        None: 20.0,
        "B": None,
    }


def test_invalid_column_and_code_rejected():
    frame = pd.DataFrame({"c0": ["A"], "c1": [10]})
    _, evidence = execute_plan(
        AnalysisPlan(action="numeric", column_id="__import__('os')"), frame, COLUMNS
    )
    assert evidence is None
    with pytest.raises(ValidationError):
        AnalysisPlan(action="exec", code="print(1)")


def test_missing_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    with pytest.raises(AnalysisError) as error:
        plan_question("summary", COLUMNS, [])
    assert error.value.code == "ai_not_configured"


def test_model_payload_does_not_include_rows(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setenv("GEMINI_MODEL", "test-model")

    def respond(url, **kwargs):
        assert kwargs["headers"]["x-goog-api-key"] == "test-key"
        prompt = json.loads(kwargs["json"]["contents"][0]["parts"][0]["text"])
        assert set(prompt) == {"task", "columns", "recent_conversation", "question"}
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {"content": {"parts": [{"text": '{"action":"overview"}'}]}}
                ]
            },
            request=httpx.Request("POST", url),
        )

    monkeypatch.setattr(httpx, "post", respond)
    assert plan_question("summary", COLUMNS, []).action == "overview"


def test_chat_persists_evidence_and_requires_consent(client, monkeypatch):
    from app.api import chat

    monkeypatch.setattr(
        chat,
        "plan_question",
        lambda *args: AnalysisPlan(action="numeric", column_id="c1"),
    )
    meta = client.post(
        "/api/v1/datasets", files={"file": ("data.csv", b"group,amount\nA,10\nB,20\n")}
    ).json()
    path = f"/api/v1/datasets/{meta['id']}/chat"
    assert client.post(path, json={"question": "sum"}).status_code == 422
    result = client.post(path, json={"question": "sum", "share_with_gemini": True})
    assert result.status_code == 200, result.text
    assert result.json()["evidence"]["numeric"][0]["sum"] == 30
    assert client.get(path).json()[0]["id"] == result.json()["id"]
    assert (
        client.post(path, json={"question": " ", "share_with_gemini": True}).status_code
        == 422
    )
