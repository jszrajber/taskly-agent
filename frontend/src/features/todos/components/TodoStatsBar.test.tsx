import { render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { useTodoStatsQuery } from '../hooks/useTodoStatsQuery'
import { TodoStatsBar } from './TodoStatsBar'

vi.mock('../../../design-system', () => import('../../../design-system/mocks'))
vi.mock('../hooks/useTodoStatsQuery', () => ({ useTodoStatsQuery: vi.fn() }))

beforeEach(() => vi.clearAllMocks())

function mockStats(data: { total: number; completed: number; overdue: number } | undefined) {
  vi.mocked(useTodoStatsQuery).mockReturnValue({ data } as ReturnType<
    typeof useTodoStatsQuery
  >)
}

it('shows total, done and overdue counts', () => {
  mockStats({ total: 5, completed: 2, overdue: 1 })
  render(<TodoStatsBar />)

  expect(screen.getByLabelText('Task summary')).toBeInTheDocument()
  expect(screen.getByText('5 tasks')).toBeInTheDocument()
  expect(screen.getByText('2 done')).toBeInTheDocument()
  expect(screen.getByText('1 overdue')).toBeInTheDocument()
})

it('shows zero overdue tasks', () => {
  mockStats({ total: 0, completed: 0, overdue: 0 })
  render(<TodoStatsBar />)

  expect(screen.getByText('0 overdue')).toBeInTheDocument()
})

it('renders nothing until the stats are available', () => {
  mockStats(undefined)
  const { container } = render(<TodoStatsBar />)

  expect(container).toBeEmptyDOMElement()
})
