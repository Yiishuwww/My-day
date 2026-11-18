import { Inbox, Plus, Settings, SunMedium, Timer } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cx } from '../lib/utils'

export type Tab = 'today' | 'inbox' | 'focus' | 'settings'

interface Props {
  active: Tab
  onChange: (tab: Tab) => void
  onCreate: () => void
}

const BEFORE: Array<{ key: Tab; label: string; icon: LucideIcon }> = [
  { key: 'today', label: '今日', icon: SunMedium },
  { key: 'inbox', label: '收件箱', icon: Inbox },
]

const AFTER: Array<{ key: Tab; label: string; icon: LucideIcon }> = [
  { key: 'focus', label: '专注', icon: Timer },
  { key: 'settings', label: '设置', icon: Settings },
]

export function TabBar({ active, onChange, onCreate }: Props) {
  const renderTab = ({
    key,
    label,
    icon: Icon,
  }: {
    key: Tab
    label: string
    icon: LucideIcon
  }) => (
    <button
      key={key}
      type="button"
      className={cx('tab', active === key && 'active')}
      onClick={() => onChange(key)}
      aria-current={active === key ? 'page' : undefined}
    >
      <Icon size={21} strokeWidth={active === key ? 2.2 : 1.9} />
      <span>{label}</span>
    </button>
  )

  return (
    <nav className="tabbar" aria-label="主导航">
      <div className="tabbar-inner">
        {BEFORE.map(renderTab)}
        <button
          type="button"
          className="tab-create"
          onClick={onCreate}
          aria-label="新建任务"
          title="新建任务"
        >
          <span className="tab-create-inner">
            <Plus size={24} strokeWidth={2.4} />
          </span>
        </button>
        {AFTER.map(renderTab)}
      </div>
    </nav>
  )
}
