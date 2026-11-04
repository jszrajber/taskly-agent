import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'
import { useDeleteTodoMutation } from './useDeleteTodoMutation'

vi.mock('../api/todos', () => ({ todosApi: { remove: vi.fn() } }))

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
  return { client, wrapper }
}

beforeEach(() => vi.clearAllMocks())

it('removes the deleted todo from the cached list', async () => {
  vi.mocked(todosApi.remove).mockResolvedValue(undefined)
  const other = { ...todoFixture, id: 8 }
  const { client, wrapper } = setup()
  client.setQueryData(todoKeys.list, [todoFixture, other])

  const { result } = renderHook(() => useDeleteTodoMutation(), { wrapper })
  await result.current.mutateAsync(todoFixture.id)

  expect(todosApi.remove).toHaveBeenCalledWith(todoFixture.id)
  expect(client.getQueryData(todoKeys.list)).toEqual([other])
})

it('does not create a list when nothing is cached', async () => {
  vi.mocked(todosApi.remove).mockResolvedValue(undefined)
  const { client, wrapper } = setup()

  const { result } = renderHook(() => useDeleteTodoMutation(), { wrapper })
  await result.current.mutateAsync(todoFixture.id)

  expect(client.getQueryData(todoKeys.list)).toBeUndefined()
})

it('marks the cached stats stale after deleting', async () => {
  vi.mocked(todosApi.remove).mockResolvedValue(undefined)
  const { client, wrapper } = setup()
  client.setQueryData(todoKeys.stats, { total: 1, completed: 0, overdue: 0 })

  const { result } = renderHook(() => useDeleteTodoMutation(), { wrapper })
  await result.current.mutateAsync(todoFixture.id)

  expect(client.getQueryState(todoKeys.stats)?.isInvalidated).toBe(true)
})

it('keeps the stats fresh when deleting fails', async () => {
  vi.mocked(todosApi.remove).mockRejectedValue(new Error('nope'))
  const { client, wrapper } = setup()
  client.setQueryData(todoKeys.stats, { total: 1, completed: 0, overdue: 0 })

  const { result } = renderHook(() => useDeleteTodoMutation(), { wrapper })
  await expect(result.current.mutateAsync(todoFixture.id)).rejects.toThrow('nope')

  expect(client.getQueryState(todoKeys.stats)?.isInvalidated).toBe(false)
})

it('keeps the todo in the cache when deleting fails', async () => {
  vi.mocked(todosApi.remove).mockRejectedValue(new Error('nope'))
  const { client, wrapper } = setup()
  client.setQueryData(todoKeys.list, [todoFixture])

  const { result } = renderHook(() => useDeleteTodoMutation(), { wrapper })
  await expect(result.current.mutateAsync(todoFixture.id)).rejects.toThrow('nope')

  expect(client.getQueryData(todoKeys.list)).toEqual([todoFixture])
})
