import { beforeEach, expect, it, vi } from 'vitest'
import { request } from '../../../lib/http'
import { todoFixture } from '../../../test/todoFixture'
import { todosApi } from './todos'

vi.mock('../../../lib/http', () => ({ request: vi.fn() }))
beforeEach(() => vi.clearAllMocks())

it('passes the abort signal when fetching tasks', async () => {
  const signal = new AbortController().signal
  vi.mocked(request).mockResolvedValue([todoFixture])
  await expect(todosApi.list(signal)).resolves.toEqual([todoFixture])
  expect(request).toHaveBeenCalledWith('/todos', { signal })
})

it('passes the abort signal when fetching stats', async () => {
  const signal = new AbortController().signal
  const stats = { total: 2, completed: 1, overdue: 0 }
  vi.mocked(request).mockResolvedValue(stats)
  await expect(todosApi.stats(signal)).resolves.toEqual(stats)
  expect(request).toHaveBeenCalledWith('/todos/stats', { signal })
})

it('sends only writable task fields on creation', async () => {
  vi.mocked(request).mockResolvedValue(todoFixture)
  await expect(todosApi.create(todoFixture)).resolves.toEqual(todoFixture)
  expect(request).toHaveBeenCalledWith('/todos', {
    method: 'POST',
    body: JSON.stringify({
      title: todoFixture.title,
      description: '',
      priority: 'medium',
      due_date: null,
      completed: false,
    }),
  })
})

it('sends only the provided fields when updating', async () => {
  vi.mocked(request).mockResolvedValue(todoFixture)
  await todosApi.update(5, { completed: true })
  expect(request).toHaveBeenCalledWith('/todos/5', {
    method: 'PATCH',
    body: JSON.stringify({ completed: true }),
  })
})

it('never sends read-only fields when updating', async () => {
  vi.mocked(request).mockResolvedValue(todoFixture)
  await todosApi.update(5, { ...todoFixture, title: 'Renamed' })
  const body = JSON.parse(vi.mocked(request).mock.calls[0][1]?.body as string)
  expect(body).not.toHaveProperty('id')
  expect(body).not.toHaveProperty('created_at')
  expect(body.title).toBe('Renamed')
})

it('deletes a task by id', async () => {
  vi.mocked(request).mockResolvedValue(undefined)
  await todosApi.remove(9)
  expect(request).toHaveBeenCalledWith('/todos/9', { method: 'DELETE' })
})
