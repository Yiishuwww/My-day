import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowLeft,
  CircleCheck,
  Flame,
  Pencil,
  Plus,
  Timer,
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
import { startOfWeekKey, todayKey } from '../lib/dates'
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

  const dueToday = habits.filter((habit) => isHabitDue(habit, today))
  const doneToday = dueToday.filter((habit) =>
    isHabitChecked(habit, today),
  ).length
  const completedToday = taskCounts.get(today) ?? 0
  const focusThisWeek = sumMapInRange(focusCounts, weekStart, today)
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

      <section className="review-stats">
        <div className="review-stat">
          <span className="review-stat-icon">
            <CircleCheck size={17} />
          </span>
          <strong>{completedToday}</strong>
          <span>今日完成</span>
        </div>
        <div className="review-stat">
          <span className="review-stat-icon">
            <Timer size={17} />
          </span>
          <strong>{focusThisWeek}</strong>
          <span>本周专注分钟</span>
        </div>
        <div className="review-stat">
          <span className="review-stat-icon">
            <Flame size={17} />
          </span>
          <strong>
            {doneToday}/{dueToday.length}
          </strong>
          <span>今日习惯</span>
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
        <p className="review-note">最近 26 周 · 左右滑动查看更早记录</p>
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
            text="先从一个每天都能做到的小习惯开始。"
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
