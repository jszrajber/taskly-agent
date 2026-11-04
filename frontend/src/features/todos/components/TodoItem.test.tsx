import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { TodoItem } from './TodoItem'

vi.mock('../../../design-system', () => import('../../../design-system/mocks'))

it('shows an active task and forwards edit requests', async () => {
  const user = userEvent.setup()
  const onEdit = vi.fn()
  const onToggle = vi.fn()
  const onDelete = vi.fn()
  render(
    <TodoItem
      todo={todoFixture}
      busy={false}
      onEdit={onEdit}
      onToggle={onToggle}
      onDelete={onDelete}
    />,
  )
  expect(screen.getByRole('heading', { name: todoFixture.title })).toBeVisible()
  expect(screen.getByText('To do')).toBeVisible()
  expect(screen.getByText('Medium')).toBeVisible()
  expect(screen.getByRole('checkbox')).not.toBeChecked()
  await user.click(
    screen.getByRole('button', { name: `Edit: ${todoFixture.title}` }),
  )
  expect(onEdit).toHaveBeenCalledTimes(1)
  expect(onToggle).not.toHaveBeenCalled()
  expect(onDelete).not.toHaveBeenCalled()
})

function renderItem(
  todo = todoFixture,
  overrides: Partial<{ busy: boolean }> = {},
) {
  const handlers = { onEdit: vi.fn(), onToggle: vi.fn(), onDelete: vi.fn() }
  render(<TodoItem todo={todo} busy={false} {...overrides} {...handlers} />)
  return handlers
}

it('forwards toggle and delete requests', async () => {
  const user = userEvent.setup()
  const handlers = renderItem()
  await user.click(
    screen.getByRole('checkbox', { name: `Complete: ${todoFixture.title}` }),
  )
  await user.click(
    screen.getByRole('button', { name: `Delete: ${todoFixture.title}` }),
  )
  expect(handlers.onToggle).toHaveBeenCalledTimes(1)
  expect(handlers.onDelete).toHaveBeenCalledTimes(1)
  expect(handlers.onEdit).not.toHaveBeenCalled()
})

it('shows a completed task as checked and offers to mark it active', () => {
  renderItem({ ...todoFixture, completed: true })
  expect(screen.getByText('Completed')).toBeVisible()
  expect(
    screen.getByRole('checkbox', { name: `Mark as active: ${todoFixture.title}` }),
  ).toBeChecked()
})

it('shows the description only when the task has one', () => {
  const { unmount } = render(
    <TodoItem
      todo={{ ...todoFixture, description: 'Bring the slides' }}
      busy={false}
      onEdit={vi.fn()}
      onToggle={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  expect(screen.getByText('Bring the slides')).toBeVisible()
  unmount()
  renderItem()
  expect(screen.queryByText('Bring the slides')).not.toBeInTheDocument()
})

it('disables every action while busy', () => {
  renderItem(todoFixture, { busy: true })
  expect(screen.getByRole('checkbox')).toBeDisabled()
  expect(
    screen.getByRole('button', { name: `Edit: ${todoFixture.title}` }),
  ).toBeDisabled()
  expect(
    screen.getByRole('button', { name: `Delete: ${todoFixture.title}` }),
  ).toBeDisabled()
})

describe('due date', () => {
  afterEach(() => vi.useRealTimers())

  it('flags an open task past its due date as overdue', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 15, 12))
    renderItem({ ...todoFixture, due_date: '2026-10-01' })
    expect(screen.getByText(/1 Oct 2026 · overdue/)).toBeVisible()
  })

  it('does not flag a future due date or a completed task as overdue', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 15, 12))
    const { unmount } = render(
      <TodoItem
        todo={{ ...todoFixture, due_date: '2026-10-20' }}
        busy={false}
        onEdit={vi.fn()}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getByText(/20 Oct 2026/)).toBeVisible()
    expect(screen.queryByText(/overdue/)).not.toBeInTheDocument()
    unmount()
    renderItem({ ...todoFixture, due_date: '2026-10-01', completed: true })
    expect(screen.queryByText(/overdue/)).not.toBeInTheDocument()
  })
})
