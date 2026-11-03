"""Fail when the test-writer agent changed files other than tests."""

import subprocess
import sys
import posixpath

BACKEND_TESTS_DIR = "backend/tests/"
FRONTEND_SRC_DIR = "frontend/src/"
FRONTEND_TEST_SUFFIXES = (".test.ts", ".test.tsx")


def changed_paths() -> list[str]:
    """Ask git which files were added, modified, deleted or renamed."""
    response = subprocess.run(
        ["git", "status", "--porcelain", "--untracked-files=all"],
        capture_output=True,
        text=True,
        check=True
    )
    files = response.stdout.splitlines()
    result = []
    for line in files:
        path = line[3:]
        if " -> " in path:
            result.extend(path.split(" -> "))
        else:
            result.append(path)
    return result


def is_allowed(path: str) -> bool:
    """True if the agent may change this path."""
    path = posixpath.normpath(path)  # Normalize path
    backend_check = path.startswith(BACKEND_TESTS_DIR)
    frontend_check = path.startswith(FRONTEND_SRC_DIR) and path.endswith(FRONTEND_TEST_SUFFIXES)
    return backend_check or frontend_check


def find_violations(paths: list[str]) -> list[str]:
    """Return the paths the agent was not allowed to change."""
    return [path for path in paths if not is_allowed(path)]


def main() -> int:
    """Print violations and return the process exit code."""
    paths = changed_paths()
    violations = find_violations(paths)
    if violations:
        for violation in violations:
            print(violation, file=sys.stderr)   # Can switch to logger in a complete project
        return 1

    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
