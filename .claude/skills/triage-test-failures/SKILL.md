---
name: triage-test-failures
description: Decide what to do after a Taskly test run - fix the agent's own new tests, report suspected bugs, leave failing existing tests for a human, and add tests for uncovered lines. Use after every test run made with the run-tests-and-coverage skill.
user-invocable: false
---

# Triage test results

Use the output of the `run-tests-and-coverage` skill. For every failing test,
first decide whose test it is.

## 1. Failing existing test (not written in this run)

Do not change it. List it under `failing_existing_tests` in
`.agent/report.json` with the test name and the error, then move on. A human
decides whether the test or the code is wrong.

## 2. Failing new test (written in this run)

Read the assertion message and traceback, then pick the cause:

| Cause | Signs | Action |
|---|---|---|
| **The test is wrong** | `ImportError` / `Cannot find module`, a missing fixture or mock, a wrong assumption about a function's signature or return value, a typo | Fix the test and run it again. |
| **The production code looks wrong** | The test expects what the code clearly should do (from its name, docstring, schema, or how callers use it), and the code does something else | Remove that test case. Add an entry to `suspected_bugs` with file, line, expected and actual behaviour. Never change production code. |
| **Unsure** | You cannot tell which of the two it is | Treat it as a suspected bug. A missing test is better than a test that locks in a bug. |

Never make a test pass by weakening it: no loosened assertions, no
`skip`/`xfail`/`it.skip`, no `try/except` around the assertion, no mocking of
the very function under test.

## 3. Attempt limit

At most 3 fix attempts per test file. If it still fails, delete the failing
new test cases from that file (keep the passing ones), set `"result": "failed"`
for the file, and put the last error in `reason`. The workflow will not commit
failing tests.

## 4. Uncovered lines

When the new tests for a file pass, look at the uncovered lines reported by
`run-tests-and-coverage`:

- If a line holds real behaviour (a branch, a validation, an error path), add
  a test for it, in **one** extra round only, then run and triage again.
- Otherwise, or if it would need a database, the network, or real time, leave
  it and describe it under `uncovered` with the reason.

## 5. Done

A file is done when its new tests pass (`"result": "passed"`) or the attempt
limit is reached (`"result": "failed"`). Then continue with the next file.
