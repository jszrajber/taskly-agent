import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'
import { useTodoStatsQuery } from './useTodoStatsQuery'

vi.mock('../api/todos', () => ({ todosApi: { stats: vi.fn() } }))

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
  return { client, wrapper }
}

beforeEach(() => vi.clearAllMocks())

it('loads the stats and caches them under the stats key', async () => {
  const stats = { total: 3, completed: 1, overdue: 1 }
  vi.mocked(todosApi.stats).mockResolvedValue(stats)
  const { client, wrapper } = setup()

  const { result } = renderHook(() => useTodoStatsQuery(), { wrapper })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))

  expect(result.current.data).toEqual(stats)
  expect(client.getQueryData(todoKeys.stats)).toEqual(stats)
  expect(todosApi.stats).toHaveBeenCalledWith(expect.any(AbortSignal))
})

it('exposes the error and no data when loading fails', async () => {
  vi.mocked(todosApi.stats).mockRejectedValue(new Error('nope'))
  const { wrapper } = setup()

  const { result } = renderHook(() => useTodoStatsQuery(), { wrapper })
  await waitFor(() => expect(result.current.isError).toBe(true))

  expect(result.current.data).toBeUndefined()
})
