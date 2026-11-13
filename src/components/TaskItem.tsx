import { Check, Clock, Flag, Repeat, Timer } from 'lucide-react'
import type { Task } from '../types'
import { humanDate, humanDateWithWeekday, humanDuration } from '../lib/dates'
import { cx } from '../lib/utils'

interface Props {
  task: Task
  onToggle: (task: Task) => void
  onOpen: (task: Task) => void
  onToggleSubtask?: (task: Task, subtaskId: string) => void
  onTagClick?: (tag: string) => void
  onFocus?: (task: Task) => void
  overdue?: boolean
  showDate?: boolean
}

export function TaskItem({
  task,
  onToggle,
  onOpen,
  onToggleSubtask,
  onTagClick,
  onFocus,
  overdue,
  showDate,
}: Props) {
  const recurrenceText =
    task.recurrence === 'daily'
      ? '每天'
      : task.recurrence === 'weekly'
        ? '每周'
        : task.recurrence === 'weekdays'
          ? '工作日'
          : ''
  const isSeries = Boolean(task.seriesId && task.rangeStart && task.rangeEnd)
  const isLastDay = isSeries && task.date === task.rangeEnd
  const hasMeta = Boolean(
    (overdue && task.date) ||
      (showDate && task.date) ||
      task.time ||
      task.duration ||
      recurrenceText ||
      isSeries,
  )
  const canFocus = Boolean((task.time || task.duration) && !task.completed && onFocus)

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

      <div className="task-main">
        <button
          type="button"
          className="task-open"
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
                <span className="meta-chip overdue-chip">
                  {humanDate(task.date)}
                </span>
              )}
              {showDate && task.date && !overdue && (
                <span className="meta-chip">
                  {humanDateWithWeekday(task.date)}
                </span>
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
              {isLastDay ? (
                <span className="meta-chip last-day-chip">最后一天！</span>
              ) : (
                isSeries &&
                task.rangeEnd && (
                  <span className="meta-chip series-chip">
                    每天 · 至 {humanDate(task.rangeEnd)}
                  </span>
                )
              )}
            </span>
          )}

          {task.notes.trim() && (
            <span className="task-notes">{task.notes}</span>
          )}
        </button>

        {task.tags.length > 0 && (
          <div className="task-tags">
            {task.tags.map((tag) =>
              onTagClick ? (
                <button
                  key={tag}
                  type="button"
                  className="tag-pill"
                  onClick={() => onTagClick(tag)}
                >
                  #{tag}
                </button>
              ) : (
                <span key={tag} className="tag-pill">
                  #{tag}
                </span>
              ),
            )}
          </div>
        )}

        {task.subtasks.length > 0 && (
          <div className="task-subtasks">
            {task.subtasks.map((subtask) => (
              <div className="task-subtask" key={subtask.id}>
                <button
                  type="button"
                  className={cx('sub-check', subtask.done && 'checked')}
                  onClick={() => onToggleSubtask?.(task, subtask.id)}
                  aria-pressed={subtask.done}
                  aria-label={
                    subtask.done
                      ? `标记子任务未完成：${subtask.title}`
                      : `完成子任务：${subtask.title}`
                  }
                  disabled={!onToggleSubtask}
                >
                  {subtask.done && <Check size={11} strokeWidth={3.2} />}
                </button>
                <span
                  className={cx(
                    'subtask-label',
                    subtask.done && 'done',
                  )}
                >
                  {subtask.title}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {canFocus && (
        <button
          type="button"
          className="task-timer"
          onClick={() => onFocus?.(task)}
          aria-label={`开始专注：${task.title}`}
          title="开始专注"
        >
          <Timer size={16} />
        </button>
      )}
    </article>
  )
}
