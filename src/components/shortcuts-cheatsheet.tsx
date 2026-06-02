'use client'

import * as React from 'react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/kbd'

export interface Shortcut {
  keys: string[]
  description: string
  group: 'Navigation' | 'Editing' | 'Coach'
}

export const SHORTCUTS: Shortcut[] = [
  { keys: ['Ctrl/⌘', 'K'], description: 'Open command palette', group: 'Navigation' },
  { keys: ['?'], description: 'Open keyboard shortcuts cheat sheet', group: 'Navigation' },
  { keys: ['Ctrl/⌘', '/'], description: 'Open keyboard shortcuts cheat sheet', group: 'Navigation' },
  { keys: ['Esc'], description: 'Close active floating panel / modal', group: 'Navigation' },
  { keys: ['Ctrl/⌘', 'Click'], description: 'Multi-select notes in note list', group: 'Editing' },
  { keys: ['Ctrl/⌘', 'Enter'], description: 'Send message in Coach chat', group: 'Coach' },
]

interface ShortcutsCheatsheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ShortcutsCheatsheet({ open, onOpenChange }: ShortcutsCheatsheetProps) {
  const groups: Shortcut['group'][] = ['Navigation', 'Editing', 'Coach']

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-bold tracking-tight text-zinc-900">
            Keyboard Shortcuts
          </DialogTitle>
          <p className="text-xs text-zinc-500 font-mono">
            Press keys below to trigger actions from anywhere in the app
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {groups.map((group) => {
            const groupShortcuts = SHORTCUTS.filter((s) => s.group === group)
            if (groupShortcuts.length === 0) return null

            return (
              <div key={group} className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  {group}
                </h3>
                <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-1">
                  {groupShortcuts.map((shortcut, idx) => (
                    <div
                      key={shortcut.description}
                      className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-100/80 last:border-0 text-zinc-700 hover:bg-white rounded-md transition-colors"
                    >
                      <span className="text-sm font-medium text-zinc-600">
                        {shortcut.description}
                      </span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, kIdx) => (
                          <React.Fragment key={kIdx}>
                            {kIdx > 0 && (
                              <span className="text-xs font-semibold text-zinc-400 px-0.5">
                                +
                              </span>
                            )}
                            <Kbd className="bg-white border-zinc-200 shadow-sm text-[11px] px-2 py-1">
                              {key}
                            </Kbd>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
