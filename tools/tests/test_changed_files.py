import json
import subprocess

import pytest

# Import the module, not its functions: pytest would collect a bare
# `test_file_for` imported here as a test case.
from tools import changed_files as cf


@pytest.mark.parametrize("path", [
    "backend/app/main.py",
    "backend/app/core/config.py",
    "frontend/src/lib/http.ts",
    "frontend/src/features/todos/components/TodoForm.tsx",
])
def test_application_code_is_a_source_file(path):
    assert cf.is_source_file(path)


@pytest.mark.parametrize("path", [
    # Tests themselves.
    "backend/tests/core/test_config.py",
    "frontend/src/lib/http.test.ts",
    "frontend/src/features/todos/components/TodoForm.test.tsx",
    # Nothing to unit test.
    "backend/app/__init__.py",
    "frontend/src/vite-env.d.ts",
    "frontend/src/test/todoFixture.ts",
    "frontend/src/design-system/components/Button/Button.tsx",
    # Outside application code.
    "tools/guard_paths.py",
    ".github/workflows/test-agent.yml",
    "backend/pyproject.toml",
    "frontend/vite.config.ts",
    "frontend/src/index.css",
])
def test_other_files_are_not_source_files(path):
    assert not cf.is_source_file(path)


@pytest.mark.parametrize("source, test", [
    ("backend/app/main.py", "backend/tests/test_main.py"),
    ("backend/app/core/config.py", "backend/tests/core/test_config.py"),
    ("backend/app/features/todos/router.py", "backend/tests/features/todos/test_router.py"),
    ("frontend/src/lib/http.ts", "frontend/src/lib/http.test.ts"),
    ("frontend/src/App.tsx", "frontend/src/App.test.tsx"),
])
def test_test_file_for_maps_source_to_its_test(source, test):
    assert cf.test_file_for(source) == test


def test_get_files_details_describes_source_files_and_skips_the_rest(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    (tmp_path / "frontend/src/lib").mkdir(parents=True)
    (tmp_path / "frontend/src/lib/http.test.ts").touch()

    details = cf.get_files_details([
        ("M", "frontend/src/lib/http.ts"),
        ("A", "backend/app/api/health.py"),
        ("M", "tools/guard_paths.py"),
        ("existing", "backend/app/main.py"),
    ])

    assert details == [
        {
            "path": "frontend/src/lib/http.ts",
            "area": "frontend",
            "status": "modified",
            "test_file": "frontend/src/lib/http.test.ts",
            "test_exists": True,
        },
        {
            "path": "backend/app/api/health.py",
            "area": "backend",
            "status": "added",
            "test_file": "backend/tests/api/test_health.py",
            "test_exists": False,
        },
        {
            "path": "backend/app/main.py",
            "area": "backend",
            "status": "existing",
            "test_file": "backend/tests/test_main.py",
            "test_exists": False,
        },
    ]


def fake_git(monkeypatch, outputs):
    """Replace subprocess.run; answer each git command with the given stdout."""
    calls = []

    def fake_run(args, **kwargs):
        calls.append((args, kwargs))
        return subprocess.CompletedProcess(args, 0, stdout=outputs[args[1]], stderr="")

    monkeypatch.setattr(cf.subprocess, "run", fake_run)
    return calls


def test_get_changed_files_parses_name_status(monkeypatch):
    calls = fake_git(monkeypatch, {"diff": "M\tbackend/app/main.py\nA\tfrontend/src/lib/x.ts\n"})

    assert cf.get_changed_files("main", "feature") == [
        ("M", "backend/app/main.py"),
        ("A", "frontend/src/lib/x.ts"),
    ]
    args, kwargs = calls[0]
    assert args == ["git", "diff", "--name-status", "--no-renames", "main...feature"]
    assert kwargs["check"] is True


def test_get_all_files_marks_every_file_as_existing(monkeypatch):
    calls = fake_git(monkeypatch, {"ls-files": "backend/app/main.py\nREADME.md\n"})

    assert cf.get_all_files() == [
        ("existing", "backend/app/main.py"),
        ("existing", "README.md"),
    ]
    assert calls[0][0] == ["git", "ls-files"]
    assert calls[0][1]["check"] is True


def test_git_failure_is_not_swallowed(monkeypatch):
    def failing_run(args, **kwargs):
        raise subprocess.CalledProcessError(128, args)

    monkeypatch.setattr(cf.subprocess, "run", failing_run)
    with pytest.raises(subprocess.CalledProcessError):
        cf.get_changed_files()


def test_main_pr_mode_writes_context_and_diff(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    fake_git(monkeypatch, {"diff": "M\tbackend/app/main.py\n"})

    assert cf.main(["--base", "origin/main", "--head", "feature"]) == 0

    context = json.loads((tmp_path / ".agent/context.json").read_text())
    assert context["mode"] == "pr"
    assert context["base_ref"] == "origin/main"
    assert [f["path"] for f in context["files"]] == ["backend/app/main.py"]
    assert (tmp_path / ".agent/diff.patch").exists()


def test_main_backfill_mode_lists_all_files_and_writes_no_diff(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    calls = fake_git(monkeypatch, {"ls-files": "backend/app/main.py\nREADME.md\n"})

    assert cf.main(["--mode", "backfill"]) == 0

    context = json.loads((tmp_path / ".agent/context.json").read_text())
    assert context["mode"] == "backfill"
    assert [f["path"] for f in context["files"]] == ["backend/app/main.py"]
    assert not (tmp_path / ".agent/diff.patch").exists()
    assert [args[1] for args, _ in calls] == ["ls-files"]


def test_main_rejects_unknown_mode():
    with pytest.raises(SystemExit):
        cf.main(["--mode", "everything"])
