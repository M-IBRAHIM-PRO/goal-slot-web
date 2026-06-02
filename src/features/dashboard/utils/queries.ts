import { reportsApi, timeEntriesApi } from '@/lib/api'

import { DashboardStats, RecentTimeEntriesResponse } from './types'

export const dashboardQueries = {
  all: ['dashboard'] as const,
  stats: () => [...dashboardQueries.all, 'stats'] as const,
  recentEntries: (params?: { page?: number; pageSize?: number; startDate?: string; endDate?: string }) =>
    [...dashboardQueries.all, 'recent-entries', params] as const,
}

const parseFormattedDuration = (value: unknown): number | undefined => {
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()
  if (!trimmed) return undefined

  const hourMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*h/)
  const minuteMatch = trimmed.match(/(\d+)\s*m(?:in)?/)
  const rawMinuteMatch = trimmed.match(/^(\d+)$/)

  if (!hourMatch && !minuteMatch && !rawMinuteMatch) return undefined

  const hours = hourMatch ? Number(hourMatch[1]) * 60 : 0
  const minutes = minuteMatch ? Number(minuteMatch[1]) : rawMinuteMatch ? Number(rawMinuteMatch[1]) : 0
  return Math.round(hours + minutes)
}

const firstNumber = (...values: unknown[]): number | undefined => {
  return values.find((value): value is number => typeof value === 'number' && Number.isFinite(value))
}

export const fetchDashboardStats = async (): Promise<DashboardStats> => {
  const res = await reportsApi.getDashboard()
  const data = res.data as any

  return {
    ...data,
    todayMinutes: firstNumber(data.todayMinutes, data.todayTotalMinutes, data.today) ??
      parseFormattedDuration(data.todayFormatted) ??
      0,
    weeklyMinutes: firstNumber(data.weeklyMinutes, data.weeklyTotalMinutes, data.weekly) ??
      parseFormattedDuration(data.weeklyFormatted) ??
      0,
  }
}

export const fetchRecentTimeEntries = async (params?: {
  page?: number
  pageSize?: number
  startDate?: string
  endDate?: string
}): Promise<RecentTimeEntriesResponse> => {
  const res = await timeEntriesApi.getRecent(params)
  const data = res.data as any
  if (Array.isArray(data)) {
    return {
      items: data,
      total: data.length,
      page: params?.page || 1,
      pageSize: params?.pageSize || 5,
      hasNextPage: false,
    }
  }
  return data
}
