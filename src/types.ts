export type Priority = 0 | 1 | 2
export type Recurrence = 'daily' | 'weekly' | 'weekdays'
export type ThemeMode = 'system' | 'light' | 'dark'

export interface Subtask {
  id: string
  title: string
  done: boolean
}

export interface Task {
  id: string
  title: string
  notes: string
  /** YYYY-MM-DD, local calendar date */
  date?: string
  /** HH:mm, local time */
  time?: string
  /** estimated duration in minutes */
  duration?: number
  priority: Priority
  tags: string[]
  subtasks: Subtask[]
  recurrence?: Recurrence
  completed: boolean
  completedAt?: number
  createdAt: number
  updatedAt: number
  /** Manual order inside the same priority bucket. */
  sortOrder?: number
  /** Present when this task is one day of a date-range series. */
  seriesId?: string
  rangeStart?: string
  rangeEnd?: string
}

export interface TrashEntry {
  id: string
  task: Task
  deletedAt: number
}

export type HabitSchedule = 'daily' | 'weekdays' | 'custom'

export interface Habit {
  id: string
  name: string
  schedule: HabitSchedule
  /** ISO weekdays: 1 = Monday ... 7 = Sunday */
  weekdays: number[]
  /** Dates completed, YYYY-MM-DD */
  checkins: string[]
  createdAt: number
  updatedAt: number
}

export interface FocusSession {
  id: string
  taskId?: string
  taskTitle: string
  durationSec: number
  startedAt: number
  endedAt: number
}
