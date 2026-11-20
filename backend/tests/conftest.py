import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path):
    from app.main import create_app

    with TestClient(create_app(data_dir=tmp_path)) as value:
        yield value
