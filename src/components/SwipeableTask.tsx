import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { Check, Trash2 } from 'lucide-react'
import { cx } from '../lib/utils'

interface Props {
  onComplete: () => void
  onDelete: () => void
  children: ReactNode
}

const COMPLETE_AT = 72
const DELETE_AT = 80
const MAX_PULL = 116

/**
 * Touch-only swipe actions around a task card.
 * Right = complete / uncomplete, left = move to trash (undo toast handles
 * mistakes). Long-press drag wins because pointer moves are ignored while the
 * dnd-kit wrapper is active.
 */
export function SwipeableTask({ onComplete, onDelete, children }: Props) {
  const [direction, setDirection] = useState<'complete' | 'delete' | null>(
    null,
  )
  const contentRef = useRef<HTMLDivElement>(null)
  const gesture = useRef({
    id: -1,
    startX: 0,
    startY: 0,
    dx: 0,
    active: false,
    swiping: false,
  })
  const suppressClick = useRef(false)
  const suppressTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    return () => {
      if (suppressTimer.current) window.clearTimeout(suppressTimer.current)
    }
  }, [])

  const clearTransform = (animate: boolean): void => {
    const element = contentRef.current
    if (!element) return
    element.style.transition = animate
      ? 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)'
      : 'none'
    element.style.transform = ''
  }

  const suppressNextClick = (): void => {
    suppressClick.current = true
    if (suppressTimer.current) window.clearTimeout(suppressTimer.current)
    suppressTimer.current = window.setTimeout(() => {
      suppressClick.current = false
    }, 350)
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.pointerType === 'mouse' || !event.isPrimary) return
    if (contentRef.current?.closest('[data-dragging="true"]')) return
    setDirection(null)
    gesture.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dx: 0,
      active: true,
      swiping: false,
    }
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const current = gesture.current
    if (!current.active || current.id !== event.pointerId) return
    if (contentRef.current?.closest('[data-dragging="true"]')) {
      current.active = false
      current.swiping = false
      setDirection(null)
      clearTransform(true)
      return
    }

    const dx = event.clientX - current.startX
    const dy = event.clientY - current.startY
    if (!current.swiping) {
      if (Math.abs(dx) < 10 || Math.abs(dx) <= Math.abs(dy) * 1.15) return
      current.swiping = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }

    event.preventDefault()
    const abs = Math.min(MAX_PULL + 20, Math.abs(dx))
    const pulled =
      abs <= MAX_PULL ? abs : MAX_PULL + (abs - MAX_PULL) * 0.3
    current.dx = Math.sign(dx) * pulled
    const nextDirection = dx >= 0 ? 'complete' : 'delete'
    setDirection((previous) =>
      previous === nextDirection ? previous : nextDirection,
    )
    const element = contentRef.current
    if (element) {
      element.style.transition = 'none'
      element.style.transform = `translateX(${current.dx}px)`
    }
  }

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    const current = gesture.current
    if (!current.active || current.id !== event.pointerId) return
    const swiped = current.swiping
    const dx = current.dx
    current.active = false
    current.swiping = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (!swiped) return
    setDirection(null)
    suppressNextClick()
    if (dx >= COMPLETE_AT) {
      clearTransform(false)
      onComplete()
    } else if (dx <= -DELETE_AT) {
      clearTransform(false)
      onDelete()
    } else {
      clearTransform(true)
    }
  }

  const handlePointerCancel = (): void => {
    gesture.current.active = false
    gesture.current.swiping = false
    setDirection(null)
    clearTransform(true)
  }

  const handleClickCapture = (event: MouseEvent<HTMLDivElement>): void => {
    if (!suppressClick.current) return
    event.preventDefault()
    event.stopPropagation()
  }

  return (
    <div className="swipe-row">
      <div
        className={cx(
          'swipe-bg',
          direction === 'delete'
            ? 'swipe-bg-delete'
            : 'swipe-bg-complete',
        )}
        aria-hidden="true"
      >
        {direction === 'delete' ? (
          <Trash2 size={19} />
        ) : (
          <Check size={20} strokeWidth={3} />
        )}
      </div>
      <div
        ref={contentRef}
        className="swipe-content"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClickCapture={handleClickCapture}
      >
        {children}
      </div>
    </div>
  )
}
