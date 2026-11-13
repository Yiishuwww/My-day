import { useEffect, useState } from 'react'
import { CircleCheck, Pause, Play, Square, Timer } from 'lucide-react'
import type { Task } from '../types'
import {
  getRemainingMs,
  type PomodoroSession,
} from '../hooks/usePomodoro'
import { cx } from '../lib/utils'

interface Props {
  session: PomodoroSession
  tasks: Task[]
  onStart: (minutes: number) => void
  onRestart: () => void
  onPause: () => void
  onResume: () => void
  onClear: () => void
  onCompleteTask: (task: Task) => void
}

const PRESETS = [15, 25, 45, 60]

function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function FocusView({
  session,
  tasks,
  onStart,
  onRestart,
  onPause,
  onResume,
  onClear,
  onCompleteTask,
}: Props) {
  const [now, setNow] = useState(() => Date.now())
  const [minutes, setMinutes] = useState(() =>
    Math.max(1, Math.round(session.durationSec / 60)),
  )

  useEffect(() => {
    if (session.status !== 'running') return
    const timer = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(timer)
  }, [session.status])

  const remainingMs =
    session.status === 'running'
      ? getRemainingMs(session, now)
      : session.remainingMs
  const isIdle = session.status === 'idle'
  const isRunning = session.status === 'running'
  const isPaused = session.status === 'paused'
  const isDone = session.status === 'done'
  const totalMs = session.durationSec * 1000
  const progress =
    session.status === 'idle'
      ? 0
      : Math.min(1, Math.max(0, 1 - remainingMs / totalMs))
  const displayMs = isIdle ? minutes * 60 * 1000 : remainingMs
  const linkedTask = session.taskId
    ? tasks.find((task) => task.id === session.taskId)
    : undefined
  const canCompleteTask = Boolean(
    isDone && linkedTask && !linkedTask.completed,
  )

  const statusLabel = isRunning
    ? '专注中'
    : isPaused
      ? '已暂停'
      : isDone
        ? '已完成'
        : '准备开始'

  const radius = 112
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - progress)

  const startIdle = (): void => {
    if (session.taskTitle) onRestart()
    else onStart(minutes)
  }

  const endSession = (): void => {
    if ((isRunning || isPaused) && !window.confirm('结束本次专注？')) return
    onClear()
  }

  return (
    <div className="view focus-view">
      <header className="page-head">
        <div>
          <p className="eyebrow">专注</p>
          <h1>番茄钟</h1>
          <p className="page-sub">留一段时间，只做一件事。</p>
        </div>
      </header>

      <section className={cx('focus-card', `focus-${session.status}`)}>
        <div className="focus-ring-wrap">
          <svg
            className="focus-ring"
            viewBox="0 0 260 260"
            aria-hidden="true"
          >
            <circle
              className="focus-ring-track"
              cx="130"
              cy="130"
              r={radius}
            />
            <circle
              className="focus-ring-progress"
              cx="130"
              cy="130"
              r={radius}
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <div className="focus-center">
            <span className="focus-status">{statusLabel}</span>
            <span className="focus-time">{formatClock(displayMs)}</span>
            {!isIdle && session.durationSec > 0 && (
              <span className="focus-total">
                共 {Math.round(session.durationSec / 60)} 分钟
              </span>
            )}
          </div>
        </div>

        {session.taskTitle ? (
          <div className="focus-task">
            <span className="focus-task-icon">
              <Timer size={15} />
            </span>
            <span>{session.taskTitle}</span>
          </div>
        ) : (
          !isIdle &&
          !isDone && <p className="focus-free">自由专注</p>
        )}

        {isIdle && !session.taskTitle && (
          <div className="focus-presets" aria-label="专注时长">
            {PRESETS.map((value) => (
              <button
                key={value}
                type="button"
                className={cx('chip', minutes === value && 'active')}
                onClick={() => setMinutes(value)}
              >
                {value} 分钟
              </button>
            ))}
          </div>
        )}

        <div className="focus-actions">
          {isIdle && (
            <button
              type="button"
              className="focus-primary"
              onClick={startIdle}
            >
              <Play size={18} fill="currentColor" />
              开始专注
            </button>
          )}

          {isRunning && (
            <button
              type="button"
              className="focus-primary"
              onClick={onPause}
            >
              <Pause size={18} fill="currentColor" />
              暂停
            </button>
          )}

          {isPaused && (
            <button
              type="button"
              className="focus-primary"
              onClick={onResume}
            >
              <Play size={18} fill="currentColor" />
              继续
            </button>
          )}

          {isDone && !canCompleteTask && (
            <button
              type="button"
              className="focus-primary"
              onClick={() => {
                onRestart()
              }}
            >
              <Play size={18} fill="currentColor" />
              再来一次
            </button>
          )}

          {isDone && canCompleteTask && linkedTask && (
            <button
              type="button"
              className="focus-primary"
              onClick={() => onCompleteTask(linkedTask)}
            >
              <CircleCheck size={18} />
              完成任务
            </button>
          )}

          {(isRunning || isPaused) && (
            <button
              type="button"
              className="focus-secondary"
              onClick={endSession}
            >
              <Square size={14} fill="currentColor" />
              结束
            </button>
          )}

          {isDone && (
            <button
              type="button"
              className="focus-secondary"
              onClick={() => {
                if (canCompleteTask) onRestart()
                else onClear()
              }}
            >
              {canCompleteTask ? '再来一次' : '结束'}
            </button>
          )}

          {isIdle && session.taskTitle && (
            <button
              type="button"
              className="focus-secondary"
              onClick={onClear}
            >
              清除
            </button>
          )}
        </div>

        {isDone && linkedTask?.completed && (
          <p className="focus-done-note">
            <CircleCheck size={14} /> 这个任务已经完成
          </p>
        )}
      </section>

      <p className="focus-hint">
        保持 App 打开时计时最准确；锁屏或切到后台后，网页计时会被系统暂停，重新打开时会按真实时间校正，但无法在锁屏时响铃。
      </p>
    </div>
  )
}
