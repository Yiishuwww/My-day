import { addDays, addMinutes, format, parseISO } from 'date-fns'
import type { Task } from '../types'

function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

function foldLine(line: string): string[] {
  const encoder = new TextEncoder()
  if (encoder.encode(line).length <= 75) return [line]

  const parts: string[] = []
  let current = ''
  let bytes = 0

  for (const char of line) {
    const size = encoder.encode(char).length
    if (bytes + size > 74) {
      parts.push(current)
      current = ' '
      bytes = 1
    }
    current += char
    bytes += size
  }
  if (current) parts.push(current)
  return parts
}

function utcStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function recurrenceRule(task: Task): string | undefined {
  if (task.recurrence === 'daily') return 'FREQ=DAILY'
  if (task.recurrence === 'weekly') return 'FREQ=WEEKLY'
  if (task.recurrence === 'weekdays') return 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'
  return undefined
}

function eventLines(task: Task): string[] {
  if (!task.date) return []

  const lines: string[] = [
    'BEGIN:VEVENT',
    `UID:${task.id}@myday`,
    `DTSTAMP:${utcStamp(new Date())}`,
  ]

  if (task.time) {
    const start = parseISO(`${task.date}T${task.time}`)
    const end = addMinutes(start, task.duration && task.duration > 0 ? task.duration : 30)
    lines.push(`DTSTART:${format(start, "yyyyMMdd'T'HHmmss")}`)
    lines.push(`DTEND:${format(end, "yyyyMMdd'T'HHmmss")}`)
  } else {
    lines.push(`DTSTART;VALUE=DATE:${task.date.replace(/-/g, '')}`)
    lines.push(
      `DTEND;VALUE=DATE:${format(addDays(parseISO(task.date), 1), 'yyyyMMdd')}`,
    )
  }

  lines.push(`SUMMARY:${escapeText(task.title)}`)

  const description = [
    task.notes.trim(),
    task.tags.length
      ? `标签：${task.tags.map((tag) => `#${tag}`).join(' ')}`
      : '',
    task.subtasks.length
      ? `子任务：\n${task.subtasks
          .map((subtask) => `${subtask.done ? '✓' : '○'} ${subtask.title}`)
          .join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  if (description) lines.push(`DESCRIPTION:${escapeText(description)}`)
  if (task.tags.length) {
    lines.push(`CATEGORIES:${task.tags.map(escapeText).join(',')}`)
  }

  const rule = recurrenceRule(task)
  if (rule) lines.push(`RRULE:${rule}`)

  if (task.time) {
    lines.push(
      'BEGIN:VALARM',
      'TRIGGER:-PT10M',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(task.title)}`,
      'END:VALARM',
    )
  }

  lines.push('END:VEVENT')
  return lines
}

export function buildIcs(tasks: Task[]): string {
  const visible = tasks
    .filter((task) => task.date && !task.completed)
    .sort((a, b) =>
      `${a.date ?? ''}${a.time ?? ''}`.localeCompare(`${b.date ?? ''}${b.time ?? ''}`),
    )

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MyDay//Task Calendar//CN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:今日',
    ...visible.flatMap(eventLines),
    'END:VCALENDAR',
  ]

  return `${lines.flatMap(foldLine).join('\r\n')}\r\n`
}
