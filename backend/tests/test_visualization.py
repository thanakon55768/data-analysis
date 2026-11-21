import pandas as pd
import pytest

from app.schemas import AnalysisError
from app.services.chat_analysis import AnalysisPlan, execute_plan
from app.services.visualization import (
    DataFilter,
    VisualizationSpec,
    apply_filters,
    build_visualization,
)

COLUMNS = [
    {"id": "c0", "label": "date", "dtype": "text"},
    {"id": "c1", "label": "sales", "dtype": "number"},
]


def test_time_sort_and_gaps():
    frame = pd.DataFrame(
        [["2026-01-03", 30], ["2026-01-01", 10], ["bad", 9]], columns=["c0", "c1"]
    )
    result = build_visualization(
        frame,
        COLUMNS,
        VisualizationSpec(
            mode="time", group_id="c0", value_id="c1", metric="sum", interval="day"
        ),
    )
    assert [point["value"] for point in result["points"]] == [10, None, 30]
    assert result["excluded_rows"] == 1


def test_filters_intersect_and_validate():
    frame = pd.DataFrame([["A", 10], ["A", 20], ["B", None]], columns=["c0", "c1"])
    result = apply_filters(
        frame,
        COLUMNS,
        [
            DataFilter(column_id="c0", operator="eq", value="a"),
            DataFilter(column_id="c1", operator="gte", value="15"),
        ],
    )
    assert result["c1"].tolist() == [20]
    with pytest.raises(AnalysisError):
        apply_filters(
            frame, COLUMNS, [DataFilter(column_id="c0", operator="gte", value="15")]
        )


def test_histogram_counts_full_data():
    frame = pd.DataFrame({"c1": [1, 2, 3, 4, None]})
    result = build_visualization(
        frame, COLUMNS[1:], VisualizationSpec(mode="histogram", group_id="c1", bins=3)
    )
    assert sum(point["value"] for point in result["points"]) == 4
    assert result["excluded_rows"] == 1


def test_scatter_sampling_disclosed():
    frame = pd.DataFrame({"c1": range(2200), "c2": range(2200)})
    columns = [{"id": name, "label": name, "dtype": "number"} for name in frame.columns]
    result = build_visualization(
        frame, columns, VisualizationSpec(mode="scatter", group_id="c1", value_id="c2")
    )
    assert len(result["points"]) == 2000
    assert result["sample_count"] == 2000
    assert result["filtered_rows"] == 2200
    assert result["warnings"]


def test_chat_plan_filters_compute_real_result():
    frame = pd.DataFrame([["A", 10], ["B", 20]], columns=["c0", "c1"])
    _, evidence = execute_plan(
        AnalysisPlan(
            action="numeric",
            column_id="c1",
            filters=[DataFilter(column_id="c0", value="B")],
        ),
        frame,
        COLUMNS,
    )
    assert evidence["numeric"][0]["sum"] == 20


def test_visualization_api_and_unknown_filter(client):
    meta = client.post(
        "/api/v1/datasets", files={"file": ("data.csv", b"group,value\nA,10\nB,20\n")}
    ).json()
    path = f"/api/v1/datasets/{meta['id']}/visualization"
    spec = {
        "group_id": "c0",
        "value_id": "c1",
        "metric": "sum",
        "filters": [{"column_id": "c1", "operator": "gte", "value": "15"}],
    }
    result = client.post(path, json=spec)
    assert result.status_code == 200, result.text
    assert result.json()["filtered_rows"] == 1
    spec["filters"][0]["column_id"] = "bad"
    assert client.post(path, json=spec).status_code == 422


def test_explanation_failure_falls_back_to_computed_answer(client, monkeypatch):
    from app.api import chat

    monkeypatch.setattr(
        chat,
        "plan_question",
        lambda *args: AnalysisPlan(action="numeric", column_id="c1"),
    )

    def fail(*args):
        raise AnalysisError("ai_unavailable", "Unavailable", 503)

    monkeypatch.setattr(chat, "explain_result", fail)
    meta = client.post(
        "/api/v1/datasets", files={"file": ("data.csv", b"group,value\nA,10\nB,20\n")}
    ).json()
    result = client.post(
        f"/api/v1/datasets/{meta['id']}/chat",
        json={"question": "sum", "share_with_gemini": True, "share_analysis": True},
    )
    assert result.status_code == 200, result.text
    assert result.json()["answer"] == result.json()["computed_answer"]
    assert result.json()["evidence"]["numeric"][0]["sum"] == 30
    assert result.json()["warnings"]


def test_chat_chart_has_computed_points():
    frame = pd.DataFrame([["A", 10], ["A", 20]], columns=["c0", "c1"])
    _, evidence = execute_plan(
        AnalysisPlan(
            action="chart",
            group_id="c0",
            column_id="c1",
            chart_kind="bar",
            metric="sum",
        ),
        frame,
        COLUMNS,
    )
    assert evidence["points"][0]["value"] == 30
    assert evidence["chart_kind"] == "bar"


def test_natural_explanation_rejects_invented_numeric_claims():
    from app.services.chat_analysis import numeric_claims_grounded

    assert numeric_claims_grounded(
        "ยอดขาย 30.0 จาก 2 แถว", {"sum": 30, "row_count": 2}, "ยอดขายรวม 30"
    )
    assert not numeric_claims_grounded("ยอดขาย 50", {"sum": 30}, "ยอดขายรวม 30")
    assert not numeric_claims_grounded("เพิ่มขึ้น 30%", {"sum": 30}, "ยอดขายรวม 30")


def test_iso_date_range_filter_includes_end_day():
    frame = pd.DataFrame(
        {"c0": ["2026-01-01", "2026-01-02T23:59:59Z", "2026-01-03", "bad"]}
    )
    result = apply_filters(
        frame,
        COLUMNS[:1],
        [
            DataFilter(column_id="c0", operator="after", value="2026-01-02"),
            DataFilter(column_id="c0", operator="before", value="2026-01-02"),
        ],
    )
    assert result["c0"].tolist() == ["2026-01-02T23:59:59Z"]
