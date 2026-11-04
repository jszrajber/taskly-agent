import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatDate, isOverdue, selectTodos, validateTodo } from './todos'
import type { TodoInput } from '../types'
import type { Todo } from '../types'

const base: Todo = {
  id: 1,
  title: 'Sprint plan',
  description: '',
  priority: 'medium',
  completed: false,
  due_date: null,
  created_at: '2026-10-01T12:00:00Z',
  updated_at: '2026-10-01T12:00:00Z',
}

describe('selectTodos', () => {
  it('combines status with a case-insensitive search in the description', () => {
    const matching = { ...base, description: 'Discuss the API' }
    const todos = [
      matching,
      { ...matching, id: 2, completed: true },
      { ...base, id: 3 },
    ]
    expect(selectTodos(todos, 'active', ' api ', 'newest')).toEqual([matching])
  })

  it('sorts by priority without changing the source array', () => {
    const high: Todo = { ...base, id: 2, priority: 'high' }
    const todos = [base, high]
    expect(selectTodos(todos, 'all', '', 'priority')).toEqual([high, base])
    expect(todos).toEqual([base, high])
  })

  it('filters completed tasks and keeps all tasks for the "all" filter', () => {
    const done = { ...base, id: 2, completed: true }
    expect(selectTodos([base, done], 'completed', '', 'newest')).toEqual([done])
    expect(selectTodos([base, done], 'all', '', 'newest')).toHaveLength(2)
  })

  it('sorts newest first and breaks ties by higher id', () => {
    const older = { ...base, id: 2, created_at: '2026-09-01T12:00:00Z' }
    const sameTimeLaterId = { ...base, id: 3 }
    expect(
      selectTodos([older, base, sameTimeLaterId], 'all', '', 'newest'),
    ).toEqual([sameTimeLaterId, base, older])
  })

  it('sorts by due date with undated tasks last', () => {
    const undated = { ...base, id: 1 }
    const late = { ...base, id: 2, due_date: '2026-12-01' }
    const early = { ...base, id: 3, due_date: '2026-11-01' }
    expect(selectTodos([undated, late, early], 'all', '', 'due')).toEqual([
      early,
      late,
      undated,
    ])
  })

  it('breaks priority ties by higher id', () => {
    const other = { ...base, id: 2 }
    expect(selectTodos([base, other], 'all', '', 'priority')).toEqual([
      other,
      base,
    ])
  })
})

describe('validateTodo', () => {
  const valid: TodoInput = {
    title: 'Plan',
    description: '',
    priority: 'medium',
    due_date: null,
    completed: false,
  }

  it('accepts a valid task', () => {
    expect(validateTodo(valid)).toEqual({})
  })

  it('requires a non-blank title of at most 120 characters', () => {
    expect(validateTodo({ ...valid, title: '   ' }).title).toBe(
      'Enter a task title.',
    )
    expect(validateTodo({ ...valid, title: 'x'.repeat(121) }).title).toBe(
      'The title must be at most 120 characters.',
    )
    expect(validateTodo({ ...valid, title: 'x'.repeat(120) })).toEqual({})
  })

  it('limits the description to 2000 characters', () => {
    expect(
      validateTodo({ ...valid, description: 'x'.repeat(2001) }).description,
    ).toBe('The description must be at most 2000 characters.')
    expect(validateTodo({ ...valid, description: 'x'.repeat(2000) })).toEqual(
      {},
    )
  })

  it('rejects impossible or malformed dates but accepts real ones', () => {
    expect(validateTodo({ ...valid, due_date: '2026-02-30' }).due_date).toBe(
      'Enter a valid date.',
    )
    expect(validateTodo({ ...valid, due_date: '30/02/2026' }).due_date).toBe(
      'Enter a valid date.',
    )
    expect(validateTodo({ ...valid, due_date: '2028-02-29' })).toEqual({})
  })
})

describe('isOverdue', () => {
  afterEach(() => vi.useRealTimers())

  it('is overdue only for open tasks due before today', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 15, 12))
    expect(isOverdue({ ...base, due_date: '2026-10-14' })).toBe(true)
    expect(isOverdue({ ...base, due_date: '2026-10-15' })).toBe(false)
    expect(isOverdue({ ...base, due_date: '2026-10-16' })).toBe(false)
    expect(isOverdue({ ...base, due_date: null })).toBe(false)
    expect(isOverdue({ ...base, due_date: '2026-10-14', completed: true })).toBe(
      false,
    )
  })
})

describe('formatDate', () => {
  it('formats an ISO date as day, short month and year', () => {
    expect(formatDate('2026-10-05')).toBe('5 Oct 2026')
  })
})
