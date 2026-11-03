"""Write .agent/context.json: the source files changed in a PR and where their tests live.

Example output:
{
  "mode": "pr",
  "base_ref": "origin/main",
  "files": [
    {
      "path": "frontend/src/features/todos/utils/todos.ts",
      "area": "frontend",
      "status": "modified",
      "test_file": "frontend/src/features/todos/utils/todos.test.ts",
      "test_exists": true
    }
  ]
}
"""

import argparse
import json
import os
import posixpath
import subprocess
import sys

STATUS = {
    "A": "added",
    "M": "modified",
    "D": "deleted",
}

CONTEXT_PATH = ".agent/context.json"
DIFF_PATH = ".agent/diff.patch"


def get_changed_files(base: str = "origin/main", head: str = "HEAD") -> list[tuple[str, str]]:
    """Return (status, path) for every file changed between base and head."""
    response = subprocess.run(
        ["git", "diff", "--name-status", "--no-renames", f"{base}...{head}"],
        capture_output=True,
        text=True,
        check=True
    )
    result = []
    for line in response.stdout.splitlines():
        status, path = line.split("\t")
        result.append((status, path))
    return result


def get_all_files() -> list[tuple[str, str]]:
    """Return ("existing", path) for every file tracked by git (backfill mode)."""
    response = subprocess.run(
        ["git", "ls-files"],
        capture_output=True,
        text=True,
        check=True
    )
    return [("existing", path) for path in response.stdout.splitlines()]


def write_diff(base: str, head: str, path: str = DIFF_PATH) -> None:
    """Save the full PR diff so the agent sees which lines changed."""
    response = subprocess.run(
        ["git", "diff", f"{base}...{head}"],
        capture_output=True,
        text=True,
        check=True
    )
    os.makedirs(posixpath.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        f.write(response.stdout)


def is_source_file(path: str) -> bool:
    """True for application code that should have unit tests (not tests themselves)."""
    name = posixpath.basename(path)
    if path.startswith("backend/app/"):
        return name.endswith(".py") and name != "__init__.py"
    if path.startswith("frontend/src/") and not path.startswith("frontend/src/design-system/"):
        return (
            name.endswith((".ts", ".tsx"))
            and ".test." not in name
            and not name.endswith(".d.ts")
            and not path.startswith("frontend/src/test/")
        )
    return False


def test_file_for(path: str) -> str:
    """Where the unit test for a source file lives."""
    if path.startswith("backend/app/"):
        # backend/app/core/config.py -> backend/tests/core/test_config.py
        rest = path.removeprefix("backend/app/")
        folder, name = posixpath.split(rest)
        return posixpath.join("backend/tests", folder, "test_" + name)
    # frontend/src/lib/http.ts -> frontend/src/lib/http.test.ts
    stem, ext = posixpath.splitext(path)
    return stem + ".test" + ext


def get_files_details(files: list[tuple[str, str]]) -> list[dict]:
    """Describe every changed source file; skip everything else."""
    files_details = []
    for status, path in files:
        if not is_source_file(path):
            continue
        test_file = test_file_for(path)
        files_details.append({
            "path": path,
            "area": path.split("/")[0],
            "status": STATUS.get(status, status),
            "test_file": test_file,
            "test_exists": os.path.exists(test_file),
        })
    return files_details


def write_context(data: dict, path: str = CONTEXT_PATH) -> None:
    """Save the context for the agent, creating .agent/ if needed."""
    os.makedirs(posixpath.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--base", default="origin/main", help="branch the PR is merged into")
    parser.add_argument("--head", default="HEAD", help="PR branch or commit")
    parser.add_argument("--mode", choices=["pr", "backfill"], default="pr",
                    help="pr: only files changed in the PR; backfill: every source file")

    args = parser.parse_args(argv)
    if args.mode == "backfill":
        files = get_all_files()
    else:
        files = get_changed_files(args.base, args.head)
        write_diff(args.base, args.head)

    data = {
        "mode": args.mode,
        "base_ref": args.base,
        "files": get_files_details(files),
    }
    write_context(data)
    print(f"{len(data['files'])} source file(s) written to {CONTEXT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
