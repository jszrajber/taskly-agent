import { expect, it } from 'vitest'
import { queryClient } from './queryClient'

it('caches queries for 30 seconds and retries them once', () => {
  const { queries } = queryClient.getDefaultOptions()

  expect(queries?.staleTime).toBe(30_000)
  expect(queries?.retry).toBe(1)
})

it('never retries mutations', () => {
  expect(queryClient.getDefaultOptions().mutations?.retry).toBe(false)
})
