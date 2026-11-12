import {
  addDays,
  differenceInCalendarDays,
  format,
  getDay,
  parseISO,
  startOfWeek,
} from 'date-fns'
import type { Recurrence, Task } from '../types'

export const WEEKDAY_CHARS = ['日', '一', '二', '三', '四', '五', '六'] as const

export function toKey(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function fromKey(key: string): Date {
  return parseISO(key)
}

export function todayKey(): string {
  return toKey(new Date())
}

export function addDaysKey(key: string, days: number): string {
  return toKey(addDays(fromKey(key), days))
}

export function weekdayLabel(key: string): string {
  return `周${WEEKDAY_CHARS[getDay(fromKey(key))]}`
}

export function humanDate(key: string): string {
  const date = fromKey(key)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

export function humanDateWithWeekday(key: string): string {
  return `${humanDate(key)} ${weekdayLabel(key)}`
}

export function monthLabel(key: string): string {
  return format(fromKey(key), 'yyyy年M月')
}

export function startOfWeekKey(key: string): string {
  return toKey(startOfWeek(fromKey(key), { weekStartsOn: 1 }))
}

export function weekKeys(startKey: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDaysKey(startKey, index))
}

export function daysUntil(key: string, base = todayKey()): number {
  return differenceInCalendarDays(fromKey(key), fromKey(base))
}

export function relativeDayLabel(key: string): string {
  const diff = daysUntil(key)
  if (diff === 0) return '今天'
  if (diff === 1) return '明天'
  if (diff === -1) return '昨天'
  if (diff > 1 && diff < 7) return `${diff} 天后`
  if (diff < -1 && diff > -7) return `${-diff} 天前`
  return ''
}

export function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 5) return '夜深了'
  if (hour < 11) return '早上好'
  if (hour < 13) return '中午好'
  if (hour < 18) return '下午好'
  if (hour < 23) return '晚上好'
  return '夜深了'
}

export function humanDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}分钟`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours}小时${rest}分` : `${hours}小时`
}

export function nextRecurrenceDate(key: string, recurrence: Recurrence): string {
  if (recurrence === 'daily') return addDaysKey(key, 1)
  if (recurrence === 'weekly') return addDaysKey(key, 7)
  let next = addDaysKey(key, 1)
  while ([0, 6].includes(getDay(fromKey(next)))) {
    next = addDaysKey(next, 1)
  }
  return next
}

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    const aTime = a.time ?? '99:99'
    const bTime = b.time ?? '99:99'
    if (aTime !== bTime) return aTime < bTime ? -1 : 1
    if (a.priority !== b.priority) return b.priority - a.priority
    return a.createdAt - b.createdAt
  })
}
