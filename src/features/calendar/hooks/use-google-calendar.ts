'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { calendarApi, type CalendarSelectionInput } from '@/lib/api'

import { calendarQueries } from '@/features/calendar/utils/queries'

// Connection status + the mutations the Settings card drives. The calendars
// list and grid events have their own hooks (they fetch on demand / per week).
export function useGoogleCalendar() {
  const queryClient = useQueryClient()
  const connection = useQuery(calendarQueries.connection())

  const invalidateAll = () => queryClient.invalidateQueries({ queryKey: calendarQueries.root() })

  // Connect returns the consent URL; the caller does the window redirect so
  // the browser leaves the SPA and lands back on Settings via the callback.
  const connect = useMutation({
    mutationFn: async () => (await calendarApi.getConsentUrl()).data.url,
  })

  const sync = useMutation({
    mutationFn: () => calendarApi.sync(),
    onSuccess: invalidateAll,
  })

  const disconnect = useMutation({
    mutationFn: () => calendarApi.disconnect(),
    onSuccess: invalidateAll,
  })

  const saveSelections = useMutation({
    mutationFn: (selections: CalendarSelectionInput[]) => calendarApi.saveSelections(selections),
    onSuccess: invalidateAll,
  })

  return { connection, connect, sync, disconnect, saveSelections }
}

// Lazily fetched only when the picker opens (enabled), so we don't hit Google
// on every Settings visit.
export function useGoogleCalendars(enabled: boolean) {
  return useQuery({ ...calendarQueries.calendars(), enabled })
}
