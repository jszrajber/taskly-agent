import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { TodoEmptyState } from './TodoEmptyState'

vi.mock('../../../design-system', () => import('../../../design-system/mocks'))

beforeEach(() => vi.clearAllMocks())

it('invites the user to add a first task and calls onCreate', async () => {
  const user = userEvent.setup()
  const onCreate = vi.fn()
  render(<TodoEmptyState hasTodos={false} disabled={false} onCreate={onCreate} />)

  expect(
    screen.getByRole('heading', { name: 'Add your first task' }),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Add your first task' }))

  expect(onCreate).toHaveBeenCalledTimes(1)
})

it('disables the create button when disabled', () => {
  render(<TodoEmptyState hasTodos={false} disabled onCreate={vi.fn()} />)

  expect(screen.getByRole('button', { name: 'Add your first task' })).toBeDisabled()
})

it('explains that filters hide the tasks and offers no create button', () => {
  render(<TodoEmptyState hasTodos disabled={false} onCreate={vi.fn()} />)

  expect(screen.getByRole('heading', { name: 'No matching tasks' })).toBeInTheDocument()
  expect(
    screen.getByText('Change the status filter or search to find your tasks.'),
  ).toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
