import type { ReactNode } from 'react'
import { cx } from '../lib/utils'

interface Props {
  icon: ReactNode
  title: string
  text: string
  actionLabel?: string
  onAction?: () => void
  compact?: boolean
}

export function EmptyState({
  icon,
  title,
  text,
  actionLabel,
  onAction,
  compact,
}: Props) {
  return (
    <div className={cx('empty', compact && 'compact')}>
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {actionLabel && onAction && (
        <button type="button" className="empty-action" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}
