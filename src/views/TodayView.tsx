import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from 'react'
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'
import {
  AlertCircle,
  CalendarPlus,
  Check,
  ChevronDown,
  CircleCheck,
  Flame,
  Moon,
  Search,
  Sparkles,
  SunMedium,
} from 'lucide-react'
import type { Habit, Task } from '../types'
import { TaskItem } from '../components/TaskItem'
import { EmptyState } from '../components/EmptyState'
import {
  greeting,
  humanDateWithWeekday,
  sortByPriorityAndOrder,
  sortTasks,
  todayKey,
} from '../lib/dates'
import { reorderTasks } from '../db'
import {
  habitScheduleLabel,
  habitStreak,
  isHabitChecked,
  isHabitDue,
} from '../lib/habits'
import { setTheme } from '../lib/theme'
import { cx } from '../lib/utils'

interface Props {
  tasks: Task[]
  onToggle: (task: Task) => void
  onToggleSubtask: (task: Task, subtaskId: string) => void
  onEdit: (task: Task) => void
  onNew: () => void
  onMoveAllOverdue: (ids: string[]) => void
  onFocus: (task: Task) => void
  onTagClick: (tag: string) => void
  onQuickSchedule: (task: Task, date: string) => void
  onSearch: () => void
  habits: Habit[]
  onToggleHabit: (habit: Habit, date: string) => void
  onOpenReview: () => void
}

function SortableTask(props: ComponentProps<typeof TaskItem>) {
  const { task } = props
  const { listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: task.id,
      data: { priority: task.priority },
    })
  const suppressClick = useRef(false)

  useEffect(() => {
    if (isDragging) {
      suppressClick.current = true
      return
    }
    if (!suppressClick.current) return
    const timer = window.setTimeout(() => {
      suppressClick.current = false
    }, 220)
    return () => window.clearTimeout(timer)
  }, [isDragging])

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      data-task-id={task.id}
      className={cx('sortable-task', isDragging && 'is-dragging')}
      onClickCapture={(event) => {
        if (suppressClick.current) {
          event.preventDefault()
          event.stopPropagation()
        }
      }}
      {...listeners}
    >
      <TaskItem {...props} />
    </div>
  )
}

export function TodayView({
  tasks,
  onToggle,
  onToggleSubtask,
  onEdit,
  onNew,
  onMoveAllOverdue,
  onFocus,
  onTagClick,
  onQuickSchedule,
  onSearch,
  habits,
  onToggleHabit,
  onOpenReview,
}: Props) {
  const today = todayKey()
  const [showDone, setShowDone] = useState(false)
  const [isDark, setIsDark] = useState(
    () => document.documentElement.getAttribute('data-theme') === 'dark',
  )

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 350, tolerance: 8 },
    }),
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const syncTheme = (): void => {
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark')
    }
    media.addEventListener('change', syncTheme)
    return () => media.removeEventListener('change', syncTheme)
  }, [])

  const toggleTheme = (): void => {
    const next = isDark ? 'light' : 'dark'
    setTheme(next)
    setIsDark(next === 'dark')
  }

  const overdue = useMemo(
    () =>
      sortTasks(
        tasks.filter(
          (task) =>
            !task.completed &&
            task.date &&
            task.date < today &&
            !task.seriesId,
        ),
      ),
    [tasks, today],
  )
  const todayTasks = useMemo(
    () => tasks.filter((task) => task.date === today),
    [tasks, today],
  )
  const openToday = useMemo(
    () =>
      sortByPriorityAndOrder(
        todayTasks.filter((task) => !task.completed),
      ),
    [todayTasks],
  )
  const doneToday = useMemo(
    () => sortTasks(todayTasks.filter((task) => task.completed)),
    [todayTasks],
  )

  const dueHabits = useMemo(
    () => habits.filter((habit) => isHabitDue(habit, today)),
    [habits, today],
  )
  const doneHabitCount = dueHabits.filter((habit) =>
    isHabitChecked(habit, today),
  ).length

  const total = todayTasks.length
  const done = doneToday.length
  const allDone = total > 0 && done === total
  const progress = total > 0 ? Math.round((done / total) * 100) : 0

  const progressText =
    total === 0
      ? overdue.length
        ? `${overdue.length} 个任务等待顺延`
        : '今天还没有安排'
      : openToday.length === 0
        ? overdue.length
          ? `今天 ${total} 件事已完成 · 还有 ${overdue.length} 件顺延`
          : `${total} 件事全部完成`
        : overdue.length
          ? `完成 ${done} / ${total} · ${overdue.length} 件顺延`
          : `完成 ${done} / ${total}`

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const activePriority = (
      args.active.data.current as { priority?: number } | undefined
    )?.priority
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter((container) => {
        const priority = (
          container.data.current as { priority?: number } | undefined
        )?.priority
        return priority === activePriority
      }),
    })
  }, [])

  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const source = openToday.find((task) => task.id === active.id)
    const target = openToday.find((task) => task.id === over.id)
    if (!source || !target || source.priority !== target.priority) return

    const group = openToday.filter(
      (task) => task.priority === source.priority,
    )
    const oldIndex = group.findIndex((task) => task.id === active.id)
    const newIndex = group.findIndex((task) => task.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const orderedIds = arrayMove(group, oldIndex, newIndex).map(
      (task) => task.id,
    )
    void reorderTasks(orderedIds).catch(() => undefined)
  }

  return (
    <div className="view today-view">
      <header className="today-hero">
        <div className="hero-top">
          <div>
            <p className="hero-date">{humanDateWithWeekday(today)}</p>
            <h1>{greeting()}</h1>
          </div>
          <div className="hero-actions">
            <button
              type="button"
              className="hero-icon search-toggle"
              onClick={onSearch}
              aria-label="搜索任务"
              title="搜索任务"
            >
              <Search size={19} />
            </button>
            <button
              type="button"
              className="hero-icon theme-toggle"
              onClick={toggleTheme}
              aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
              title={isDark ? '切换到浅色模式' : '切换到深色模式'}
            >
              {isDark ? <SunMedium size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>
        <div className="hero-progress">
          <div
            className="hero-progress-bar"
            role="progressbar"
            aria-label="今日完成进度"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
          <p className="hero-progress-text">
            {allDone && overdue.length === 0 && (
              <Sparkles size={12} className="progress-sparkle" aria-hidden="true" />
            )}
            {progressText}
          </p>
        </div>
      </header>

      {overdue.length > 0 && (
        <section className="section">
          <div className="section-head">
            <div className="section-title">
              <AlertCircle size={15} className="warn-icon" />
              <h2>顺延</h2>
              <span className="count-pill warn">{overdue.length}</span>
            </div>
            <button
              type="button"
              className="text-btn"
              onClick={() => onMoveAllOverdue(overdue.map((task) => task.id))}
            >
              全部移到今天
            </button>
          </div>
          <div className="task-list">
            {overdue.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                overdue
                onToggle={onToggle}
                onToggleSubtask={onToggleSubtask}
                onOpen={onEdit}
                onFocus={onFocus}
                onTagClick={onTagClick}
                onQuickSchedule={onQuickSchedule}
                quickSchedule
              />
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <div className="section-title">
            <h2>今天</h2>
            <span className="count-pill">{openToday.length}</span>
          </div>
          {total > 0 && (
            <span className="section-hint">
              {done}/{total} 完成
            </span>
          )}
        </div>

        {openToday.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={openToday.map((task) => task.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="task-list">
                {openToday.map((task) => (
                  <SortableTask
                    key={task.id}
                    task={task}
                    onToggle={onToggle}
                    onToggleSubtask={onToggleSubtask}
                    onOpen={onEdit}
                    onFocus={onFocus}
                    onTagClick={onTagClick}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : total > 0 ? (
          <div className="all-done">
            <CircleCheck size={17} />
            今天的任务都完成了
          </div>
        ) : (
          <EmptyState
            icon={<CalendarPlus size={22} />}
            title="今天还没有安排"
            text="给自己定一件小事，从点右下角的 + 开始。"
            actionLabel="添加今天的任务"
            onAction={onNew}
          />
        )}

        {doneToday.length > 0 && (
          <>
            <button
              type="button"
              className={cx('done-toggle', showDone && 'open')}
              onClick={() => setShowDone((value) => !value)}
              aria-expanded={showDone}
            >
              <ChevronDown size={16} />
              <span>已完成 {doneToday.length}</span>
            </button>
            {showDone && (
              <div className="task-list done-list">
                {doneToday.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggle={onToggle}
                    onToggleSubtask={onToggleSubtask}
                    onOpen={onEdit}
                    onFocus={onFocus}
                    onTagClick={onTagClick}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <section className="section habits-section">
        <div className="section-head">
          <div className="section-title">
            <h2>习惯</h2>
            {dueHabits.length > 0 && (
              <span className="count-pill">
                {doneHabitCount}/{dueHabits.length}
              </span>
            )}
          </div>
          <button type="button" className="text-btn" onClick={onOpenReview}>
            回顾
          </button>
        </div>

        {dueHabits.length > 0 ? (
          <div className="habit-today-list">
            {dueHabits.map((habit) => {
              const checked = isHabitChecked(habit, today)
              const streak = habitStreak(habit, today)
              return (
                <button
                  key={habit.id}
                  type="button"
                  className={cx(
                    'habit-today-row',
                    checked && 'is-checked',
                  )}
                  onClick={() => onToggleHabit(habit, today)}
                  aria-pressed={checked}
                >
                  <span className="habit-today-check">
                    {checked && <Check size={14} strokeWidth={3.2} />}
                  </span>
                  <span className="habit-today-main">
                    <span className="habit-today-name">{habit.name}</span>
                    <span className="habit-today-meta">
                      {habitScheduleLabel(habit)}
                    </span>
                  </span>
                  {streak > 0 && (
                    <span className="habit-today-streak">
                      <Flame size={12} />
                      {streak}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ) : habits.length === 0 ? (
          <button
            type="button"
            className="habit-empty-card"
            onClick={onOpenReview}
          >
            <span>还没有习惯</span>
            <span>去创建一个 →</span>
          </button>
        ) : (
          <p className="habit-rest">今天没有需要打卡的习惯。</p>
        )}
      </section>
    </div>
  )
}
