import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { expect, it } from 'vitest'
import { todoKeys } from '../api/queryKeys'
import { useTodosBusy } from './useTodosBusy'

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
  return { client, wrapper }
}

it('is idle when nothing is mutating', () => {
  const { wrapper } = setup()

  const { result } = renderHook(() => useTodosBusy(), { wrapper })

  expect(result.current).toBe(false)
})

it('is busy while a todo mutation runs and idle after it settles', async () => {
  const { client, wrapper } = setup()
  const { result } = renderHook(() => useTodosBusy(), { wrapper })
  let release: () => void = () => {}

  const pending = client
    .getMutationCache()
    .build(client, {
      mutationKey: todoKeys.update,
      mutationFn: () => new Promise<void>((resolve) => (release = resolve)),
    })
    .execute(undefined)
  await waitFor(() => expect(result.current).toBe(true))

  release()
  await pending
  await waitFor(() => expect(result.current).toBe(false))
})

it('ignores mutations outside the todos keys', async () => {
  const { client, wrapper } = setup()
  const { result } = renderHook(() => useTodosBusy(), { wrapper })
  let release: () => void = () => {}

  const pending = client
    .getMutationCache()
    .build(client, {
      mutationKey: ['other'],
      mutationFn: () => new Promise<void>((resolve) => (release = resolve)),
    })
    .execute(undefined)
  await waitFor(() => expect(client.isMutating()).toBe(1))

  expect(result.current).toBe(false)
  release()
  await pending
})
