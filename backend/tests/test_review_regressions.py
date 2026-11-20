from datetime import timedelta
from io import BytesIO

import pytest
from openpyxl import Workbook
from test_datasets import upload


def test_csv_precision_loss_stays_text_and_does_not_invent_duplicate_rows(client):
    meta = upload(client, b"value\n1e-400\n0\n").json()
    root = "/api/v1/datasets/" + meta["id"]
    preview = client.get(root + "/preview").json()
    assert preview["rows"] == [{"c0": "1e-400"}, {"c0": "0"}]
    stats = client.get(root + "/statistics").json()
    assert stats["duplicate_rows"] == 0
    assert stats["numeric"] == []
    assert stats["warnings"]
    meta = upload(client, b"value\n2.0000000000000001\n2\n").json()
    assert (
        client.get("/api/v1/datasets/" + meta["id"] + "/statistics").json()[
            "duplicate_rows"
        ]
        == 0
    )


def test_long_text_preview_adapts_page_and_preserves_complete_cells(client):
    text = "a" * 44000
    meta = upload(client, ("name\n" + (text + "\n") * 50).encode()).json()
    root = "/api/v1/datasets/" + meta["id"]
    response = client.get(root + "/preview?limit=50")
    assert response.status_code == 200
    preview = response.json()
    assert 1 <= len(preview["rows"]) < 50
    assert preview["limit"] == len(preview["rows"])
    assert preview["rows"][0]["c0"] == text
    assert preview["warnings"]
    assert client.get(root + "/statistics").json()["row_count"] == 50


def test_one_huge_row_preview_is_truncated_only_with_explicit_warning(client):
    text = "a" * (2 * 1024 * 1024 + 10)
    meta = upload(client, ("name\n" + text + "\n").encode()).json()
    response = client.get("/api/v1/datasets/" + meta["id"] + "/preview")
    assert response.status_code == 200
    preview = response.json()
    assert len(preview["rows"]) == 1
    assert preview["truncated_cells"] == ["c0"]
    assert preview["warnings"]
    assert len(preview["rows"][0]["c0"]) < len(text)
    assert preview["total_rows"] == 1


def test_excel_elapsed_duration_is_unambiguous_text(client):
    book = Workbook()
    book.active.append(["elapsed"])
    book.active.append([timedelta(hours=27, minutes=30)])
    book.active["A2"].number_format = "[h]:mm:ss"
    output = BytesIO()
    book.save(output)
    meta = upload(client, output.getvalue(), "duration.xlsx").json()
    root = "/api/v1/datasets/" + meta["id"]
    response = client.post(root + "/sheet", json={"sheet_name": "Sheet"})
    assert response.status_code == 200, response.text
    preview = client.get(root + "/preview").json()
    assert preview["rows"][0]["c0"] == "PT99000S"


def test_repeated_excel_strings_have_a_logical_size_budget(tmp_path, monkeypatch):
    from app.schemas import AnalysisError
    from app.services import parsing

    book = Workbook()
    book.active.append(["text"])
    for _ in range(10):
        book.active.append(["repeated description" * 10])
    target = tmp_path / "repeated.xlsx"
    book.save(target)
    monkeypatch.setattr(parsing, "MAX_LOGICAL_BYTES", 100, raising=False)
    with pytest.raises(AnalysisError) as error:
        parsing.parse_dataset(target, "xlsx", "Sheet")
    assert error.value.code == "logical_size_limit"


def test_quoted_single_column_delimiter_characters_are_valid_csv(client):
    meta = upload(client, b'"sum|count"\nhello\n').json()
    response = client.get("/api/v1/datasets/" + meta["id"] + "/preview")
    assert response.status_code == 200
    assert response.json()["columns"][0]["label"] == "sum|count"
