import { useEffect, useMemo, useRef, useState } from 'react'
import { addDays, startOfWeek } from 'date-fns'
import { humanDateWithWeekday, toKey } from '../lib/dates'

export type HeatmapMetric = 'tasks' | 'focus' | 'habits'

interface Props {
  values: Map<string, number>
  metric: HeatmapMetric
  weeks?: number
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

function levelFor(metric: HeatmapMetric, value: number): number {
  if (value <= 0) return 0
  if (metric === 'tasks') {
    if (value === 1) return 1
    if (value === 2) return 2
    if (value <= 4) return 3
    return 4
  }
  if (metric === 'focus') {
    if (value <= 15) return 1
    if (value <= 30) return 2
    if (value <= 60) return 3
    return 4
  }
  if (value === 1) return 1
  if (value === 2) return 2
  if (value === 3) return 3
  return 4
}

function valueLabel(metric: HeatmapMetric, value: number): string {
  if (metric === 'tasks') return `${value} 个任务`
  if (metric === 'focus') return `${value} 分钟专注`
  return `${value} 次打卡`
}

export function Heatmap({ values, metric, weeks = 26 }: Props) {
  // Capture "now" once per mount: a fixed reference keeps the grid stable
  // across re-renders while still reflecting the day the view was opened.
  const [now] = useState(() => new Date())
  const { today, start } = useMemo(() => {
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 })
    return {
      today: toKey(now),
      start: addDays(currentWeekStart, -(weeks - 1) * 7),
    }
  }, [now, weeks])
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = scrollRef.current
    if (element) element.scrollLeft = element.scrollWidth
  }, [])

  const columns = Array.from({ length: weeks }, (_, weekIndex) => {
    return Array.from({ length: 7 }, (_, dayIndex) => {
      const date = addDays(start, weekIndex * 7 + dayIndex)
      const key = toKey(date)
      const future = key > today
      const value = values.get(key) ?? 0
      return {
        key,
        future,
        value,
        level: future ? 0 : levelFor(metric, value),
      }
    })
  })

  return (
    <div className="heatmap">
      <div className="heatmap-body">
        <div className="heatmap-weekdays" aria-hidden="true">
          {WEEKDAY_LABELS.map((label) => (
            <span key={label}>{label === '二' || label === '四' || label === '六' ? '' : label}</span>
          ))}
        </div>
        <div className="heatmap-scroll" ref={scrollRef}>
          <div className="heatmap-weeks">
            {columns.map((week, index) => (
              <div className="heatmap-week" key={index}>
                {week.map((cell) => (
                  <span
                    key={cell.key}
                    data-date={cell.future ? undefined : cell.key}
                    className={
                      cell.future
                        ? 'heat-cell is-future'
                        : `heat-cell level-${cell.level}`
                    }
                    title={
                      cell.future
                        ? undefined
                        : `${humanDateWithWeekday(cell.key)} · ${valueLabel(metric, cell.value)}`
                    }
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="heatmap-legend" aria-hidden="true">
        <span>少</span>
        <span className="heat-cell level-0" />
        <span className="heat-cell level-1" />
        <span className="heat-cell level-2" />
        <span className="heat-cell level-3" />
        <span className="heat-cell level-4" />
        <span>多</span>
      </div>
    </div>
  )
}
