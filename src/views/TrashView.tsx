import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Trash2, Undo2 } from 'lucide-react'
import type { TrashEntry } from '../types'
import {
  db,
  emptyTrash,
  permanentlyDeleteTrashEntry,
  purgeTrash,
  restoreTrashEntry,
} from '../db'
import { humanDateWithWeekday, humanDuration } from '../lib/dates'

interface Props {
  onBack: () => void
  notify: (message: string) => void
}

function deletedLabel(timestamp: number): string {
  const days = Math.floor((Date.now() - timestamp) / (24 * 60 * 60 * 1000))
  if (days <= 0) return '今天删除'
  if (days === 1) return '昨天删除'
  return `${days} 天前删除`
}

function taskMeta(entry: TrashEntry): string {
  const parts: string[] = []
  if (entry.task.date) parts.push(humanDateWithWeekday(entry.task.date))
  if (entry.task.time) {
    parts.push(
      entry.task.duration
        ? `${entry.task.time} · ${humanDuration(entry.task.duration)}`
        : entry.task.time,
    )
  } else if (entry.task.duration) {
    parts.push(humanDuration(entry.task.duration))
  }
  return parts.join(' · ')
}

export function TrashView({ onBack, notify }: Props) {
  const entries = useLiveQuery(
    () => db.trash.orderBy('deletedAt').reverse().toArray(),
    [],
    undefined,
  )

  useEffect(() => {
    void purgeTrash(30)
  }, [])

  const handleRestore = async (entry: TrashEntry): Promise<void> => {
    try {
      const restored = await restoreTrashEntry(entry.id)
      notify(restored ? '任务已恢复' : '任务已经存在，未覆盖')
    } catch {
      notify('恢复失败，请再试一次')
    }
  }

  const handleDelete = async (entry: TrashEntry): Promise<void> => {
    if (!window.confirm('彻底删除这个任务？此操作无法撤销。')) return
    try {
      await permanentlyDeleteTrashEntry(entry.id)
      notify('任务已彻底删除')
    } catch {
      notify('删除失败，请再试一次')
    }
  }

  const handleEmpty = async (): Promise<void> => {
    if (!window.confirm('清空最近删除？所有已删除任务将被彻底删除。')) return
    try {
      await emptyTrash()
      notify('最近删除已清空')
    } catch {
      notify('清空失败，请再试一次')
    }
  }

  const list = entries ?? []

  return (
    <div className="view trash-view">
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
          <p className="eyebrow">回收站</p>
          <h1>最近删除</h1>
        </div>
        <span className="count-pill">{list.length}</span>
      </header>

      <p className="trash-hint">
        删除的任务会保留 30 天，之后自动清理。
      </p>

      {list.length > 0 ? (
        <>
          <div className="trash-list">
            {list.map((entry) => {
              const meta = taskMeta(entry)
              return (
                <article className="trash-row" key={entry.id}>
                  <div className="trash-main">
                    <strong className="trash-title">{entry.task.title}</strong>
                    {meta && <span className="trash-meta">{meta}</span>}
                    <span className="trash-deleted">
                      {deletedLabel(entry.deletedAt)}
                    </span>
                  </div>
                  <div className="trash-actions">
                    <button
                      type="button"
                      className="trash-restore"
                      onClick={() => void handleRestore(entry)}
                    >
                      <Undo2 size={14} />
                      恢复
                    </button>
                    <button
                      type="button"
                      className="trash-delete"
                      onClick={() => void handleDelete(entry)}
                      aria-label={`彻底删除：${entry.task.title}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
          <button
            type="button"
            className="trash-empty"
            onClick={() => void handleEmpty()}
          >
            清空最近删除
          </button>
        </>
      ) : (
        <div className="empty">
          <div className="empty-icon">
            <Trash2 size={22} />
          </div>
          <h3>没有已删除的任务</h3>
          <p>删除任务后会先放在这里，30 天内都可以恢复。</p>
        </div>
      )}
    </div>
  )
}
