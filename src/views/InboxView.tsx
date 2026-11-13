import { useMemo, useState } from 'react'
import { ChevronDown, Inbox } from 'lucide-react'
import type { Task } from '../types'
import { TaskItem } from '../components/TaskItem'
import { EmptyState } from '../components/EmptyState'
import { sortTasks } from '../lib/dates'
import { cx } from '../lib/utils'

interface Props {
  tasks: Task[]
  onToggle: (task: Task) => void
  onToggleSubtask: (task: Task, subtaskId: string) => void
  onEdit: (task: Task) => void
  onFocus: (task: Task) => void
  onTagClick: (tag: string) => void
  onNew: () => void
}

export function InboxView({
  tasks,
  onToggle,
  onToggleSubtask,
  onEdit,
  onFocus,
  onTagClick,
  onNew,
}: Props) {
  const [showDone, setShowDone] = useState(false)

  const pending = useMemo(
    () => sortTasks(tasks.filter((task) => !task.date && !task.completed)),
    [tasks],
  )
  const completed = useMemo(
    () =>
      tasks
        .filter((task) => !task.date && task.completed)
        .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)),
    [tasks],
  )

  return (
    <div className="view inbox-view">
      <header className="page-head">
        <div>
          <p className="eyebrow">收集</p>
          <h1>收件箱</h1>
          <p className="page-sub">先记下来，稍后再安排时间。</p>
        </div>
      </header>

      <section className="section">
        <div className="section-head">
          <div className="section-title">
            <h2>待安排</h2>
            <span className="count-pill">{pending.length}</span>
          </div>
        </div>

        {pending.length > 0 ? (
          <div className="task-list">
            {pending.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onToggle={onToggle}
                onToggleSubtask={onToggleSubtask}
                onOpen={onEdit}
                onFocus={onFocus}
                onTagClick={onTagClick}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Inbox size={22} />}
            title="收件箱是空的"
            text="想到什么先记在这里，之后再点开任务安排日期。"
            actionLabel="记一件事"
            onAction={onNew}
          />
        )}

        {completed.length > 0 && (
          <>
            <button
              type="button"
              className={cx('done-toggle', showDone && 'open')}
              onClick={() => setShowDone((value) => !value)}
              aria-expanded={showDone}
            >
              <ChevronDown size={16} />
              <span>已完成 {completed.length}</span>
            </button>
            {showDone && (
              <div className="task-list done-list">
                {completed.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggle={onToggle}
                    onToggleSubtask={onToggleSubtask}
                    onOpen={onEdit}
                    onFocus={onFocus}
                    onTagClick={onTagClick}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
