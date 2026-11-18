import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  CalendarDays,
  ChevronRight,
  Download,
  Flame,
  Monitor,
  Moon,
  Share,
  Sun,
  Tag,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Task, ThemeMode } from '../types'
import { todayKey } from '../lib/dates'
import {
  clearAllData,
  exportBackup,
  exportCalendar,
  getLastBackupAt,
  importBackup,
} from '../lib/backup'
import { getTheme, setTheme } from '../lib/theme'
import { isIOS, isStandalone, cx } from '../lib/utils'

interface Props {
  tasks: Task[]
  notify: (message: string) => void
  onManageTags: () => void
  onOpenTrash: () => void
  onOpenReview: () => void
}

const THEME_OPTIONS: Array<{
  value: ThemeMode
  label: string
  icon: LucideIcon
}> = [
  { value: 'system', label: '跟随系统', icon: Monitor },
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
]

export function SettingsView({
  tasks,
  notify,
  onManageTags,
  onOpenTrash,
  onOpenReview,
}: Props) {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getTheme())
  const [lastBackupAt, setLastBackupAt] = useState(() => getLastBackupAt())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pageOpenedAt] = useState(() => Date.now())
  const backupDaysAgo = useMemo(
    () =>
      lastBackupAt
        ? Math.max(
            0,
            Math.floor((pageOpenedAt - lastBackupAt) / (24 * 60 * 60 * 1000)),
          )
        : null,
    [lastBackupAt, pageOpenedAt],
  )
  const needsBackup = backupDaysAgo === null || backupDaysAgo >= 30

  const today = todayKey()
  const completedCount = tasks.filter((task) => task.completed).length
  const openCount = tasks.filter(
    (task) =>
      !task.completed &&
      !(task.seriesId && task.date && task.date < today),
  ).length
  const showInstall = isIOS() && !isStandalone()

  const changeTheme = (mode: ThemeMode): void => {
    setThemeMode(mode)
    setTheme(mode)
  }

  const handleExportBackup = async (): Promise<void> => {
    try {
      const saved = await exportBackup()
      if (saved) setLastBackupAt(getLastBackupAt())
      notify(saved ? '备份已导出' : '已取消导出')
    } catch {
      notify('导出失败，请再试一次')
    }
  }

  const handleExportCalendar = async (): Promise<void> => {
    try {
      const saved = await exportCalendar(tasks)
      notify(saved ? '日历文件已导出' : '已取消导出')
    } catch {
      notify('导出失败，请再试一次')
    }
  }

  const handleImportFile = async (
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!window.confirm('导入会覆盖当前所有任务，确定继续吗？')) return
    try {
      const result = await importBackup(file)
      notify(
        `已导入 ${result.tasks} 个任务${result.habits ? `、${result.habits} 个习惯` : ''}`,
      )
    } catch {
      notify('导入失败：请选择正确的备份文件')
    }
  }

  const handleClear = async (): Promise<void> => {
    if (!window.confirm('确定清空所有任务、习惯和统计数据？此操作无法撤销。')) {
      return
    }
    try {
      await clearAllData()
      notify('所有数据已清空')
    } catch {
      notify('清空失败，请再试一次')
    }
  }

  return (
    <div className="view settings-view">
      <header className="page-head">
        <div>
          <p className="eyebrow">偏好</p>
          <h1>设置</h1>
        </div>
      </header>

      {showInstall && (
        <section className="install-card">
          <div className="install-icon">
            <Share size={19} />
          </div>
          <div>
            <h3>把它放到主屏幕</h3>
            <p>
              在 Safari 里点「分享」→「添加到主屏幕」，之后就能像 App
              一样全屏打开，也能离线使用。建议先添加再开始记录；之前的数据如未带过去，可以导出备份后再导入。
            </p>
          </div>
        </section>
      )}

      <section className="settings-group">
        <h2>外观</h2>
        <div className="segmented">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              className={cx('seg-option', themeMode === value && 'active')}
              onClick={() => changeTheme(value)}
              aria-pressed={themeMode === value}
            >
              <Icon size={15} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-group">
        <h2>整理</h2>
        <div className="setting-list">
          <button
            type="button"
            className="setting-row"
            onClick={onManageTags}
          >
            <span className="setting-icon">
              <Tag size={17} />
            </span>
            <span className="setting-text">
              <strong>标签管理</strong>
              <small>重命名、删除标签，或按标签查看任务</small>
            </span>
            <ChevronRight size={16} className="chev" />
          </button>
          <button
            type="button"
            className="setting-row"
            onClick={onOpenReview}
          >
            <span className="setting-icon">
              <Flame size={17} />
            </span>
            <span className="setting-text">
              <strong>习惯与统计</strong>
              <small>习惯打卡、连续天数和完成热力图</small>
            </span>
            <ChevronRight size={16} className="chev" />
          </button>
          <button
            type="button"
            className="setting-row"
            onClick={onOpenTrash}
          >
            <span className="setting-icon">
              <Undo2 size={17} />
            </span>
            <span className="setting-text">
              <strong>最近删除</strong>
              <small>误删的任务保留 30 天，可随时恢复</small>
            </span>
            <ChevronRight size={16} className="chev" />
          </button>
        </div>
      </section>

      <section className="settings-group">
        <h2>数据</h2>

        <div className="stat-card">
          <div className="stat-cell">
            <strong>{tasks.length}</strong>
            <span>全部任务</span>
          </div>
          <div className="stat-cell">
            <strong>{openCount}</strong>
            <span>待办</span>
          </div>
          <div className="stat-cell">
            <strong>{completedCount}</strong>
            <span>已完成</span>
          </div>
        </div>

        <div className="setting-list">
          <button
            type="button"
            className="setting-row"
            onClick={handleExportBackup}
          >
            <span className="setting-icon">
              <Download size={17} />
            </span>
            <span className="setting-text">
              <strong>导出备份</strong>
              <small>JSON 文件，包含全部任务</small>
            </span>
            <ChevronRight size={16} className="chev" />
          </button>

          <button
            type="button"
            className="setting-row"
            onClick={() => fileInputRef.current?.click()}
          >
            <span className="setting-icon">
              <Upload size={17} />
            </span>
            <span className="setting-text">
              <strong>导入备份</strong>
              <small>从 JSON 文件恢复，会覆盖当前数据</small>
            </span>
            <ChevronRight size={16} className="chev" />
          </button>

          <button
            type="button"
            className="setting-row"
            onClick={handleExportCalendar}
          >
            <span className="setting-icon">
              <CalendarDays size={17} />
            </span>
            <span className="setting-text">
              <strong>导出日历</strong>
              <small>生成 .ics，可导入苹果日历</small>
            </span>
            <ChevronRight size={16} className="chev" />
          </button>

          <button
            type="button"
            className="setting-row danger"
            onClick={handleClear}
          >
            <span className="setting-icon">
              <Trash2 size={17} />
            </span>
            <span className="setting-text">
              <strong>清空数据</strong>
              <small>删除本机上的所有任务，无法撤销</small>
            </span>
            <ChevronRight size={16} className="chev" />
          </button>
        </div>

        <div className={cx('backup-status', needsBackup && 'needs-backup')}>
          <span>
            {lastBackupAt
              ? `上次备份：${backupDaysAgo === 0 ? '今天' : `${backupDaysAgo} 天前`}`
              : '还没有导出过备份'}
          </span>
          {needsBackup && <strong>建议现在导出一份</strong>}
        </div>

        <p className="settings-note">
          数据只保存在这台设备的浏览器里。换手机或清理 Safari 数据前，记得先导出备份。
        </p>
      </section>

      <section className="settings-group">
        <h2>关于</h2>
        <div className="about-card">
          <div className="about-brand">
            <span className="about-logo">✓</span>
            <div>
              <strong>今日</strong>
              <small>待办 · 日历 · 只属于你</small>
            </div>
          </div>
          <p>
            一个本地优先的小工具，帮你把想做的事放进时间里。所有数据只保存在本机，不会上传到任何服务器。
          </p>
          <span className="version">v1.0.0</span>
        </div>
      </section>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden-input"
        onChange={handleImportFile}
      />
    </div>
  )
}
