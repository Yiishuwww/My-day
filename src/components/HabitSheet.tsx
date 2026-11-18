import { useEffect, useState } from 'react'
import { Check, Trash2, X } from 'lucide-react'
import type { Habit, HabitSchedule } from '../types'
import { createHabit, deleteHabit, updateHabit } from '../db'
import { WEEKDAY_OPTIONS, habitScheduleLabel } from '../lib/habits'
import { cx } from '../lib/utils'

interface Props {
  habit?: Habit
  onClose: () => void
  onSaved: (message: string) => void
}

const SCHEDULES: Array<{ value: HabitSchedule; label: string }> = [
  { value: 'daily', label: '每天' },
  { value: 'weekdays', label: '工作日' },
  { value: 'custom', label: '自定义' },
]

export function HabitSheet({ habit, onClose, onSaved }: Props) {
  const editing = Boolean(habit)
  const [name, setName] = useState(habit?.name ?? '')
  const [schedule, setSchedule] = useState<HabitSchedule>(
    habit?.schedule ?? 'daily',
  )
  const [weekdays, setWeekdays] = useState<number[]>(
    habit?.schedule === 'custom' && habit.weekdays.length
      ? habit.weekdays
      : [1, 2, 3, 4, 5],
  )
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const chooseSchedule = (value: HabitSchedule): void => {
    setError('')
    setSchedule(value)
    if (value === 'custom' && !weekdays.length) {
      setWeekdays([1, 2, 3, 4, 5])
    }
  }

  const toggleWeekday = (day: number): void => {
    setWeekdays((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day].sort((a, b) => a - b),
    )
  }

  const handleSave = async (): Promise<void> => {
    if (busy) return
    const finalName = name.trim()
    if (!finalName) {
      setError('给习惯起个名字吧')
      return
    }
    if (schedule === 'custom' && weekdays.length === 0) {
      setError('至少选择一天')
      return
    }
    setBusy(true)
    try {
      const payload = {
        name: finalName,
        schedule,
        weekdays: schedule === 'weekdays' ? [1, 2, 3, 4, 5] : weekdays,
      }
      if (habit) {
        await updateHabit(habit.id, payload)
        onSaved('习惯已更新')
      } else {
        await createHabit(payload)
        onSaved('习惯已添加')
      }
    } catch {
      setError('保存失败了，请再试一次')
      setBusy(false)
    }
  }

  const handleDelete = async (): Promise<void> => {
    if (!habit || busy) return
    if (!window.confirm(`删除习惯「${habit.name}」？打卡记录也会一起删除。`)) {
      return
    }
    setBusy(true)
    try {
      await deleteHabit(habit.id)
      onSaved('习惯已删除')
    } catch {
      setError('删除失败，请再试一次')
      setBusy(false)
    }
  }

  const previewHabit: Habit = {
    id: habit?.id ?? 'preview',
    name: name || '习惯',
    schedule,
    weekdays,
    checkins: habit?.checkins ?? [],
    createdAt: habit?.createdAt ?? 0,
    updatedAt: habit?.updatedAt ?? 0,
  }

  return (
    <div
      className="sheet-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="habit-sheet-title"
      >
        <div className="sheet-grab" aria-hidden="true" />
        <div className="sheet-head">
          <h2 id="habit-sheet-title">
            {editing ? '编辑习惯' : '添加习惯'}
          </h2>
          <div className="sheet-head-actions">
            <button
              type="button"
              className="sheet-save"
              onClick={handleSave}
              disabled={busy}
            >
              {busy ? '保存中' : '保存'}
            </button>
            <button
              type="button"
              className="sheet-close"
              aria-label="关闭"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="sheet-body">
          <input
            className="title-input"
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              if (error) setError('')
            }}
            placeholder="习惯名称，比如喝水、阅读、运动"
            aria-label="习惯名称"
            autoFocus={!editing}
            autoComplete="off"
          />
          {error && <p className="form-error">{error}</p>}

          <div className="field">
            <div className="field-label">频率</div>
            <div className="segmented">
              {SCHEDULES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={cx(
                    'seg-option',
                    schedule === item.value && 'active',
                  )}
                  onClick={() => chooseSchedule(item.value)}
                  aria-pressed={schedule === item.value}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {schedule === 'custom' && (
            <div className="field">
              <div className="field-label">选择星期</div>
              <div className="habit-weekday-row">
                {WEEKDAY_OPTIONS.map((option) => {
                  const active = weekdays.includes(option.value)
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={cx(
                        'habit-weekday',
                        active && 'active',
                      )}
                      onClick={() => toggleWeekday(option.value)}
                      aria-pressed={active}
                    >
                      {option.label}
                      {active && <Check size={11} strokeWidth={3} />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="habit-preview">
            <span className="habit-preview-label">预览</span>
            <strong>{name.trim() || '习惯'}</strong>
            <span>{habitScheduleLabel(previewHabit)}</span>
          </div>

          <p className="field-note">
            每天一次打卡。更改频率后，已有打卡记录会保留。
          </p>
        </div>

        <div className="sheet-footer">
          {editing && (
            <button
              type="button"
              className="danger-btn"
              onClick={handleDelete}
              disabled={busy}
            >
              <Trash2 size={16} />
              <span>删除</span>
            </button>
          )}
          <button
            type="button"
            className="primary-btn"
            onClick={handleSave}
            disabled={busy}
          >
            {busy ? '保存中' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
