import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus } from 'lucide-react'
import {
  db,
  moveTasksToDate,
  purgeTrash,
  recordFocusSession,
  restoreTrashEntries,
  toggleHabitCheckin,
  toggleSubtask,
  toggleTask,
  trashTasks,
  updateTask,
} from './db'
import type { Habit, Task } from './types'
import { humanDate, todayKey } from './lib/dates'
import { usePomodoro } from './hooks/usePomodoro'
import { TabBar, type Tab } from './components/TabBar'
import { TaskSheet, type SheetState } from './components/TaskSheet'
import { SeriesSheet } from './components/SeriesSheet'
import { TodayView } from './views/TodayView'
import { CalendarView } from './views/CalendarView'
import { InboxView } from './views/InboxView'
import { FocusView } from './views/FocusView'
import { SettingsView } from './views/SettingsView'
import { TagsView } from './views/TagsView'
import { TrashView } from './views/TrashView'
import { SearchView } from './views/SearchView'
import { ReviewView } from './views/ReviewView'

type SpecialView =
  | { kind: 'tags'; tag?: string }
  | { kind: 'trash' }
  | { kind: 'search' }
  | { kind: 'review' }
  | null

interface ToastAction {
  label: string
  onClick: () => void
}

interface ToastState {
  message: string
  actionLabel?: string
  action?: () => void
}

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [selectedDate, setSelectedDate] = useState<string>(() => todayKey())
  const [sheet, setSheet] = useState<SheetState | null>(null)
  const [seriesEdit, setSeriesEdit] = useState<Task | null>(null)
  const [specialView, setSpecialView] = useState<SpecialView>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)
  const pendingToggles = useRef(new Set<string>())
  const tasks = useLiveQuery(() => db.tasks.toArray(), [])
  const habits = useLiveQuery(
    () => db.habits.orderBy('createdAt').toArray(),
    [],
    [],
  )
  const {
    session: focusSession,
    start: startPomodoro,
    pause: pausePomodoro,
    resume: resumePomodoro,
    clear: clearPomodoro,
  } = usePomodoro()

  const notify = useCallback((message: string, action?: ToastAction) => {
    setToast({
      message,
      actionLabel: action?.label,
      action: action?.onClick,
    })
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(
      () => setToast(null),
      action ? 5000 : 2200,
    )
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    }
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [tab, specialView])

  useEffect(() => {
    if (navigator.storage && typeof navigator.storage.persist === 'function') {
      void navigator.storage.persist().catch(() => undefined)
    }
  }, [])

  useEffect(() => {
    void purgeTrash(30)
  }, [])

  const previousFocusStatus = useRef(focusSession.status)
  const lastLoggedFocus = useRef<number | null>(null)
  useEffect(() => {
    if (
      previousFocusStatus.current === 'running' &&
      focusSession.status === 'done'
    ) {
      notify('专注结束')
      const endedAt = focusSession.finishedAt ?? Date.now()
      if (lastLoggedFocus.current !== endedAt) {
        lastLoggedFocus.current = endedAt
        void recordFocusSession({
          taskId: focusSession.taskId,
          taskTitle: focusSession.taskTitle,
          durationSec: focusSession.durationSec,
          startedAt: endedAt - focusSession.durationSec * 1000,
          endedAt,
        })
      }
    }
    previousFocusStatus.current = focusSession.status
  }, [
    focusSession.durationSec,
    focusSession.finishedAt,
    focusSession.status,
    focusSession.taskId,
    focusSession.taskTitle,
    notify,
  ])

  const openNew = useCallback((initial?: Partial<Task>) => {
    setSheet({ mode: 'new', initial })
  }, [])

  const openEdit = useCallback((task: Task) => {
    setSheet({ mode: 'edit', task })
  }, [])

  const closeSheet = useCallback(() => setSheet(null), [])

  const handleSaved = useCallback(
    (message: string, action?: ToastAction) => {
      setSheet(null)
      notify(message, action)
    },
    [notify],
  )

  const handleToggle = useCallback(
    (task: Task) => {
      if (pendingToggles.current.has(task.id)) return
      pendingToggles.current.add(task.id)
      void (async () => {
        try {
          const result = await toggleTask(task.id)
          if (result.spawned?.date) {
            notify(`已完成 · 下一次 ${humanDate(result.spawned.date)}`)
          }
        } catch {
          notify('操作失败，请再试一次')
        } finally {
          pendingToggles.current.delete(task.id)
        }
      })()
    },
    [notify],
  )

  const handleToggleSubtask = useCallback(
    (task: Task, subtaskId: string) => {
      void toggleSubtask(task.id, subtaskId).catch(() => {
        notify('操作失败，请再试一次')
      })
    },
    [notify],
  )

  const handleMoveAllOverdue = useCallback(
    (ids: string[]) => {
      if (!ids.length) return
      void moveTasksToDate(ids, todayKey())
        .then(() => notify(`已移动 ${ids.length} 个任务到今天`))
        .catch(() => notify('移动失败，请再试一次'))
    },
    [notify],
  )

  const handleQuickSchedule = useCallback(
    (task: Task, date: string) => {
      void updateTask(task.id, { date })
        .then(() => notify(`已移到 ${humanDate(date)}`))
        .catch(() => notify('改期失败，请再试一次'))
    },
    [notify],
  )

  const handleBulkComplete = useCallback(
    (items: Task[]) => {
      const targets = items.filter((task) => !task.completed)
      if (!targets.length) {
        notify('所选任务都已完成')
        return
      }
      void (async () => {
        let count = 0
        for (const task of targets) {
          try {
            await toggleTask(task.id)
            count += 1
          } catch {
            // Continue with the rest.
          }
        }
        notify(count ? `已完成 ${count} 个任务` : '操作失败，请再试一次')
      })()
    },
    [notify],
  )

  const handleBulkTrash = useCallback(
    (items: Task[]) => {
      if (!items.length) return
      const ids = items.map((task) => task.id)
      void trashTasks(ids)
        .then((moved) => {
          if (!moved.length) return
          notify(`已移到最近删除 ${moved.length} 个任务`, {
            label: '撤销',
            onClick: () => {
              void restoreTrashEntries(ids).then((count) => {
                notify(count ? `已恢复 ${count} 个任务` : '没有可恢复的任务')
              })
            },
          })
        })
        .catch(() => notify('删除失败，请再试一次'))
    },
    [notify],
  )

  const handleTrashTask = useCallback(
    (task: Task) => {
      void trashTasks([task.id])
        .then((moved) => {
          if (!moved.length) return
          notify('已移到最近删除', {
            label: '撤销',
            onClick: () => {
              void restoreTrashEntries([task.id]).then((count) => {
                notify(count ? '已恢复任务' : '任务已不存在')
              })
            },
          })
        })
        .catch(() => notify('删除失败，请再试一次'))
    },
    [notify],
  )

  const handleBulkReschedule = useCallback(
    (items: Task[], date: string | null) => {
      const targets = items.filter(
        (task) => !task.completed && !task.seriesId,
      )
      if (!targets.length) {
        notify('没有可以改期的任务')
        return
      }
      void Promise.all(
        targets.map((task) =>
          updateTask(task.id, { date: date ?? undefined }),
        ),
      )
        .then(() =>
          notify(
            date
              ? `已把 ${targets.length} 个任务移到 ${humanDate(date)}`
              : `已把 ${targets.length} 个任务移到收件箱`,
          ),
        )
        .catch(() => notify('改期失败，请再试一次'))
    },
    [notify],
  )

  const handleTagClick = useCallback((tag: string) => {
    setSpecialView({ kind: 'tags', tag })
  }, [])

  const handleManageTags = useCallback(() => {
    setSpecialView({ kind: 'tags' })
  }, [])

  const handleOpenTrash = useCallback(() => {
    setSpecialView({ kind: 'trash' })
  }, [])

  const handleOpenSearch = useCallback(() => {
    setSpecialView({ kind: 'search' })
  }, [])

  const handleOpenReview = useCallback(() => {
    setSpecialView({ kind: 'review' })
  }, [])

  const handleTabChange = useCallback((next: Tab) => {
    setSpecialView(null)
    setTab(next)
  }, [])

  const handleToggleHabit = useCallback(
    (habit: Habit, date: string) => {
      void toggleHabitCheckin(habit.id, date).catch(() => {
        notify('操作失败，请再试一次')
      })
    },
    [notify],
  )

  const openEditFromTags = useCallback((task: Task) => {
    setSpecialView(null)
    setSheet({ mode: 'edit', task })
  }, [])

  const handleEditSeries = useCallback((task: Task) => {
    if (!task.seriesId) return
    setSheet(null)
    setSeriesEdit(task)
  }, [])

  const startFocus = useCallback(
    (task?: Task, minutes?: number) => {
      const active =
        focusSession.status === 'running' ||
        focusSession.status === 'paused'
      if (active && focusSession.taskId !== task?.id) {
        if (
          !window.confirm(
            '当前还有正在进行的计时，开始新的会结束当前计时，继续吗？',
          )
        ) {
          return
        }
      }
      if (task?.id && focusSession.taskId === task.id && active) {
        setSpecialView(null)
        setTab('focus')
        return
      }
      const duration = minutes ?? task?.duration ?? 25
      startPomodoro(
        duration,
        task ? { id: task.id, title: task.title } : undefined,
      )
      setSpecialView(null)
      setTab('focus')
    },
    [focusSession, startPomodoro],
  )

  const handleStartFocus = useCallback(
    (task: Task) => {
      startFocus(task)
    },
    [startFocus],
  )

  const handleStartFocusMinutes = useCallback(
    (minutes: number) => {
      startFocus(undefined, minutes)
    },
    [startFocus],
  )

  const handleRestartFocus = useCallback(() => {
    startPomodoro(
      Math.max(1, Math.round(focusSession.durationSec / 60)),
      focusSession.taskId
        ? { id: focusSession.taskId, title: focusSession.taskTitle }
        : undefined,
    )
    setSpecialView(null)
    setTab('focus')
  }, [focusSession, startPomodoro])

  if (tasks === undefined) {
    return (
      <div className="boot-screen">
        <div className="boot-mark">✓</div>
      </div>
    )
  }

  return (
    <div className="app">
      {specialView?.kind === 'tags' ? (
        <main className="app-main">
          <TagsView
            key={specialView.tag ?? 'all-tags'}
            tasks={tasks}
            initialTag={specialView.tag}
            onBack={() => setSpecialView(null)}
            onToggle={handleToggle}
            onToggleSubtask={handleToggleSubtask}
            onEdit={openEditFromTags}
            onFocus={handleStartFocus}
            notify={notify}
          />
        </main>
      ) : specialView?.kind === 'trash' ? (
        <main className="app-main">
          <TrashView onBack={() => setSpecialView(null)} notify={notify} />
        </main>
      ) : specialView?.kind === 'search' ? (
        <main className="app-main">
          <SearchView
            tasks={tasks}
            onBack={() => setSpecialView(null)}
            onEdit={openEdit}
            onBulkComplete={handleBulkComplete}
            onBulkTrash={handleBulkTrash}
            onBulkReschedule={handleBulkReschedule}
          />
        </main>
      ) : specialView?.kind === 'review' ? (
        <main className="app-main">
          <ReviewView
            tasks={tasks}
            habits={habits}
            onBack={() => setSpecialView(null)}
            onToggleHabit={handleToggleHabit}
            notify={notify}
          />
        </main>
      ) : (
        <>
          <main className="app-main" key={tab}>
            {tab === 'today' && (
              <TodayView
                tasks={tasks}
                onToggle={handleToggle}
                onToggleSubtask={handleToggleSubtask}
                onEdit={openEdit}
                onNew={() => openNew({ date: todayKey() })}
                onMoveAllOverdue={handleMoveAllOverdue}
                onFocus={handleStartFocus}
                onTagClick={handleTagClick}
                onQuickSchedule={handleQuickSchedule}
                onDelete={handleTrashTask}
                onSearch={handleOpenSearch}
                habits={habits}
                onToggleHabit={handleToggleHabit}
                onOpenReview={handleOpenReview}
              />
            )}

            {tab === 'calendar' && (
              <CalendarView
                tasks={tasks}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                onToggle={handleToggle}
                onToggleSubtask={handleToggleSubtask}
                onEdit={openEdit}
                onFocus={handleStartFocus}
                onTagClick={handleTagClick}
                onNew={(date) => openNew({ date })}
              />
            )}

            {tab === 'inbox' && (
              <InboxView
                tasks={tasks}
                onToggle={handleToggle}
                onToggleSubtask={handleToggleSubtask}
                onEdit={openEdit}
                onFocus={handleStartFocus}
                onTagClick={handleTagClick}
                onQuickSchedule={handleQuickSchedule}
                onDelete={handleTrashTask}
                onNew={() => openNew()}
              />
            )}

            {tab === 'focus' && (
              <FocusView
                session={focusSession}
                tasks={tasks}
                onStart={handleStartFocusMinutes}
                onRestart={handleRestartFocus}
                onPause={pausePomodoro}
                onResume={resumePomodoro}
                onClear={clearPomodoro}
                onCompleteTask={handleToggle}
              />
            )}

            {tab === 'settings' && (
              <SettingsView
                tasks={tasks}
                notify={notify}
                onManageTags={handleManageTags}
                onOpenTrash={handleOpenTrash}
                onOpenReview={handleOpenReview}
              />
            )}
          </main>

          <TabBar active={tab} onChange={handleTabChange} />

          {tab === 'today' || tab === 'calendar' || tab === 'inbox' ? (
            <button
              type="button"
              className="fab"
              aria-label="新建任务"
              onClick={() => {
                if (tab === 'calendar') openNew({ date: selectedDate })
                else if (tab === 'today') openNew({ date: todayKey() })
                else openNew()
              }}
            >
              <Plus size={26} />
            </button>
          ) : null}
        </>
      )}

      {sheet && (
        <TaskSheet
          state={sheet}
          onClose={closeSheet}
          onSaved={handleSaved}
          onEditSeries={handleEditSeries}
        />
      )}

      {seriesEdit && (
        <SeriesSheet
          task={seriesEdit}
          onClose={() => setSeriesEdit(null)}
          onSaved={(message) => {
            setSeriesEdit(null)
            notify(message)
          }}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          <span>{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              className="toast-action"
              onClick={() => {
                const action = toast.action
                if (toastTimer.current) {
                  window.clearTimeout(toastTimer.current)
                }
                setToast(null)
                action?.()
              }}
            >
              {toast.actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
