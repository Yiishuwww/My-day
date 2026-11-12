import { useMemo, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import type { Task } from '../types'
import { TaskItem } from '../components/TaskItem'
import { WeekStrip } from '../components/WeekStrip'
import {
  addDaysKey,
  humanDateWithWeekday,
  monthLabel,
  relativeDayLabel,
  sortTasks,
  startOfWeekKey,
  todayKey,
} from '../lib/dates'
import { cx } from '../lib/utils'

interface Props {
  tasks: Task[]
  selectedDate: string
  onSelectDate: (date: string) => void
  onToggle: (task: Task) => void
  onEdit: (task: Task) => void
  onNew: (date: string) => void
}

export function CalendarView({
  tasks,
  selectedDate,
  onSelectDate,
  onToggle,
  onEdit,
  onNew,
}: Props) {
  const today = todayKey()
  const weekStart = startOfWeekKey(selectedDate)
  const [showDone, setShowDone] = useState(false)

  const dayTasks = useMemo(
    () => tasks.filter((task) => task.date === selectedDate),
    [tasks, selectedDate],
  )
  const open = useMemo(
    () => sortTasks(dayTasks.filter((task) => !task.completed)),
    [dayTasks],
  )
  const done = useMemo(
    () => sortTasks(dayTasks.filter((task) => task.completed)),
    [dayTasks],
  )

  const relative = relativeDayLabel(selectedDate)
  const countLabel =
    open.length > 0 ? `${open.length} 待办` : done.length > 0 ? '已完成' : '空闲'

  return (
    <div className="view calendar-view">
      <header className="page-head">
        <div>
          <p className="eyebrow">计划</p>
          <h1>日历</h1>
        </div>
        <button
          type="button"
          className="today-btn"
          onClick={() => onSelectDate(today)}
          disabled={selectedDate === today}
        >
          回到今天
        </button>
      </header>

      <div className="cal-toolbar">
        <button
          type="button"
          className="icon-btn"
          aria-label="上一周"
          onClick={() => onSelectDate(addDaysKey(selectedDate, -7))}
        >
          <ChevronLeft size={19} />
        </button>
        <div className="cal-month">{monthLabel(selectedDate)}</div>
        <button
          type="button"
          className="icon-btn"
          aria-label="下一周"
          onClick={() => onSelectDate(addDaysKey(selectedDate, 7))}
        >
          <ChevronRight size={19} />
        </button>
      </div>

      <WeekStrip
        weekStart={weekStart}
        selectedDate={selectedDate}
        tasks={tasks}
        onSelect={onSelectDate}
        onPrevWeek={() => onSelectDate(addDaysKey(selectedDate, -7))}
        onNextWeek={() => onSelectDate(addDaysKey(selectedDate, 7))}
      />

      <section className="day-panel">
        <div className="day-panel-head">
          <div>
            {relative && <p className="day-relative">{relative}</p>}
            <h2>{humanDateWithWeekday(selectedDate)}</h2>
          </div>
          <span className="count-pill">{countLabel}</span>
        </div>

        {open.length > 0 && (
          <div className="task-list">
            {open.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onToggle={onToggle}
                onOpen={onEdit}
              />
            ))}
          </div>
        )}

        {dayTasks.length === 0 && (
          <div className="day-empty">
            <p>这一天还没有安排</p>
            <button
              type="button"
              className="empty-action"
              onClick={() => onNew(selectedDate)}
            >
              添加任务
            </button>
          </div>
        )}

        {done.length > 0 && (
          <>
            <button
              type="button"
              className={cx('done-toggle', showDone && 'open')}
              onClick={() => setShowDone((value) => !value)}
              aria-expanded={showDone}
            >
              <ChevronDown size={16} />
              <span>已完成 {done.length}</span>
            </button>
            {showDone && (
              <div className="task-list done-list">
                {done.map((task) => (
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

        {dayTasks.length > 0 && (
          <button
            type="button"
            className="add-inline"
            onClick={() => onNew(selectedDate)}
          >
            <Plus size={16} />
            添加任务
          </button>
        )}
      </section>
    </div>
  )
}
