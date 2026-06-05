'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { CalendarDays, CheckSquare, Flag, Loader2, X } from 'lucide-react'
import { toast } from 'react-hot-toast'

import { useImportTemplate } from '../hooks'
import type { TemplateDefinition } from '../types'

interface ImportDialogProps {
  template: TemplateDefinition
  open: boolean
  onClose: () => void
}

export function ImportDialog({ template, open, onClose }: ImportDialogProps) {
  const router = useRouter()
  const importMutation = useImportTemplate(template.id)

  const hasSchedule = (template.schedule?.length ?? 0) > 0
  const hasGoals = (template.goals?.length ?? 0) > 0
  const hasTasks = (template.tasks?.length ?? 0) > 0

  const [importSchedule, setImportSchedule] = useState(hasSchedule)
  const [importGoals, setImportGoals] = useState(hasGoals)
  const [importTasks, setImportTasks] = useState(hasTasks)

  if (!open) return null

  const nothingSelected = !importSchedule && !importGoals && !importTasks

  const handleImport = async () => {
    try {
      const result = await importMutation.mutateAsync({
        schedule: importSchedule,
        goals: importGoals,
        tasks: importTasks,
      })
      const parts: string[] = []
      if (result.scheduleBlocksCreated > 0)
        parts.push(`${result.scheduleBlocksCreated} schedule blocks`)
      if (result.goalsCreated > 0) parts.push(`${result.goalsCreated} goals`)
      if (result.tasksCreated > 0) parts.push(`${result.tasksCreated} tasks`)
      toast.success(`Imported ${parts.join(', ') || 'nothing'}`)
      onClose()
      // Route the user to the most relevant page based on what they imported.
      if (importSchedule) router.push('/dashboard/schedule')
      else if (importGoals) router.push('/dashboard/goals')
      else if (importTasks) router.push('/dashboard/tasks')
    } catch {
      toast.error('Import failed. Please try again.')
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Import template"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-zinc-200 bg-gradient-to-br from-[#fffbea] to-white px-4 py-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Import template
            </div>
            <div className="mt-0.5 text-sm font-bold text-zinc-900">
              {template.name}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </header>

        <div className="space-y-3 px-4 py-4">
          <p className="text-xs text-zinc-600">
            Choose what you want to bring into your account. You can edit
            everything after import.
          </p>

          <CheckboxRow
            icon={<CalendarDays className="h-4 w-4" />}
            label="Schedule blocks"
            sublabel={
              hasSchedule
                ? `${template.schedule?.length} recurring blocks across the week`
                : 'This template has no schedule'
            }
            checked={importSchedule}
            disabled={!hasSchedule}
            onChange={setImportSchedule}
          />

          <CheckboxRow
            icon={<Flag className="h-4 w-4" />}
            label="Goals"
            sublabel={
              hasGoals
                ? `Create ${template.goals?.length} goals the template's blocks and tasks point at`
                : 'This template has no goals'
            }
            checked={importGoals}
            disabled={!hasGoals}
            onChange={setImportGoals}
          />

          <CheckboxRow
            icon={<CheckSquare className="h-4 w-4" />}
            label="Starter tasks"
            sublabel={
              hasTasks
                ? `${template.tasks?.length} initial tasks to seed the goals`
                : 'This template has no tasks'
            }
            checked={importTasks}
            disabled={!hasTasks}
            onChange={setImportTasks}
          />

          {importSchedule && !importGoals && hasGoals && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
              You are importing the schedule without the goals it references.
              Blocks will be created without a linked goal. You can wire them up
              later from the Schedule page.
            </div>
          )}
          {importTasks && !importGoals && hasGoals && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
              You are importing tasks without the goals they belong to. Tasks
              will be created unlinked.
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={importMutation.isPending}
            className="inline-flex h-9 items-center rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={nothingSelected || importMutation.isPending}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#f2cc0d] px-3 text-xs font-bold text-zinc-900 shadow-sm hover:bg-[#dfb90c] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {importMutation.isPending && (
              <Loader2 className="h-3 w-3 animate-spin" />
            )}
            {importMutation.isPending ? 'Importing...' : 'Import to my account'}
          </button>
        </footer>
      </div>
    </div>
  )
}

function CheckboxRow({
  icon,
  label,
  sublabel,
  checked,
  disabled,
  onChange,
}: {
  icon: React.ReactNode
  label: string
  sublabel: string
  checked: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors ${
        disabled
          ? 'cursor-not-allowed border-zinc-100 bg-zinc-50 opacity-60'
          : checked
            ? 'border-[#f2cc0d] bg-[#fffbea]'
            : 'border-zinc-200 bg-white hover:bg-zinc-50'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#f2cc0d]"
      />
      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-600">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-zinc-900">{label}</div>
        <div className="text-[11px] text-zinc-500">{sublabel}</div>
      </div>
    </label>
  )
}
