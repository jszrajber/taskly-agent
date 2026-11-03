---
name: pytest-unit-tests
description: Conventions for writing pytest unit tests for the Taskly FastAPI backend (backend/app). Use when creating or updating tests under backend/tests.
user-invocable: false
paths: backend/**
---

# Pytest unit tests

Write unit tests for the backend files listed in `.agent/context.json` that got
a `create` or `update` decision (see the `pr-change-analysis` skill). Read the
source file and the existing tests next to it first, and match their style.

## Layout

- Mirror the source path: `backend/app/core/config.py` is tested in
  `backend/tests/core/test_config.py`. Name files `test_<module>.py`.
- Add an empty `__init__.py` to any new test directory, as the existing ones
  have.
- Import from the `app` package: `from app.core.config import resolve_database_url`.
  Pytest runs from `backend/` with `pythonpath = ["."]`.
- Use plain test functions named `test_<behaviour>`, and
  `@pytest.mark.parametrize` for input variants.

## Fixtures

`backend/tests/conftest.py` already provides these. Use them instead of
building your own:

| Fixture | What it gives you |
|---|---|
| `repository_mock` | `create_autospec(TodoRepository)`; `list()` returns `[]` |
| `client` | `TestClient` with only the todos router and `repository_mock` injected |
| `todo_values` | a valid task as a dict |
| `todo` | the same task as a `Todo` schema |
| `model_factory` | builds a `TodoRecord` from a dict |

There is no database fixture on purpose. Add a fixture to `conftest.py` only if
several test files need it; otherwise keep it in the test file.

## Rules

- **No real database or network.** Mock the repository or session with
  `unittest.mock.Mock` / `create_autospec`. To check SQL, compile the statement
  with `sqlalchemy.dialects.postgresql`, as `test_repository.py` does.
- **No dependence on `.env`.** `app/core/config.py` calls `load_dotenv`, which
  would read a developer's local `.env`. Patch it
  (`monkeypatch.setattr("app.core.config.load_dotenv", lambda *a, **k: None)`)
  and set variables with `monkeypatch.setenv` / `monkeypatch.delenv`.
- **No real time.** Do not compare with the current time; patch it, or assert
  on types and ordering.
- **App startup:** test `create_app` and `lifespan` with mocked engine and
  session factory functions (`monkeypatch.setattr` on the module that imports
  them), never with a running database.
- **HTTP tests:** use the `client` fixture and assert on the status code **and**
  the response body, plus the repository calls (`assert_called_once_with`,
  `assert_not_called`).

## Run

Only `python -m pytest` is allowed (a bare `pytest` is denied). From the
repository root:

```sh
cd backend && python -m pytest tests/core/test_config.py -q
```
