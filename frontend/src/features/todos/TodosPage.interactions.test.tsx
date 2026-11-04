import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { todoFixture } from '../../test/todoFixture'
import { useNotice } from '../../hooks/useNotice'
import { useTodoFilters } from './hooks/useTodoFilters'
import { useTodosBusy } from './hooks/useTodosBusy'
import { useTodosQuery } from './hooks/useTodosQuery'
import { useUpdateTodoMutation } from './hooks/useUpdateTodoMutation'
import { TodosPage } from './TodosPage'

vi.mock('../../design-system', () => import('../../design-system/mocks'))
vi.mock('../../hooks/useNotice', () => ({ useNotice: vi.fn() }))
vi.mock('./hooks/useTodoFilters', () => ({ useTodoFilters: vi.fn() }))
vi.mock('./hooks/useTodosBusy', () => ({ useTodosBusy: vi.fn() }))
vi.mock('./hooks/useTodosQuery', () => ({ useTodosQuery: vi.fn() }))
vi.mock('./hooks/useUpdateTodoMutation', () => ({
  useUpdateTodoMutation: vi.fn(),
}))
vi.mock('./components/TodosHeader', () => ({
  TodosHeader: ({ onCreate }: { onCreate: () => void }) => (
    <button onClick={onCreate}>New task</button>
  ),
}))
vi.mock('./components/TodoStatsBar', () => ({ TodoStatsBar: () => null }))
vi.mock('./components/TodoFilters', () => ({ TodoFilters: () => null }))
vi.mock('./components/TodoList', () => ({
  TodoList: ({
    todos,
    onToggle,
    onEdit,
    onDelete,
  }: {
    todos: { id: number; title: string }[]
    onToggle: (todo: never) => void
    onEdit: (todo: never) => void
    onDelete: (todo: never) => void
  }) => (
    <div>
      {todos.map((todo) => (
        <div key={todo.id}>
          <button onClick={() => onToggle(todo as never)}>toggle</button>
          <button onClick={() => onEdit(todo as never)}>edit</button>
          <button onClick={() => onDelete(todo as never)}>delete</button>
        </div>
      ))}
    </div>
  ),
}))
vi.mock('./components/TodoEditor', () => ({
  TodoEditor: ({
    todo,
    onClose,
    onSaved,
  }: {
    todo: unknown
    onClose: () => void
    onSaved: (notice: string) => void
  }) => (
    <div role="dialog" aria-label="editor">
      {todo === 'new' ? 'creating' : 'editing'}
      <button onClick={onClose}>close editor</button>
      <button onClick={() => onSaved('Task saved.')}>save editor</button>
    </div>
  ),
}))
vi.mock('./components/DeleteTodoDialog', () => ({
  DeleteTodoDialog: ({
    onClose,
    onDeleted,
  }: {
    onClose: () => void
    onDeleted: () => void
  }) => (
    <div role="dialog" aria-label="delete">
      <button onClick={onClose}>close delete</button>
      <button onClick={onDeleted}>confirm delete</button>
    </div>
  ),
}))
vi.mock('../../components/SuccessNotice', () => ({ SuccessNotice: () => null }))

const notify = vi.fn()
const mutateAsync = vi.fn()

function setup({ busy = false, mutationError = null as Error | null } = {}) {
  vi.mocked(useTodosQuery).mockReturnValue({
    data: [todoFixture],
    isPending: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useTodosQuery>)
  vi.mocked(useUpdateTodoMutation).mockReturnValue({
    error: mutationError,
    reset: vi.fn(),
    mutateAsync,
  } as unknown as ReturnType<typeof useUpdateTodoMutation>)
  vi.mocked(useTodosBusy).mockReturnValue(busy)
  vi.mocked(useNotice).mockReturnValue({ message: '', notify })
  vi.mocked(useTodoFilters).mockReturnValue({
    filter: 'all',
    search: '',
    sort: 'newest',
    visible: [todoFixture],
    setFilter: vi.fn(),
    setSearch: vi.fn(),
    setSort: vi.fn(),
  })
  render(<TodosPage />)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('toggling a task', () => {
  it('completes an active task and congratulates the user', async () => {
    const user = userEvent.setup()
    mutateAsync.mockResolvedValue({ ...todoFixture, completed: true })
    setup()
    await user.click(screen.getByRole('button', { name: 'toggle' }))
    expect(mutateAsync).toHaveBeenCalledWith({
      id: todoFixture.id,
      input: { completed: true },
    })
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith('Another task complete. Well done!'),
    )
  })

  it('reports when a task is marked active again', async () => {
    const user = userEvent.setup()
    mutateAsync.mockResolvedValue({ ...todoFixture, completed: false })
    setup()
    await user.click(screen.getByRole('button', { name: 'toggle' }))
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith('Task marked as active.'),
    )
  })

  it('does not notify when the update fails', async () => {
    const user = userEvent.setup()
    mutateAsync.mockRejectedValue(new Error('nope'))
    setup()
    await user.click(screen.getByRole('button', { name: 'toggle' }))
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1))
    expect(notify).not.toHaveBeenCalled()
  })

  it('ignores toggles while another operation is busy', async () => {
    const user = userEvent.setup()
    setup({ busy: true })
    await user.click(screen.getByRole('button', { name: 'toggle' }))
    expect(mutateAsync).not.toHaveBeenCalled()
  })

  it('shows a mutation error in the page alert', () => {
    setup({ mutationError: new Error('Could not update.') })
    expect(screen.getByTestId('alert')).toHaveTextContent('Could not update.')
  })
})

describe('editor and delete dialogs', () => {
  it('opens the editor for a new task and closes it', async () => {
    const user = userEvent.setup()
    setup()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'New task' }))
    expect(screen.getByRole('dialog', { name: 'editor' })).toHaveTextContent(
      'creating',
    )
    await user.click(screen.getByRole('button', { name: 'close editor' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(notify).not.toHaveBeenCalled()
  })

  it('opens the editor for an existing task and notifies after saving', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'edit' }))
    expect(screen.getByRole('dialog', { name: 'editor' })).toHaveTextContent(
      'editing',
    )
    await user.click(screen.getByRole('button', { name: 'save editor' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(notify).toHaveBeenCalledWith('Task saved.')
  })

  it('closes the delete dialog on cancel without notifying', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'delete' }))
    await user.click(screen.getByRole('button', { name: 'close delete' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(notify).not.toHaveBeenCalled()
  })

  it('closes the delete dialog and notifies after deletion', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'delete' }))
    await user.click(screen.getByRole('button', { name: 'confirm delete' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(notify).toHaveBeenCalledWith('Task deleted.')
  })
})
