import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Flag,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import type { Priority, Task } from '../types'
import { EmptyState } from '../components/EmptyState'
import {
  addDaysKey,
  humanDateWithWeekday,
  humanDuration,
  todayKey,
} from '../lib/dates'
import { cx } from '../lib/utils'

type StatusFilter = 'open' | 'done' | 'all'

interface Props {
  tasks: Task[]
  onBack: () => void
  onEdit: (task: Task) => void
  onBulkComplete: (tasks: Task[]) => void
  onBulkTrash: (tasks: Task[]) => void
  onBulkReschedule: (tasks: Task[], date: string | null) => void
}

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'open', label: '待办' },
  { value: 'done', label: '已完成' },
  { value: 'all', label: '全部' },
]

const PRIORITY_OPTIONS: Array<{ value: Priority | null; label: string }> = [
  { value: null, label: '全部优先级' },
  { value: 2, label: '高' },
  { value: 1, label: '中' },
  { value: 0, label: '无' },
]

export function SearchView({
  tasks,
  onBack,
  onEdit,
  onBulkComplete,
  onBulkTrash,
  onBulkReschedule,
}: Props) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('open')
  const [priority, setPriority] = useState<Priority | null>(null)
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [dateMenuOpen, setDateMenuOpen] = useState(false)

  const tagStats = useMemo(() => {
    const counts = new Map<string, number>()
    for (const task of tasks) {
      for (const tag of task.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
    }
    return Array.from(counts.entries()).sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh'),
    )
  }, [tasks])

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return tasks
      .filter((task) => {
        if (status === 'open' && task.completed) return false
        if (status === 'done' && !task.completed) return false
        if (priority !== null && task.priority !== priority) return false
        if (tagFilter && !task.tags.includes(tagFilter)) return false
        if (!needle) return true
        const haystack = [
          task.title,
          task.notes,
          task.tags.map((tag) => `#${tag}`).join(' '),
          task.subtasks.map((subtask) => subtask.title).join(' '),
        ]
          .join('\n')
          .toLowerCase()
        return haystack.includes(needle)
      })
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1
        const aDate = a.date ?? '9999-99-99'
        const bDate = b.date ?? '9999-99-99'
        if (aDate !== bDate) return aDate < bDate ? -1 : 1
        const aTime = a.time ?? '99:99'
        const bTime = b.time ?? '99:99'
        if (aTime !== bTime) return aTime < bTime ? -1 : 1
        return a.createdAt - b.createdAt
      })
  }, [tasks, query, status, priority, tagFilter])

  const selectedTasks = tasks.filter((task) => selected.has(task.id))

  const clearSelection = (): void => {
    setSelected(new Set())
    setDateMenuOpen(false)
  }

  const toggleSelectMode = (): void => {
    setSelectMode((value) => !value)
    clearSelection()
  }

  const toggleSelected = (id: string): void => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const changeStatus = (value: StatusFilter): void => {
    setStatus(value)
    clearSelection()
  }

  const changePriority = (value: Priority | null): void => {
    setPriority(value)
    clearSelection()
  }

  const changeTag = (tag: string | null): void => {
    setTagFilter(tag === tagFilter ? null : tag)
    clearSelection()
  }

  const handleComplete = (): void => {
    if (!selectedTasks.length) return
    onBulkComplete(selectedTasks)
    setSelectMode(false)
    clearSelection()
  }

  const handleTrash = (): void => {
    if (!selectedTasks.length) return
    onBulkTrash(selectedTasks)
    setSelectMode(false)
    clearSelection()
  }

  const applyDate = (date: string | null): void => {
    if (!selectedTasks.length) return
    onBulkReschedule(selectedTasks, date)
    setSelectMode(false)
    clearSelection()
  }

  const today = todayKey()

  return (
    <div
      className={cx('view search-view', selectMode && 'has-selection')}
    >
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
          <p className="eyebrow">查找</p>
          <h1>搜索</h1>
        </div>
        <button type="button" className="text-btn" onClick={toggleSelectMode}>
          {selectMode ? '取消' : '选择'}
        </button>
      </header>

      <div className="search-box">
        <Search size={17} />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            clearSelection()
          }}
          placeholder="搜索标题、备注、子任务、标签"
          aria-label="搜索任务"
          autoFocus
          autoComplete="off"
          autoCorrect="off"
        />
        {query && (
          <button
            type="button"
            className="search-clear"
            onClick={() => {
              setQuery('')
              clearSelection()
            }}
            aria-label="清除搜索"
          >
            <X size={15} />
          </button>
        )}
      </div>

      <div className="segmented search-status">
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={cx(
              'seg-option',
              status === option.value && 'active',
            )}
            onClick={() => changeStatus(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="chip-row search-priority-row">
        {PRIORITY_OPTIONS.map((option) => (
          <button
            key={option.label}
            type="button"
            className={cx(
              'chip',
              priority === option.value && 'active',
            )}
            onClick={() => changePriority(option.value)}
          >
            {option.value === 2 && <span className="prio-dot high" />}
            {option.value === 1 && <span className="prio-dot medium" />}
            {option.label}
          </button>
        ))}
      </div>

      {tagStats.length > 0 && (
        <div className="search-tags">
          {tagStats.map(([tag]) => (
            <button
              key={tag}
              type="button"
              className={cx('chip tag-filter-chip', tagFilter === tag && 'active')}
              onClick={() => changeTag(tag)}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      <div className="search-summary">
        <span>{results.length} 条结果</span>
        {(query || tagFilter || priority !== null || status !== 'open') && (
          <button
            type="button"
            className="text-btn"
            onClick={() => {
              setQuery('')
              setStatus('open')
              setPriority(null)
              setTagFilter(null)
              clearSelection()
            }}
          >
            清除筛选
          </button>
        )}
      </div>

      {results.length > 0 ? (
        <div className="search-results">
          {results.map((task) => {
            const selectedTask = selected.has(task.id)
            const meta = task.date
              ? humanDateWithWeekday(task.date)
              : '收件箱'
            return (
              <div
                key={task.id}
                className={cx(
                  'search-result',
                  task.completed && 'is-done',
                  selectedTask && 'is-selected',
                )}
              >
                {selectMode && (
                  <button
                    type="button"
                    className={cx(
                      'search-select',
                      selectedTask && 'checked',
                    )}
                    onClick={() => toggleSelected(task.id)}
                    role="checkbox"
                    aria-checked={selectedTask}
                    aria-label={`选择任务：${task.title}`}
                  >
                    {selectedTask && <Check size={13} strokeWidth={3} />}
                  </button>
                )}
                <button
                  type="button"
                  className="search-result-main"
                  onClick={() =>
                    selectMode ? toggleSelected(task.id) : onEdit(task)
                  }
                >
                  <span className="search-result-title-row">
                    {task.priority > 0 && (
                      <Flag
                        size={12}
                        className={cx(
                          'priority-flag',
                          task.priority === 2 ? 'high' : 'medium',
                        )}
                        fill="currentColor"
                      />
                    )}
                    <span className="search-result-title">{task.title}</span>
                  </span>
                  <span className="search-result-meta">
                    <span className="meta-chip">{meta}</span>
                    {task.time && (
                      <span className="meta-item">
                        {task.time}
                        {task.duration
                          ? ` · ${humanDuration(task.duration)}`
                          : ''}
                      </span>
                    )}
                    {!task.time && task.duration && (
                      <span className="meta-item">
                        {humanDuration(task.duration)}
                      </span>
                    )}
                    {task.tags.map((tag) => (
                      <span key={tag} className="search-result-tag">
                        #{tag}
                      </span>
                    ))}
                  </span>
                  {task.notes.trim() && (
                    <span className="search-result-notes">{task.notes}</span>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Search size={22} />}
          title="没有找到任务"
          text="换个关键词，或者放宽筛选条件试试。"
        />
      )}

      {selectMode && (
        <div className="selection-bar">
          <div className="selection-info">
            <strong>{selected.size}</strong>
            <span>已选择</span>
          </div>
          <div className="selection-actions">
            <button
              type="button"
              onClick={handleComplete}
              disabled={selected.size === 0}
            >
              <Check size={16} />
              完成
            </button>
            <button
              type="button"
              onClick={() => setDateMenuOpen(true)}
              disabled={selected.size === 0}
            >
              <CalendarDays size={16} />
              改期
            </button>
            <button
              type="button"
              className="danger"
              onClick={handleTrash}
              disabled={selected.size === 0}
            >
              <Trash2 size={16} />
              删除
            </button>
          </div>
        </div>
      )}

      {dateMenuOpen && (
        <div
          className="bulk-date-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setDateMenuOpen(false)
            }
          }}
        >
          <div className="bulk-date-sheet">
            <p>把 {selected.size} 个任务移到</p>
            <div className="chip-row">
              <button
                type="button"
                className="chip"
                onClick={() => applyDate(today)}
              >
                今天
              </button>
              <button
                type="button"
                className="chip"
                onClick={() => applyDate(addDaysKey(today, 1))}
              >
                明天
              </button>
              <button
                type="button"
                className="chip"
                onClick={() => applyDate(addDaysKey(today, 2))}
              >
                后天
              </button>
              <button
                type="button"
                className="chip"
                onClick={() => applyDate(null)}
              >
                无日期
              </button>
              <label className="chip date-chip">
                <CalendarDays size={14} />
                选日期
                <input
                  type="date"
                  aria-label="批量选择日期"
                  onChange={(event) => {
                    if (event.target.value) applyDate(event.target.value)
                  }}
                />
              </label>
              <button
                type="button"
                className="chip"
                onClick={() => setDateMenuOpen(false)}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
