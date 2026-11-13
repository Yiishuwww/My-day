import Dexie, { type Table } from 'dexie'
import type { Priority, Recurrence, Subtask, Task } from './types'
import {
  addDaysKey,
  daysBetweenKeys,
  nextRecurrenceDate,
  todayKey,
} from './lib/dates'
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

export interface RangeDraft extends Omit<TaskDraft, 'date' | 'recurrence'> {
  start: string
  end: string
}

export type TaskPatch = Partial<Omit<Task, 'id' | 'createdAt'>>

class MyDayDatabase extends Dexie {
  tasks!: Table<Task, string>

  constructor() {
    super('myday')
    this.version(1).stores({
      tasks: '&id, date, completed, createdAt',
    })
    this.version(2)
      .stores({
        tasks: '&id, date, completed, createdAt, *tags, seriesId',
      })
      .upgrade(async (transaction) => {
        const table = transaction.table<Task, string>('tasks')
        const tasks = await table.toArray()
        const groups = new Map<string, Task[]>()

        for (const task of tasks) {
          const key = `${task.date ?? 'inbox'}|${task.priority}`
          const group = groups.get(key)
          if (group) group.push(task)
          else groups.set(key, [task])
        }

        for (const group of groups.values()) {
          group.sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1
            const aTime = a.time ?? '99:99'
            const bTime = b.time ?? '99:99'
            if (aTime !== bTime) return aTime < bTime ? -1 : 1
            return a.createdAt - b.createdAt
          })
          for (let index = 0; index < group.length; index += 1) {
            await table.update(group[index].id, { sortOrder: index })
          }
        }
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
    sortOrder: now,
  }
  await db.tasks.add(task)
  return task
}

/**
 * Create one task per day for a date range. Each instance is a normal task
 * so completion, subtasks, tags and the focus timer all keep working.
 */
export async function createTaskRange(draft: RangeDraft): Promise<number> {
  const { start, end } = draft
  if (!start || !end || start > end) throw new Error('invalid-range')
  const dayCount = daysBetweenKeys(start, end) + 1
  if (dayCount < 1 || dayCount > 366) throw new Error('range-too-long')

  const now = Date.now()
  const seriesId = uid()
  const tasks: Task[] = []
  let dateKey = start

  for (let index = 0; index < dayCount; index += 1) {
    tasks.push({
      id: uid(),
      title: draft.title.trim(),
      notes: draft.notes?.trim() ?? '',
      date: dateKey,
      time: draft.time || undefined,
      duration:
        draft.duration && draft.duration > 0 ? draft.duration : undefined,
      priority: draft.priority ?? 0,
      tags: draft.tags ? [...draft.tags] : [],
      subtasks: (draft.subtasks ?? []).map((subtask) => ({
        ...subtask,
        id: uid(),
        done: false,
      })),
      completed: false,
      createdAt: now + index,
      updatedAt: now + index,
      sortOrder: now + index,
      seriesId,
      rangeStart: start,
      rangeEnd: end,
    })
    dateKey = addDaysKey(dateKey, 1)
  }

  await db.tasks.bulkAdd(tasks)
  return tasks.length
}

export async function updateTask(id: string, patch: TaskPatch): Promise<void> {
  const existing = await db.tasks.get(id)
  if (!existing) return

  const nextPatch: TaskPatch = { ...patch }
  const dateChanged =
    Object.prototype.hasOwnProperty.call(patch, 'date') &&
    patch.date !== existing.date
  const priorityChanged =
    patch.priority !== undefined && patch.priority !== existing.priority

  if (dateChanged || priorityChanged) {
    nextPatch.sortOrder = patch.date ? Date.now() : undefined
  }

  await db.tasks.update(id, { ...nextPatch, updatedAt: Date.now() })
}

export async function deleteTask(id: string): Promise<void> {
  await db.tasks.delete(id)
}

export async function deleteTaskSeries(seriesId: string): Promise<number> {
  return db.tasks.where('seriesId').equals(seriesId).delete()
}

export async function moveTasksToDate(
  ids: string[],
  date: string,
): Promise<void> {
  if (!ids.length) return
  const now = Date.now()
  await db.transaction('rw', db.tasks, async () => {
    for (let index = 0; index < ids.length; index += 1) {
      await db.tasks.update(ids[index], {
        date,
        sortOrder: now + index,
        updatedAt: now,
      })
    }
  })
}

export async function reorderTasks(ids: string[]): Promise<void> {
  const now = Date.now()
  await db.transaction('rw', db.tasks, async () => {
    for (let index = 0; index < ids.length; index += 1) {
      await db.tasks.update(ids[index], {
        sortOrder: index,
        updatedAt: now,
      })
    }
  })
}

export async function toggleSubtask(
  taskId: string,
  subtaskId: string,
): Promise<void> {
  const task = await db.tasks.get(taskId)
  if (!task) return
  const subtasks = task.subtasks.map((subtask) =>
    subtask.id === subtaskId ? { ...subtask, done: !subtask.done } : subtask,
  )
  await db.tasks.update(taskId, { subtasks, updatedAt: Date.now() })
}

export async function renameTag(from: string, to: string): Promise<number> {
  const source = from.replace(/^#+/, '').trim()
  const target = to.replace(/^#+/, '').trim()
  if (!source || !target || source === target) return 0

  const affected = await db.tasks.where('tags').equals(source).toArray()
  if (!affected.length) return 0

  await db.transaction('rw', db.tasks, async () => {
    for (const task of affected) {
      const tags = Array.from(
        new Set(task.tags.map((tag) => (tag === source ? target : tag))),
      )
      await db.tasks.update(task.id, { tags, updatedAt: Date.now() })
    }
  })
  return affected.length
}

export async function deleteTag(tag: string): Promise<number> {
  const name = tag.replace(/^#+/, '').trim()
  if (!name) return 0

  const affected = await db.tasks.where('tags').equals(name).toArray()
  if (!affected.length) return 0

  await db.transaction('rw', db.tasks, async () => {
    for (const task of affected) {
      const tags = task.tags.filter((item) => item !== name)
      await db.tasks.update(task.id, { tags, updatedAt: Date.now() })
    }
  })
  return affected.length
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
