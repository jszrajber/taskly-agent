from datetime import date

import pytest

from app.features.todos.schemas import Todo, TodoCreate


def test_list_returns_tasks_from_repository(client, repository_mock, todo):
    repository_mock.list.return_value = [todo]
    response = client.get("/api/todos")
    assert response.status_code == 200
    assert response.json() == [todo.model_dump(mode="json")]
    repository_mock.list.assert_called_once_with()


def test_create_trims_input_and_returns_created_task(client, repository_mock, todo):
    repository_mock.create.return_value = todo
    response = client.post("/api/todos", json={"title": "  Plan the sprint  ", "priority": "high"})
    assert response.status_code == 201
    assert response.json() == todo.model_dump(mode="json")
    repository_mock.create.assert_called_once_with(
        TodoCreate(title="Plan the sprint", priority="high")
    )


def test_stats_route_is_not_shadowed_by_todo_id_and_counts_tasks(
    client, repository_mock, todo_values
):
    done = Todo.model_validate({**todo_values, "id": 1, "completed": True})
    late = Todo.model_validate({**todo_values, "id": 2, "due_date": date(2000, 1, 1)})
    later = Todo.model_validate({**todo_values, "id": 3, "due_date": date(9999, 12, 31)})
    repository_mock.list.return_value = [done, late, later]

    response = client.get("/api/todos/stats")

    assert response.status_code == 200
    assert response.json() == {"total": 3, "completed": 1, "overdue": 1}
    repository_mock.list.assert_called_once_with()
    repository_mock.get.assert_not_called()


def test_stats_of_empty_repository_are_zero(client, repository_mock):
    repository_mock.list.return_value = []
    response = client.get("/api/todos/stats")
    assert response.status_code == 200
    assert response.json() == {"total": 0, "completed": 0, "overdue": 0}


@pytest.mark.parametrize("payload", [
    {"title": "   "},
    {"title": "x" * 121},
    {"title": "Task", "priority": "urgent"},
    {"title": "Task", "due_date": "2026-02-30"},
])
def test_invalid_create_never_calls_repository(client, repository_mock, payload):
    assert client.post("/api/todos", json=payload).status_code == 422
    repository_mock.create.assert_not_called()
