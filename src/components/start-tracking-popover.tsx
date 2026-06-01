'use client'

import { useEffect, useMemo, useState } from 'react'

import { useTimerStore } from '@/lib/use-timer-store'
import { Loader2, Play, Search, X, Plus } from 'lucide-react'
import { toast } from 'react-hot-toast'

import { useTimeTrackerData } from '@/features/time-tracker/hooks/use-time-tracker-queries'
import { findScheduleBlockForDateTime } from '@/features/time-tracker/utils/schedule'
import type { Task } from '@/features/time-tracker/utils/types'
import { useCreateTaskMutation } from '@/features/tasks/hooks/use-tasks-mutations'
import { useDismissable } from '@/lib/use-dismissable'
import { useFloatingUiStore } from '@/lib/use-floating-ui-store'

interface StartTrackingPopoverProps {
  open: boolean
  onClose: () => void
}

const NO_GOAL = '__NO_GOAL__'

export function StartTrackingPopover({ open, onClose }: StartTrackingPopoverProps) {
  const { tasks, weeklySchedule, goals } = useTimeTrackerData()
  const start = useTimerStore((s) => s.start)
  const createTaskMutation = useCreateTaskMutation()
  const setStartTrackingOpen = useFloatingUiStore((s) => s.setStartTrackingOpen)
  const [query, setQuery] = useState('')
  const [freeText, setFreeText] = useState('')
  const [selectedGoalId, setSelectedGoalId] = useState<string>(NO_GOAL)
  const [isCreating, setIsCreating] = useState(false)

  const activeBlock = useMemo(() => {
    if (!weeklySchedule) return null
    return findScheduleBlockForDateTime(weeklySchedule, new Date())
  }, [weeklySchedule])

  // Sync open state with the floating UI store so other floating widgets
  // (check-in pill, coach button) can step aside while this popover owns
  // the bottom-right corner.
  useEffect(() => {
    setStartTrackingOpen(open)
    if (!open) {
      setQuery('')
      setFreeText('')
      setIsCreating(false)
    }
    return () => setStartTrackingOpen(false)
  }, [open, setStartTrackingOpen])

  // Pre-fill goal with the active schedule block's goal whenever it changes
  // or the popover opens. User can still override.
  useEffect(() => {
    if (open) {
      setSelectedGoalId(activeBlock?.goalId || NO_GOAL)
    }
  }, [open, activeBlock?.goalId])

  const filtered = useMemo<Task[]>(() => {
    const q = query.trim().toLowerCase()
    const base: Task[] = tasks ?? []
    if (!q) {
      const goalId = activeBlock?.goalId
      if (goalId) {
        return [...base].sort((a, b) => {
          const aMatch = a.goalId === goalId ? 1 : 0
          const bMatch = b.goalId === goalId ? 1 : 0
          return bMatch - aMatch
        }).slice(0, 8)
      }
      return base.slice(0, 8)
    }
    return base.filter((t: Task) => t.title.toLowerCase().includes(q)).slice(0, 12)
  }, [tasks, query, activeBlock])

  const activeGoalHasNoTasks = useMemo(() => {
    if (!activeBlock?.goalId) return false
    const base: Task[] = tasks ?? []
    return !base.some((t) => t.goalId === activeBlock.goalId)
  }, [tasks, activeBlock])

  const startWithTask = (task: Task) => {
    start(
      task.title,
      task.id,
      task.category || '',
      task.goalId || '',
      activeBlock?.id || '',
    )
    toast.success(`Tracking "${task.title}"`)
    onClose()
  }

  // Free-text "Just track" — no task created, just a timer with the title.
  // Kept for the quick-capture case where users don't want to commit to a
  // task entity (e.g. tracking a 10-minute interruption).
  const startFreeform = () => {
    const trimmed = freeText.trim()
    if (!trimmed) {
      toast.error('Type what you are working on or pick a task')
      return
    }
    const goalId = selectedGoalId === NO_GOAL ? '' : selectedGoalId
    start(trimmed, '', '', goalId, activeBlock?.id || '')
    toast.success(`Tracking "${trimmed}"`)
    onClose()
  }

  // Create a real Task with the chosen goal, then start the timer pointing
  // at that task. This way the work shows up under the goal in the Tasks
  // page (previously, free-form titles only created a TimeEntry, which
  // meant the goal had time logged against it but no matching task — very
  // confusing).
  const createTaskAndStart = async () => {
    const trimmed = freeText.trim()
    if (!trimmed) {
      toast.error('Type a title for the task')
      return
    }
    setIsCreating(true)
    try {
      const goalId = selectedGoalId === NO_GOAL ? undefined : selectedGoalId
      const created = await createTaskMutation.mutateAsync({
        title: trimmed,
        goalId,
        scheduleBlockId: activeBlock?.id || undefined,
      } as any)
      start(
        created.title,
        created.id,
        created.category || '',
        created.goalId || '',
        activeBlock?.id || '',
      )
      onClose()
    } catch {
      // mutation already toasts the failure
    } finally {
      setIsCreating(false)
    }
  }

  const dismissRef = useDismissable<HTMLDivElement>(open, onClose)

  if (!open) return null

  const goalNameById = (id: string): string => {
    if (id === NO_GOAL) return 'No goal'
    const g = goals?.find((g) => g.id === id)
    return g?.title || 'No goal'
  }

  return (
    <div
      ref={dismissRef}
      role="dialog"
      aria-label="Start tracking"
      className="fixed bottom-20 right-4 z-50 flex w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
    >
      <header className="flex items-center justify-between border-b border-zinc-200 bg-gradient-to-br from-[#fffbea] to-white px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#f2cc0d]/20 text-[#8a7307]">
            <Play className="h-3.5 w-3.5" />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-zinc-900">Start tracking</div>
            {activeBlock ? (
              <div className="text-[10px] text-zinc-500">
                Now on schedule: <span className="font-medium text-zinc-700">{activeBlock.title}</span>
              </div>
            ) : (
              <div className="text-[10px] text-zinc-400">No active schedule block</div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Close"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      <div className="border-b border-zinc-100 px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks..."
            className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-8 pr-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-[#f2cc0d] focus:outline-none focus:ring-1 focus:ring-[#f2cc0d]"
            autoFocus
          />
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto">
        {activeGoalHasNoTasks && !query && (
          <div className="border-b border-amber-100 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-800">
            No tasks yet for the active goal
            {activeBlock?.goal?.title ? (
              <> <span className="font-semibold">({activeBlock.goal.title})</span></>
            ) : null}
            . Other tasks shown below, or type a custom title at the bottom to create one.
          </div>
        )}
        {!tasks ? (
          <div className="flex items-center justify-center gap-2 px-3 py-6 text-xs text-zinc-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading tasks...
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-zinc-500">
            {query ? 'No tasks match. Type a custom title below and press Enter.' : 'No tasks yet.'}
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {filtered.map((task) => {
              const isActiveGoal = activeBlock?.goalId && task.goalId === activeBlock.goalId
              return (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => startWithTask(task)}
                    title={`Start tracking "${task.title}"`}
                    className="group/row flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[#fff7d1]"
                  >
                    <span
                      aria-hidden
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 transition-colors group-hover/row:border-[#f2cc0d] group-hover/row:bg-[#f2cc0d] group-hover/row:text-zinc-900"
                    >
                      <Play className="h-3 w-3 fill-current" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-zinc-900">{task.title}</span>
                    <span className="flex shrink-0 items-center gap-1.5 text-[10px] text-zinc-500">
                      {task.goal?.title && (
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5">
                          {task.goal.title}
                        </span>
                      )}
                      {isActiveGoal && (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">on now</span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-zinc-200 bg-zinc-50 p-2">
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Or start with a custom title
        </div>
        <input
          type="text"
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              createTaskAndStart()
            }
          }}
          placeholder="What are you working on?"
          className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-[#f2cc0d] focus:outline-none focus:ring-1 focus:ring-[#f2cc0d]"
        />
        <div className="mt-1.5 flex items-center gap-1.5">
          <label className="shrink-0 text-[10px] font-medium text-zinc-500" htmlFor="quick-start-goal">
            Under
          </label>
          <select
            id="quick-start-goal"
            value={selectedGoalId}
            onChange={(e) => setSelectedGoalId(e.target.value)}
            title={`Goal: ${goalNameById(selectedGoalId)}`}
            className="h-7 min-w-0 flex-1 rounded-md border border-zinc-200 bg-white px-1.5 text-[11px] text-zinc-900 focus:border-[#f2cc0d] focus:outline-none focus:ring-1 focus:ring-[#f2cc0d]"
          >
            <option value={NO_GOAL}>No goal</option>
            {(goals ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={startFreeform}
            disabled={!freeText.trim() || isCreating}
            title="Start a timer without creating a task"
            className="inline-flex h-8 items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Just track
          </button>
          <button
            type="button"
            onClick={createTaskAndStart}
            disabled={!freeText.trim() || isCreating}
            title="Create a task under the selected goal and start tracking"
            className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md bg-[#f2cc0d] px-2.5 text-xs font-semibold text-zinc-900 shadow-sm hover:bg-[#dfb90c] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCreating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
            Create task & track
          </button>
        </div>
      </div>
    </div>
  )
}
