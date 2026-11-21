import pytest


@pytest.fixture
def chart_url(client):
    response = client.post(
        "/api/v1/datasets",
        files={"file": ("data.csv", b"group,amount\nA,10\nA,20\nB,\n,5\n")},
    )
    return f"/api/v1/datasets/{response.json()['id']}/chart"


def test_chart_sum_all_rows(client, chart_url):
    response = client.get(
        chart_url, params={"group_id": "c0", "value_id": "c1", "metric": "sum"}
    )
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["row_count"] == 4
    assert {row["group"]: row["value"] for row in result["groups"]} == {
        "A": 30,
        "B": None,
        None: 5,
    }


def test_chart_count_counts_rows(client, chart_url):
    result = client.get(chart_url, params={"group_id": "c0"}).json()
    assert {row["group"]: row["value"] for row in result["groups"]} == {
        "A": 2,
        "B": 1,
        None: 1,
    }


@pytest.mark.parametrize(
    "params",
    [
        {"group_id": "missing"},
        {"group_id": "c0", "value_id": "c0", "metric": "mean"},
        {"group_id": "c0", "metric": "execute"},
    ],
)
def test_invalid_chart(client, chart_url, params):
    assert client.get(chart_url, params=params).status_code == 422


def test_chart_rejects_changed_sheet(client, chart_url):
    response = client.get(
        chart_url, params={"group_id": "c0", "expected_sheet": "Other sheet"}
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "dataset_changed"
