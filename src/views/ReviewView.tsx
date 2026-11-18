import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowLeft,
  CircleCheck,
  Flame,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import type { Habit, Task } from '../types'
import { db, deleteHabit } from '../db'
import { HabitSheet } from '../components/HabitSheet'
import { Heatmap, type HeatmapMetric } from '../components/Heatmap'
import { EmptyState } from '../components/EmptyState'
import {
  habitScheduleLabel,
  habitStreak,
  isHabitChecked,
  isHabitDue,
} from '../lib/habits'
import {
  addDaysKey,
  daysBetweenKeys,
  humanDate,
  startOfWeekKey,
  todayKey,
  toKey,
  weekKeys,
} from '../lib/dates'
import {
  completedTaskCountsByDate,
  focusMinutesByDate,
  habitCheckinsByDate,
  sumMapInRange,
} from '../lib/stats'
import { cx } from '../lib/utils'

interface Props {
  tasks: Task[]
  habits: Habit[]
  onBack: () => void
  onToggleHabit: (habit: Habit, date: string) => void
  notify: (message: string) => void
}

const METRICS: Array<{ value: HeatmapMetric; label: string }> = [
  { value: 'tasks', label: '任务' },
  { value: 'focus', label: '专注' },
  { value: 'habits', label: '习惯' },
]

const BAR_LABELS = ['一', '二', '三', '四', '五', '六', '日']

export function ReviewView({
  tasks,
  habits,
  onBack,
  onToggleHabit,
  notify,
}: Props) {
  const [metric, setMetric] = useState<HeatmapMetric>('tasks')
  const [habitSheet, setHabitSheet] = useState<{ habit?: Habit } | null>(null)
  const focusSessions = useLiveQuery(
    () => db.focusSessions.toArray(),
    [],
    [],
  )

  const today = todayKey()
  const weekStart = startOfWeekKey(today)
  const taskCounts = useMemo(() => completedTaskCountsByDate(tasks), [tasks])
  const focusCounts = useMemo(
    () => focusMinutesByDate(focusSessions),
    [focusSessions],
  )
  const habitCounts = useMemo(() => habitCheckinsByDate(habits), [habits])

  const weekDates = weekKeys(weekStart)
  const completedThisWeek = sumMapInRange(taskCounts, weekStart, today)
  const focusThisWeek = sumMapInRange(focusCounts, weekStart, today)
  const lastWeekStart = addDaysKey(weekStart, -7)
  const completedLastWeek = sumMapInRange(
    taskCounts,
    lastWeekStart,
    addDaysKey(lastWeekStart, daysBetweenKeys(weekStart, today)),
  )
  let habitDueCount = 0
  let habitDoneCount = 0
  for (const habit of habits) {
    const created = toKey(new Date(habit.createdAt))
    for (const date of weekDates) {
      if (date > today) break
      if (date < created || !isHabitDue(habit, date)) continue
      habitDueCount += 1
      if (isHabitChecked(habit, date)) habitDoneCount += 1
    }
  }
  const habitRate =
    habitDueCount > 0
      ? Math.round((habitDoneCount / habitDueCount) * 100)
      : null
  const trend = completedThisWeek - completedLastWeek
  const trendText =
    completedThisWeek === 0 && completedLastWeek === 0
      ? ''
      : trend > 0
        ? `比上周多 ${trend} 件`
        : trend < 0
          ? `比上周少 ${-trend} 件`
          : '与上周持平'
  const maxBar = Math.max(
    1,
    ...weekDates.map((date) => taskCounts.get(date) ?? 0),
  )
  const metricValues =
    metric === 'tasks'
      ? taskCounts
      : metric === 'focus'
        ? focusCounts
        : habitCounts

  const handleDeleteHabit = async (habit: Habit): Promise<void> => {
    if (
      !window.confirm(
        `删除习惯「${habit.name}」？打卡记录也会一起删除。`,
      )
    ) {
      return
    }
    try {
      await deleteHabit(habit.id)
      notify('习惯已删除')
    } catch {
      notify('删除失败，请再试一次')
    }
  }

  return (
    <div className="view review-view">
      <header className="tags-head">
        <button
          type="button"
          className="back-btn"
          onClick={onBack}
          aria-label="返回"
        >
          <ArrowLeft size={19} />
        </button>
        <div className="tags-title">
          <p className="eyebrow">回顾</p>
          <h1>习惯与统计</h1>
        </div>
      </header>

      <section className="weekly-card">
        <div className="weekly-head">
          <div>
            <h2>本周回顾</h2>
            <p className="weekly-range">
              {humanDate(weekStart)} – {humanDate(addDaysKey(weekStart, 6))}
            </p>
          </div>
          {trendText && (
            <span
              className={cx(
                'weekly-trend',
                trend > 0 && 'up',
                trend < 0 && 'down',
              )}
            >
              {trendText}
            </span>
          )}
        </div>

        <div className="weekly-metrics">
          <div className="weekly-metric">
            <strong>{completedThisWeek}</strong>
            <span>完成任务</span>
          </div>
          <div className="weekly-metric">
            <strong>{focusThisWeek}</strong>
            <span>专注分钟</span>
          </div>
          <div className="weekly-metric">
            <strong>{habitRate === null ? '—' : `${habitRate}%`}</strong>
            <span>习惯完成</span>
          </div>
        </div>

        <div className="weekly-bars" aria-label="本周每日完成任务数">
          {weekDates.map((date, index) => {
            const value = taskCounts.get(date) ?? 0
            const future = date > today
            return (
              <div
                key={date}
                className={cx(
                  'weekly-bar-col',
                  date === today && 'is-today',
                  future && 'is-future',
                )}
                title={`${humanDate(date)} · ${value} 个任务`}
              >
                <span className="weekly-bar-track">
                  {value > 0 && (
                    <span
                      className="weekly-bar-fill"
                      style={{
                        height: `${Math.max(12, (value / maxBar) * 100)}%`,
                      }}
                    />
                  )}
                </span>
                <span className="weekly-bar-label">
                  {BAR_LABELS[index]}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="review-card">
        <div className="review-section-head">
          <h2>完成热力图</h2>
          <div className="heatmap-metrics">
            {METRICS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={cx(
                  'heatmap-metric',
                  metric === item.value && 'active',
                )}
                onClick={() => setMetric(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <Heatmap values={metricValues} metric={metric} />
      </section>

      <section className="review-card">
        <div className="review-section-head">
          <h2>习惯</h2>
          <button
            type="button"
            className="text-btn"
            onClick={() => setHabitSheet({})}
          >
            <Plus size={14} />
            添加
          </button>
        </div>

        {habits.length > 0 ? (
          <div className="habit-list">
            {habits.map((habit) => {
              const due = isHabitDue(habit, today)
              const checked = isHabitChecked(habit, today)
              const streak = habitStreak(habit, today)
              return (
                <div
                  className={cx(
                    'habit-row',
                    checked && 'is-checked',
                    !due && 'is-rest',
                  )}
                  key={habit.id}
                >
                  <button
                    type="button"
                    className={cx(
                      'habit-row-check',
                      checked && 'checked',
                    )}
                    onClick={() => onToggleHabit(habit, today)}
                    disabled={!due}
                    role="checkbox"
                    aria-checked={checked}
                    aria-label={
                      due
                        ? checked
                          ? `取消打卡：${habit.name}`
                          : `打卡：${habit.name}`
                        : `${habit.name} 今天休息`
                    }
                  >
                    {checked && <CircleCheck size={16} />}
                  </button>
                  <button
                    type="button"
                    className="habit-row-main"
                    onClick={() => setHabitSheet({ habit })}
                  >
                    <span className="habit-row-title">{habit.name}</span>
                    <span className="habit-row-meta">
                      {habitScheduleLabel(habit)}
                      {due
                        ? streak > 0
                          ? ` · 连续 ${streak} 天`
                          : ''
                        : ' · 今天休息'}
                    </span>
                  </button>
                  <div className="habit-row-actions">
                    <button
                      type="button"
                      onClick={() => setHabitSheet({ habit })}
                      aria-label={`编辑习惯 ${habit.name}`}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => void handleDeleteHabit(habit)}
                      aria-label={`删除习惯 ${habit.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyState
            icon={<Flame size={22} />}
            title="还没有习惯"
            actionLabel="添加习惯"
            onAction={() => setHabitSheet({})}
          />
        )}
      </section>

      {habitSheet && (
        <HabitSheet
          habit={habitSheet.habit}
          onClose={() => setHabitSheet(null)}
          onSaved={(message) => {
            setHabitSheet(null)
            notify(message)
          }}
        />
      )}
    </div>
  )
}
