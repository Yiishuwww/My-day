import Dexie, { type Table } from 'dexie'
import type { Priority, Recurrence, Subtask, Task } from './types'
import { nextRecurrenceDate, todayKey } from './lib/dates'
import { uid } from './lib/utils'

export interface TaskDraft {
  title: string
  notes?: string
  date?: string
  time?: string
  duration?: number
  priority?: Priority
  tags?: string[]
  subtasks?: Subtask[]
  recurrence?: Recurrence
}

export type TaskPatch = Partial<Omit<Task, 'id' | 'createdAt'>>

class MyDayDatabase extends Dexie {
  tasks!: Table<Task, string>

  constructor() {
    super('myday')
    this.version(1).stores({
      tasks: '&id, date, completed, createdAt',
    })
  }
}

export const db = new MyDayDatabase()

export async function createTask(draft: TaskDraft): Promise<Task> {
  const now = Date.now()
  const task: Task = {
    id: uid(),
    title: draft.title.trim(),
    notes: draft.notes?.trim() ?? '',
    date: draft.date || undefined,
    time: draft.date ? draft.time || undefined : undefined,
    duration: draft.duration && draft.duration > 0 ? draft.duration : undefined,
    priority: draft.priority ?? 0,
    tags: draft.tags ?? [],
    subtasks: draft.subtasks ?? [],
    recurrence: draft.recurrence,
    completed: false,
    createdAt: now,
    updatedAt: now,
  }
  await db.tasks.add(task)
  return task
}

export async function updateTask(id: string, patch: TaskPatch): Promise<void> {
  await db.tasks.update(id, { ...patch, updatedAt: Date.now() })
}

export async function deleteTask(id: string): Promise<void> {
  await db.tasks.delete(id)
}

export async function moveTasksToDate(ids: string[], date: string): Promise<void> {
  if (!ids.length) return
  const now = Date.now()
  await db.transaction('rw', db.tasks, async () => {
    for (const id of ids) {
      await db.tasks.update(id, { date, updatedAt: now })
    }
  })
}

export interface ToggleResult {
  spawned?: Task
}

export async function toggleTask(id: string): Promise<ToggleResult> {
  const task = await db.tasks.get(id)
  if (!task) return {}

  const now = Date.now()

  if (!task.completed) {
    await db.tasks.update(id, {
      completed: true,
      completedAt: now,
      updatedAt: now,
    })

    if (task.recurrence && task.date) {
      let next = nextRecurrenceDate(task.date, task.recurrence)
      const today = todayKey()
      let guard = 0
      while (next < today && guard < 3700) {
        next = nextRecurrenceDate(next, task.recurrence)
        guard += 1
      }

      const duplicate = await db.tasks
        .where('date')
        .equals(next)
        .filter(
          (candidate) =>
            !candidate.completed &&
            candidate.title === task.title &&
            candidate.recurrence === task.recurrence,
        )
        .first()
      if (duplicate) return {}

      const spawned = await createTask({
        title: task.title,
        notes: task.notes,
        date: next,
        time: task.time,
        duration: task.duration,
        priority: task.priority,
        tags: [...task.tags],
        subtasks: task.subtasks.map((subtask) => ({
          ...subtask,
          id: uid(),
          done: false,
        })),
        recurrence: task.recurrence,
      })
      return { spawned }
    }
  } else {
    await db.tasks.update(id, {
      completed: false,
      completedAt: undefined,
      updatedAt: now,
    })
  }

  return {}
}
