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
}
