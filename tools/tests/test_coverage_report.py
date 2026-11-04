import json

import pytest

from tools import coverage_report as cr

OUTCOME_VARS = ("AGENT_OUTCOME", "GUARD_OUTCOME", "BACKEND_OUTCOME", "FRONTEND_OUTCOME")


@pytest.fixture(autouse=True)
def isolated(tmp_path, monkeypatch):
    """Every test runs in an empty directory with no workflow variables set."""
    monkeypatch.chdir(tmp_path)
    for name in (*OUTCOME_VARS, "COMMITTED", "RUN_URL"):
        monkeypatch.delenv(name, raising=False)
    return tmp_path


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data))


# load_json

def test_load_json_reads_a_file(isolated):
    write_json(isolated / "a.json", {"x": 1})
    assert cr.load_json("a.json") == {"x": 1}


def test_load_json_of_missing_file_is_none_and_reported_on_stderr(capsys):
    assert cr.load_json("missing.json") is None
    out = capsys.readouterr()
    assert out.out == ""  # stdout becomes the PR comment
    assert "missing.json" in out.err


def test_load_json_of_broken_file_is_none(isolated):
    (isolated / "bad.json").write_text("{not json")
    assert cr.load_json("bad.json") is None


# clean

@pytest.mark.parametrize("raw, expected", [
    ("plain text", "plain text"),
    ("ping @someone", "ping @​someone"),
    ("a | b", "a \\| b"),
    ("line one\nline two", "line one line two"),
    (None, "None"),
    (3, "3"),
])
def test_clean_makes_agent_text_safe_for_a_comment(raw, expected):
    assert cr.clean(raw) == expected


# status_table

def test_status_table_shows_step_outcomes(monkeypatch):
    monkeypatch.setenv("AGENT_OUTCOME", "success")
    monkeypatch.setenv("BACKEND_OUTCOME", "failure")
    monkeypatch.setenv("COMMITTED", "true")

    table = cr.status_table()

    assert "| Agent | success |" in table
    assert "| Backend tests | failure |" in table
    assert "| Frontend tests | skipped |" in table  # variable not set
    assert "| Tests committed | yes |" in table


def test_status_table_without_commit_says_no():
    assert "| Tests committed | no |" in cr.status_table()


# files_table

def test_files_table_has_a_row_per_file():
    table = cr.files_table({"files": [
        {"path": "backend/app/api/health.py", "decision": "create",
         "tests_added": ["a", "b"], "result": "passed", "uncovered": []},
        {"path": "frontend/src/lib/http.ts", "decision": "update",
         "tests_added": ["c"], "result": "failed", "uncovered": ["line 30", "line 41"]},
    ]})
    assert table.splitlines()[2:] == [
        "| backend/app/api/health.py | create | 2 | passed | - |",
        "| frontend/src/lib/http.ts | update | 1 | failed | line 30; line 41 |",
    ]


def test_files_table_survives_missing_fields():
    table = cr.files_table({"files": [{"path": "backend/app/main.py"}]})
    assert "| backend/app/main.py | - | 0 | - | - |" in table


def test_files_table_cleans_agent_text():
    table = cr.files_table({"files": [{"path": "x.py", "decision": "skip | @x"}]})
    assert "skip \\| @​x" in table


@pytest.mark.parametrize("report", [None, {}, {"files": []}])
def test_files_table_without_files_is_empty(report):
    assert cr.files_table(report) == ""


# list_section

def test_list_section_shows_only_non_empty_lists():
    text = cr.list_section({
        "failing_existing_tests": [{"test": "test_a", "error": "AssertionError"}],
        "suspected_bugs": ["health.py:12 returns 200 when the DB is down"],
        "warnings": [],
    })
    assert text == (
        "### Failing existing tests (need a human)\n"
        "- test_a: AssertionError\n"
        "\n"
        "### Suspected bugs\n"
        "- health.py:12 returns 200 when the DB is down"
    )


def test_list_section_cleans_agent_text():
    text = cr.list_section({"warnings": ["ping @someone"]})
    assert "@​someone" in text


@pytest.mark.parametrize("report", [None, {}, {"suspected_bugs": []}])
def test_list_section_with_nothing_to_report_is_empty(report):
    assert cr.list_section(report) == ""


# coverage

def test_percent_walks_the_keys_and_rounds():
    assert cr.percent({"a": {"b": 91.6}}, "a", "b") == "92%"


@pytest.mark.parametrize("data", [None, {}, {"a": {}}, {"a": {"b": "abc"}}])
def test_percent_of_missing_or_bad_data_is_na(data):
    assert cr.percent(data, "a", "b") == "n/a"


def test_coverage_line_reads_both_coverage_files(isolated):
    write_json(isolated / "backend/coverage/coverage.json", {"totals": {"percent_covered": 91.2}})
    write_json(isolated / "frontend/coverage/coverage-summary.json", {"total": {"lines": {"pct": 84.1}}})
    assert cr.coverage_line() == "Coverage: backend 91% · frontend 84%"


def test_coverage_line_without_files_is_na():
    assert cr.coverage_line() == "Coverage: backend n/a · frontend n/a"


# main

def write_context(isolated, files):
    write_json(isolated / ".agent/context.json", {"mode": "pr", "files": files})


def test_main_with_nothing_to_test_prints_a_short_note(isolated, capsys):
    write_context(isolated, [])
    assert cr.main() == 0
    assert capsys.readouterr().out.strip() == "No source files changed, nothing to test."


def test_main_passes_when_no_step_failed(isolated, monkeypatch, capsys):
    write_context(isolated, [{"path": "backend/app/api/health.py"}])
    write_json(isolated / ".agent/report.json", {"files": [{"path": "backend/app/api/health.py"}]})
    for name in OUTCOME_VARS:
        monkeypatch.setenv(name, "success")
    monkeypatch.setenv("RUN_URL", "https://example.test/run/1")

    assert cr.main() == 0
    out = capsys.readouterr().out
    assert out.startswith("## Test agent: ✅ passed")
    assert "| backend/app/api/health.py |" in out
    assert "[Full run](https://example.test/run/1)" in out


@pytest.mark.parametrize("failed_step", OUTCOME_VARS)
def test_main_fails_when_any_step_failed(isolated, monkeypatch, capsys, failed_step):
    write_context(isolated, [{"path": "backend/app/api/health.py"}])
    for name in OUTCOME_VARS:
        monkeypatch.setenv(name, "success")
    monkeypatch.setenv(failed_step, "failure")

    assert cr.main() == 0  # the comment is still posted; the workflow fails the run
    assert capsys.readouterr().out.startswith("## Test agent: ❌ failed")


def test_main_without_agent_report_still_prints_the_status(isolated, monkeypatch, capsys):
    write_context(isolated, [{"path": "backend/app/api/health.py"}])
    monkeypatch.setenv("AGENT_OUTCOME", "failure")

    assert cr.main() == 0
    out = capsys.readouterr().out
    assert "| Agent | failure |" in out
    assert "| File |" not in out
