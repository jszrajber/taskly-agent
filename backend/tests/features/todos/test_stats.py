from datetime import date

import pytest

from app.features.todos.schemas import Todo, TodoStats
from app.features.todos.stats import compute_stats, is_overdue

TODAY = date(2026, 10, 15)


@pytest.fixture
def make_todo(todo_values):
    def factory(**overrides):
        return Todo.model_validate({**todo_values, **overrides})

    return factory


@pytest.mark.parametrize(
    ("completed", "due_date", "expected"),
    [
        (False, date(2026, 10, 14), True),
        (False, TODAY, False),
        (False, date(2026, 10, 16), False),
        (False, None, False),
        (True, date(2026, 10, 14), False),
    ],
)
def test_is_overdue(make_todo, completed, due_date, expected):
    todo = make_todo(completed=completed, due_date=due_date)
    assert is_overdue(todo, TODAY) is expected


def test_compute_stats_of_no_tasks_is_all_zero():
    assert compute_stats([], TODAY) == TodoStats(total=0, completed=0, overdue=0)


def test_compute_stats_counts_total_completed_and_overdue(make_todo):
    todos = [
        make_todo(id=1, completed=True, due_date=date(2026, 10, 1)),
        make_todo(id=2, completed=False, due_date=date(2026, 10, 1)),
        make_todo(id=3, completed=False, due_date=TODAY),
        make_todo(id=4, completed=False, due_date=None),
        make_todo(id=5, completed=True, due_date=None),
    ]

    assert compute_stats(todos, TODAY) == TodoStats(total=5, completed=2, overdue=1)
