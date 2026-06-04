import { queryOptions } from '@tanstack/react-query'

import { calendarApi } from '@/lib/api'

export const calendarQueries = {
  root: () => ['google-calendar'] as const,

  connectionKey: () => [...calendarQueries.root(), 'connection'] as const,
  calendarsKey: () => [...calendarQueries.root(), 'calendars'] as const,
  eventsKey: (from: string, to: string) => [...calendarQueries.root(), 'events', from, to] as const,

  connection: () =>
    queryOptions({
      queryKey: calendarQueries.connectionKey(),
      queryFn: async () => (await calendarApi.getConnection()).data,
    }),

  calendars: () =>
    queryOptions({
      queryKey: calendarQueries.calendarsKey(),
      queryFn: async () => (await calendarApi.listCalendars()).data,
    }),

  events: (from: string, to: string) =>
    queryOptions({
      queryKey: calendarQueries.eventsKey(from, to),
      queryFn: async () => (await calendarApi.getEvents(from, to)).data,
    }),
} as const
