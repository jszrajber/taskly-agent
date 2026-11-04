import { Badge } from '../../../design-system'
import { useTodoStatsQuery } from '../hooks/useTodoStatsQuery'

export function TodoStatsBar() {
  const { data } = useTodoStatsQuery()

  // Nothing to show until the counts arrive (or if loading them failed).
  if (!data) return null

  return (
    <div className="row compact" aria-label="Task summary">
      <Badge variant="neutral">{data.total} tasks</Badge>
      <Badge variant="success">{data.completed} done</Badge>
      <Badge variant={data.overdue > 0 ? 'warning' : 'neutral'}>
        {data.overdue} overdue
      </Badge>
    </div>
  )
}
