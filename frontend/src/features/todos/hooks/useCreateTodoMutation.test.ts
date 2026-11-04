import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'
import type { TodoInput } from '../types'
import { useCreateTodoMutation } from './useCreateTodoMutation'

vi.mock('../api/todos', () => ({ todosApi: { create: vi.fn() } }))

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
  return { client, wrapper }
}

const input: TodoInput = {
  title: 'New',
  description: '',
  priority: 'low',
  due_date: null,
  completed: false,
}

beforeEach(() => vi.clearAllMocks())

it('prepends the saved todo to the cached list', async () => {
  const saved = { ...todoFixture, id: 8, title: 'New' }
  vi.mocked(todosApi.create).mockResolvedValue(saved)
  const { client, wrapper } = setup()
  client.setQueryData(todoKeys.list, [todoFixture])

  const { result } = renderHook(() => useCreateTodoMutation(), { wrapper })
  await result.current.mutateAsync(input)

  expect(todosApi.create).toHaveBeenCalledWith(input)
  expect(client.getQueryData(todoKeys.list)).toEqual([saved, todoFixture])
})

it('replaces a cached todo with the same id instead of duplicating it', async () => {
  const saved = { ...todoFixture, title: 'Server copy' }
  vi.mocked(todosApi.create).mockResolvedValue(saved)
  const { client, wrapper } = setup()
  client.setQueryData(todoKeys.list, [todoFixture])

  const { result } = renderHook(() => useCreateTodoMutation(), { wrapper })
  await result.current.mutateAsync(input)

  expect(client.getQueryData(todoKeys.list)).toEqual([saved])
})

it('creates the list when the cache is empty', async () => {
  vi.mocked(todosApi.create).mockResolvedValue(todoFixture)
  const { client, wrapper } = setup()

  const { result } = renderHook(() => useCreateTodoMutation(), { wrapper })
  await result.current.mutateAsync(input)

  expect(client.getQueryData(todoKeys.list)).toEqual([todoFixture])
})

it('marks the cached stats stale after creating', async () => {
  vi.mocked(todosApi.create).mockResolvedValue(todoFixture)
  const { client, wrapper } = setup()
  client.setQueryData(todoKeys.stats, { total: 0, completed: 0, overdue: 0 })

  const { result } = renderHook(() => useCreateTodoMutation(), { wrapper })
  await result.current.mutateAsync(input)

  expect(client.getQueryState(todoKeys.stats)?.isInvalidated).toBe(true)
})

it('keeps the stats fresh when creating fails', async () => {
  vi.mocked(todosApi.create).mockRejectedValue(new Error('nope'))
  const { client, wrapper } = setup()
  client.setQueryData(todoKeys.stats, { total: 0, completed: 0, overdue: 0 })

  const { result } = renderHook(() => useCreateTodoMutation(), { wrapper })
  await expect(result.current.mutateAsync(input)).rejects.toThrow('nope')

  expect(client.getQueryState(todoKeys.stats)?.isInvalidated).toBe(false)
})

it('leaves the cache unchanged when creating fails', async () => {
  vi.mocked(todosApi.create).mockRejectedValue(new Error('nope'))
  const { client, wrapper } = setup()
  client.setQueryData(todoKeys.list, [todoFixture])

  const { result } = renderHook(() => useCreateTodoMutation(), { wrapper })
  await expect(result.current.mutateAsync(input)).rejects.toThrow('nope')

  expect(client.getQueryData(todoKeys.list)).toEqual([todoFixture])
})
