from pathlib import Path

import pytest


@pytest.mark.parametrize("kind", ["tsv", "json", "jsonl", "xls", "ods"])
def test_upload_and_analyze(client, kind):
    bodies = {
        "tsv": b"amount\tcode\n42\t001\n",
        "json": b'[{"amount":42}]',
        "jsonl": b'{"amount":42}\n',
    }
    workbook = kind in {"xls", "ods"}
    body = (
        (Path(__file__).parent / "fixtures" / f"amount.{kind}").read_bytes()
        if workbook
        else bodies[kind]
    )
    response = client.post("/api/v1/datasets", files={"file": (f"amount.{kind}", body)})
    assert response.status_code == 201, response.text
    meta = response.json()
    url = f"/api/v1/datasets/{meta['id']}"
    if workbook:
        assert meta["sheets"] == [{"name": "Data"}]
        response = client.post(f"{url}/sheet", json={"sheet_name": "Data"})
        assert response.status_code == 200, response.text
    stats = client.get(f"{url}/statistics").json()
    assert stats["numeric"][0]["sum"] == 42
