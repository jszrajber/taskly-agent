import subprocess

import pytest

from tools import guard_paths
from tools.guard_paths import changed_paths, find_violations, is_allowed, main


@pytest.mark.parametrize("path", [
    "backend/tests/core/test_config.py",
    "backend/tests/conftest.py",
    "backend/tests/core/__init__.py",
    "backend/./tests/core/test_config.py",
    "frontend/src/lib/http.test.ts",
    "frontend/src/features/todos/hooks/useTodosQuery.test.tsx",
])
def test_test_files_are_allowed(path):
    assert is_allowed(path)


@pytest.mark.parametrize("path", [
    "backend/app/core/config.py",
    "backend/pyproject.toml",
    "frontend/src/lib/http.ts",
    "frontend/vite.config.ts",
    "frontend/package.json",
    ".github/workflows/test-agent.yml",
    ".github/test-agent/claude-settings.json",
    ".claude/agents/test-writer.md",
    "tools/guard_paths.py",
    # Look-alikes of allowed locations.
    "backend/testsX/evil.py",
    "backend/tests",
    "frontend/src/foo.test.tsx.bak",
    "frontend/vite.config.test.ts",
    # Path traversal out of an allowed directory.
    "backend/tests/../app/main.py",
    "frontend/src/../vite.config.test.ts",
])
def test_other_files_are_blocked(path):
    assert not is_allowed(path)


def test_find_violations_returns_only_blocked_paths_in_order():
    paths = [
        "backend/tests/core/test_config.py",
        "backend/app/main.py",
        "frontend/src/lib/http.test.ts",
        ".github/workflows/test-agent.yml",
    ]
    assert find_violations(paths) == [
        "backend/app/main.py",
        ".github/workflows/test-agent.yml",
    ]


def test_find_violations_of_no_changes_is_empty():
    assert find_violations([]) == []


def fake_git_status(monkeypatch, stdout):
    calls = []

    def fake_run(args, **kwargs):
        calls.append((args, kwargs))
        return subprocess.CompletedProcess(args, 0, stdout=stdout, stderr="")

    monkeypatch.setattr(guard_paths.subprocess, "run", fake_run)
    return calls


def test_changed_paths_parses_every_status_and_both_sides_of_a_rename(monkeypatch):
    calls = fake_git_status(monkeypatch, (
        " M backend/app/main.py\n"
        "?? backend/tests/core/test_config.py\n"
        " D backend/tests/old_test.py\n"
        "R  backend/app/a.py -> backend/tests/a.py\n"
    ))
    assert changed_paths() == [
        "backend/app/main.py",
        "backend/tests/core/test_config.py",
        "backend/tests/old_test.py",
        "backend/app/a.py",
        "backend/tests/a.py",
    ]
    args, kwargs = calls[0]
    assert args == ["git", "status", "--porcelain", "--untracked-files=all"]
    assert kwargs["check"] is True


def test_changed_paths_of_clean_tree_is_empty(monkeypatch):
    fake_git_status(monkeypatch, "")
    assert changed_paths() == []


def test_changed_paths_fails_when_git_fails(monkeypatch):
    def failing_run(args, **kwargs):
        raise subprocess.CalledProcessError(128, args)

    monkeypatch.setattr(guard_paths.subprocess, "run", failing_run)
    with pytest.raises(subprocess.CalledProcessError):
        changed_paths()


def test_main_passes_when_only_tests_changed(monkeypatch, capsys):
    monkeypatch.setattr(guard_paths, "changed_paths", lambda: ["backend/tests/test_a.py"])
    assert main() == 0
    assert capsys.readouterr().err == ""


def test_main_fails_and_lists_every_violation(monkeypatch, capsys):
    monkeypatch.setattr(guard_paths, "changed_paths", lambda: [
        "backend/app/main.py",
        "backend/tests/test_a.py",
        ".github/workflows/test-agent.yml",
    ])
    assert main() == 1
    err = capsys.readouterr().err
    assert "backend/app/main.py" in err
    assert ".github/workflows/test-agent.yml" in err
    assert "backend/tests/test_a.py" not in err
