import { getDay } from 'date-fns'
import type { Habit } from '../types'
import { addDaysKey, fromKey, todayKey } from './dates'

export const WEEKDAY_OPTIONS = [
  { value: 1, label: '一' },
  { value: 2, label: '二' },
  { value: 3, label: '三' },
  { value: 4, label: '四' },
  { value: 5, label: '五' },
  { value: 6, label: '六' },
  { value: 7, label: '日' },
]

const WEEKDAY_LABELS: Record<number, string> = {
  1: '周一',
  2: '周二',
  3: '周三',
  4: '周四',
  5: '周五',
  6: '周六',
  7: '周日',
}

export function isoWeekday(key: string): number {
  const day = getDay(fromKey(key))
  return day === 0 ? 7 : day
}

export function isHabitDue(habit: Habit, key: string): boolean {
  if (habit.schedule === 'daily') return true
  if (habit.schedule === 'weekdays') {
    const day = isoWeekday(key)
    return day >= 1 && day <= 5
  }
  return habit.weekdays.includes(isoWeekday(key))
}

export function isHabitChecked(habit: Habit, key: string): boolean {
  return habit.checkins.includes(key)
}

export function habitStreak(habit: Habit, base = todayKey()): number {
  let cursor = base
  if (isHabitDue(habit, base) && !isHabitChecked(habit, base)) {
    cursor = addDaysKey(cursor, -1)
  }

  let streak = 0
  for (let index = 0; index < 4000; index += 1) {
    if (isHabitDue(habit, cursor)) {
      if (!isHabitChecked(habit, cursor)) break
      streak += 1
    }
    cursor = addDaysKey(cursor, -1)
  }
  return streak
}

export function habitScheduleLabel(habit: Habit): string {
  if (habit.schedule === 'daily') return '每天'
  if (habit.schedule === 'weekdays') return '工作日'
  if (!habit.weekdays.length) return '自定义'
  return habit.weekdays.map((day) => WEEKDAY_LABELS[day]).join('、')
}
