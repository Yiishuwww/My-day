import { useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  List,
  Plus,
  Repeat,
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

type DayView = 'list' | 'timeline'

const DEFAULT_START_HOUR = 8
const DEFAULT_END_HOUR = 20
const HOUR_HEIGHT = 52
const GRID_TOP = 12

interface LaidOutEvent {
  task: Task
  start: number
  end: number
  column: number
  columns: number
  top: number
  height: number
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, minutes))
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(
    clamped % 60,
  ).padStart(2, '0')}`
}

function eventDuration(task: Task): number {
  return task.duration && task.duration > 0 ? task.duration : 30
}

function layoutTimelineEvents(
  tasks: Task[],
  startHour: number,
  endHour: number,
): LaidOutEvent[] {
  const maxMinutes = (endHour + 1) * 60
  const sorted = tasks
    .filter((task) => Boolean(task.time))
    .map((task) => {
      const start = timeToMinutes(task.time as string)
      return {
        task,
        start,
        end: Math.min(start + eventDuration(task), maxMinutes),
      }
    })
    .sort((a, b) => a.start - b.start || a.end - b.end)

  const laidOut: LaidOutEvent[] = []
  let cluster: Array<{ task: Task; start: number; end: number }> = []
  let clusterEnd = -1

  const flush = (): void => {
    if (!cluster.length) return
    const columnEnds: number[] = []
    const placed = cluster.map((event) => {
      let column = columnEnds.findIndex((end) => end <= event.start)
      if (column === -1) {
        column = columnEnds.length
        columnEnds.push(event.end)
      } else {
        columnEnds[column] = event.end
      }
      return { ...event, column }
    })
    const columns = Math.max(1, columnEnds.length)
    for (const event of placed) {
      laidOut.push({
        ...event,
        columns,
        top: ((event.start - startHour * 60) / 60) * HOUR_HEIGHT,
        height: Math.max(
          24,
          ((event.end - event.start) / 60) * HOUR_HEIGHT - 2,
        ),
      })
    }
    cluster = []
    clusterEnd = -1
  }

  for (const event of sorted) {
    if (cluster.length && event.start >= clusterEnd) flush()
    cluster.push(event)
    clusterEnd = Math.max(clusterEnd, event.end)
  }
  flush()
  return laidOut
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
}: Props) {
  const today = todayKey()
  const weekStart = startOfWeekKey(selectedDate)
  const [showDone, setShowDone] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [view, setView] = useState<DayView>('timeline')
  const [now, setNow] = useState(() => new Date())

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
  const timedTasks = useMemo(
    () => dayTasks.filter((task) => Boolean(task.time)),
    [dayTasks],
  )
  const untimedTasks = useMemo(
    () => dayTasks.filter((task) => !task.time),
    [dayTasks],
  )

  const nowHour = now.getHours()
  const eventStartHours = timedTasks.map((task) =>
    Math.floor(timeToMinutes(task.time as string) / 60),
  )
  const eventEndHours = timedTasks.map((task) =>
    Math.ceil(
      (timeToMinutes(task.time as string) + eventDuration(task)) / 60,
    ),
  )
  const startHour = Math.max(
    0,
    Math.min(
      DEFAULT_START_HOUR,
      ...eventStartHours,
      selectedDate === today ? nowHour : DEFAULT_START_HOUR,
    ),
  )
  const endHour = Math.min(
    23,
    Math.max(
      DEFAULT_END_HOUR,
      ...eventEndHours,
      selectedDate === today ? nowHour : DEFAULT_END_HOUR,
    ),
  )
  const hours = Array.from(
    { length: endHour - startHour + 1 },
    (_, index) => startHour + index,
  )
  const timelineHeight = GRID_TOP + hours.length * HOUR_HEIGHT
  const laidOutEvents = useMemo(
    () => layoutTimelineEvents(timedTasks, startHour, endHour),
    [timedTasks, startHour, endHour],
  )

  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const showNow =
    selectedDate === today &&
    nowMinutes >= startHour * 60 &&
    nowMinutes <= endHour * 60 + 59
  const nowTop =
    GRID_TOP + ((nowMinutes - startHour * 60) / 60) * HOUR_HEIGHT
  const nowLabel = `现在 ${minutesToTime(nowMinutes)}`

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

        {dayTasks.length > 0 && (
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

        {view === 'list' && open.length > 0 && (
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

        {view === 'timeline' && timedTasks.length > 0 && (
          <div
            className="timeline-calendar"
            style={{ height: timelineHeight }}
          >
            <div className="timeline-rail" aria-hidden="true">
              {hours.map((hour, index) => (
                <span
                  className="timeline-hour-label"
                  key={hour}
                  style={{ top: GRID_TOP + index * HOUR_HEIGHT }}
                >
                  {String(hour).padStart(2, '0')}:00
                </span>
              ))}
            </div>

            <div className="timeline-canvas">
              {hours.map((hour, index) => (
                <span
                  className="timeline-hour-line"
                  key={hour}
                  style={{ top: GRID_TOP + index * HOUR_HEIGHT }}
                />
              ))}

              {laidOutEvents.map(({ task, column, columns, top, height }) => {
                const endLabel = minutesToTime(
                  timeToMinutes(task.time as string) + eventDuration(task),
                )
                const timeLabel = `${task.time}${
                  task.duration ? `–${endLabel}` : ''
                }`
                const compact = height < 44
                return (
                  <button
                    type="button"
                    key={task.id}
                    className={cx(
                      'cal-event',
                      compact && 'is-compact',
                      task.completed && 'is-done',
                    )}
                    style={{
                      top: GRID_TOP + top,
                      height,
                      left: `calc(${(column / columns) * 100}% + 2px)`,
                      width: `calc(${100 / columns}% - 4px)`,
                    }}
                    onClick={() => onEdit(task)}
                    aria-label={`编辑日程：${task.title}`}
                    title={`${task.title} · ${timeLabel}`}
                  >
                    <span
                      className={cx(
                        'cal-event-title-row',
                        compact && 'is-compact',
                      )}
                    >
                      <span className="cal-event-title">{task.title}</span>
                      {compact ? (
                        <span className="cal-event-time-inline">
                          {timeLabel}
                        </span>
                      ) : (
                        task.recurrence && (
                          <Repeat size={10} className="cal-event-repeat" />
                        )
                      )}
                    </span>
                    {!compact && (
                      <span className="cal-event-time">{timeLabel}</span>
                    )}
                  </button>
                )
              })}

              {showNow && (
                <span
                  className="timeline-now-line"
                  style={{ top: nowTop }}
                  aria-hidden="true"
                >
                  <span className="timeline-now-label">{nowLabel}</span>
                </span>
              )}
            </div>
          </div>
        )}

        {view === 'timeline' &&
          dayTasks.length > 0 &&
          timedTasks.length === 0 && (
            <div className="timeline-empty">
              <Clock size={16} />
              这一天没有带时间的安排
            </div>
          )}

        {view === 'timeline' && untimedTasks.length > 0 && (
          <button
            type="button"
            className="timeline-list-link"
            onClick={() => changeView('list')}
          >
            <List size={14} />
            {untimedTasks.length} 个未安排时间的任务
          </button>
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
