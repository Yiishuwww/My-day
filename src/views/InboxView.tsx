import { useMemo, useState } from 'react'
import { ChevronDown, Inbox } from 'lucide-react'
import type { Task } from '../types'
import { TaskItem } from '../components/TaskItem'
import { SortableTaskList } from '../components/SortableTaskList'
import { EmptyState } from '../components/EmptyState'
import { sortByPriorityAndOrder } from '../lib/dates'
import { reorderTasks } from '../db'
import { cx } from '../lib/utils'

interface Props {
  tasks: Task[]
  onToggle: (task: Task) => void
  onToggleSubtask: (task: Task, subtaskId: string) => void
  onEdit: (task: Task) => void
  onFocus: (task: Task) => void
  onTagClick: (tag: string) => void
  onQuickSchedule: (task: Task, date: string) => void
  onDelete: (task: Task) => void
  onNew: () => void
}

export function InboxView({
  tasks,
  onToggle,
  onToggleSubtask,
  onEdit,
  onFocus,
  onTagClick,
  onQuickSchedule,
  onDelete,
  onNew,
}: Props) {
  const [showDone, setShowDone] = useState(false)

  const pending = useMemo(
    () =>
      sortByPriorityAndOrder(
        tasks.filter((task) => !task.date && !task.completed),
      ),
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
          <SortableTaskList
            tasks={pending}
            onReorder={(orderedIds) => {
              void reorderTasks(orderedIds).catch(() => undefined)
            }}
            itemProps={{
              onToggle,
              onToggleSubtask,
              onOpen: onEdit,
              onFocus,
              onTagClick,
              onQuickSchedule,
              onDelete,
              quickSchedule: true,
            }}
          />
        ) : (
          <EmptyState
            icon={<Inbox size={22} />}
            title="收件箱是空的"
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
                    onQuickSchedule={onQuickSchedule}
                    onDelete={onDelete}
                    quickSchedule
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
