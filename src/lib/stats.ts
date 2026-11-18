import type { FocusSession, Habit, Task } from '../types'
import { toKey } from './dates'

export function completedTaskCountsByDate(
  tasks: Task[],
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const task of tasks) {
    if (!task.completed || !task.completedAt) continue
    const key = toKey(new Date(task.completedAt))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

export function focusMinutesByDate(
  sessions: FocusSession[],
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const session of sessions) {
    const key = toKey(new Date(session.endedAt))
    counts.set(
      key,
      (counts.get(key) ?? 0) + Math.round(session.durationSec / 60),
    )
  }
  return counts
}

export function habitCheckinsByDate(
  habits: Habit[],
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const habit of habits) {
    for (const date of habit.checkins) {
      counts.set(date, (counts.get(date) ?? 0) + 1)
    }
  }
  return counts
}

export function sumMapInRange(
  values: Map<string, number>,
  start: string,
  end: string,
): number {
  let total = 0
  for (const [key, value] of values) {
    if (key >= start && key <= end) total += value
  }
  return total
}
