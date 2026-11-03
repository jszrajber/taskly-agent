---
name: vitest-unit-tests
description: Conventions for writing Vitest and React Testing Library unit tests for the Taskly React frontend (frontend/src). Use when creating or updating *.test.ts or *.test.tsx files.
user-invocable: false
paths: frontend/**
---

# Vitest unit tests

Write unit tests for the frontend files listed in `.agent/context.json` that got
a `create` or `update` decision (see the `pr-change-analysis` skill). Read the
source file and the existing tests next to it first, and match their style.

## Layout

- Colocate tests with the source: `TodoForm.tsx` → `TodoForm.test.tsx`,
  `http.ts` → `http.test.ts`. Use `.tsx` only when the test renders JSX.
- Import test APIs explicitly: `import { beforeEach, expect, it, vi } from 'vitest'`.
- Top-level `it(...)` blocks are the norm; use `describe` only to group tests of
  one function with several behaviours, as `utils/todos.test.ts` does.
- The environment is jsdom with `@testing-library/jest-dom` matchers and
  automatic cleanup (`src/test/setup.ts`). Do not add your own cleanup.

## Project helpers

- **Design system:** components must render with the project mocks. Add this
  line at the top of every component test, with the relative path adjusted:
  ```ts
  vi.mock('../../../design-system', () => import('../../../design-system/mocks'))
  ```
- **Fixture:** `todoFixture` from `src/test/todoFixture.ts` is a valid `Todo`.
  Spread it for variants: `{ ...todoFixture, id: 8, completed: true }`.
- **Mocking modules:** replace a module with `vi.fn()` exports, then control
  them with `vi.mocked`, and reset between tests:
  ```ts
  vi.mock('../api/todos', () => ({ todosApi: { list: vi.fn(), create: vi.fn() } }))
  beforeEach(() => vi.clearAllMocks())
  vi.mocked(todosApi.list).mockResolvedValue([todoFixture])
  ```
  `api/todos.test.ts` and `TodosPage.test.tsx` follow this pattern.

## Hooks that use React Query

Create a fresh `QueryClient` per test with retries off, and pass it to the
wrapper so the test can inspect the cache:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return { client, wrapper }
}
```

- Queries: wait for the result with
  `await waitFor(() => expect(result.current.isSuccess).toBe(true))`.
- Mutations in this project write to the cache with `setQueryData`. Seed the
  cache with `client.setQueryData(todoKeys.list, [...])`, run
  `await result.current.mutateAsync(...)`, then assert on
  `client.getQueryData(todoKeys.list)`, not only on the API mock.
- Also cover the error path: a rejected API call must leave the cache unchanged.

## Rules

- **No real requests.** Mock `todosApi` or `lib/http`. When testing
  `lib/http.ts` itself, stub `fetch` with `vi.stubGlobal('fetch', vi.fn())` and
  call `vi.unstubAllGlobals()` in `afterEach`.
- **Query like a user:** `getByRole('button', { name: ... })`, then
  `getByLabelText` and `getByText`. No test IDs or CSS selectors.
- **Interaction:** `const user = userEvent.setup()`, then `await user.click(...)`.
  Do not use `fireEvent`.
- **Time:** use `vi.useFakeTimers()` for anything time-based (for example
  `useNotice`), and `vi.useRealTimers()` in `afterEach`.
- **No snapshot tests.**

## Run

Only `npx vitest run` is allowed (`npm test` and a bare `vitest` are denied).
From the repository root:

```sh
cd frontend && npx vitest run src/features/todos/hooks/useTodosQuery.test.tsx
```
