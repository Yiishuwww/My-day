import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus } from 'lucide-react'
import {
  db,
  moveTasksToDate,
  toggleSubtask,
  toggleTask,
} from './db'
import type { Task } from './types'
import { humanDate, todayKey } from './lib/dates'
import { usePomodoro } from './hooks/usePomodoro'
import { TabBar, type Tab } from './components/TabBar'
import { TaskSheet, type SheetState } from './components/TaskSheet'
import { TodayView } from './views/TodayView'
import { CalendarView } from './views/CalendarView'
import { InboxView } from './views/InboxView'
import { FocusView } from './views/FocusView'
import { SettingsView } from './views/SettingsView'
import { TagsView } from './views/TagsView'

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [selectedDate, setSelectedDate] = useState<string>(() => todayKey())
  const [sheet, setSheet] = useState<SheetState | null>(null)
  const [tagView, setTagView] = useState<{ tag?: string } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)
  const pendingToggles = useRef(new Set<string>())
  const tasks = useLiveQuery(() => db.tasks.toArray(), [])
  const {
    session: focusSession,
    start: startPomodoro,
    pause: pausePomodoro,
    resume: resumePomodoro,
    clear: clearPomodoro,
  } = usePomodoro()

  const notify = useCallback((message: string) => {
    setToast(message)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2200)
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    }
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [tab])

  useEffect(() => {
    if (navigator.storage && typeof navigator.storage.persist === 'function') {
      void navigator.storage.persist().catch(() => undefined)
    }
  }, [])

  const previousFocusStatus = useRef(focusSession.status)
  useEffect(() => {
    if (
      previousFocusStatus.current === 'running' &&
      focusSession.status === 'done'
    ) {
      notify('专注结束')
    }
    previousFocusStatus.current = focusSession.status
  }, [focusSession.status, notify])

  const openNew = useCallback((initial?: Partial<Task>) => {
    setSheet({ mode: 'new', initial })
  }, [])

  const openEdit = useCallback((task: Task) => {
    setSheet({ mode: 'edit', task })
  }, [])

  const closeSheet = useCallback(() => setSheet(null), [])

  const handleSaved = useCallback(
    (message: string) => {
      setSheet(null)
      notify(message)
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

  const handleTagClick = useCallback((tag: string) => {
    setTagView({ tag })
  }, [])

  const handleManageTags = useCallback(() => {
    setTagView({})
  }, [])

  const openEditFromTags = useCallback((task: Task) => {
    setTagView(null)
    setSheet({ mode: 'edit', task })
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
      if (
        task?.id &&
        focusSession.taskId === task.id &&
        active
      ) {
        setTagView(null)
        setTab('focus')
        return
      }
      const duration = minutes ?? task?.duration ?? 25
      startPomodoro(
        duration,
        task ? { id: task.id, title: task.title } : undefined,
      )
      setTagView(null)
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
    setTagView(null)
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
      {tagView ? (
        <main className="app-main">
          <TagsView
            key={tagView.tag ?? 'all-tags'}
            tasks={tasks}
            initialTag={tagView.tag}
            onBack={() => setTagView(null)}
            onToggle={handleToggle}
            onToggleSubtask={handleToggleSubtask}
            onEdit={openEditFromTags}
            onFocus={handleStartFocus}
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
              />
            )}
          </main>

          <TabBar active={tab} onChange={setTab} />

          {tab !== 'settings' && tab !== 'focus' && (
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
          )}
        </>
      )}

      {sheet && (
        <TaskSheet
          state={sheet}
          onClose={closeSheet}
          onSaved={handleSaved}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}
