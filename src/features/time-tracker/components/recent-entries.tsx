import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

import { EditTimeEntryModal } from '@/features/time-tracker/components/edit-time-entry-modal'
import { useDeleteTimeEntry } from '@/features/time-tracker/hooks/use-time-tracker-mutations'
import { TimeEntry } from '@/features/time-tracker/utils/types'
import { useGoalsQuery } from '@/features/goals/hooks/use-goals-queries'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { CalendarRange, Clock, History, Pencil, Search, Target, Trash2, X } from 'lucide-react'

import { timeEntriesApi } from '@/lib/api'
import { formatDate, formatDuration } from '@/lib/utils'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { GoalSlotSpinner } from '@/components/goalslot-logo'

const NO_GOAL_FILTER = '__NO_GOAL__'

export function RecentEntries() {
  const deleteEntry = useDeleteTimeEntry()
  const [entryToDelete, setEntryToDelete] = useState<TimeEntry | null>(null)
  const [entryToEdit, setEntryToEdit] = useState<TimeEntry | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [goalFilter, setGoalFilter] = useState<string>('')

  const { data: goals = [] } = useGoalsQuery()

  // Debounce the search input so we don't fire a request per keystroke.
  // 300ms is long enough to merge a fast typist's burst into one query
  // and short enough to feel live.
  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(handle)
  }, [searchInput])

  // Any filter change should reset back to page 1, otherwise users land
  // on an empty page-5 of a 2-page result and think the search broke.
  useEffect(() => {
    setPage(1)
  }, [search, goalFilter, startDate, endDate])

  const recentQuery = useQuery({
    queryKey: ['time-tracker', 'recent-entries', 'paged', page, pageSize, startDate, endDate, search, goalFilter],
    queryFn: async () => {
      const res = await timeEntriesApi.getRecent({
        page,
        pageSize,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: search || undefined,
        goalId: goalFilter || undefined,
      })

      const data = res.data as any
      if (Array.isArray(data)) {
        return { items: data, total: data.length, page, pageSize, hasNextPage: false }
      }
      return data
    },
    placeholderData: (previousData) => previousData,
  })

  const entries: TimeEntry[] = recentQuery.data?.items || []
  const total = recentQuery.data?.total || 0
  const hasNext = recentQuery.data?.hasNextPage ?? entries.length === pageSize
  const totalPages = useMemo(() => (pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1), [total, pageSize])

  const handleConfirmDelete = async () => {
    if (!entryToDelete || deleteEntry.isPending) return
    await deleteEntry.mutateAsync(entryToDelete.id)
    setEntryToDelete(null)
  }

  const handlePageChange = (direction: 'prev' | 'next') => {
    setPage((p) => {
      if (direction === 'prev') return Math.max(1, p - 1)
      if (!hasNext) return p
      return p + 1
    })
  }

  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1
  const showingTo = Math.min(page * pageSize, total)

  const hasFilters = !!(startDate || endDate || search || goalFilter)

  const clearAllFilters = () => {
    setStartDate('')
    setEndDate('')
    setSearchInput('')
    setSearch('')
    setGoalFilter('')
    setPage(1)
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold uppercase sm:mb-6 sm:text-xl md:text-2xl">
        <History className="h-5 w-5 sm:h-6 sm:w-6" />
        <span className="hidden sm:inline">Recent Time Entries</span>
        <span className="sm:hidden">Recent Entries</span>
      </h2>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 bg-white p-3 text-xs sm:text-sm">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && searchInput) {
                e.preventDefault()
                setSearchInput('')
              }
            }}
            placeholder="Search task name or notes..."
            className="h-8 w-full rounded-md border border-zinc-200 bg-white pl-8 pr-7 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-[#f2cc0d] focus:outline-none focus:ring-1 focus:ring-[#f2cc0d]"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              title="Clear search"
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <select
          value={goalFilter}
          onChange={(e) => setGoalFilter(e.target.value)}
          title="Filter by goal"
          className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-900 focus:border-[#f2cc0d] focus:outline-none focus:ring-1 focus:ring-[#f2cc0d]"
        >
          <option value="">All goals</option>
          <option value={NO_GOAL_FILTER}>No goal</option>
          {(goals as any[]).map((g) => (
            <option key={g.id} value={g.id}>{g.title}</option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          <span className="font-mono uppercase text-gray-700">From</span>
          <input
            type="date"
            className="h-8 rounded-md border border-zinc-200 px-2 text-xs"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="font-mono uppercase text-gray-700">To</span>
          <input
            type="date"
            className="h-8 rounded-md border border-zinc-200 px-2 text-xs"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-900 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={clearAllFilters}
          disabled={!hasFilters || recentQuery.isFetching}
        >
          Clear filters
        </button>
      </div>

      {recentQuery.isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <GoalSlotSpinner size="md" />
        </div>
      ) : entries.length === 0 ? (
        <div className="py-6 text-center text-gray-500 sm:py-8">
          <Clock className="mx-auto mb-3 h-10 w-10 opacity-50 sm:mb-4 sm:h-12 sm:w-12" />
          <p className="font-mono text-sm uppercase sm:text-base">
            {hasFilters ? 'No entries found' : 'No entries yet'}
          </p>
          <p className="text-xs sm:text-sm">
            {hasFilters ? 'Try adjusting your filters' : 'Start tracking your time!'}
          </p>
          {hasFilters && (
            <button
              type="button"
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-xs font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
              onClick={() => {
                setStartDate('')
                setEndDate('')
                setPage(1)
              }}
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          <div className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs uppercase text-gray-700">
              <CalendarRange className="h-4 w-4" />
              <span>
                Showing {showingFrom}-{showingTo} of {total}
              </span>
              {startDate && <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">From {startDate}</span>}
              {endDate && <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">To {endDate}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 px-4 py-1 py-2 text-sm text-xs font-semibold text-zinc-900 transition-colors hover:bg-zinc-50 disabled:opacity-50"
                onClick={() => handlePageChange('prev')}
                disabled={page === 1 || recentQuery.isFetching}
              >
                Prev
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 px-4 py-1 py-2 text-sm text-xs font-semibold text-zinc-900 transition-colors hover:bg-zinc-50 disabled:opacity-50"
                onClick={() => handlePageChange('next')}
                disabled={!hasNext || recentQuery.isFetching}
              >
                Next
              </button>
              <span className="font-mono text-xs text-gray-600">
                Page {page} / {totalPages}
              </span>
              <select
                className="border border-zinc-200 px-2 py-1 text-xs"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setPage(1)
                }}
              >
                {[5, 10, 20, 50].map((size) => (
                  <option key={size} value={size}>
                    {size} / page
                  </option>
                ))}
              </select>
            </div>
          </div>

          {entries.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="group flex items-center gap-3 border border-zinc-200 bg-white p-3 transition-all hover:bg-gray-50 hover:shadow-sm sm:gap-4 sm:p-4"
            >
              <div
                className="h-2 w-2 shrink-0 rounded-full sm:h-3 sm:w-3"
                style={{ backgroundColor: entry.goal?.color || '#f2cc0d' }}
              />
              <div className="min-w-0 flex-1">
                {entry.taskId ? (
                  <Link
                    href={`/dashboard/tasks?taskId=${entry.taskId}`}
                    title={`Open task "${entry.taskName}"`}
                    className="block truncate text-sm font-bold underline-offset-2 hover:text-[#8a7307] hover:underline sm:text-base"
                  >
                    {entry.taskName}
                  </Link>
                ) : (
                  <div className="truncate text-sm font-bold sm:text-base">{entry.taskName}</div>
                )}
                <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs text-gray-500">
                  {entry.goal && (
                    <>
                      <Target className="h-3 w-3 shrink-0" />
                      <span className="truncate">{entry.goal.title}</span>
                    </>
                  )}
                  {entry.notes && entry.notes !== 'Timer session' && entry.notes !== 'Manual entry' && (
                    <>
                      {entry.goal && <span className="text-gray-300">•</span>}
                      <span className="truncate italic text-gray-400">{entry.notes}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <div className="text-right">
                  <div className="font-mono text-sm font-bold sm:text-base">{formatDuration(entry.duration)}</div>
                  <div className="font-mono text-xs text-gray-500">{formatDate(entry.date)}</div>
                </div>
                <div className="flex gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    className="rounded-sm border-2 border-gray-300 bg-white p-1.5 transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-sm"
                    onClick={() => setEntryToEdit(entry)}
                    title="Edit entry"
                    aria-label="Edit entry"
                  >
                    <Pencil className="h-3.5 w-3.5 text-gray-600" />
                  </button>
                  <button
                    type="button"
                    className="rounded-sm border-2 border-red-300 bg-white p-1.5 transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-sm"
                    onClick={() => setEntryToDelete(entry)}
                    disabled={deleteEntry.isPending}
                    title="Delete entry"
                    aria-label="Delete entry"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-600" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!entryToDelete}
        onOpenChange={(open) => {
          if (!open) setEntryToDelete(null)
        }}
        title="Delete time entry?"
        description="This will remove the time entry and update your stats."
        onConfirm={handleConfirmDelete}
        onCancel={() => setEntryToDelete(null)}
        confirmButtonText="Delete"
        cancelButtonText="Keep entry"
        variant="destructive"
        isLoading={deleteEntry.isPending}
      />

      <EditTimeEntryModal
        isOpen={!!entryToEdit}
        onClose={() => setEntryToEdit(null)}
        entry={entryToEdit}
      />
    </div>
  )
}
