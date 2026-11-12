import { useMemo, useState } from 'react'
import {
  AlertCircle,
  CalendarPlus,
  ChevronDown,
  CircleCheck,
  Sparkles,
  SunMedium,
} from 'lucide-react'
import type { Task } from '../types'
import { TaskItem } from '../components/TaskItem'
import { EmptyState } from '../components/EmptyState'
import {
  greeting,
  humanDateWithWeekday,
  sortTasks,
  todayKey,
} from '../lib/dates'
import { cx } from '../lib/utils'

interface Props {
  tasks: Task[]
  onToggle: (task: Task) => void
  onEdit: (task: Task) => void
  onNew: () => void
  onMoveAllOverdue: (ids: string[]) => void
}

export function TodayView({
  tasks,
  onToggle,
  onEdit,
  onNew,
  onMoveAllOverdue,
}: Props) {
  const today = todayKey()
  const [showDone, setShowDone] = useState(false)

  const overdue = useMemo(
    () =>
      sortTasks(
        tasks.filter(
          (task) => !task.completed && task.date && task.date < today,
        ),
      ),
    [tasks, today],
  )
  const todayTasks = useMemo(
    () => tasks.filter((task) => task.date === today),
    [tasks, today],
  )
  const openToday = useMemo(
    () => sortTasks(todayTasks.filter((task) => !task.completed)),
    [todayTasks],
  )
  const doneToday = useMemo(
    () => sortTasks(todayTasks.filter((task) => task.completed)),
    [todayTasks],
  )

  const total = todayTasks.length
  const done = doneToday.length
  const allDone = total > 0 && done === total
  const progress = total > 0 ? Math.round((done / total) * 100) : 0

  const progressText =
    total === 0
      ? overdue.length
        ? `${overdue.length} 个任务等待顺延`
        : '今天还没有安排'
      : openToday.length === 0
        ? overdue.length
          ? `今天 ${total} 件事已完成 · 还有 ${overdue.length} 件顺延`
          : `${total} 件事全部完成`
        : overdue.length
          ? `完成 ${done} / ${total} · ${overdue.length} 件顺延`
          : `完成 ${done} / ${total}`

  return (
    <div className="view today-view">
      <header className="today-hero">
        <div className="hero-top">
          <div>
            <p className="hero-date">{humanDateWithWeekday(today)}</p>
            <h1>{greeting()}</h1>
          </div>
          <div className="hero-icon">
            {allDone && overdue.length === 0 ? (
              <Sparkles size={20} />
            ) : (
              <SunMedium size={20} />
            )}
          </div>
        </div>
        <div className="hero-progress">
          <div
            className="hero-progress-bar"
            role="progressbar"
            aria-label="今日完成进度"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
          <p className="hero-progress-text">{progressText}</p>
        </div>
      </header>

      {overdue.length > 0 && (
        <section className="section">
          <div className="section-head">
            <div className="section-title">
              <AlertCircle size={15} className="warn-icon" />
              <h2>顺延</h2>
              <span className="count-pill warn">{overdue.length}</span>
            </div>
            <button
              type="button"
              className="text-btn"
              onClick={() => onMoveAllOverdue(overdue.map((task) => task.id))}
            >
              全部移到今天
            </button>
          </div>
          <div className="task-list">
            {overdue.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                overdue
                onToggle={onToggle}
                onOpen={onEdit}
              />
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <div className="section-title">
            <h2>今天</h2>
            <span className="count-pill">{openToday.length}</span>
          </div>
          {total > 0 && (
            <span className="section-hint">
              {done}/{total} 完成
            </span>
          )}
        </div>

        {openToday.length > 0 ? (
          <div className="task-list">
            {openToday.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onToggle={onToggle}
                onOpen={onEdit}
              />
            ))}
          </div>
        ) : total > 0 ? (
          <div className="all-done">
            <CircleCheck size={17} />
            今天的任务都完成了
          </div>
        ) : (
          <EmptyState
            icon={<CalendarPlus size={22} />}
            title="今天还没有安排"
            text="给自己定一件小事，从点右下角的 + 开始。"
            actionLabel="添加今天的任务"
            onAction={onNew}
          />
        )}

        {doneToday.length > 0 && (
          <>
            <button
              type="button"
              className={cx('done-toggle', showDone && 'open')}
              onClick={() => setShowDone((value) => !value)}
              aria-expanded={showDone}
            >
              <ChevronDown size={16} />
              <span>已完成 {doneToday.length}</span>
            </button>
            {showDone && (
              <div className="task-list done-list">
                {doneToday.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggle={onToggle}
                    onOpen={onEdit}
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
