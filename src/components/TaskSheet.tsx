import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, Check, Clock, Plus, Trash2, X } from 'lucide-react'
import type { Priority, Recurrence, Subtask, Task } from '../types'
import {
  createTask,
  createTaskRange,
  deleteTask,
  deleteTaskSeries,
  updateTask,
} from '../db'
import {
  addDaysKey,
  daysBetweenKeys,
  humanDate,
  humanDuration,
  todayKey,
} from '../lib/dates'
import { parseQuickAdd } from '../lib/parse'
import { cx, uid } from '../lib/utils'

export type SheetState =
  | { mode: 'new'; initial?: Partial<Task> }
  | { mode: 'edit'; task: Task }

interface Props {
  state: SheetState
  onClose: () => void
  onSaved: (message: string) => void
}

const PRIORITIES: Array<{ value: Priority; label: string }> = [
  { value: 0, label: '无' },
  { value: 1, label: '中' },
  { value: 2, label: '高' },
]

const RECURRENCES: Array<{ value: Recurrence | ''; label: string }> = [
  { value: '', label: '不重复' },
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
  { value: 'weekdays', label: '工作日' },
]

function splitTagInput(value: string): string[] {
  return value
    .split(/[,，、\s]+/)
    .map((tag) => tag.replace(/^#+/, '').trim())
    .filter(Boolean)
}

export function TaskSheet({ state, onClose, onSaved }: Props) {
  const editing = state.mode === 'edit'
  const task = state.mode === 'edit' ? state.task : undefined
  const initial = state.mode === 'new' ? state.initial : undefined
  const initialDay = task?.date ?? initial?.date ?? todayKey()
  const isSeriesTask = Boolean(
    task?.seriesId && task.rangeStart && task.rangeEnd,
  )

  const [title, setTitle] = useState(task?.title ?? '')
  const [notes, setNotes] = useState(task?.notes ?? initial?.notes ?? '')
  const [date, setDate] = useState<string | undefined>(
    task?.date ?? initial?.date,
  )
  const [dateTouched, setDateTouched] = useState(false)
  const [rangeMode, setRangeMode] = useState(false)
  const [rangeStart, setRangeStart] = useState(
    task?.rangeStart ?? initialDay,
  )
  const [rangeEnd, setRangeEnd] = useState(
    task?.rangeEnd ?? addDaysKey(task?.rangeStart ?? initialDay, 6),
  )
  const [time, setTime] = useState(task?.time ?? initial?.time ?? '')
  const [timeTouched, setTimeTouched] = useState(editing)
  const [duration, setDuration] = useState<number | undefined>(
    task?.duration ?? initial?.duration,
  )
  const [durationTouched, setDurationTouched] = useState(editing)
  const [priority, setPriority] = useState<Priority>(
    task?.priority ?? initial?.priority ?? 0,
  )
  const [recurrence, setRecurrence] = useState<Recurrence | ''>(
    task?.recurrence ?? initial?.recurrence ?? '',
  )
  const [tags, setTags] = useState<string[]>(
    task?.tags ?? initial?.tags ?? [],
  )
  const [tagDraft, setTagDraft] = useState('')
  const [subtasks, setSubtasks] = useState<Subtask[]>(
    task?.subtasks ?? initial?.subtasks ?? [],
  )
  const [newSubtask, setNewSubtask] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  const parsed = useMemo(
    () => (editing ? undefined : parseQuickAdd(title)),
    [editing, title],
  )

  const parsedDate = parsed?.date
  const parsedTime = parsed?.time
  const parsedDuration = parsed?.duration
  const parsedTags = parsed?.tags ?? []
  const parsedTitle = parsed?.title ?? ''

  const effectiveDate = editing
    ? date
    : dateTouched
      ? date
      : (parsedDate ?? date)
  const effectiveTime = editing
    ? time
    : timeTouched
      ? time
      : (parsedTime ?? time)
  const effectiveDuration = editing
    ? duration
    : durationTouched
      ? duration
      : (parsedDuration ?? duration)

  const showParsedDate = Boolean(
    !editing && !rangeMode && parsedDate && !dateTouched,
  )
  const showParsedTime = Boolean(!editing && parsedTime && !timeTouched)
  const showParsedDuration = Boolean(
    !editing && parsedDuration && !durationTouched,
  )
  const showParsedTitle = Boolean(
    !editing && parsedTitle && parsedTitle !== title.trim(),
  )
  const hasParseInfo =
    showParsedDate ||
    showParsedTime ||
    showParsedDuration ||
    parsedTags.length > 0 ||
    showParsedTitle

  const today = todayKey()
  const tomorrow = addDaysKey(today, 1)
  const dayAfter = addDaysKey(today, 2)
  const quickDates = [
    { label: '今天', value: today },
    { label: '明天', value: tomorrow },
    { label: '后天', value: dayAfter },
  ]
  const customDateActive = Boolean(
    effectiveDate &&
      effectiveDate !== today &&
      effectiveDate !== tomorrow &&
      effectiveDate !== dayAfter,
  )
  const customDateLabel =
    effectiveDate && customDateActive ? humanDate(effectiveDate) : '选日期'

  const quickDurations = [15, 30]
  const customDurationValue =
    effectiveDuration && !quickDurations.includes(effectiveDuration)
      ? effectiveDuration
      : ''
  const rangeDayCount = useMemo(() => {
    if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) return 0
    return daysBetweenKeys(rangeStart, rangeEnd) + 1
  }, [rangeStart, rangeEnd])

  useEffect(() => {
    if (editing) return
    const timer = window.setTimeout(() => titleRef.current?.focus(), 320)
    return () => window.clearTimeout(timer)
  }, [editing])

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

  const chooseDate = (value: string | undefined): void => {
    setError('')
    setDate(value)
    setDateTouched(true)
  }

  const chooseDuration = (value: number): void => {
    setDurationTouched(true)
    setDuration(effectiveDuration === value ? undefined : value)
  }

  const setCustomDuration = (value: string): void => {
    setDurationTouched(true)
    if (!value) {
      setDuration(undefined)
      return
    }
    const minutes = Number(value)
    if (Number.isFinite(minutes) && minutes > 0) {
      setDuration(Math.min(1440, Math.round(minutes)))
    } else {
      setDuration(undefined)
    }
  }

  const enableRangeMode = (): void => {
    setError('')
    const start = effectiveDate ?? today
    setRangeStart(start)
    setRangeEnd(addDaysKey(start, 6))
    setRangeMode(true)
    setRecurrence('')
  }

  const commitTag = (): void => {
    const next = splitTagInput(tagDraft)
    if (next.length) {
      setTags((current) => Array.from(new Set([...current, ...next])))
    }
    setTagDraft('')
  }

  const removeTag = (tag: string): void => {
    setTags((current) => current.filter((item) => item !== tag))
  }

  const addSubtask = (): void => {
    const value = newSubtask.trim()
    if (!value) return
    setSubtasks((current) => [...current, { id: uid(), title: value, done: false }])
    setNewSubtask('')
  }

  const toggleSubtask = (id: string): void => {
    setSubtasks((current) =>
      current.map((subtask) =>
        subtask.id === id ? { ...subtask, done: !subtask.done } : subtask,
      ),
    )
  }

  const updateSubtaskTitle = (id: string, value: string): void => {
    setSubtasks((current) =>
      current.map((subtask) =>
        subtask.id === id ? { ...subtask, title: value } : subtask,
      ),
    )
  }

  const removeSubtask = (id: string): void => {
    setSubtasks((current) => current.filter((subtask) => subtask.id !== id))
  }

  const handleSave = async (): Promise<void> => {
    if (busy) return
    const finalTitle = (editing ? title : parsedTitle).trim()
    if (!finalTitle) {
      setError('先写点要做什么吧')
      titleRef.current?.focus()
      return
    }

    if (rangeMode) {
      if (!rangeStart || !rangeEnd) {
        setError('请选择开始和结束日期')
        return
      }
      if (rangeStart > rangeEnd) {
        setError('结束日期不能早于开始日期')
        return
      }
      const dayCount = daysBetweenKeys(rangeStart, rangeEnd) + 1
      if (dayCount > 366) {
        setError('日期段最多 366 天')
        return
      }
    } else if (!isSeriesTask) {
      if (recurrence && !effectiveDate) {
        setError('重复任务需要先选择一个日期')
        return
      }
      if (effectiveTime && !effectiveDate) {
        setError('设置时间后需要选择一个日期')
        return
      }
    }

    const finalTags = Array.from(
      new Set(
        [...tags, ...splitTagInput(tagDraft), ...parsedTags]
          .map((tag) => tag.replace(/^#+/, '').trim())
          .filter(Boolean),
      ),
    )
    const finalSubtasks = [
      ...subtasks,
      ...(newSubtask.trim()
        ? [{ id: uid(), title: newSubtask.trim(), done: false }]
        : []),
    ]
      .map((subtask) => ({ ...subtask, title: subtask.title.trim() }))
      .filter((subtask) => subtask.title.length > 0)
    const resolvedDuration =
      effectiveDuration && effectiveDuration > 0
        ? effectiveDuration
        : undefined

    setBusy(true)
    try {
      if (rangeMode) {
        const count = await createTaskRange({
          title: finalTitle,
          notes: notes.trim(),
          start: rangeStart,
          end: rangeEnd,
          time: effectiveTime || undefined,
          duration: resolvedDuration,
          priority,
          tags: finalTags,
          subtasks: finalSubtasks,
        })
        onSaved(`已添加 ${count} 天的任务`)
        return
      }

      const payload = {
        title: finalTitle,
        notes: notes.trim(),
        date: effectiveDate || undefined,
        time: effectiveTime || undefined,
        duration: resolvedDuration,
        priority,
        tags: finalTags,
        subtasks: finalSubtasks,
        recurrence: isSeriesTask ? undefined : recurrence || undefined,
      }

      if (editing && task) {
        await updateTask(task.id, payload)
        onSaved('已保存')
      } else {
        await createTask(payload)
        onSaved('已添加任务')
      }
    } catch {
      setError('保存失败了，请再试一次')
      setBusy(false)
    }
  }

  const handleDelete = async (): Promise<void> => {
    if (!task || busy) return
    if (!window.confirm('删除这个任务？')) return
    setBusy(true)
    try {
      await deleteTask(task.id)
      onSaved('已删除任务')
    } catch {
      setError('删除失败，请再试一次')
      setBusy(false)
    }
  }

  const handleDeleteSeries = async (): Promise<void> => {
    if (!task?.seriesId || busy) return
    if (!window.confirm('删除整个时间段的全部任务？')) return
    setBusy(true)
    try {
      await deleteTaskSeries(task.seriesId)
      onSaved('已删除整个时间段')
    } catch {
      setError('删除失败，请再试一次')
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
        aria-labelledby="sheet-title"
      >
        <div className="sheet-grab" aria-hidden="true" />
        <div className="sheet-head">
          <h2 id="sheet-title">{editing ? '编辑任务' : '新建任务'}</h2>
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
            ref={titleRef}
            className="title-input"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value)
              if (error) setError('')
            }}
            placeholder="要做什么？"
            aria-label="任务内容"
            autoComplete="off"
            autoCorrect="off"
            enterKeyHint="done"
          />
          {error && <p className="form-error">{error}</p>}

          {hasParseInfo && (
            <div className="parse-hint">
              <span className="parse-hint-label">已识别</span>
              {showParsedDate && parsedDate && (
                <span className="parsed-chip">
                  <CalendarDays size={12} />
                  {humanDate(parsedDate)}
                </span>
              )}
              {showParsedTime && parsedTime && (
                <span className="parsed-chip">
                  <Clock size={12} />
                  {parsedTime}
                </span>
              )}
              {showParsedDuration && parsedDuration && (
                <span className="parsed-chip">
                  <Clock size={12} />
                  {humanDuration(parsedDuration)}
                </span>
              )}
              {parsedTags.map((tag) => (
                <span className="parsed-chip" key={tag}>
                  #{tag}
                </span>
              ))}
              {showParsedTitle && (
                <span className="parsed-title">将保存为「{parsedTitle}」</span>
              )}
            </div>
          )}

          <div className="field">
            <div className="field-label">
              <span>日期</span>
              {isSeriesTask && <span className="optional">日期段</span>}
            </div>

            {isSeriesTask ? (
              <div className="series-info">
                <div className="series-info-row">
                  {task?.date && (
                    <span className="meta-chip">{humanDate(task.date)}</span>
                  )}
                  <span className="meta-chip">
                    区间 {task?.rangeStart ? humanDate(task.rangeStart) : ''} –{' '}
                    {task?.rangeEnd ? humanDate(task.rangeEnd) : ''}
                  </span>
                </div>
                <p>日期段任务，修改只影响这一天。</p>
                <button
                  type="button"
                  className="text-btn danger-text"
                  onClick={handleDeleteSeries}
                >
                  删除整个时间段
                </button>
              </div>
            ) : (
              <>
                {!editing && (
                  <div className="segmented date-mode-toggle">
                    <button
                      type="button"
                      className={cx('seg-option', !rangeMode && 'active')}
                      onClick={() => {
                        setRangeMode(false)
                        setError('')
                      }}
                    >
                      单日
                    </button>
                    <button
                      type="button"
                      className={cx('seg-option', rangeMode && 'active')}
                      onClick={enableRangeMode}
                    >
                      日期段
                    </button>
                  </div>
                )}

                {rangeMode ? (
                  <>
                    <div className="range-dates">
                      <label className="range-date">
                        <span>开始</span>
                        <input
                          type="date"
                          value={rangeStart}
                          onChange={(event) => {
                            setError('')
                            setRangeStart(event.target.value)
                          }}
                        />
                      </label>
                      <span className="range-arrow">→</span>
                      <label className="range-date">
                        <span>结束</span>
                        <input
                          type="date"
                          value={rangeEnd}
                          min={rangeStart || today}
                          onChange={(event) => {
                            setError('')
                            setRangeEnd(event.target.value)
                          }}
                        />
                      </label>
                    </div>
                    <p className="field-note">
                      {rangeDayCount > 0
                        ? `共 ${rangeDayCount} 天，每天生成一条任务；最后一天会显示“最后一天！”。`
                        : '请选择开始和结束日期。'}
                    </p>
                  </>
                ) : (
                  <div className="chip-row">
                    {quickDates.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        className={cx(
                          'chip',
                          effectiveDate === item.value && 'active',
                        )}
                        onClick={() => chooseDate(item.value)}
                      >
                        {item.label}
                      </button>
                    ))}
                    <label
                      className={cx(
                        'chip date-chip',
                        customDateActive && 'active',
                      )}
                    >
                      <CalendarDays size={14} />
                      <span>{customDateLabel}</span>
                      <input
                        type="date"
                        value={effectiveDate ?? ''}
                        onChange={(event) =>
                          chooseDate(event.target.value || undefined)
                        }
                        aria-label="选择日期"
                      />
                    </label>
                    <button
                      type="button"
                      className={cx('chip', !effectiveDate && 'active')}
                      onClick={() => chooseDate(undefined)}
                    >
                      无日期
                    </button>
                  </div>
                )}
              </>
            )}
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
                value={effectiveTime}
                onChange={(event) => {
                  const value = event.target.value
                  setTime(value)
                  setTimeTouched(true)
                  if (value && !rangeMode && !effectiveDate) chooseDate(today)
                }}
                aria-label="时间"
              />
              {quickDurations.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={cx(
                    'duration-chip',
                    effectiveDuration === value && 'active',
                  )}
                  onClick={() => chooseDuration(value)}
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
                  onChange={(event) => setCustomDuration(event.target.value)}
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

          {!rangeMode && !isSeriesTask && (
            <div className="field">
              <div className="field-label">重复</div>
              <div className="chip-row">
                {RECURRENCES.map((item) => (
                  <button
                    key={item.value || 'none'}
                    type="button"
                    className={cx(
                      'chip',
                      recurrence === item.value && 'active',
                    )}
                    onClick={() => {
                      if (error) setError('')
                      setRecurrence(item.value)
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              {recurrence && (
                <p className="field-note">
                  {effectiveDate
                    ? '完成后会自动生成下一次任务'
                    : '重复任务需要先选择一个日期'}
                </p>
              )}
            </div>
          )}

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
                    onClick={() => removeTag(tag)}
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
              <span>子任务</span>
              <span className="optional">可选</span>
            </div>
            <div className="subtask-list">
              {subtasks.map((subtask) => (
                <div className="subtask-item" key={subtask.id}>
                  <button
                    type="button"
                    className={cx('sub-check', subtask.done && 'checked')}
                    onClick={() => toggleSubtask(subtask.id)}
                    aria-pressed={subtask.done}
                    aria-label={
                      subtask.done ? '标记子任务未完成' : '完成子任务'
                    }
                  >
                    {subtask.done && <Check size={12} strokeWidth={3} />}
                  </button>
                  <input
                    className={cx(
                      'subtask-input',
                      subtask.done && 'done',
                    )}
                    value={subtask.title}
                    onChange={(event) =>
                      updateSubtaskTitle(subtask.id, event.target.value)
                    }
                    aria-label="子任务内容"
                  />
                  <button
                    type="button"
                    className="subtask-remove"
                    onClick={() => removeSubtask(subtask.id)}
                    aria-label="删除子任务"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <div className="subtask-add">
                <input
                  value={newSubtask}
                  onChange={(event) => setNewSubtask(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      addSubtask()
                    }
                  }}
                  placeholder="添加子任务"
                  aria-label="添加子任务"
                />
                <button
                  type="button"
                  className="mini-add"
                  onClick={addSubtask}
                  disabled={!newSubtask.trim()}
                  aria-label="添加子任务"
                >
                  <Plus size={15} />
                </button>
              </div>
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
              placeholder="补充一点细节…"
              rows={3}
            />
          </div>
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
              <span>{isSeriesTask ? '删除这天' : '删除'}</span>
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
