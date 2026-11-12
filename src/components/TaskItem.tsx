import { Check, Clock, Flag, ListChecks, Repeat } from 'lucide-react'
import type { Task } from '../types'
import { humanDate, humanDuration } from '../lib/dates'
import { cx } from '../lib/utils'

interface Props {
  task: Task
  onToggle: (task: Task) => void
  onOpen: (task: Task) => void
  overdue?: boolean
}

export function TaskItem({ task, onToggle, onOpen, overdue }: Props) {
  const subtaskDone = task.subtasks.filter((subtask) => subtask.done).length
  const recurrenceText =
    task.recurrence === 'daily'
      ? '每天'
      : task.recurrence === 'weekly'
        ? '每周'
        : task.recurrence === 'weekdays'
          ? '工作日'
          : ''

  const hasMeta = Boolean(
    (overdue && task.date) ||
      task.time ||
      task.duration ||
      recurrenceText ||
      task.subtasks.length,
  )

  return (
    <article
      className={cx(
        'task-card',
        task.completed && 'is-done',
        overdue && 'is-overdue',
      )}
    >
      <button
        type="button"
        className={cx('task-check', task.completed && 'checked')}
        onClick={() => onToggle(task)}
        role="checkbox"
        aria-checked={task.completed}
        aria-label={
          task.completed ? `标记未完成：${task.title}` : `完成任务：${task.title}`
        }
      >
        <span className="check-circle">
          {task.completed && <Check size={15} strokeWidth={3.2} />}
        </span>
      </button>

      <button
        type="button"
        className="task-main"
        onClick={() => onOpen(task)}
        aria-label={`编辑任务：${task.title}`}
      >
        <span className="task-title-row">
          {task.priority > 0 && (
            <Flag
              size={13}
              className={cx(
                'priority-flag',
                task.priority === 2 ? 'high' : 'medium',
              )}
              fill="currentColor"
            />
          )}
          <span className="task-title">{task.title}</span>
        </span>

        {hasMeta && (
          <span className="task-meta">
            {overdue && task.date && (
              <span className="meta-chip overdue-chip">{humanDate(task.date)}</span>
            )}
            {task.time && (
              <span className="meta-item">
                <Clock size={13} />
                {task.time}
                {task.duration ? ` · ${humanDuration(task.duration)}` : ''}
              </span>
            )}
            {!task.time && task.duration && (
              <span className="meta-item">
                <Clock size={13} />
                {humanDuration(task.duration)}
              </span>
            )}
            {recurrenceText && (
              <span className="meta-item">
                <Repeat size={13} />
                {recurrenceText}
              </span>
            )}
            {task.subtasks.length > 0 && (
              <span
                className={cx(
                  'meta-item',
                  subtaskDone === task.subtasks.length && 'meta-done',
                )}
              >
                <ListChecks size={13} />
                {subtaskDone}/{task.subtasks.length}
              </span>
            )}
          </span>
        )}

        {task.tags.length > 0 && (
          <span className="task-tags">
            {task.tags.map((tag) => (
              <span key={tag} className="tag-pill">
                #{tag}
              </span>
            ))}
          </span>
        )}
      </button>
    </article>
  )
}
