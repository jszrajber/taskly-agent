---
name: run-tests-and-coverage
description: Run Taskly backend and frontend unit tests and read the results. Use after creating or updating any test file. This skill only runs tests; it never changes files.
user-invocable: false
---

# Run tests

This skill runs tests and reads their output. It does not change any file.
Deciding what to do with a failure is the agent's job, not this skill's.

Dependencies are already installed by the workflow. Do not install anything.

## Commands

Only these commands are allowed; anything else is denied automatically.

| Area | Command (from the repository root) |
|---|---|
| Backend, one file | `cd backend && python -m pytest tests/<path>/test_<module>.py -q` |
| Backend, all | `cd backend && python -m pytest -q` |
| Frontend, one file | `cd frontend && npx vitest run src/<path>.test.tsx` |
| Frontend, all | `cd frontend && npx vitest run` |

## Order

1. Run the test files created or changed in this run, one by one.
2. Then run the whole suite once for each area you touched (backend and/or
   frontend), to see whether anything else fails.

## Reading the output

- **pytest:** the last line summarises the run, for example
  `3 passed, 1 failed in 0.42s`. Each failure is listed as
  `FAILED tests/<path>::<test_name> - <error>`. Exit code `0` means all passed.
- **Vitest:** the summary shows `Test Files` and `Tests` with passed and failed
  counts. Each failing test is marked `FAIL` or `×` with its file and name,
  followed by the assertion error. Exit code `0` means all passed.

For every failing test, note whether it is in a test case written in this run
or in an existing test case. The agent needs that distinction.

## Finding uncovered code

When the tests for a source file pass, run them once more with coverage for
that file only, to see which lines are still not tested:

| Area | Command (from the repository root) |
|---|---|
| Backend | `cd backend && python -m pytest tests/core/test_config.py -q --cov=app.core.config --cov-report=term-missing` |
| Frontend | `cd frontend && npx vitest run src/lib/http.test.ts --coverage --coverage.include=src/lib/http.ts --coverage.reporter=text` |

- pytest lists the untested lines in the `Missing` column, for example `14-16, 22`.
- Vitest lists them in the `Uncovered Line #s` column.

Open the source file at those lines and list each uncovered part under
`uncovered` for that file in `.agent/report.json`, with a short description of
what it does (for example "error branch when DB_PORT is not a number").
Use this list only to see what is missing; the coverage numbers shown in the
pull request come from the workflow, not from this run.

## Rules

- Never modify or delete an existing test case, even if it fails.
- If an existing test fails, leave it as is and list it under
  `failing_existing_tests` in `.agent/report.json` with the test name and the
  error. A human decides whether the test or the code needs fixing.
- Set `"result": "passed"` for a file only if you saw it pass in the last run.
- Do not report coverage percentages. The workflow reruns every test with
  coverage after the agent finishes and reports the numbers in the pull
  request, so results never depend on what the agent says.
