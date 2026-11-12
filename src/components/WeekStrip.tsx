import { useRef } from 'react'
import { getDay } from 'date-fns'
import type { Task } from '../types'
import {
  WEEKDAY_CHARS,
  fromKey,
  humanDateWithWeekday,
  todayKey,
  weekKeys,
} from '../lib/dates'
import { cx } from '../lib/utils'

interface Props {
  weekStart: string
  selectedDate: string
  tasks: Task[]
  onSelect: (date: string) => void
  onPrevWeek: () => void
  onNextWeek: () => void
}

export function WeekStrip({
  weekStart,
  selectedDate,
  tasks,
  onSelect,
  onPrevWeek,
  onNextWeek,
}: Props) {
  const today = todayKey()
  const days = weekKeys(weekStart)
  const gestureStart = useRef<{ x: number; y: number } | null>(null)

  const counts = new Map<string, { total: number; open: number }>()
  for (const task of tasks) {
    if (!task.date) continue
    const entry = counts.get(task.date) ?? { total: 0, open: 0 }
    entry.total += 1
    if (!task.completed) entry.open += 1
    counts.set(task.date, entry)
  }

  return (
    <div
      className="week-strip"
      onTouchStart={(event) => {
        const touch = event.touches[0]
        if (touch) gestureStart.current = { x: touch.clientX, y: touch.clientY }
      }}
      onTouchEnd={(event) => {
        if (!gestureStart.current) return
        const touch = event.changedTouches[0]
        if (!touch) return
        const dx = touch.clientX - gestureStart.current.x
        const dy = touch.clientY - gestureStart.current.y
        gestureStart.current = null
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) {
          if (dx < 0) onNextWeek()
          else onPrevWeek()
        }
      }}
    >
      {days.map((key) => {
        const date = fromKey(key)
        const count = counts.get(key)
        const selected = key === selectedDate
        const isToday = key === today

        return (
          <button
            key={key}
            type="button"
            data-date={key}
            className={cx(
              'day-cell',
              selected && 'is-selected',
              isToday && 'is-today',
            )}
            onClick={() => onSelect(key)}
            aria-pressed={selected}
            aria-label={humanDateWithWeekday(key)}
          >
            <span className="dow">{WEEKDAY_CHARS[getDay(date)]}</span>
            <span className="date-num">{date.getDate()}</span>
            <span className="day-dot-wrap">
              {count && (
                <span className={cx('day-dot', count.open === 0 && 'done')} />
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
