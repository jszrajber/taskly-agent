import { act, renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { useTodoFilters } from './useTodoFilters'

const todos = [
  { ...todoFixture, id: 1, title: 'Write report', completed: true },
  { ...todoFixture, id: 2, title: 'Buy milk', created_at: '2026-10-02T12:00:00Z' },
]

it('starts with all tasks, no search and newest first', () => {
  const { result } = renderHook(() => useTodoFilters(todos))

  expect(result.current.filter).toBe('all')
  expect(result.current.search).toBe('')
  expect(result.current.sort).toBe('newest')
  expect(result.current.visible.map((t) => t.id)).toEqual([2, 1])
})

it('narrows the visible tasks when the filter changes', () => {
  const { result } = renderHook(() => useTodoFilters(todos))

  act(() => result.current.setFilter('completed'))

  expect(result.current.visible.map((t) => t.id)).toEqual([1])
})

it('narrows the visible tasks by search text', () => {
  const { result } = renderHook(() => useTodoFilters(todos))

  act(() => result.current.setSearch('MILK'))

  expect(result.current.visible.map((t) => t.id)).toEqual([2])
})

it('re-sorts when the sort changes', () => {
  const items = [
    { ...todoFixture, id: 1, priority: 'low' as const },
    { ...todoFixture, id: 2, priority: 'high' as const },
  ]
  const { result } = renderHook(() => useTodoFilters(items))

  act(() => result.current.setSort('priority'))

  expect(result.current.visible.map((t) => t.id)).toEqual([2, 1])
})
