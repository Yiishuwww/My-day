import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Flag,
  List,
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
  humanDuration,
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
  onBack: () => void
}

type DayView = 'list' | 'timeline'

const EXPANDED_KEY = 'myday.calendar.expanded'
const VIEW_KEY = 'myday.calendar.dayView'
const DEFAULT_START_HOUR = 8
const DEFAULT_END_HOUR = 20

function timeToHour(time: string): number {
  return Number(time.slice(0, 2))
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function TimelineTask({
  task,
  onToggle,
  onEdit,
}: {
  task: Task
  onToggle: (task: Task) => void
  onEdit: (task: Task) => void
}) {
  return (
    <div className="timeline-task">
      <button
        type="button"
        className="timeline-check"
        onClick={() => onToggle(task)}
        role="checkbox"
        aria-checked={false}
        aria-label={`完成任务：${task.title}`}
      >
        <span className="check-circle" />
      </button>
      <button
        type="button"
        className="timeline-main"
        onClick={() => onEdit(task)}
        aria-label={`编辑任务：${task.title}`}
      >
        <span className="timeline-title-row">
          {task.priority > 0 && (
            <Flag
              size={11}
              className={cx(
                'priority-flag',
                task.priority === 2 ? 'high' : 'medium',
              )}
              fill="currentColor"
            />
          )}
          <span className="timeline-title">{task.title}</span>
        </span>
        <span className="timeline-meta">
          {task.time}
          {task.duration ? ` · ${humanDuration(task.duration)}` : ''}
        </span>
      </button>
    </div>
  )
}

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
  onBack,
}: Props) {
  const today = todayKey()
  const weekStart = startOfWeekKey(selectedDate)
  const [showDone, setShowDone] = useState(false)
  const [expanded, setExpanded] = useState(
    () => localStorage.getItem(EXPANDED_KEY) === '1',
  )
  const [view, setView] = useState<DayView>(() =>
    localStorage.getItem(VIEW_KEY) === 'timeline' ? 'timeline' : 'list',
  )
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    localStorage.setItem(EXPANDED_KEY, expanded ? '1' : '0')
  }, [expanded])

  useEffect(() => {
    if (view !== 'timeline' || selectedDate !== today) return
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [view, selectedDate, today])

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

  const timedOpen = useMemo(
    () => open.filter((task) => Boolean(task.time)),
    [open],
  )
  const untimedOpen = useMemo(
    () => open.filter((task) => !task.time),
    [open],
  )
  const tasksByHour = useMemo(() => {
    const groups = new Map<number, Task[]>()
    for (const task of timedOpen) {
      const hour = timeToHour(task.time as string)
      const list = groups.get(hour) ?? []
      list.push(task)
      groups.set(hour, list)
    }
    for (const list of groups.values()) {
      list.sort(
        (a, b) =>
          timeToMinutes(a.time as string) - timeToMinutes(b.time as string),
      )
    }
    return groups
  }, [timedOpen])

  const nowHour = now.getHours()
  const hourValues = timedOpen.map((task) => timeToHour(task.time as string))
  const startHour = Math.max(
    0,
    Math.min(
      DEFAULT_START_HOUR,
      ...hourValues,
      selectedDate === today ? nowHour : DEFAULT_START_HOUR,
    ),
  )
  const endHour = Math.min(
    23,
    Math.max(
      DEFAULT_END_HOUR,
      ...hourValues,
      selectedDate === today ? nowHour : DEFAULT_END_HOUR,
    ),
  )
  const hours = Array.from(
    { length: endHour - startHour + 1 },
    (_, index) => startHour + index,
  )
  const nowLabel = `现在 ${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes(),
  ).padStart(2, '0')}`

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

  const changeView = (next: DayView): void => {
    setView(next)
    setNow(new Date())
    localStorage.setItem(VIEW_KEY, next)
  }

  return (
    <div className="view calendar-view">
      <header className="tags-head calendar-head">
        <button
          type="button"
          className="back-btn"
          onClick={onBack}
          aria-label="返回"
        >
          <ArrowLeft size={19} />
        </button>
        <div className="tags-title">
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
          <div className="day-view-switch" role="group" aria-label="任务显示方式">
            <button
              type="button"
              className={cx('day-view-btn', view === 'list' && 'active')}
              onClick={() => changeView('list')}
              aria-pressed={view === 'list'}
            >
              <List size={13} />
              列表
            </button>
            <button
              type="button"
              className={cx('day-view-btn', view === 'timeline' && 'active')}
              onClick={() => changeView('timeline')}
              aria-pressed={view === 'timeline'}
            >
              <Clock size={13} />
              时间轴
            </button>
          </div>
        )}

        {open.length > 0 && view === 'list' && (
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

        {open.length > 0 && view === 'timeline' && (
          <div className="day-timeline">
            {untimedOpen.length > 0 && (
              <div className="timeline-untimed">
                <p className="timeline-untimed-label">未安排时间</p>
                <div className="task-list">
                  {untimedOpen.map((task) => (
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
              </div>
            )}

            {timedOpen.length > 0 && (
              <div className="timeline-hours">
                {hours.map((hour) => {
                  const list = tasksByHour.get(hour) ?? []
                  const showNow =
                    selectedDate === today &&
                    hour === nowHour &&
                    nowHour >= startHour &&
                    nowHour <= endHour
                  return (
                    <div className="timeline-hour" key={hour}>
                      <span className="timeline-hour-label">
                        {String(hour).padStart(2, '0')}:00
                      </span>
                      <div className="timeline-slot">
                        {list.map((task) => (
                          <TimelineTask
                            key={task.id}
                            task={task}
                            onToggle={onToggle}
                            onEdit={onEdit}
                          />
                        ))}
                        {showNow && (
                          <span className="timeline-now">{nowLabel}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
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
