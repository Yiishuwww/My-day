import { useMemo, useState } from 'react'
import { ArrowLeft, Check, Pencil, Tag, Trash2, X } from 'lucide-react'
import type { Task } from '../types'
import { TaskItem } from '../components/TaskItem'
import { EmptyState } from '../components/EmptyState'
import { deleteTag, renameTag } from '../db'
import { cx } from '../lib/utils'

interface Props {
  tasks: Task[]
  initialTag?: string
  onBack: () => void
  onToggle: (task: Task) => void
  onToggleSubtask: (task: Task, subtaskId: string) => void
  onEdit: (task: Task) => void
  onFocus: (task: Task) => void
  notify: (message: string) => void
}

export function TagsView({
  tasks,
  initialTag,
  onBack,
  onToggle,
  onToggleSubtask,
  onEdit,
  onFocus,
  notify,
}: Props) {
  const [selectedTag, setSelectedTag] = useState<string | null>(
    initialTag ?? null,
  )
  const [editingTag, setEditingTag] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

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

  const filteredTasks = useMemo(() => {
    if (!selectedTag) return []
    return tasks
      .filter((task) => task.tags.includes(selectedTag))
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
  }, [tasks, selectedTag])

  const startRename = (tag: string): void => {
    setEditingTag(tag)
    setDraft(tag)
  }

  const saveRename = async (): Promise<void> => {
    if (!editingTag) return
    const target = draft.replace(/^#+/, '').trim()
    if (!target) return
    if (target === editingTag) {
      setEditingTag(null)
      return
    }
    try {
      const count = await renameTag(editingTag, target)
      notify(`已重命名，影响 ${count} 个任务`)
      setEditingTag(null)
      if (selectedTag === editingTag) setSelectedTag(target)
    } catch {
      notify('重命名失败，请再试一次')
    }
  }

  const handleDelete = async (tag: string): Promise<void> => {
    if (
      !window.confirm(
        `删除标签「${tag}」？这会把它从所有任务中移除，任务本身不会删除。`,
      )
    ) {
      return
    }
    try {
      const count = await deleteTag(tag)
      notify(`已从 ${count} 个任务移除标签`)
    } catch {
      notify('删除失败，请再试一次')
    }
  }

  const handleBack = (): void => {
    if (selectedTag) {
      setSelectedTag(null)
      return
    }
    onBack()
  }

  return (
    <div className="view tags-view">
      <header className="tags-head">
        <button
          type="button"
          className="back-btn"
          onClick={handleBack}
          aria-label={selectedTag ? '返回标签列表' : '返回'}
        >
          <ArrowLeft size={19} />
        </button>
        <div className="tags-title">
          <p className="eyebrow">标签</p>
          <h1>{selectedTag ? `#${selectedTag}` : '标签管理'}</h1>
        </div>
        <span className="count-pill">
          {selectedTag ? filteredTasks.length : tagStats.length}
        </span>
      </header>

      {selectedTag ? (
        <section className="tag-tasks">
          {filteredTasks.length > 0 ? (
            <div className="task-list">
              {filteredTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  showDate
                  onToggle={onToggle}
                  onToggleSubtask={onToggleSubtask}
                  onOpen={onEdit}
                  onFocus={onFocus}
                  onTagClick={setSelectedTag}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Tag size={22} />}
              title="这个标签下没有任务"
              text="标签可能刚刚被重命名或移除了。"
              actionLabel="返回标签列表"
              onAction={() => setSelectedTag(null)}
            />
          )}
        </section>
      ) : tagStats.length > 0 ? (
        <div className="tag-manager-list">
          {tagStats.map(([tag, count]) => (
            <div className="tag-row" key={tag}>
              {editingTag === tag ? (
                <div className="tag-rename">
                  <span className="tag-hash">#</span>
                  <input
                    className="tag-rename-input"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void saveRename()
                      }
                      if (event.key === 'Escape') setEditingTag(null)
                    }}
                    autoFocus
                    aria-label="新的标签名称"
                  />
                  <button
                    type="button"
                    className="tag-action confirm"
                    onClick={() => void saveRename()}
                    aria-label="保存标签名称"
                  >
                    <Check size={15} />
                  </button>
                  <button
                    type="button"
                    className="tag-action"
                    onClick={() => setEditingTag(null)}
                    aria-label="取消重命名"
                  >
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className="tag-row-main"
                    onClick={() => setSelectedTag(tag)}
                  >
                    <span className="tag-hash">#</span>
                    <span className="tag-name">{tag}</span>
                    <span className="tag-count">{count}</span>
                  </button>
                  <button
                    type="button"
                    className={cx('tag-action')}
                    onClick={() => startRename(tag)}
                    aria-label={`重命名标签 ${tag}`}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className="tag-action danger"
                    onClick={() => void handleDelete(tag)}
                    aria-label={`删除标签 ${tag}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Tag size={22} />}
          title="还没有标签"
          text="在任务里输入 #标签，之后就能在这里管理并筛选它们。"
          actionLabel="返回"
          onAction={onBack}
        />
      )}
    </div>
  )
}
