# Solution: Unit Test Agent and Agentic Workflow

A Claude Code agent with five skills writes missing unit tests for the Taskly
backend (FastAPI, pytest) and frontend (React, Vitest). A GitHub Actions
workflow runs it on every pull request and on demand for the whole project.

The model only writes test files. Everything that decides the outcome — which
files to test, whether the agent stayed inside test files, whether the tests
pass, what gets committed and what the PR comment says — is done by
deterministic, tested Python tools and workflow steps.

## Results

| Run | What happened | Coverage (backend · frontend) |
|---|---|---|
| Start | Original repository | 42% · 48% |
| [Backfill #1](https://github.com/jszrajber/taskly-agent/actions/runs/41836451986) → [PR #7](https://github.com/jszrajber/taskly-agent/pull/7) | 16 new test files for the source files that had none | 68% · 74% |
| [Demo feature](https://github.com/jszrajber/taskly-agent/actions/runs/41917348331) → [PR #9](https://github.com/jszrajber/taskly-agent/pull/9) | New code written without tests; the agent created 3 test files and extended 7 | 70% · 75% |
| [Backfill #2](https://github.com/jszrajber/taskly-agent/actions/runs/41918479391) → [PR #10](https://github.com/jszrajber/taskly-agent/pull/10) | Gap analysis of files that already had tests: 12 test files extended, 1 added | 100% · 98% |

In every run the agent added test cases only. The only existing lines it
changed were import statements. No existing test failed and no bugs were
suspected.

## Where things are

| Path | What |
|---|---|
| `.claude/agents/test-writer.md` | The agent: process, hard rules, tool list, model, turn limit |
| `.claude/skills/pr-change-analysis/` | Decide `create` / `update` / `skip` per file; report format |
| `.claude/skills/pytest-unit-tests/` | Backend test conventions (fixtures, mocking, no DB, no `.env`, no real time) |
| `.claude/skills/vitest-unit-tests/` | Frontend test conventions (React Query setup, design-system mocks, queries by role) |
| `.claude/skills/run-tests-and-coverage/` | How to run tests and find uncovered lines; never changes files |
| `.claude/skills/triage-test-failures/` | What to do with failures: fix own tests, report suspected bugs, never touch existing tests |
| `.github/test-agent/claude-settings.json` | CI-only permission rules for the agent |
| `.github/workflows/test-agent.yml` | The workflow |
| `tools/changed_files.py` | Lists source files to test and where their tests live → `.agent/context.json` |
| `tools/guard_paths.py` | Fails if anything other than test files changed |
| `tools/coverage_report.py` | Builds the PR comment from real step outcomes and coverage files |
| `tools/tests/` | 92 unit tests for the three tools |

## How it works

```
pull request (backend/app/** or frontend/src/**)      Actions → Test agent → Run workflow
        │                                                       │
        ▼                                                       ▼
 changed_files --mode pr                               changed_files --mode backfill
 (git diff base...head)                                (git ls-files)
        └───────────────────────┬───────────────────────────────┘
                                ▼
        .agent/context.json (+ .agent/diff.patch in pr mode)
                                │  no source files → agent is skipped
                                ▼
        claude -p --agent test-writer --permission-mode dontAsk
               writes tests + .agent/report.json
                                │  no report → step fails
                                ▼
        guard_paths: only backend/tests/** and frontend/src/**/*.test.ts(x)?
                                ▼
        workflow runs pytest --cov and vitest --coverage itself
                                ▼
        commit only if guard + both suites pass
          pr mode       → push to the PR branch
          backfill mode → new branch + new PR
                                ▼
        coverage_report → PR comment; the run is red if any check failed
```

## Key decisions

**Claude Code CLI, not `claude-code-action`.** The action posts its own
comments, makes its own commits and expects a GitHub App. Here the agent should
only write files and the workflow should own git and GitHub, so the plain CLI
(`claude -p --agent test-writer`) is simpler to control and to reason about.

**A custom agent plus small skills.** The agent file holds the process and the
hard rules. Each skill covers one job (analyse, write backend tests, write
frontend tests, run, triage), so the conventions for each stack stay short and
can be changed independently.

**Deterministic tools around the model.** The file list, the safety check and
the PR comment come from Python code with unit tests, not from the model. The
same input always gives the same result, and the model cannot skip files,
claim tests pass, or approve its own changes.

**Results come from the workflow, not from the agent.** After the agent
finishes, the workflow reruns both suites with coverage. The PR comment takes
pass/fail from those step outcomes; the agent's report only adds descriptions
(decisions, uncovered parts, suspected bugs).

**Existing tests are never changed to make them pass.** A failing existing test
is left as it is and reported under *Failing existing tests (need a human)*.
A human decides whether the test or the code is wrong. The agent may only add
cases to existing test files.

**Two modes.** `pr` looks only at files changed in the PR and at the diff.
`backfill` checks every source file; it is how the missing tests were added
and how coverage gaps in already-tested files were closed.

**Commit only when everything is green.** If the guard or a test suite fails,
nothing is pushed; the tests are still available in the run's artifact
(`tests.patch`).

## Security

Three independent layers limit what the agent can change:

1. **Agent tools** — `Read, Glob, Grep, Edit, Write, Bash`; no web access.
2. **Permission rules** (`claude-settings.json`, `--permission-mode dontAsk`) —
   writes only to test files and `.agent/report.json`; Bash only
   `python -m pytest *` and `npx vitest run *`; `.env`, `.claude/**` and
   `.github/**` are denied. Anything else is refused without asking.
3. **`guard_paths.py`** — after the agent, independent of its permissions,
   fails the run if any non-test file changed (paths are normalised, so
   `backend/tests/../app` does not pass).

The permission file lives in `.github/test-agent/`, not in
`.claude/settings.json`, because the latter would also restrict every local
Claude Code session in the repository.

Workflow hardening:

- PRs from forks do not run the agent (they get no secrets).
- `permissions: {}` by default; the job gets only `contents: write` and
  `pull-requests: write`.
- All actions are pinned to commit SHAs; the Claude Code CLI to an exact version.
- `CLAUDE_CODE_OAUTH_TOKEN` is passed only to the agent step.
- `persist-credentials: false`: the GitHub token is not stored in the checkout,
  so the agent's shell cannot push; the push step passes the token explicitly.
- Branch names (user-controlled) reach shell scripts only through `env`, never
  through `${{ }}` inside `run:`.
- `concurrency` cancels the previous run on a new push; job and agent step
  have timeouts.
- Prompt injection: the agent treats code, comments and PR text as data, and
  reports instructions it finds under *Warnings*. Its report is untrusted text
  in the PR comment: `@mentions` are neutralised, `|` escaped, newlines removed.
- Pull requests opened by the workflow (backfill) use `GITHUB_TOKEN`, so GitHub
  holds their own workflow runs until a maintainer approves them. Before
  approving, check *Files changed* for edits to `.github/`.

In the runs the permissions worked as intended: the agent tried shell
commands that were not allowed (for example editing a test through a Python
heredoc) and, when they were denied, used the allowed tools instead. It
explicitly refused to work around a denied write.

## How to run

**In CI** — the secret `CLAUDE_CODE_OAUTH_TOKEN` must be set, and for backfill
*Settings → Actions → General → Allow GitHub Actions to create and approve pull
requests* must be enabled.

- Pull request: open a PR that changes `backend/app/**` or `frontend/src/**`.
- Backfill: *Actions → Test agent → Run workflow*.

**Locally** (needs the backend virtualenv, `npm ci` in `frontend/`, and the
`claude` CLI logged in):

```sh
# tests of the tools
python -m pytest tools/tests -q

# what the agent would get
python -m tools.changed_files --base origin/main --head HEAD   # or --mode backfill
cat .agent/context.json

# run the agent with the CI permissions, then the guard
claude -p "Write unit tests for the files in .agent/context.json and save the report to .agent/report.json." \
  --agent test-writer \
  --settings .github/test-agent/claude-settings.json \
  --permission-mode dontAsk
python -m tools.guard_paths
```

The application itself runs as described in `README.md`
(`docker compose up --build`).

## Example run: the demo feature (PR #9)

The feature: a task summary under the page header (*N tasks · N done ·
N overdue*) — `GET /api/todos/stats` on the backend, a query hook and a badge
bar on the frontend, and stats invalidation in the three mutation hooks. It was
written without tests.

The agent's decisions matched the change:

- `create` for `stats.py`, `useTodoStatsQuery.ts`, `TodoStatsBar.tsx`;
- `update` for `router.py`, `todos.ts`, `queryKeys.ts` and the three mutation
  hooks, adding cases only;
- `skip` for `types.ts` and `TodosPage.tsx`.

Things worth noting in its tests:

- `is_overdue` is tested with a fixed date and its boundaries (due yesterday,
  today, tomorrow, no date, completed after the due date) — not with the real
  clock.
- A router test checks that `/api/todos/stats` is not captured by
  `/{todo_id}` (the route must be declared first) and that `get` is not called.
- Each mutation test checks both that the stats are invalidated after success
  and that they are not invalidated after a failed call.
- It reported honestly that the badge colour is not asserted because the
  design-system mock drops the `variant` prop.

## Human review of the agent's work

Every agent PR was reviewed before merging. Findings, and what changed because
of them:

| Finding | Action |
|---|---|
| First run: every `Write` of a test file was denied in CI, though the same settings worked locally; the run was still reported as passed | Write rules added next to Edit rules, plus copies anchored to the absolute checkout path; the agent step now fails when no report is written; the full `stream-json` transcript is kept in the artifact |
| Backfill #1 stopped at 60 turns and skipped the coverage step; the agent's `maxTurns` won over the workflow's `--max-turns` | `maxTurns` raised to 200 in the agent file |
| A test that only repeated `queryClient` config values, for a file excluded from coverage | Skill: read the coverage exclusion lists and skip such files; never assert on literals copied from the source |
| A hook test built on React Query internals (`getMutationCache().build()`) | Skill: public APIs only |
| No special characters in `resolve_database_url` input | Skill: string-building code must be tested with special characters |
| Demo: `schemas.py` got two tests of a plain Pydantic model, although the skill says to skip it | Left as is (harmless); an example that the model does not always follow the skills, which is why a human reviews the PR |

## Assumptions

- Only same-repository PRs are trusted; forks are out of scope.
- Unit tests only: no database, network or `.env`. Database behaviour is not
  verified by these tests (see limitations).
- A Claude subscription token is enough for the task's scale; an API key would
  work the same way (`ANTHROPIC_API_KEY`).
- Files excluded from coverage in `pyproject.toml` / `vite.config.ts`
  (models, schemas, types, entry points, design system) do not need tests.

## Limitations

- **The agent's own test runs see the Claude token.** The agent step needs
  `CLAUDE_CODE_OAUTH_TOKEN`, and the tests the agent writes and runs inside
  that step inherit the environment. Bash is limited to pytest and Vitest, but
  a test written under prompt injection could still read the variable and try
  to leak it (over the network, or by writing it into a test file or the
  report that ends up in the PR). The later test steps have no secrets. The
  fixes, in the order I would apply them:
  1. **Run tests without the secret.** Allow the agent only a wrapper such as
     `tools/run_tests.sh`, which starts pytest or Vitest with a clean
     environment (`env -i` plus `PATH` and `HOME`), instead of
     `python -m pytest *` and `npx vitest run *`. The tests then cannot see
     the token at all.
  2. **Block outgoing network traffic** in the job except the Anthropic API
     and package registries (an egress allow-list such as
     `step-security/harden-runner`), so a read token cannot be sent anywhere.
  3. **Scan for secrets before anything is published:** a secret-scanning step
     (for example gitleaks) over `tests.patch` and `report.json` before the
     commit and the PR comment, plus GitHub push protection.
  4. **Short-lived credentials:** workload identity federation (GitHub OIDC)
     instead of a long-lived token, so a leaked credential expires quickly.
- **Shared test helpers cannot be created.** The agent may write only `*.test`
  files, so the React Query `setup()` helper is copied into each hook test
  instead of living in `src/test/`. Allowing that folder would widen the guard.
- **Model behaviour is not fully deterministic.** The skills are followed most
  of the time, not always (see the `schemas.py` example). The guard and the
  independent test run catch unsafe or failing output, but not every weak test.
- **Repository code is covered with mocks.** `repository.py` is tested by
  checking calls and compiled SQL, not against PostgreSQL.
- **Turn limits:** the agent file's `maxTurns` overrides the CLI flag, so PR
  runs also get up to 200 turns.
- **Comment length:** in backfill mode every skipped file gets a row.
- **Serial and single-job:** backend and frontend tests are written in one
  agent session.
- `overdue` in the demo uses the server's local date.

## What I would change for production

- Close the token exposure described in the limitations: tests run through a
  clean-environment wrapper, egress allow-list, secret scanning before commit
  and comment, and workload identity federation instead of a long-lived token.
- Use a GitHub App with minimal permissions instead of `GITHUB_TOKEN`, so agent
  PRs run CI without manual approval and commits are attributed to the app.
- Integration tests against a real PostgreSQL (service container) for the
  repository layer and for a SQL version of the stats endpoint.
- Move the fix-and-retry loop into code (for example LangGraph or the Claude
  Agent SDK) so the three-attempt limit is enforced, not only described in a
  skill. The workflow depends only on the `context.json` → `report.json`
  contract, so the engine can be replaced without touching the rest.
- Split backend and frontend into parallel agent runs.
- Collapse skipped files in the PR comment and show per-file coverage deltas.
- Enforce Prettier on generated tests.
- Track cost and turns per run (already in the transcript) and alert on
  regressions.

## Use of AI in this solution

I used Claude Code as a pair programmer and reviewer.

**What I did myself**

- Chose the engine and the overall architecture: an agent that only writes
  tests, surrounded by deterministic tools and a workflow that decides the
  outcome.
- Set the core rules: existing tests are never changed to make them pass,
  failing ones are reported to a human; the test-running skill only runs tests
  and lists uncovered lines; one PR per step.
- Wrote the Python tools — `guard_paths.py`, `changed_files.py` and
  `coverage_report.py` — and the demo feature (backend and frontend), fixing
  them after review.
- Ran the workflow, diagnosed the failed first run from the agent's
  transcript, and reviewed every agent PR before merging.

**What came from Claude, as suggestions**

- Drafts of the agent prompt, the five skills, the workflow and the unit tests
  of the tools, plus review comments and fixes on my code.
- I accepted these only after going through them, understanding how they work,
  and comparing them with alternatives. Examples of alternatives I weighed:
  - the ready-made `claude-code-action` versus the plain CLI;
  - Claude Code versus a custom agent in LangChain or LangGraph;
  - a stored database column versus a value computed on each request for
    "overdue";
  - counting in SQL versus in Python, and on the server versus in the browser;
  - fixing weak agent tests by hand versus improving the skills that produced
    them.
