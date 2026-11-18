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
  purgeTrash,
  renameTag,
  reorderTasks,
  restoreTrashEntries,
  restoreTrashEntry,
  toggleSubtask,
  trashTask,
  trashTasks,
  updateTaskSeries,
  createHabit,
  updateHabit,
  toggleHabitCheckin,
  recordFocusSession,
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
  const completedRangeTask = rangeTasks.find(
    (task) => task.date === '2026-11-13',
  )
  assert.ok(completedRangeTask, 'range day exists')
  await db.tasks.update(completedRangeTask.id, {
    completed: true,
    completedAt: Date.now(),
  })

  const seriesUpdate = await updateTaskSeries(seriesId as string, {
    title: '新连续任务',
    notes: '更新过',
    time: '09:30',
    duration: 45,
    priority: 2,
    tags: ['学习'],
    start: '2026-11-12',
    end: '2026-11-16',
  })
  assert.deepEqual(
    seriesUpdate,
    { updated: 2, created: 2, removed: 0 },
    'series update counts',
  )
  const updatedSeries = await db.tasks
    .where('seriesId')
    .equals(seriesId as string)
    .toArray()
  assert.equal(updatedSeries.length, 5, 'series extend creates five days')
  const historyTask = updatedSeries.find(
    (task) => task.date === '2026-11-13',
  )
  assert.equal(
    historyTask?.title,
    '连续任务',
    'series edit leaves completed history untouched',
  )
  assert.equal(historyTask?.duration, 30, 'history duration unchanged')
  const updatedDay = updatedSeries.find(
    (task) => task.date === '2026-11-14',
  )
  assert.equal(updatedDay?.title, '新连续任务', 'series title updated')
  assert.equal(updatedDay?.time, '09:30', 'series time updated')
  assert.equal(updatedDay?.duration, 45, 'series duration updated')
  assert.equal(updatedDay?.priority, 2, 'series priority updated')
  assert.deepEqual(updatedDay?.tags, ['学习'], 'series tags updated')
  assert.equal(updatedDay?.rangeStart, '2026-11-12', 'series start updated')
  assert.equal(updatedDay?.rangeEnd, '2026-11-16', 'series end updated')
  assert.ok(
    updatedSeries.some((task) => task.date === '2026-11-12'),
    'series start extension creates a task',
  )
  assert.ok(
    updatedSeries.some((task) => task.date === '2026-11-16'),
    'series end extension creates a task',
  )

  assert.equal(
    await deleteTaskSeries(seriesId as string),
    5,
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

  await trashTask('a')
  assert.equal(await db.tasks.get('a'), undefined, 'soft delete removes task')
  assert.ok(await db.trash.get('a'), 'soft delete creates trash entry')
  assert.equal(await restoreTrashEntry('a'), true, 'restore trash entry')
  assert.ok(await db.tasks.get('a'), 'restored task is back')
  await trashTasks(['a', 'b'])
  assert.equal(await db.tasks.get('a'), undefined, 'bulk trash removes a')
  assert.equal(await db.tasks.get('b'), undefined, 'bulk trash removes b')
  assert.equal(
    await restoreTrashEntries(['a', 'b']),
    2,
    'bulk restore works',
  )
  const stale = await db.tasks.get('a')
  assert.ok(stale, 'tasks restored after bulk trash')
  await db.trash.put({
    id: 'stale',
    task: stale,
    deletedAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
  })
  await purgeTrash(30)
  assert.equal(
    await db.trash.get('stale'),
    undefined,
    'trash purge removes old entries',
  )

  const habit = await createHabit({
    name: '喝水',
    schedule: 'daily',
    weekdays: [],
  })
  await toggleHabitCheckin(habit.id, '2026-11-18')
  const habitChecked = await db.habits.get(habit.id)
  assert.deepEqual(
    habitChecked?.checkins,
    ['2026-11-18'],
    'habit checkin is stored',
  )
  await updateHabit(habit.id, {
    name: '喝水升级',
    schedule: 'custom',
    weekdays: [5, 1, 3, 3],
  })
  const habitUpdated = await db.habits.get(habit.id)
  assert.equal(habitUpdated?.name, '喝水升级')
  assert.deepEqual(
    habitUpdated?.weekdays,
    [1, 3, 5],
    'habit weekdays are cleaned and sorted',
  )
  assert.deepEqual(
    habitUpdated?.checkins,
    ['2026-11-18'],
    'habit edit preserves checkins',
  )

  await recordFocusSession({
    taskTitle: '专注测试',
    durationSec: 90,
    startedAt: 1000,
    endedAt: 2000,
  })
  assert.equal(
    (await db.focusSessions.toArray()).length,
    1,
    'focus session is stored',
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
    habits: [
      {
        id: 'habit-import',
        name: '喝水导入',
        schedule: 'custom',
        weekdays: [1, 3, 5],
        checkins: ['2026-11-18'],
        createdAt: 6,
        updatedAt: 6,
      },
    ],
    focusSessions: [
      {
        id: 'focus-import',
        taskTitle: '导入专注',
        durationSec: 600,
        startedAt: 7000,
        endedAt: 8000,
      },
    ],
  }
  const imported = await importBackup(
    new File([JSON.stringify(backup)], 'backup.json', {
      type: 'application/json',
    }),
  )
  assert.deepEqual(
    imported,
    { tasks: 2, habits: 1, focusSessions: 1 },
    'backup import summary',
  )
  const importedHabit = await db.habits.get('habit-import')
  assert.equal(importedHabit?.name, '喝水导入')
  assert.deepEqual(importedHabit?.weekdays, [1, 3, 5])
  assert.deepEqual(importedHabit?.checkins, ['2026-11-18'])
  const importedFocus = await db.focusSessions.get('focus-import')
  assert.equal(importedFocus?.durationSec, 600)
  assert.equal(
    (await db.focusSessions.toArray()).length,
    1,
    'import replaces focus history',
  )
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
