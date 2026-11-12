import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus } from 'lucide-react'
import { db, moveTasksToDate, toggleTask } from './db'
import type { Task } from './types'
import { humanDate, todayKey } from './lib/dates'
import { TabBar, type Tab } from './components/TabBar'
import { TaskSheet, type SheetState } from './components/TaskSheet'
import { TodayView } from './views/TodayView'
import { CalendarView } from './views/CalendarView'
import { InboxView } from './views/InboxView'
import { SettingsView } from './views/SettingsView'

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [selectedDate, setSelectedDate] = useState<string>(() => todayKey())
  const [sheet, setSheet] = useState<SheetState | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)
  const pendingToggles = useRef(new Set<string>())
  const tasks = useLiveQuery(() => db.tasks.toArray(), [])

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

  const handleMoveAllOverdue = useCallback(
    (ids: string[]) => {
      if (!ids.length) return
      void moveTasksToDate(ids, todayKey())
        .then(() => notify(`已移动 ${ids.length} 个任务到今天`))
        .catch(() => notify('移动失败，请再试一次'))
    },
    [notify],
  )

  if (tasks === undefined) {
    return (
      <div className="boot-screen">
        <div className="boot-mark">✓</div>
      </div>
    )
  }

  return (
    <div className="app">
      <main className="app-main" key={tab}>
        {tab === 'today' && (
          <TodayView
            tasks={tasks}
            onToggle={handleToggle}
            onEdit={openEdit}
            onNew={() => openNew({ date: todayKey() })}
            onMoveAllOverdue={handleMoveAllOverdue}
          />
        )}

        {tab === 'calendar' && (
          <CalendarView
            tasks={tasks}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onToggle={handleToggle}
            onEdit={openEdit}
            onNew={(date) => openNew({ date })}
          />
        )}

        {tab === 'inbox' && (
          <InboxView
            tasks={tasks}
            onToggle={handleToggle}
            onEdit={openEdit}
            onNew={() => openNew()}
          />
        )}

        {tab === 'settings' && <SettingsView tasks={tasks} notify={notify} />}
      </main>

      <TabBar active={tab} onChange={setTab} />

      {tab !== 'settings' && (
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
