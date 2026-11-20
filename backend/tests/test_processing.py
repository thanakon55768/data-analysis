import time
from pathlib import Path

import pytest

from app.schemas import AnalysisError
from app.services.parsing import run_parse


def slow_parser(path, filename, sheet_name, output):
    time.sleep(5)
    Path(output).write_text("should never finish")


def test_timeout_terminates_worker_and_removes_partial_output(tmp_path):
    source = tmp_path / "original.csv"
    source.write_text("a\n1")
    with pytest.raises(AnalysisError) as error:
        run_parse(source, "data.csv", None, timeout=0.1, worker=slow_parser)
    assert error.value.code == "processing_timeout"
    assert not (tmp_path / "processing.json").exists()


def test_failed_sheet_keeps_previous_selection(client):
    from test_datasets import upload, workbook_bytes

    metadata = upload(client, workbook_bytes(), "book.xlsx").json()
    root = "/api/v1/datasets/" + metadata["id"]
    assert (
        client.post(root + "/sheet", json={"sheet_name": "ยอดขาย"}).status_code == 200
    )
    assert client.post(root + "/sheet", json={"sheet_name": "ว่าง"}).status_code == 422
    assert client.get(root + "/statistics").json()["numeric"][0]["sum"] == 100
