import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'

const { default: Dexie } = await import('dexie')

interface SeedTask {
  id: string
  title: string
  notes: string
  date: string
  time?: string
  priority: 0 | 1 | 2
  tags: string[]
  subtasks: Array<{ id: string; title: string; done: boolean }>
  completed: boolean
  createdAt: number
  updatedAt: number
}

const legacy = new Dexie('myday')
legacy.version(1).stores({
  tasks: '&id, date, completed, createdAt',
})
await legacy.open()

const seed: SeedTask[] = [
  {
    id: 'a',
    title: '上午低',
    notes: '',
    date: '2026-11-13',
    time: '09:00',
    priority: 0,
    tags: ['工作'],
    subtasks: [{ id: 'sub-a', title: '准备', done: false }],
    completed: false,
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: 'b',
    title: '下午低',
    notes: '',
    date: '2026-11-13',
    time: '15:00',
    priority: 0,
    tags: ['生活'],
    subtasks: [],
    completed: false,
    createdAt: 2,
    updatedAt: 2,
  },
  {
    id: 'c',
    title: '高优先级',
    notes: '',
    date: '2026-11-13',
    time: '12:00',
    priority: 2,
    tags: ['工作', '重要'],
    subtasks: [],
    completed: false,
    createdAt: 3,
    updatedAt: 3,
  },
]
await legacy.table('tasks').bulkAdd(seed)
legacy.close()

const {
  db,
  createTaskRange,
  deleteTaskSeries,
  deleteTag,
  renameTag,
  reorderTasks,
  toggleSubtask,
} = await import('../src/db')
const { importBackup } = await import('../src/lib/backup')

try {
  await db.open()
  const migrated = await db.tasks.toArray()
  assert.equal(migrated.length, 3, 'migration preserved tasks')
  const byId = new Map(migrated.map((task) => [task.id, task]))
  const a = byId.get('a')
  const b = byId.get('b')
  const c = byId.get('c')
  assert.ok(a && b && c, 'migrated tasks present')
  assert.equal(typeof a?.sortOrder, 'number', 'sortOrder assigned')
  assert.equal(typeof b?.sortOrder, 'number', 'sortOrder assigned')
  assert.equal(typeof c?.sortOrder, 'number', 'sortOrder assigned')
  assert.ok(
    (a?.sortOrder ?? 0) < (b?.sortOrder ?? 0),
    'migration preserves time order inside priority',
  )

  assert.equal(
    await db.tasks.where('tags').equals('工作').count(),
    2,
    'tags multi-entry index works',
  )

  await toggleSubtask('a', 'sub-a')
  const aToggled = await db.tasks.get('a')
  assert.equal(aToggled?.subtasks[0]?.done, true, 'toggleSubtask works')

  const rangeCount = await createTaskRange({
    title: '连续任务',
    notes: '每天做一点',
    start: '2026-11-13',
    end: '2026-11-15',
    time: '08:00',
    duration: 30,
    priority: 1,
    tags: ['健康'],
    subtasks: [{ id: 'range-sub', title: '热身', done: false }],
  })
  assert.equal(rangeCount, 3, 'range creates one task per day')
  const rangeTasks = await db.tasks
    .where('seriesId')
    .above('')
    .filter((task) => task.title === '连续任务')
    .toArray()
  assert.equal(rangeTasks.length, 3, 'range tasks persisted')
  assert.ok(
    rangeTasks.every(
      (task) =>
        task.rangeStart === '2026-11-13' &&
        task.rangeEnd === '2026-11-15' &&
        task.time === '08:00' &&
        task.duration === 30,
    ),
    'range fields copied to each day',
  )
  const subtaskIds = new Set(
    rangeTasks.flatMap((task) => task.subtasks.map((subtask) => subtask.id)),
  )
  assert.equal(subtaskIds.size, 3, 'range subtasks are independent per day')

  const seriesId = rangeTasks[0]?.seriesId
  assert.ok(seriesId, 'range has series id')
  assert.equal(
    await deleteTaskSeries(seriesId as string),
    3,
    'delete series removes all days',
  )

  const renamed = await renameTag('生活', '日常')
  assert.equal(renamed, 1, 'renameTag updates one task')
  assert.equal(
    await db.tasks.where('tags').equals('日常').count(),
    1,
    'renamed tag indexed',
  )
  await deleteTag('日常')
  const bAfter = await db.tasks.get('b')
  assert.ok(!bAfter?.tags.includes('日常'), 'deleteTag removes tag')

  await reorderTasks(['b', 'a'])
  const aReordered = await db.tasks.get('a')
  const bReordered = await db.tasks.get('b')
  assert.ok(
    (bReordered?.sortOrder ?? 0) < (aReordered?.sortOrder ?? 0),
    'manual reorder persists',
  )

  const backup = {
    app: 'myday',
    version: 1,
    tasks: [
      {
        id: 'series-import',
        title: '日期段导入',
        notes: '',
        date: '2026-11-13',
        time: '08:00',
        duration: 30,
        priority: 1,
        tags: ['健康'],
        subtasks: [{ id: 'import-sub', title: '热身', done: true }],
        completed: false,
        createdAt: 4,
        updatedAt: 4,
        sortOrder: 42,
        seriesId: 'series-x',
        rangeStart: '2026-11-13',
        rangeEnd: '2026-11-15',
      },
      {
        id: 'normal-import',
        title: '普通导入',
        notes: '',
        priority: 0,
        tags: ['工作'],
        subtasks: [],
        completed: false,
        createdAt: 5,
        updatedAt: 5,
        sortOrder: 7,
      },
    ],
  }
  const importedCount = await importBackup(
    new File([JSON.stringify(backup)], 'backup.json', {
      type: 'application/json',
    }),
  )
  assert.equal(importedCount, 2, 'backup import count')
  const importedSeries = await db.tasks.get('series-import')
  assert.equal(importedSeries?.seriesId, 'series-x', 'series id survives import')
  assert.equal(
    importedSeries?.rangeStart,
    '2026-11-13',
    'range start survives import',
  )
  assert.equal(
    importedSeries?.rangeEnd,
    '2026-11-15',
    'range end survives import',
  )
  assert.equal(
    importedSeries?.sortOrder,
    42,
    'manual order survives import',
  )
  assert.equal(
    importedSeries?.subtasks[0]?.done,
    true,
    'subtask state survives import',
  )

  console.log('✓ DB migration, import and data helpers passed')
} finally {
  db.close()
  await Dexie.delete('myday')
}
