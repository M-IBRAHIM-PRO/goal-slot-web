'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

import { ArrowLeft, CalendarDays, CheckSquare, Flag, Loader2, Sparkles } from 'lucide-react'

import { useTemplate } from '../hooks'
import { CATEGORY_LABEL, type TemplateScheduleBlock } from '../types'
import { ImportDialog } from './import-dialog'

const DAY_NAME = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface TemplateDetailPageProps {
  templateId: string
}

export function TemplateDetailPage({ templateId }: TemplateDetailPageProps) {
  const { data: template, isLoading, error } = useTemplate(templateId)
  const [importOpen, setImportOpen] = useState(false)

  const blocksByDay = useMemo(() => {
    const map = new Map<number, TemplateScheduleBlock[]>()
    if (!template?.schedule) return map
    for (const b of template.schedule) {
      const arr = map.get(b.dayOfWeek) ?? []
      arr.push(b)
      map.set(b.dayOfWeek, arr)
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.startTime.localeCompare(b.startTime))
    }
    return map
  }, [template])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 px-4 py-24 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading template...
      </div>
    )
  }

  if (error || !template) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h2 className="text-lg font-bold text-zinc-900">Template not found</h2>
        <p className="mt-2 text-sm text-zinc-600">
          This template may have been removed or never existed.
        </p>
        <Link
          href="/dashboard/library"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-900 hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Library
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <Link
        href="/dashboard/library"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Library
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {template.featured && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#f2cc0d] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-900">
              <Sparkles className="h-3 w-3" />
              Featured
            </span>
          )}
          {template.categories.map((c) => (
            <span
              key={c}
              className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600"
            >
              {CATEGORY_LABEL[c]}
            </span>
          ))}
        </div>
        <h1 className="text-2xl font-bold uppercase tracking-tight text-zinc-900 sm:text-3xl">
          {template.name}
        </h1>
        <div className="text-sm text-zinc-500">
          by{' '}
          {template.sourceUrl ? (
            <a
              href={template.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-zinc-700 hover:underline"
            >
              {template.source}
            </a>
          ) : (
            <span className="font-semibold text-zinc-700">{template.source}</span>
          )}
        </div>
        <p className="text-sm text-zinc-600">{template.description}</p>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#f2cc0d] px-4 text-sm font-bold text-zinc-900 shadow-sm hover:bg-[#dfb90c]"
          >
            Import to my account
          </button>
          <div className="flex flex-wrap gap-3 text-[11px] text-zinc-500">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {template.schedule?.length ?? 0} blocks
            </span>
            <span className="inline-flex items-center gap-1">
              <Flag className="h-3 w-3" />
              {template.goals?.length ?? 0} goals
            </span>
            <span className="inline-flex items-center gap-1">
              <CheckSquare className="h-3 w-3" />
              {template.tasks?.length ?? 0} tasks
            </span>
          </div>
        </div>
      </header>

      {template.longDescription && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm leading-relaxed text-zinc-700 shadow-sm">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            About this template
          </div>
          <div className="whitespace-pre-line">{template.longDescription}</div>
        </section>
      )}

      {template.goals && template.goals.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Goals you would get
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {template.goals.map((g) => (
              <div
                key={g.ref}
                className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-4 w-4 rounded-full border-2 border-zinc-200"
                    style={{ backgroundColor: g.color }}
                    aria-hidden
                  />
                  <h3 className="text-sm font-bold uppercase text-zinc-900">
                    {g.title}
                  </h3>
                </div>
                {g.description && (
                  <p className="mt-2 text-xs text-zinc-600">{g.description}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {template.schedule && template.schedule.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Weekly schedule preview
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6, 0].map((day) => {
              const items = blocksByDay.get(day) ?? []
              if (items.length === 0) return null
              return (
                <div
                  key={day}
                  className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm"
                >
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    {DAY_NAME[day]}
                  </div>
                  <ul className="space-y-1.5">
                    {items.map((b, i) => {
                      const goal = template.goals?.find((g) => g.ref === b.goalRef)
                      return (
                        <li
                          key={`${b.startTime}-${i}`}
                          className="flex items-start gap-2 text-[12px]"
                        >
                          <span className="shrink-0 font-mono text-zinc-500">
                            {b.startTime}
                          </span>
                          <span className="min-w-0 flex-1 text-zinc-800">
                            {b.title}
                          </span>
                          {goal && (
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: goal.color }}
                              aria-hidden
                              title={goal.title}
                            />
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {template.tasks && template.tasks.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Starter tasks
          </h2>
          <div className="space-y-1.5 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
            {template.tasks.map((t, i) => {
              const goal = template.goals?.find((g) => g.ref === t.goalRef)
              return (
                <div
                  key={`${t.title}-${i}`}
                  className="flex items-start gap-2 border-b border-zinc-100 py-1.5 last:border-b-0"
                >
                  <CheckSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
                  <span className="min-w-0 flex-1 text-sm text-zinc-800">
                    {t.title}
                  </span>
                  {goal && (
                    <span
                      className="inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600"
                      title={goal.title}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: goal.color }}
                        aria-hidden
                      />
                      {goal.title}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      <ImportDialog
        template={template}
        open={importOpen}
        onClose={() => setImportOpen(false)}
      />
    </div>
  )
}
