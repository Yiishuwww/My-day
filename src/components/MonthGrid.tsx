import { addDays, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from 'date-fns'
import type { Task } from '../types'
import {
  WEEKDAY_CHARS,
  fromKey,
  humanDateWithWeekday,
  toKey,
  todayKey,
} from '../lib/dates'
import { cx } from '../lib/utils'

interface Props {
  monthKey: string
  selectedDate: string
  tasks: Task[]
  onSelect: (date: string) => void
}

const MONDAY_FIRST = [
  WEEKDAY_CHARS[1],
  WEEKDAY_CHARS[2],
  WEEKDAY_CHARS[3],
  WEEKDAY_CHARS[4],
  WEEKDAY_CHARS[5],
  WEEKDAY_CHARS[6],
  WEEKDAY_CHARS[0],
]

export function MonthGrid({
  monthKey,
  selectedDate,
  tasks,
  onSelect,
}: Props) {
  const monthStart = startOfMonth(fromKey(monthKey))
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 })
  const days: Date[] = []
  for (let date = gridStart; date <= gridEnd; date = addDays(date, 1)) {
    days.push(date)
  }

  const counts = new Map<string, { total: number; open: number }>()
  for (const task of tasks) {
    if (!task.date) continue
    const entry = counts.get(task.date) ?? { total: 0, open: 0 }
    entry.total += 1
    if (!task.completed) entry.open += 1
    counts.set(task.date, entry)
  }

  const monthNumber = monthStart.getMonth()
  const today = todayKey()

  return (
    <div className="month-grid">
      <div className="month-weekdays" aria-hidden="true">
        {MONDAY_FIRST.map((label) => (
          <span key={label} className="month-weekday">
            {label}
          </span>
        ))}
      </div>
      <div className="month-days">
        {days.map((date) => {
          const key = toKey(date)
          const count = counts.get(key)
          const outside = date.getMonth() !== monthNumber
          return (
            <button
              key={key}
              type="button"
              data-date={key}
              className={cx(
                'month-cell',
                outside && 'is-outside',
                key === selectedDate && 'is-selected',
                key === today && 'is-today',
              )}
              onClick={() => onSelect(key)}
              aria-label={humanDateWithWeekday(key)}
              aria-pressed={key === selectedDate}
            >
              <span className="month-date">{date.getDate()}</span>
              <span className="month-dot-wrap">
                {count && (
                  <span
                    className={cx('month-dot', count.open === 0 && 'done')}
                  />
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
