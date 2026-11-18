import Dexie, { type Table } from 'dexie'
import type {
  FocusSession,
  Habit,
  HabitSchedule,
  Priority,
  Recurrence,
  Subtask,
  Task,
  TrashEntry,
} from './types'
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

export interface SeriesUpdate {
  title: string
  notes: string
  time?: string
  duration?: number
  priority: Priority
  tags: string[]
  start: string
  end: string
}

export interface SeriesUpdateResult {
  updated: number
  created: number
  removed: number
}

export type TaskPatch = Partial<Omit<Task, 'id' | 'createdAt'>>

class MyDayDatabase extends Dexie {
  tasks!: Table<Task, string>
  trash!: Table<TrashEntry, string>
  habits!: Table<Habit, string>
  focusSessions!: Table<FocusSession, string>

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
    this.version(3).stores({
      tasks: '&id, date, completed, createdAt, *tags, seriesId',
      trash: '&id, deletedAt',
    })
    this.version(4).stores({
      tasks: '&id, date, completed, createdAt, *tags, seriesId',
      trash: '&id, deletedAt',
      habits: '&id, createdAt',
      focusSessions: '&id, endedAt, taskId',
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

/**
 * Edit the shared fields of a date-range series. Completed days are kept
 * untouched as history. Missing days inside the new range are created, and
 * incomplete days outside the new range are removed.
 */
export async function updateTaskSeries(
  seriesId: string,
  update: SeriesUpdate,
): Promise<SeriesUpdateResult> {
  const { start, end } = update
  const title = update.title.trim()
  if (!title) throw new Error('empty-title')
  if (!start || !end || start > end) throw new Error('invalid-range')
  const dayCount = daysBetweenKeys(start, end) + 1
  if (dayCount < 1 || dayCount > 366) throw new Error('range-too-long')

  const existing = await db.tasks
    .where('seriesId')
    .equals(seriesId)
    .toArray()
  if (!existing.length) throw new Error('series-not-found')

  const byDate = new Map(existing.map((task) => [task.date, task]))
  const template =
    existing.find((task) => task.subtasks.length > 0) ?? existing[0]
  const now = Date.now()
  let updated = 0
  let created = 0
  let removed = 0

  const dates: string[] = []
  let cursor = start
  for (let index = 0; index < dayCount; index += 1) {
    dates.push(cursor)
    cursor = addDaysKey(cursor, 1)
  }

  await db.transaction('rw', db.tasks, async () => {
    for (const date of dates) {
      const task = byDate.get(date)
      if (!task) {
        const newTask: Task = {
          id: uid(),
          title,
          notes: update.notes.trim(),
          date,
          time: update.time || undefined,
          duration:
            update.duration && update.duration > 0
              ? update.duration
              : undefined,
          priority: update.priority,
          tags: [...update.tags],
          subtasks: template.subtasks.map((subtask) => ({
            ...subtask,
            id: uid(),
            done: false,
          })),
          completed: false,
          createdAt: now,
          updatedAt: now,
          sortOrder: now,
          seriesId,
          rangeStart: start,
          rangeEnd: end,
        }
        await db.tasks.add(newTask)
        created += 1
      } else if (!task.completed) {
        await db.tasks.update(task.id, {
          title,
          notes: update.notes.trim(),
          time: update.time || undefined,
          duration:
            update.duration && update.duration > 0
              ? update.duration
              : undefined,
          priority: update.priority,
          tags: [...update.tags],
          rangeStart: start,
          rangeEnd: end,
          updatedAt: now,
        })
        updated += 1
      }
    }

    for (const task of existing) {
      if (!task.date) continue
      if (task.date >= start && task.date <= end) continue
      if (task.completed) continue
      await db.tasks.delete(task.id)
      removed += 1
    }
  })

  return { updated, created, removed }
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

export async function trashTask(id: string): Promise<Task | undefined> {
  const task = await db.tasks.get(id)
  if (!task) return undefined
  await db.transaction('rw', db.tasks, db.trash, async () => {
    await db.trash.put({ id: task.id, task, deletedAt: Date.now() })
    await db.tasks.delete(id)
  })
  return task
}

export async function trashTasks(ids: string[]): Promise<Task[]> {
  const uniqueIds = Array.from(new Set(ids))
  if (!uniqueIds.length) return []
  const moved: Task[] = []
  await db.transaction('rw', db.tasks, db.trash, async () => {
    for (const id of uniqueIds) {
      const task = await db.tasks.get(id)
      if (!task) continue
      moved.push(task)
      await db.trash.put({ id: task.id, task, deletedAt: Date.now() })
      await db.tasks.delete(id)
    }
  })
  return moved
}

export async function deleteTask(id: string): Promise<void> {
  await trashTask(id)
}

export async function restoreTrashEntry(id: string): Promise<boolean> {
  const entry = await db.trash.get(id)
  if (!entry) return false
  let restored = false
  await db.transaction('rw', db.tasks, db.trash, async () => {
    const existing = await db.tasks.get(id)
    if (!existing) {
      await db.tasks.put(entry.task)
      restored = true
    }
    await db.trash.delete(id)
  })
  return restored
}

export async function restoreTrashEntries(ids: string[]): Promise<number> {
  const uniqueIds = Array.from(new Set(ids))
  let restored = 0
  await db.transaction('rw', db.tasks, db.trash, async () => {
    for (const id of uniqueIds) {
      const entry = await db.trash.get(id)
      if (!entry) continue
      const existing = await db.tasks.get(id)
      if (!existing) {
        await db.tasks.put(entry.task)
        restored += 1
      }
      await db.trash.delete(id)
    }
  })
  return restored
}

export async function permanentlyDeleteTrashEntry(id: string): Promise<void> {
  await db.trash.delete(id)
}

export async function emptyTrash(): Promise<void> {
  await db.trash.clear()
}

export async function purgeTrash(days = 30): Promise<number> {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return db.trash.where('deletedAt').below(cutoff).delete()
}

export async function deleteTaskSeries(seriesId: string): Promise<number> {
  return db.tasks.where('seriesId').equals(seriesId).delete()
}

export interface HabitInput {
  name: string
  schedule: HabitSchedule
  weekdays: number[]
}

function cleanWeekdays(days: number[]): number[] {
  return Array.from(
    new Set(days.filter((day) => Number.isInteger(day) && day >= 1 && day <= 7)),
  ).sort((a, b) => a - b)
}

export async function createHabit(input: HabitInput): Promise<Habit> {
  const now = Date.now()
  const habit: Habit = {
    id: uid(),
    name: input.name.trim(),
    schedule: input.schedule,
    weekdays: cleanWeekdays(input.weekdays),
    checkins: [],
    createdAt: now,
    updatedAt: now,
  }
  await db.habits.add(habit)
  return habit
}

export async function updateHabit(
  id: string,
  patch: HabitInput,
): Promise<void> {
  await db.habits.update(id, {
    name: patch.name.trim(),
    schedule: patch.schedule,
    weekdays: cleanWeekdays(patch.weekdays),
    updatedAt: Date.now(),
  })
}

export async function deleteHabit(id: string): Promise<void> {
  await db.habits.delete(id)
}

export async function toggleHabitCheckin(
  id: string,
  date: string,
): Promise<void> {
  const habit = await db.habits.get(id)
  if (!habit) return
  const checked = habit.checkins.includes(date)
  const checkins = checked
    ? habit.checkins.filter((item) => item !== date)
    : [...habit.checkins, date].sort()
  await db.habits.update(id, { checkins, updatedAt: Date.now() })
}

export interface FocusSessionInput {
  taskId?: string
  taskTitle: string
  durationSec: number
  startedAt: number
  endedAt: number
}

export async function recordFocusSession(
  input: FocusSessionInput,
): Promise<void> {
  if (!input.durationSec || input.durationSec <= 0) return
  const session: FocusSession = {
    id: uid(),
    taskId: input.taskId,
    taskTitle: input.taskTitle,
    durationSec: Math.round(input.durationSec),
    startedAt: input.startedAt,
    endedAt: input.endedAt,
  }
  await db.focusSessions.add(session)
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
