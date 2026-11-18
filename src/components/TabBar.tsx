import {
  CalendarDays,
  Inbox,
  Settings,
  SunMedium,
  Timer,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cx } from '../lib/utils'

export type Tab = 'today' | 'calendar' | 'inbox' | 'focus' | 'settings'

interface Props {
  active: Tab
  onChange: (tab: Tab) => void
}

const BEFORE: Array<{ key: Tab; label: string; icon: LucideIcon }> = [
  { key: 'inbox', label: '收件箱', icon: Inbox },
  { key: 'calendar', label: '日历', icon: CalendarDays },
]

const AFTER: Array<{ key: Tab; label: string; icon: LucideIcon }> = [
  { key: 'focus', label: '专注', icon: Timer },
  { key: 'settings', label: '设置', icon: Settings },
]

export function TabBar({ active, onChange }: Props) {
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
          className={cx('tab', 'tab-home', active === 'today' && 'active')}
          onClick={() => onChange('today')}
          aria-current={active === 'today' ? 'page' : undefined}
          aria-label="今日"
        >
          <span className="tab-home-icon">
            <SunMedium
              size={22}
              strokeWidth={active === 'today' ? 2.3 : 2}
            />
          </span>
          <span>今日</span>
        </button>
        {AFTER.map(renderTab)}
      </div>
    </nav>
  )
}
