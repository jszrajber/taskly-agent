import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'
import { useUpdateTodoMutation } from './useUpdateTodoMutation'

vi.mock('../api/todos', () => ({ todosApi: { update: vi.fn() } }))

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
  return { client, wrapper }
}

beforeEach(() => vi.clearAllMocks())

it('replaces only the updated todo in the cached list', async () => {
  const saved = { ...todoFixture, completed: true }
  const other = { ...todoFixture, id: 8 }
  vi.mocked(todosApi.update).mockResolvedValue(saved)
  const { client, wrapper } = setup()
  client.setQueryData(todoKeys.list, [todoFixture, other])

  const { result } = renderHook(() => useUpdateTodoMutation(), { wrapper })
  await result.current.mutateAsync({ id: todoFixture.id, input: { completed: true } })

  expect(todosApi.update).toHaveBeenCalledWith(todoFixture.id, { completed: true })
  expect(client.getQueryData(todoKeys.list)).toEqual([saved, other])
})

it('does not create a list when nothing is cached', async () => {
  vi.mocked(todosApi.update).mockResolvedValue(todoFixture)
  const { client, wrapper } = setup()

  const { result } = renderHook(() => useUpdateTodoMutation(), { wrapper })
  await result.current.mutateAsync({ id: todoFixture.id, input: { title: 'x' } })

  expect(client.getQueryData(todoKeys.list)).toBeUndefined()
})

it('marks the cached stats stale after updating', async () => {
  vi.mocked(todosApi.update).mockResolvedValue(todoFixture)
  const { client, wrapper } = setup()
  client.setQueryData(todoKeys.stats, { total: 1, completed: 0, overdue: 0 })

  const { result } = renderHook(() => useUpdateTodoMutation(), { wrapper })
  await result.current.mutateAsync({ id: todoFixture.id, input: { completed: true } })

  expect(client.getQueryState(todoKeys.stats)?.isInvalidated).toBe(true)
})

it('keeps the stats fresh when updating fails', async () => {
  vi.mocked(todosApi.update).mockRejectedValue(new Error('nope'))
  const { client, wrapper } = setup()
  client.setQueryData(todoKeys.stats, { total: 1, completed: 0, overdue: 0 })

  const { result } = renderHook(() => useUpdateTodoMutation(), { wrapper })
  await expect(
    result.current.mutateAsync({ id: todoFixture.id, input: { completed: true } }),
  ).rejects.toThrow('nope')

  expect(client.getQueryState(todoKeys.stats)?.isInvalidated).toBe(false)
})

it('leaves the cache unchanged when updating fails', async () => {
  vi.mocked(todosApi.update).mockRejectedValue(new Error('nope'))
  const { client, wrapper } = setup()
  client.setQueryData(todoKeys.list, [todoFixture])

  const { result } = renderHook(() => useUpdateTodoMutation(), { wrapper })
  await expect(
    result.current.mutateAsync({ id: todoFixture.id, input: { completed: true } }),
  ).rejects.toThrow('nope')

  expect(client.getQueryData(todoKeys.list)).toEqual([todoFixture])
})
