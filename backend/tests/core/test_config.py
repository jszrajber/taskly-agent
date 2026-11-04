import pytest

from app.core.config import resolve_database_url

DB_VARS = ["POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_HOST", "DB_PORT", "POSTGRES_DB"]


@pytest.fixture(autouse=True)
def isolated_env(monkeypatch):
    monkeypatch.setattr("app.core.config.load_dotenv", lambda *a, **k: None)
    for name in ["DATABASE_URL", *DB_VARS]:
        monkeypatch.delenv(name, raising=False)


def test_explicit_argument_wins_over_environment(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://env/db")

    assert resolve_database_url("postgresql://arg/db") == "postgresql://arg/db"


def test_uses_database_url_environment_variable(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://env/db")

    assert resolve_database_url() == "postgresql://env/db"


def test_builds_url_from_postgres_variables(monkeypatch):
    monkeypatch.setenv("POSTGRES_USER", "taskly")
    monkeypatch.setenv("POSTGRES_PASSWORD", "s3cret")
    monkeypatch.setenv("POSTGRES_HOST", "db.local")
    monkeypatch.setenv("DB_PORT", "5433")
    monkeypatch.setenv("POSTGRES_DB", "todos")

    assert (
        resolve_database_url()
        == "postgresql+psycopg://taskly:s3cret@db.local:5433/todos"
    )


def test_missing_variables_raise_key_error():
    with pytest.raises(KeyError):
        resolve_database_url()
