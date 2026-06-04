export type {
  CalendarSyncDirection,
  CalendarSelectionInput,
  GoogleCalendarConnectionDto,
  GoogleCalendarDto,
  ExternalEventDto,
} from '@/lib/api'

// An external Google event already mapped onto the weekly grid's coordinate
// system: a day column (0=Sunday) plus start/end as minutes-from-midnight.
// The grid uses the same units as native ScheduleBlocks (see constants.ts).
export interface ExternalEventVM {
  id: string
  title: string
  calendarName: string
  color: string | null
  dayOfWeek: number
  startMin: number
  endMin: number
  isAllDay: boolean
}
