from datetime import date

import pytest
from pydantic import ValidationError

from app.features.todos.schemas import Priority, TodoCreate, TodoUpdate


def test_create_applies_defaults():
    todo = TodoCreate(title="Write")

    assert todo.description == ""
    assert todo.priority is Priority.medium
    assert todo.due_date is None
    assert todo.completed is False


def test_create_strips_whitespace():
    assert TodoCreate(title="  Write  ").title == "Write"


@pytest.mark.parametrize(
    "values",
    [
        {"title": ""},
        {"title": "   "},
        {"title": "x" * 121},
        {"title": "ok", "description": "x" * 2001},
        {"title": "ok", "priority": "urgent"},
        {"title": "ok", "completed": "yes"},
        {"title": "ok", "unknown": 1},
    ],
)
def test_create_rejects_invalid_values(values):
    with pytest.raises(ValidationError):
        TodoCreate(**values)


def test_update_accepts_partial_fields():
    update = TodoUpdate(completed=True)

    assert update.model_dump(exclude_unset=True) == {"completed": True}


def test_update_allows_null_due_date():
    update = TodoUpdate(due_date=None)

    assert update.model_fields_set == {"due_date"}
    assert update.due_date is None


def test_update_parses_due_date():
    assert TodoUpdate(due_date="2026-12-01").due_date == date(2026, 12, 1)


def test_update_rejects_empty_patch():
    with pytest.raises(ValidationError):
        TodoUpdate()


@pytest.mark.parametrize("field", ["title", "description", "priority", "completed"])
def test_update_rejects_null_for_other_fields(field):
    with pytest.raises(ValidationError):
        TodoUpdate(**{field: None})
