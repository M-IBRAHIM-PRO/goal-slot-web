'use client'

import { useMemo } from 'react'

import { useGoogleCalendar } from '@/features/calendar/hooks/use-google-calendar'
import { calendarQueries } from '@/features/calendar/utils/queries'
import { ExternalEventVM } from '@/features/calendar/utils/types'
import { DAY_START_MIN, PX_PER_MIN } from '@/features/schedule/utils/constants'
import { useQuery } from '@tanstack/react-query'
import { endOfWeek, startOfWeek } from 'date-fns'

import { formatTime12h, minutesToTime } from '@/lib/utils'

// The schedule grid is a weekly recurring template with no concept of a
// concrete week. External Google events are date-anchored, so we anchor the
// overlay to the *current* week (Sunday-start, matching dayOfWeek 0=Sunday)
// and map each event onto its weekday column. Times render in the browser's
// local zone, which lines up with how the native grid reads.
export function useExternalWeekEvents() {
  const { connection } = useGoogleCalendar()
  const connected = connection.data?.connected ?? false

  const { from, to } = useMemo(() => {
    const now = new Date()
    return {
      from: startOfWeek(now, { weekStartsOn: 0 }).toISOString(),
      to: endOfWeek(now, { weekStartsOn: 0 }).toISOString(),
    }
  }, [])

  const events = useQuery({ ...calendarQueries.events(from, to), enabled: connected })

  const eventsByDay = useMemo(() => {
    const byDay: Record<number, ExternalEventVM[]> = {}
    for (const e of events.data ?? []) {
      if (e.status === 'cancelled') continue
      const start = new Date(e.startsAt)
      const end = new Date(e.endsAt)
      const vm: ExternalEventVM = {
        id: e.id,
        title: e.title,
        calendarName: e.calendarName,
        color: e.color,
        dayOfWeek: start.getDay(),
        startMin: e.isAllDay ? 0 : start.getHours() * 60 + start.getMinutes(),
        endMin: e.isAllDay ? 24 * 60 : end.getHours() * 60 + end.getMinutes(),
        isAllDay: e.isAllDay,
      }
      ;(byDay[vm.dayOfWeek] ??= []).push(vm)
    }
    return byDay
  }, [events.data])

  return { connected, eventsByDay, hasEvents: (events.data?.length ?? 0) > 0 }
}

// A single read-only external event drawn on a day column. Striped + muted to
// read as "not yours to edit", no drag handles, and pointer-events-none so it
// never steals clicks from the native blocks painted on top of it. The source
// calendar + time live in the native title tooltip.
export function ExternalEventItem({ event }: { event: ExternalEventVM }) {
  const top = (event.startMin - DAY_START_MIN) * PX_PER_MIN
  const height = Math.max((event.endMin - event.startMin) * PX_PER_MIN, 22)
  const accent = event.color ?? '#94a3b8'
  const timeLabel = event.isAllDay
    ? 'All day'
    : `${formatTime12h(minutesToTime(event.startMin))} - ${formatTime12h(minutesToTime(event.endMin))}`

  return (
    <div
      className="pointer-events-none absolute left-0.5 right-0.5 z-0 overflow-hidden rounded-md border border-dashed px-1.5 py-1 text-[10px] leading-tight"
      style={{
        top,
        height,
        borderColor: accent,
        color: '#475569',
        backgroundImage: `repeating-linear-gradient(45deg, ${accent}1a, ${accent}1a 4px, transparent 4px, transparent 8px)`,
      }}
      title={`${event.title} · ${event.calendarName} · ${timeLabel}`}
    >
      <span className="block truncate font-semibold text-slate-600">{event.title}</span>
      <span className="block truncate text-slate-400">{event.calendarName}</span>
    </div>
  )
}
