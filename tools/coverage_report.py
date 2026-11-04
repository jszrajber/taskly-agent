import json
import os
import sys


def load_json(path: str) -> dict | None:
    try:
        with open(path, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Could not load {path}: {e}", file=sys.stderr)
        return None


def status_table() -> str:
    rows = [
        ("Agent", os.environ.get("AGENT_OUTCOME", "skipped")),
        ("Guard (only test files changed)", os.environ.get("GUARD_OUTCOME", "skipped")),
        ("Backend tests", os.environ.get("BACKEND_OUTCOME", "skipped")),
        ("Frontend tests", os.environ.get("FRONTEND_OUTCOME", "skipped")),
    ]

    lines = ["| Check | Result |", "|---|---|"]
    for name, result in rows: 
        lines.append(f"| {name} | {result} |")

    committed = "yes" if os.environ.get("COMMITTED") == "true" else "no"
    lines.append(f"| Tests committed | {committed} |")

    return "\n".join(lines)


def clean(text):
    text = str(text)

    text = text.replace("\n", " ")
    text = text.replace("|", "\\|")
    text = text.replace("@", "@\u200b")   # invisible space after @, so GitHub mentions nobody  

    return text


def files_table(report: dict | None) -> str:
    if not report or not report.get("files"):
        return ""

    lines = ["| File | Decision | Tests added | Result | Uncovered |", "|---|---|---|---|---|"]
    for f in report["files"]:
        file = clean(f.get("path", "-"))
        decision = clean(f.get("decision", "-"))
        tests_added = len(f.get("tests_added", []))
        result = clean(f.get("result", "-"))
        uncovered = clean("; ".join(f.get("uncovered", [])) or "-")
        lines.append(f"| {file} | {decision} | {tests_added} | {result} | {uncovered} |")

    return "\n".join(lines)


def list_section(report: dict | None) -> str:
    """Lists from the agent's report that need a human; empty lists are left out."""
    if not report:
        return ""

    sections = [
        ("Failing existing tests (need a human)", report.get("failing_existing_tests", [])),
        ("Suspected bugs", report.get("suspected_bugs", [])),
        ("Warnings", report.get("warnings", [])),
    ]
    result = []
    for title, items in sections:
        if not items:
            continue
        lines = [f"### {title}"]
        for item in items:
            if isinstance(item, dict):
                # failing_existing_tests: {"test": ..., "error": ...}
                item = f"{item.get('test', '-')}: {item.get('error', '-')}"
            lines.append(f"- {clean(item)}")
        result.append("\n".join(lines))

    return "\n\n".join(result)


def percent(data: dict | None, *keys: str) -> str:
    """Walk the keys into data; "n/a" if the file or any key is missing."""
    try:
        for key in keys:
            data = data[key]
        return f"{data:.0f}%"
    except (KeyError, TypeError, ValueError):
        return "n/a"


def coverage_line() -> str:
    backend = load_json("backend/coverage/coverage.json")
    frontend = load_json("frontend/coverage/coverage-summary.json")
    backend_cov = percent(backend, "totals", "percent_covered")
    frontend_cov = percent(frontend, "total", "lines", "pct")
    return f"Coverage: backend {backend_cov} · frontend {frontend_cov}"


def main() -> int:
    context = load_json(".agent/context.json")
    report = load_json(".agent/report.json")

    if not context or not context.get("files"):
        print("No source files changed, nothing to test.")
        return 0

    outcomes = ["AGENT_OUTCOME", "GUARD_OUTCOME", "BACKEND_OUTCOME", "FRONTEND_OUTCOME"]
    
    failed = any(os.environ.get(outcome) for outcome in outcomes if os.environ.get(outcome) == "failure")
    header = "## Test agent: ❌ failed" if failed else "## Test agent: ✅ passed"

    parts = [
        header,
        status_table(),
        files_table(report),
        list_section(report),
        coverage_line(),
        f"[Full run]({os.environ.get('RUN_URL', '')})",
    ]

    print("\n\n".join(p for p in parts if p))
    return 0


if __name__ == "__main__":
    sys.exit(main())