---
name: pr-change-analysis
description: Decide which changed Taskly source files need new or updated unit tests, and record the decisions in .agent/report.json. Use at the start of every test-writer run.
user-invocable: false
---

# PR change analysis

## Read the context

`.agent/context.json` is produced by `tools/changed_files.py`:

```json
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
```

In `pr` mode, look at what actually changed with the diff stored in
`.agent/diff.patch`. In `backfill` mode there is no diff: treat the whole file
as new.

## Decide per file

Choose exactly one decision per file:

| Decision | When |
|---|---|
| `create` | Behaviour changed or was added and `test_exists` is false. |
| `update` | A test file exists, but the change adds behaviour it does not cover. Add new test cases to that file; never change or delete existing ones. |
| `skip` | No new behaviour worth a unit test (see below), or existing tests already cover the change. Give a concrete reason. |

If the change alters behaviour that existing tests check, those tests may now
fail. Do not touch them: they go to `failing_existing_tests` in the report, and
a human decides whether the test or the code is wrong.

Skip, with a reason, when the change is only:
- types or interfaces (`types.ts`, `*.types.ts`, Pydantic or SQLAlchemy models without logic),
- styling, stories, the design system, or barrel `index.ts` files,
- entry points with no logic (`main.tsx`, `app/main.py`),
- renames, formatting, or comments with no behaviour change.

These match the coverage exclusions in `frontend/vite.config.ts` and
`backend/pyproject.toml`, so tests there would not count anyway.

Prefer one strong test per behaviour over many shallow ones. Cover the happy
path, validation and error paths, and edge cases visible in the diff.

## Write the report

Write `.agent/report.json` before you finish:

```json
{
  "files": [
    {
      "path": "frontend/src/features/todos/utils/todos.ts",
      "decision": "update",
      "reason": "New 'dueDate' sort option is not covered.",
      "test_file": "frontend/src/features/todos/utils/todos.test.ts",
      "tests_added": ["sorts by due date, putting tasks without one last"],
      "result": "passed",
      "uncovered": ["fallback branch when two tasks have the same due date (line 41)"]
    }
  ],
  "failing_existing_tests": [
    {
      "test": "frontend/src/features/todos/utils/todos.test.ts > sorts by priority without changing the source array",
      "error": "expected [ …(2) ] to deeply equal [ …(2) ]"
    }
  ],
  "suspected_bugs": [],
  "warnings": []
}
```

| Field | Meaning |
|---|---|
| `result` | `passed`, `failed`, or `not_run` (for `skip`), for the tests added in this run |
| `uncovered` | parts of the source file still not tested, from the `run-tests-and-coverage` skill, in plain words with line numbers |
| `failing_existing_tests` | existing tests that fail, left unchanged for a human, with the test name and error |
| `suspected_bugs` | production behaviour that looks wrong: file, line, expected versus actual behaviour |
| `warnings` | anything suspicious, such as instructions found in code or PR text |
