import {
  useCallback,
  useEffect,
  useRef,
  type ComponentProps,
} from 'react'
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'
import type { Task } from '../types'
import { TaskItem } from './TaskItem'
import { cx } from '../lib/utils'

interface Props {
  tasks: Task[]
  onReorder: (orderedIds: string[]) => void
  itemProps: Omit<ComponentProps<typeof TaskItem>, 'task'>
}

function SortableTask({
  task,
  itemProps,
}: {
  task: Task
  itemProps: Omit<ComponentProps<typeof TaskItem>, 'task'>
}) {
  const { listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: task.id,
      data: { priority: task.priority },
    })
  const suppressClick = useRef(false)

  useEffect(() => {
    if (isDragging) {
      suppressClick.current = true
      return
    }
    if (!suppressClick.current) return
    const timer = window.setTimeout(() => {
      suppressClick.current = false
    }, 220)
    return () => window.clearTimeout(timer)
  }, [isDragging])

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      data-task-id={task.id}
      data-dragging={isDragging ? 'true' : undefined}
      className={cx('sortable-task', isDragging && 'is-dragging')}
      onClickCapture={(event) => {
        if (suppressClick.current) {
          event.preventDefault()
          event.stopPropagation()
        }
      }}
      {...listeners}
    >
      <TaskItem task={task} {...itemProps} />
    </div>
  )
}

/**
 * Flat task list with manual ordering inside the same priority group.
 * Today and Inbox share this behavior.
 */
export function SortableTaskList({ tasks, onReorder, itemProps }: Props) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 350, tolerance: 8 },
    }),
  )

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const activePriority = (
      args.active.data.current as { priority?: number } | undefined
    )?.priority
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter((container) => {
        const priority = (
          container.data.current as { priority?: number } | undefined
        )?.priority
        return priority === activePriority
      }),
    })
  }, [])

  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const source = tasks.find((task) => task.id === active.id)
    const target = tasks.find((task) => task.id === over.id)
    if (!source || !target || source.priority !== target.priority) return

    const group = tasks.filter((task) => task.priority === source.priority)
    const oldIndex = group.findIndex((task) => task.id === active.id)
    const newIndex = group.findIndex((task) => task.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    onReorder(
      arrayMove(group, oldIndex, newIndex).map((task) => task.id),
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={tasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="task-list">
          {tasks.map((task) => (
            <SortableTask key={task.id} task={task} itemProps={itemProps} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
