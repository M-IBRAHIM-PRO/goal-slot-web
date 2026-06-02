import { DashboardStats as DashboardStatsType } from '@/features/dashboard/utils/types'
import { CheckSquare, Clock, Target, TrendingUp } from 'lucide-react'

import { StatCard } from '@/components/ui/stat-card'
import { formatDuration } from '@/lib/utils'

interface DashboardStatsProps {
  stats?: DashboardStatsType
}

export function DashboardStats({ stats }: DashboardStatsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Today's Focus"
        value={formatDuration(stats?.todayMinutes ?? 0)}
        icon={<Clock />}
        accent="brand"
      />
      <StatCard
        label="Weekly Total"
        value={formatDuration(stats?.weeklyMinutes ?? 0)}
        icon={<TrendingUp />}
        accent="neutral"
      />
      <StatCard
        label="Active Goals"
        value={stats?.activeGoals ?? 0}
        icon={<Target />}
        accent="success"
      />
      <StatCard
        label="Tasks Logged"
        value={stats?.tasksLogged ?? 0}
        icon={<CheckSquare />}
        accent="warning"
      />
    </div>
  )
}
