'use client'

import { useState } from 'react'

import { CalendarPickerDialog } from '@/features/calendar/components/calendar-picker-dialog'
import { useGoogleCalendar } from '@/features/calendar/hooks/use-google-calendar'
import { AlertTriangle, CalendarDays, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'react-hot-toast'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { SectionHeader } from '@/components/ui/section-header'

export function GoogleCalendarCard() {
  const { connection, connect, sync, disconnect } = useGoogleCalendar()
  const [showPicker, setShowPicker] = useState(false)

  const data = connection.data
  const isConnected = data?.connected ?? false
  const isStale = data?.status === 'stale'

  const handleConnect = async () => {
    try {
      const url = await connect.mutateAsync()
      window.location.assign(url)
    } catch {
      toast.error('Could not start Google sign-in. Check that Calendar is configured.')
    }
  }

  const handleSync = async () => {
    try {
      await sync.mutateAsync()
      toast.success('Sync started')
    } catch {
      toast.error('Sync failed')
    }
  }

  const handleDisconnect = async () => {
    const ok =
      typeof window !== 'undefined'
        ? window.confirm('Disconnect Google Calendar? Imported events will be removed from your schedule.')
        : true
    if (!ok) return
    try {
      await disconnect.mutateAsync()
      toast.success('Google Calendar disconnected')
    } catch {
      toast.error('Could not disconnect')
    }
  }

  return (
    <GlassCard padded>
      <SectionHeader
        title={
          <span className="inline-flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Google Calendar
          </span>
        }
        action={
          isStale ? (
            <Badge variant="default">Reconnect needed</Badge>
          ) : isConnected ? (
            <Badge variant="success">Connected</Badge>
          ) : (
            <Badge variant="default">Not Connected</Badge>
          )
        }
      />

      <p className="mb-4 text-sm text-zinc-600">
        See your Google Calendar events alongside your GoalSlot schedule. We ask for read and write
        access because a later update will also push your GoalSlot blocks back to Google.
      </p>

      {/* Unverified-app callout — shipping v1 before Google verification. */}
      <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          This app has not been verified by Google yet. You may see a &ldquo;Google hasn&rsquo;t verified
          this app&rdquo; warning on the consent screen. It is safe to continue &mdash; choose Advanced, then
          continue to GoalSlot.
        </span>
      </div>

      {isStale && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12px] text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Access to this Google account was revoked. Reconnect to resume syncing.</span>
        </div>
      )}

      {isConnected && !isStale ? (
        <div className="space-y-3">
          {data?.accountEmail && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
              <span className="truncate text-sm text-zinc-700">{data.accountEmail}</span>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="brand" size="sm" onClick={() => setShowPicker(true)}>
              <CalendarDays className="h-3.5 w-3.5" />
              Manage calendars
            </Button>
            <Button variant="secondary" size="sm" onClick={handleSync} disabled={sync.isPending}>
              <RefreshCw className="h-3.5 w-3.5" />
              {sync.isPending ? 'Syncing...' : 'Sync now'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnect.isPending}
              className="text-rose-600 hover:text-rose-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Disconnect
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="brand" onClick={handleConnect} disabled={connect.isPending}>
          {connect.isPending ? 'Redirecting...' : isStale ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}
        </Button>
      )}

      <CalendarPickerDialog open={showPicker} onOpenChange={setShowPicker} connection={data} />
    </GlassCard>
  )
}
