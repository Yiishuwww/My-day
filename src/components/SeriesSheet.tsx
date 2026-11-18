import { useEffect, useState } from 'react'
import { CalendarDays, Check, X } from 'lucide-react'
import type { Priority, Task } from '../types'
import { updateTaskSeries } from '../db'
import {
  daysBetweenKeys,
  humanDate,
  humanDuration,
  todayKey,
} from '../lib/dates'
import { cx } from '../lib/utils'

interface Props {
  task: Task
  onClose: () => void
  onSaved: (message: string) => void
}

const PRIORITIES: Array<{ value: Priority; label: string }> = [
  { value: 0, label: '无' },
  { value: 1, label: '中' },
  { value: 2, label: '高' },
]

function splitTagInput(value: string): string[] {
  return value
    .split(/[,，、\s]+/)
    .map((tag) => tag.replace(/^#+/, '').trim())
    .filter(Boolean)
}

export function SeriesSheet({ task, onClose, onSaved }: Props) {
  const seriesId = task.seriesId
  const initialStart = task.rangeStart ?? task.date ?? todayKey()
  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes)
  const [start, setStart] = useState(initialStart)
  const [end, setEnd] = useState(task.rangeEnd ?? initialStart)
  const [time, setTime] = useState(task.time ?? '')
  const [duration, setDuration] = useState<number | undefined>(task.duration)
  const [priority, setPriority] = useState<Priority>(task.priority)
  const [tags, setTags] = useState<string[]>(task.tags)
  const [tagDraft, setTagDraft] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const dayCount =
    start && end && start <= end ? daysBetweenKeys(start, end) + 1 : 0
  const quickDurations = [15, 30]
  const customDurationValue =
    duration && !quickDurations.includes(duration) ? duration : ''

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

  const commitTag = (): void => {
    const next = splitTagInput(tagDraft)
    if (next.length) {
      setTags((current) => Array.from(new Set([...current, ...next])))
    }
    setTagDraft('')
  }

  const handleSave = async (): Promise<void> => {
    if (busy) return
    const finalTitle = title.trim()
    if (!finalTitle) {
      setError('标题不能为空')
      return
    }
    if (!start || !end) {
      setError('请选择开始和结束日期')
      return
    }
    if (start > end) {
      setError('结束日期不能早于开始日期')
      return
    }
    const count = daysBetweenKeys(start, end) + 1
    if (count > 366) {
      setError('日期段最多 366 天')
      return
    }

    const finalTags = Array.from(
      new Set(
        [...tags, ...splitTagInput(tagDraft)]
          .map((tag) => tag.replace(/^#+/, '').trim())
          .filter(Boolean),
      ),
    )

    setBusy(true)
    try {
      if (!seriesId) throw new Error('no-series')
      const result = await updateTaskSeries(seriesId, {
        title: finalTitle,
        notes: notes.trim(),
        time: time || undefined,
        duration: duration && duration > 0 ? duration : undefined,
        priority,
        tags: finalTags,
        start,
        end,
      })
      const parts = [`已更新 ${result.updated + result.created} 天`]
      if (result.created) parts.push(`新增 ${result.created} 天`)
      if (result.removed) parts.push(`移除 ${result.removed} 天`)
      onSaved(parts.join('，'))
    } catch {
      setError('保存失败了，请再试一次')
      setBusy(false)
    }
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
        aria-labelledby="series-sheet-title"
      >
        <div className="sheet-grab" aria-hidden="true" />
        <div className="sheet-head">
          <h2 id="series-sheet-title">编辑整个时间段</h2>
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
            value={title}
            onChange={(event) => {
              setTitle(event.target.value)
              if (error) setError('')
            }}
            placeholder="这段时间要做什么？"
            aria-label="时间段任务标题"
            autoComplete="off"
          />
          {error && <p className="form-error">{error}</p>}

          <div className="field">
            <div className="field-label">
              <span>日期范围</span>
              <span className="optional">
                {dayCount > 0 ? `共 ${dayCount} 天` : '请选择日期'}
              </span>
            </div>
            <div className="range-dates">
              <label className="range-date">
                <span>开始</span>
                <input
                  type="date"
                  value={start}
                  onChange={(event) => {
                    setError('')
                    setStart(event.target.value)
                  }}
                />
              </label>
              <span className="range-arrow">→</span>
              <label className="range-date">
                <span>结束</span>
                <input
                  type="date"
                  value={end}
                  min={start || todayKey()}
                  onChange={(event) => {
                    setError('')
                    setEnd(event.target.value)
                  }}
                />
              </label>
            </div>
            <p className="field-note">
              共享字段会更新区间内所有未完成的天，已完成的历史不会改动。
              延长日期会新增任务（并复制现有子任务结构），缩短会移除未完成的多余日期。
            </p>
          </div>

          <div className="field">
            <div className="field-label">
              <span>时间与时长</span>
              <span className="optional">可选</span>
            </div>
            <div className="time-row">
              <input
                type="time"
                className="time-input"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                aria-label="时间"
              />
              {quickDurations.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={cx(
                    'duration-chip',
                    duration === value && 'active',
                  )}
                  onClick={() =>
                    setDuration(duration === value ? undefined : value)
                  }
                >
                  {humanDuration(value)}
                </button>
              ))}
              <label className="duration-custom">
                <input
                  type="number"
                  min={5}
                  max={1440}
                  step={5}
                  inputMode="numeric"
                  value={customDurationValue}
                  onChange={(event) => {
                    if (!event.target.value) {
                      setDuration(undefined)
                      return
                    }
                    const minutes = Number(event.target.value)
                    setDuration(
                      Number.isFinite(minutes) && minutes > 0
                        ? Math.min(1440, Math.round(minutes))
                        : undefined,
                    )
                  }}
                  placeholder="自定义"
                  aria-label="自定义时长（分钟）"
                />
                <span>分钟</span>
              </label>
            </div>
          </div>

          <div className="field">
            <div className="field-label">优先级</div>
            <div className="segmented">
              {PRIORITIES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={cx(
                    'seg-option',
                    priority === item.value && 'active',
                  )}
                  onClick={() => setPriority(item.value)}
                  aria-pressed={priority === item.value}
                >
                  {item.value > 0 && (
                    <span
                      className={cx(
                        'prio-dot',
                        item.value === 2 ? 'high' : 'medium',
                      )}
                    />
                  )}
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <div className="field-label">
              <span>标签</span>
              <span className="optional">可选</span>
            </div>
            <div className="tag-editor">
              {tags.map((tag) => (
                <span className="tag-edit-chip" key={tag}>
                  {tag}
                  <button
                    type="button"
                    onClick={() =>
                      setTags((current) =>
                        current.filter((item) => item !== tag),
                      )
                    }
                    aria-label={`移除标签 ${tag}`}
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
              <input
                className="tag-input"
                value={tagDraft}
                onChange={(event) => setTagDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    commitTag()
                  }
                }}
                onBlur={commitTag}
                placeholder={tags.length ? '' : '输入标签，回车添加'}
                aria-label="添加标签"
              />
            </div>
          </div>

          <div className="field">
            <div className="field-label">
              <span>备注</span>
              <span className="optional">可选</span>
            </div>
            <textarea
              className="notes-input"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="这段时间的补充说明…"
              rows={3}
            />
          </div>

          <div className="series-edit-summary">
            <CalendarDays size={15} />
            <span>
              {start && end && start <= end
                ? `${humanDate(start)} – ${humanDate(end)}，共 ${dayCount} 天`
                : '请选择有效日期范围'}
            </span>
            {task.completed && (
              <span className="series-history-note">
                <Check size={12} /> 已完成的历史保持不变
              </span>
            )}
          </div>
        </div>

        <div className="sheet-footer">
          <button
            type="button"
            className="primary-btn"
            onClick={handleSave}
            disabled={busy}
          >
            {busy ? '保存中' : '保存整个时间段'}
          </button>
        </div>
      </div>
    </div>
  )
}
