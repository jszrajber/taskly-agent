from unittest.mock import Mock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.dependencies import get_repository
from app.api.health import router


def make_client(repository, **kwargs):
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_repository] = lambda: repository
    return TestClient(app, **kwargs)


def test_health_returns_ok_after_querying_database():
    repository = Mock()

    response = make_client(repository).get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    repository.session.execute.assert_called_once()


def test_health_fails_when_database_errors():
    repository = Mock()
    repository.session.execute.side_effect = RuntimeError("down")

    response = make_client(repository, raise_server_exceptions=False).get("/api/health")

    assert response.status_code == 500
