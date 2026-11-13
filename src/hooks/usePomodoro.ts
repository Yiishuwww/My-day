import { useCallback, useEffect, useState } from 'react'

export type PomodoroStatus = 'idle' | 'running' | 'paused' | 'done'

export interface PomodoroSession {
  status: PomodoroStatus
  taskId?: string
  taskTitle: string
  durationSec: number
  startedAt?: number
  remainingMs: number
  finishedAt?: number
}

export interface FocusTask {
  id: string
  title: string
}

const STORAGE_KEY = 'myday.pomodoro.v1'
const DEFAULT_SECONDS = 25 * 60

function idleSession(durationSec = DEFAULT_SECONDS): PomodoroSession {
  return {
    status: 'idle',
    taskTitle: '',
    durationSec,
    remainingMs: durationSec * 1000,
  }
}

export function getRemainingMs(
  session: PomodoroSession,
  now = Date.now(),
): number {
  if (session.status === 'running' && session.startedAt) {
    return Math.max(
      0,
      session.durationSec * 1000 - (now - session.startedAt),
    )
  }
  return Math.max(0, session.remainingMs)
}

function loadSession(): PomodoroSession {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return idleSession()
    const parsed = JSON.parse(raw) as Partial<PomodoroSession>
    if (!parsed || typeof parsed.durationSec !== 'number') return idleSession()

    const durationSec = Math.max(60, Math.min(86400, Math.round(parsed.durationSec)))
    const session: PomodoroSession = {
      status:
        parsed.status === 'running' ||
        parsed.status === 'paused' ||
        parsed.status === 'done'
          ? parsed.status
          : 'idle',
      taskId: typeof parsed.taskId === 'string' ? parsed.taskId : undefined,
      taskTitle:
        typeof parsed.taskTitle === 'string' ? parsed.taskTitle : '',
      durationSec,
      startedAt:
        typeof parsed.startedAt === 'number' ? parsed.startedAt : undefined,
      remainingMs:
        typeof parsed.remainingMs === 'number'
          ? Math.max(0, parsed.remainingMs)
          : durationSec * 1000,
      finishedAt:
        typeof parsed.finishedAt === 'number' ? parsed.finishedAt : undefined,
    }

    if (session.status === 'running' && session.startedAt) {
      const remaining = getRemainingMs(session)
      if (remaining <= 0) {
        return {
          ...session,
          status: 'done',
          startedAt: undefined,
          remainingMs: 0,
          finishedAt: Date.now(),
        }
      }
      session.remainingMs = remaining
    }
    return session
  } catch {
    return idleSession()
  }
}

let audioContext: AudioContext | null = null

function primeAudio(): void {
  try {
    if (typeof AudioContext === 'undefined') return
    if (!audioContext) audioContext = new AudioContext()
    if (audioContext.state === 'suspended') void audioContext.resume()
  } catch {
    // Audio is best effort only.
  }
}

function playChime(): void {
  if (!audioContext) return
  try {
    const context = audioContext
    if (context.state === 'suspended') void context.resume()
    const start = context.currentTime
    ;[880, 1174.66].forEach((frequency, index) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      const at = start + index * 0.18
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(0.18, at + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.36)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(at)
      oscillator.stop(at + 0.4)
    })
  } catch {
    // Ignore audio failures.
  }
}

interface WakeLockSentinelLike {
  release: () => Promise<void>
}

interface WakeLockNavigator {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>
  }
}

let wakeLock: WakeLockSentinelLike | null = null

async function acquireWakeLock(): Promise<void> {
  try {
    const nav = navigator as unknown as WakeLockNavigator
    if (!nav.wakeLock || wakeLock) return
    wakeLock = await nav.wakeLock.request('screen')
  } catch {
    wakeLock = null
  }
}

async function releaseWakeLock(): Promise<void> {
  if (!wakeLock) return
  try {
    await wakeLock.release()
  } catch {
    // Ignore.
  }
  wakeLock = null
}

export function usePomodoro() {
  const [session, setSession] = useState<PomodoroSession>(() => loadSession())

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  }, [session])

  const finish = useCallback(() => {
    playChime()
    setSession((current) =>
      current.status === 'running'
        ? {
            ...current,
            status: 'done',
            startedAt: undefined,
            remainingMs: 0,
            finishedAt: Date.now(),
          }
        : current,
    )
  }, [])

  useEffect(() => {
    if (session.status !== 'running' || !session.startedAt) {
      void releaseWakeLock()
      return
    }

    void acquireWakeLock()
    const endAt = session.startedAt + session.durationSec * 1000
    const remaining = endAt - Date.now()
    if (remaining <= 0) {
      const immediate = window.setTimeout(finish, 0)
      return () => window.clearTimeout(immediate)
    }

    const timer = window.setTimeout(finish, remaining)
    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') {
        if (Date.now() >= endAt) finish()
        else void acquireWakeLock()
      } else {
        void releaseWakeLock()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [session.status, session.startedAt, session.durationSec, finish])

  useEffect(() => {
    return () => {
      void releaseWakeLock()
    }
  }, [])

  const start = useCallback((minutes: number, task?: FocusTask) => {
    primeAudio()
    const durationSec = Math.max(
      60,
      Math.min(86400, Math.round(minutes * 60)),
    )
    setSession({
      status: 'running',
      taskId: task?.id,
      taskTitle: task?.title ?? '',
      durationSec,
      startedAt: Date.now(),
      remainingMs: durationSec * 1000,
    })
    void acquireWakeLock()
  }, [])

  const pause = useCallback(() => {
    setSession((current) => {
      if (current.status !== 'running') return current
      return {
        ...current,
        status: 'paused',
        remainingMs: getRemainingMs(current),
        startedAt: undefined,
      }
    })
    void releaseWakeLock()
  }, [])

  const resume = useCallback(() => {
    primeAudio()
    setSession((current) => {
      if (current.status !== 'paused') return current
      const remainingMs = Math.max(0, current.remainingMs)
      return {
        ...current,
        status: 'running',
        startedAt: Date.now() - (current.durationSec * 1000 - remainingMs),
        remainingMs,
      }
    })
  }, [])

  const reset = useCallback(() => {
    setSession((current) => ({
      ...current,
      status: 'idle',
      startedAt: undefined,
      remainingMs: current.durationSec * 1000,
      finishedAt: undefined,
    }))
    void releaseWakeLock()
  }, [])

  const clear = useCallback(() => {
    setSession((current) => ({
      ...current,
      status: 'idle',
      taskId: undefined,
      taskTitle: '',
      startedAt: undefined,
      remainingMs: current.durationSec * 1000,
      finishedAt: undefined,
    }))
    void releaseWakeLock()
  }, [])

  return { session, start, pause, resume, reset, clear }
}
