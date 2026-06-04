'use client'

import { useEffect, useState } from 'react'

import { useGoogleCalendar, useGoogleCalendars } from '@/features/calendar/hooks/use-google-calendar'
import {
  CalendarSelectionInput,
  CalendarSyncDirection,
  GoogleCalendarConnectionDto,
} from '@/features/calendar/utils/types'
import { toast } from 'react-hot-toast'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loading } from '@/components/ui/loading'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type PickerState = Record<string, { checked: boolean; direction: CalendarSyncDirection }>

// Direction copy. "out"/"both" land in PR2 (push); PR1 only acts on the
// inbound half, but we keep the full set so selections persist across PRs.
const DIRECTIONS: { value: CalendarSyncDirection; label: string }[] = [
  { value: 'in', label: 'Show in GoalSlot' },
  { value: 'both', label: 'Two-way (push in PR2)' },
  { value: 'out', label: 'Push only (PR2)' },
]

export function CalendarPickerDialog({
  open,
  onOpenChange,
  connection,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  connection: GoogleCalendarConnectionDto | undefined
}) {
  const { saveSelections } = useGoogleCalendar()
  const { data: calendars, isPending } = useGoogleCalendars(open)
  const [state, setState] = useState<PickerState>({})

  // Seed checkbox/direction state from the saved selections whenever the
  // calendar list (re)loads or the dialog reopens.
  useEffect(() => {
    if (!calendars) return
    const saved = new Map((connection?.selections ?? []).map((s) => [s.externalCalId, s]))
    const next: PickerState = {}
    for (const cal of calendars) {
      const match = saved.get(cal.id)
      next[cal.id] = { checked: !!match, direction: match?.syncDirection ?? 'in' }
    }
    setState(next)
  }, [calendars, connection?.selections])

  const handleSave = async () => {
    if (!calendars) return
    const selections: CalendarSelectionInput[] = calendars
      .filter((cal) => state[cal.id]?.checked)
      .map((cal) => ({
        externalCalId: cal.id,
        displayName: cal.name,
        color: cal.color,
        syncDirection: state[cal.id].direction,
      }))
    try {
      await saveSelections.mutateAsync(selections)
      toast.success('Calendar selections saved')
      onOpenChange(false)
    } catch {
      toast.error('Could not save selections')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage calendars</DialogTitle>
          <DialogDescription>
            Pick which Google calendars appear on your schedule. Read-only for now; pushing GoalSlot
            blocks back to Google arrives in a later update.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] space-y-2 overflow-y-auto py-2">
          {isPending && (
            <div className="flex h-24 items-center justify-center">
              <Loading />
            </div>
          )}

          {!isPending && (calendars?.length ?? 0) === 0 && (
            <p className="py-6 text-center text-sm text-zinc-500">No calendars found on this account.</p>
          )}

          {!isPending &&
            calendars?.map((cal) => {
              const row = state[cal.id] ?? { checked: false, direction: 'in' as CalendarSyncDirection }
              return (
                <div
                  key={cal.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2"
                >
                  <label className="flex min-w-0 flex-1 items-center gap-2.5">
                    <Checkbox
                      checked={row.checked}
                      onCheckedChange={(checked) =>
                        setState((prev) => ({
                          ...prev,
                          [cal.id]: { ...row, checked: checked === true },
                        }))
                      }
                    />
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full border border-zinc-200"
                      style={{ backgroundColor: cal.color ?? '#94a3b8' }}
                    />
                    <span className="truncate text-sm font-medium text-zinc-800">{cal.name}</span>
                    {cal.primary && (
                      <span className="rounded-full bg-zinc-100 px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                        Primary
                      </span>
                    )}
                  </label>

                  <Select
                    value={row.direction}
                    onValueChange={(value) =>
                      setState((prev) => ({
                        ...prev,
                        [cal.id]: { ...row, direction: value as CalendarSyncDirection },
                      }))
                    }
                    disabled={!row.checked}
                  >
                    <SelectTrigger className="h-8 w-[170px] shrink-0 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIRECTIONS.map((d) => (
                        <SelectItem key={d.value} value={d.value} className="text-xs">
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )
            })}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saveSelections.isPending}>
            Cancel
          </Button>
          <Button variant="brand" onClick={handleSave} disabled={isPending || saveSelections.isPending}>
            {saveSelections.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
