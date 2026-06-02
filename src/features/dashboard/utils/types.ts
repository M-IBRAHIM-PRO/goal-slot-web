import { TimeEntry } from '@/features/time-tracker/utils/types'

export interface DashboardStats {
  todayMinutes: number
  todayFormatted?: string
  weeklyMinutes: number
  weeklyFormatted?: string
  activeGoals: number
  tasksLogged: number
}

export interface RecentTimeEntriesResponse {
  items: TimeEntry[]
  total?: number
  page?: number
  pageSize?: number
  hasNextPage?: boolean
}
