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

const TABS: Array<{ key: Tab; label: string; icon: LucideIcon }> = [
  { key: 'today', label: '今日', icon: SunMedium },
  { key: 'calendar', label: '日历', icon: CalendarDays },
  { key: 'inbox', label: '收件箱', icon: Inbox },
  { key: 'focus', label: '专注', icon: Timer },
  { key: 'settings', label: '设置', icon: Settings },
]

export function TabBar({ active, onChange }: Props) {
  return (
    <nav className="tabbar" aria-label="主导航">
      <div className="tabbar-inner">
        {TABS.map(({ key, label, icon: Icon }) => (
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
        ))}
      </div>
    </nav>
  )
}
