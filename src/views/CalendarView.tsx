import { useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Plus,
} from 'lucide-react'
import type { Task } from '../types'
import { TaskItem } from '../components/TaskItem'
import { WeekStrip } from '../components/WeekStrip'
import { MonthGrid } from '../components/MonthGrid'
import {
  addDaysKey,
  addMonthsKey,
  humanDateWithWeekday,
  monthLabel,
  relativeDayLabel,
  sortTasks,
  startOfMonthKey,
  startOfWeekKey,
  todayKey,
} from '../lib/dates'
import { cx } from '../lib/utils'

interface Props {
  tasks: Task[]
  selectedDate: string
  onSelectDate: (date: string) => void
  onToggle: (task: Task) => void
  onToggleSubtask: (task: Task, subtaskId: string) => void
  onEdit: (task: Task) => void
  onFocus: (task: Task) => void
  onTagClick: (tag: string) => void
  onNew: (date: string) => void
}

const EXPANDED_KEY = 'myday.calendar.expanded'

export function CalendarView({
  tasks,
  selectedDate,
  onSelectDate,
  onToggle,
  onToggleSubtask,
  onEdit,
  onFocus,
  onTagClick,
  onNew,
}: Props) {
  const today = todayKey()
  const weekStart = startOfWeekKey(selectedDate)
  const [showDone, setShowDone] = useState(false)
  const [expanded, setExpanded] = useState(
    () => localStorage.getItem(EXPANDED_KEY) === '1',
  )

  useEffect(() => {
    localStorage.setItem(EXPANDED_KEY, expanded ? '1' : '0')
  }, [expanded])

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

  const navigate = (direction: number): void => {
    onSelectDate(
      expanded
        ? addMonthsKey(selectedDate, direction)
        : addDaysKey(selectedDate, direction * 7),
    )
  }

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
          aria-label={expanded ? '上个月' : '上一周'}
          onClick={() => navigate(-1)}
        >
          <ChevronLeft size={19} />
        </button>
        <div className="cal-month">{monthLabel(selectedDate)}</div>
        <button
          type="button"
          className="icon-btn"
          aria-label={expanded ? '下个月' : '下一周'}
          onClick={() => navigate(1)}
        >
          <ChevronRight size={19} />
        </button>
      </div>

      {expanded ? (
        <MonthGrid
          monthKey={startOfMonthKey(selectedDate)}
          selectedDate={selectedDate}
          tasks={tasks}
          onSelect={onSelectDate}
        />
      ) : (
        <WeekStrip
          weekStart={weekStart}
          selectedDate={selectedDate}
          tasks={tasks}
          onSelect={onSelectDate}
          onPrevWeek={() => onSelectDate(addDaysKey(selectedDate, -7))}
          onNextWeek={() => onSelectDate(addDaysKey(selectedDate, 7))}
        />
      )}

      <button
        type="button"
        className="cal-expand"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        {expanded ? (
          <>
            <ChevronUp size={14} />
            收起月历
          </>
        ) : (
          <>
            <ChevronDown size={14} />
            展开月历
          </>
        )}
      </button>

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
                onToggleSubtask={onToggleSubtask}
                onOpen={onEdit}
                onFocus={onFocus}
                onTagClick={onTagClick}
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
