import { db } from '../db'
import type { Priority, Recurrence, Subtask, Task } from '../types'
import { todayKey } from './dates'
import { buildIcs } from './ics'
import { saveFile } from './files'
import { uid } from './utils'

function validDate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return undefined
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined
  }
  return value
}

function validTime(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const match = value.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return undefined
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return undefined
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function normalizeSubtasks(value: unknown): Subtask[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === 'object',
    )
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : uid(),
      title: typeof item.title === 'string' ? item.title : '',
      done: item.done === true,
    }))
    .filter((item) => item.title.trim().length > 0)
}

function normalizeTask(raw: unknown): Task | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string' || typeof r.title !== 'string' || !r.title.trim()) {
    return null
  }

  const now = Date.now()
  const priority: Priority = r.priority === 2 ? 2 : r.priority === 1 ? 1 : 0
  const date = validDate(r.date)
  const recurrence: Recurrence | undefined =
    date &&
    (r.recurrence === 'daily' ||
      r.recurrence === 'weekly' ||
      r.recurrence === 'weekdays')
      ? r.recurrence
      : undefined

  return {
    id: r.id,
    title: r.title.trim(),
    notes: typeof r.notes === 'string' ? r.notes : '',
    date,
    time: date ? validTime(r.time) : undefined,
    duration:
      typeof r.duration === 'number' && r.duration > 0
        ? Math.round(r.duration)
        : undefined,
    priority,
    tags: Array.isArray(r.tags)
      ? Array.from(
          new Set(
            r.tags
              .filter((tag): tag is string => typeof tag === 'string')
              .map((tag) => tag.trim())
              .filter(Boolean),
          ),
        )
      : [],
    subtasks: normalizeSubtasks(r.subtasks),
    recurrence,
    completed: r.completed === true,
    completedAt:
      typeof r.completedAt === 'number' ? r.completedAt : undefined,
    createdAt: typeof r.createdAt === 'number' ? r.createdAt : now,
    updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : now,
  }
}

export async function exportBackup(): Promise<boolean> {
  const tasks = await db.tasks.toArray()
  const payload = {
    app: 'myday',
    version: 1,
    exportedAt: new Date().toISOString(),
    tasks,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  })
  return saveFile(`myday-backup-${todayKey()}.json`, blob)
}

export async function exportCalendar(tasks: Task[]): Promise<boolean> {
  const blob = new Blob([buildIcs(tasks)], { type: 'text/calendar' })
  return saveFile(`myday-${todayKey()}.ics`, blob)
}

export async function importBackup(file: File): Promise<number> {
  const text = await file.text()
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('invalid-json')
  }

  const rawList = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { tasks?: unknown }).tasks)
      ? (data as { tasks: unknown[] }).tasks
      : null

  if (!rawList) throw new Error('invalid-format')

  const normalized = rawList
    .map(normalizeTask)
    .filter((task): task is Task => task !== null)
  if (rawList.length > 0 && normalized.length === 0) {
    throw new Error('no-valid-tasks')
  }

  const unique = Array.from(new Map(normalized.map((task) => [task.id, task])).values())
  await db.transaction('rw', db.tasks, async () => {
    await db.tasks.clear()
    if (unique.length) await db.tasks.bulkAdd(unique)
  })
  return unique.length
}

export async function clearAllTasks(): Promise<void> {
  await db.tasks.clear()
}
