from datetime import date

from .schemas import Todo, TodoStats


def is_overdue(todo: Todo, today: date) -> bool:
    """An open task whose due date has already passed."""
    return not todo.completed and todo.due_date is not None and todo.due_date < today


def compute_stats(todos: list[Todo], today: date) -> TodoStats:
    return TodoStats(
        total=len(todos),
        completed=sum(1 for t in todos if t.completed),
        overdue=sum(1 for t in todos if is_overdue(t, today)),
    )
