import { expect, it } from 'vitest'
import { todoKeys } from './queryKeys'

it('nests every key under the shared todos prefix so one key matches all', () => {
  for (const key of [todoKeys.list, todoKeys.create, todoKeys.update, todoKeys.delete]) {
    expect(key.slice(0, todoKeys.all.length)).toEqual(todoKeys.all)
  }
})

it('gives each operation a distinct key', () => {
  const keys = [todoKeys.list, todoKeys.create, todoKeys.update, todoKeys.delete].map(
    (key) => key.join('/'),
  )
  expect(new Set(keys).size).toBe(4)
})
