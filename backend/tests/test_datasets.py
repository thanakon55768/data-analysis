import json
import zipfile
from datetime import UTC, datetime, timedelta
from io import BytesIO

import pytest
from openpyxl import Workbook


def upload(client, body=b"name,value\nA,10\nB,20\nC,30\nD,\n", name="data.csv"):
    return client.post("/api/v1/datasets", files={"file": (name, body)})


def workbook_bytes():
    book = Workbook()
    book.active.title = "ยอดขาย"
    book.active.append(["สินค้า", "ยอดขาย"])
    book.active.append(["ชา", 100])
    sheet = book.create_sheet("อื่น")
    sheet.append(["value"])
    sheet.append([9])
    sheet = book.create_sheet("สูตร")
    sheet.append(["value"])
    sheet.append(["=1+1"])
    book.create_sheet("ว่าง")
    out = BytesIO()
    book.save(out)
    return out.getvalue()


def test_real_statistics_and_null(client):
    response = upload(client)
    assert response.status_code == 201
    meta = response.json()
    assert meta["status"] == "ready"
    stats = client.get(f"/api/v1/datasets/{meta['id']}/statistics").json()
    assert (
        stats["row_count"],
        stats["column_count"],
        stats["missing_cells"],
        stats["rows_with_missing"],
    ) == (4, 2, 1, 1)
    numeric = stats["numeric"][0]
    assert {
        k: numeric[k]
        for k in [
            "column_id",
            "count",
            "missing",
            "sum",
            "mean",
            "median",
            "min",
            "max",
        ]
    } == dict(
        column_id="c1", count=3, missing=1, sum=60, mean=20, median=20, min=10, max=30
    )


def test_thai_bom_multiline_literal_na_and_headers(client):
    body = '\ufeffชื่อ,ชื่อ,,ค่า\n"ชา\nไทย",NA,0,10\nกาแฟ,,false,20\n'.encode("utf-8")
    meta = upload(client, body).json()
    result = client.get(f"/api/v1/datasets/{meta['id']}/preview").json()
    assert [c["label"] for c in result["columns"]] == ["ชื่อ", "ชื่อ", "", "ค่า"]
    assert result["rows"][0]["c0"] == "ชา\nไทย"
    assert result["rows"][0]["c1"] == "NA"
    assert result["rows"][1]["c1"] is None
    assert result["rows"][0]["c2"] == "0"


def test_search_pagination_and_validation(client):
    meta = upload(client, "ชื่อ,ค่า\nชา[ไทย],10\nกาแฟ,20\nชา,30\n".encode()).json()
    root = f"/api/v1/datasets/{meta['id']}/preview"
    result = client.get(root, params={"search": "[ไทย]"}).json()
    assert result["filtered_rows"] == 1
    assert result["total_rows"] == 3
    assert result["rows"][0]["c1"] == 10
    assert (
        client.get(root, params={"offset": 1, "limit": 1}).json()["rows"][0]["c1"] == 20
    )
    for query in ["limit=201", "offset=-1", "limit=0", "search=" + "x" * 201]:
        assert client.get(root + "?" + query).status_code == 422


def test_workbook_sheet_selection_and_formula_warning(client):
    response = upload(client, workbook_bytes(), "data.xlsx")
    assert response.status_code == 201, response.text
    meta = response.json()
    root = f"/api/v1/datasets/{meta['id']}"
    assert meta["status"] == "needs_sheet"
    assert client.get(root + "/statistics").status_code == 409
    assert (
        client.post(root + "/sheet", json={"sheet_name": "missing"}).status_code == 422
    )
    assert (
        client.post(root + "/sheet", json={"sheet_name": "ยอดขาย"}).status_code == 200
    )
    assert client.get(root + "/statistics").json()["numeric"][0]["sum"] == 100
    assert client.post(root + "/sheet", json={"sheet_name": "อื่น"}).status_code == 200
    assert client.get(root + "/statistics").json()["numeric"][0]["sum"] == 9
    result = client.post(root + "/sheet", json={"sheet_name": "สูตร"})
    assert result.status_code == 200
    assert result.json()["warnings"]
    assert client.post(root + "/sheet", json={"sheet_name": "ว่าง"}).status_code == 422


@pytest.mark.parametrize(
    "name,body,status",
    [
        ("bad.exe", b"a,b\n1,2", 415),
        ("bad.xlsx", b"not a zip", 422),
        ("bad.csv", b"\xff\xfe", 422),
        ("empty.csv", b"", 422),
        ("bad.csv", b"a,b\n1,2,3\n", 422),
        ("bad.csv", b'a,b\n"unclosed,2', 422),
        ("bad.csv", b"a;b\n1;2", 422),
        ("empty.csv", b"a,b\n", 422),
    ],
)
def test_bad_files_are_errors_and_cleaned(client, name, body, status):
    response = upload(client, body, name)
    assert response.status_code == status
    assert response.json()["error"]["code"]
    assert list(client.app.state.repository.root.iterdir()) == []


def test_size_and_shape_limits(client):
    assert upload(client, b"x" * (10 * 1024 * 1024 + 1)).status_code == 413
    assert (
        upload(
            client,
            (
                ",".join("c" + str(i) for i in range(201))
                + "\n"
                + ",".join(["1"] * 201)
            ).encode(),
        ).status_code
        == 422
    )
    assert upload(client, b"value\n" + b"1\n" * 100001).status_code == 422


def test_archive_member_limit(client):
    out = BytesIO()
    with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for i in range(2001):
            archive.writestr(str(i), "")
    assert upload(client, out.getvalue(), "bad.xlsx").status_code == 422


def test_expanded_archive_limit(client):
    out = BytesIO()
    with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("large", b"0" * (100 * 1024 * 1024 + 1))
    assert upload(client, out.getvalue(), "bad.xlsx").status_code == 422


def test_text_numeric_dates_duplicate_and_missing_semantics(client):
    meta = upload(
        client, b"code,date,value\n001,01/02/2026,5\n001,01/02/2026,5\n002,,\n"
    ).json()
    root = f"/api/v1/datasets/{meta['id']}"
    preview = client.get(root + "/preview").json()
    assert preview["rows"][0]["c0"] == "001"
    assert preview["rows"][0]["c1"] == "01/02/2026"
    stats = client.get(root + "/statistics").json()
    assert stats["duplicate_rows"] == 1
    assert stats["missing_cells"] == 2
    assert stats["rows_with_missing"] == 1
    assert len(stats["numeric"]) == 1


def test_no_numeric_and_nonfinite_metrics(client):
    meta = upload(client, b"name,empty\nNA,\nB,\n").json()
    root = f"/api/v1/datasets/{meta['id']}"
    assert client.get(root + "/statistics").json()["numeric"] == []
    import pandas as pd

    from app.services.statistics import compute_statistics

    result = compute_statistics(
        pd.DataFrame({"c0": [float("inf"), float("-inf"), None]}),
        [{"id": "c0", "label": "value", "dtype": "number"}],
    )
    assert result["numeric"][0]["sum"] is None
    assert result["warnings"]
    json.dumps(result, allow_nan=False)


def test_delete_and_expiry_remove_files(client):
    meta = upload(client, name="../../escape.csv").json()
    dataset_id = meta["id"]
    assert "/" not in dataset_id
    assert client.delete(f"/api/v1/datasets/{dataset_id}").status_code == 204
    assert client.get(f"/api/v1/datasets/{dataset_id}/preview").status_code == 404
    assert not list(client.app.state.repository.root.iterdir())
    meta = upload(client).json()
    path = client.app.state.repository.root / meta["id"] / "metadata.json"
    content = json.loads(path.read_text())
    content["expires_at"] = (datetime.now(UTC) - timedelta(seconds=1)).isoformat()
    path.write_text(json.dumps(content))
    assert client.get(f"/api/v1/datasets/{meta['id']}/preview").status_code == 404
    assert not path.exists()


def test_local_host_and_origin_protection(client):
    assert (
        client.post(
            "/api/v1/datasets",
            headers={"Origin": "https://evil.example"},
            files={"file": ("x.csv", b"a\n1")},
        ).status_code
        == 403
    )
    assert client.get("/health", headers={"Host": "evil.example"}).status_code == 400


def test_busy_parser_is_retryable(client):
    gate = client.app.state.parse_gate
    gate.acquire()
    try:
        assert upload(client).status_code == 503
    finally:
        gate.release()
