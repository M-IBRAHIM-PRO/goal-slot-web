'use client'

// @ts-ignore: side-effect import of CSS - project has no global CSS type declarations
import '@excalidraw/excalidraw/index.css'

import type React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'

import { updateWhiteboard } from '@/lib/api/whiteboards'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'

import type { ExcalidrawScene } from './types'

const ExcalidrawBundle = dynamic(
  () =>
    import('@excalidraw/excalidraw').then(({ Excalidraw, MainMenu }) => {
      function ExcalidrawWithMenu(props: React.ComponentProps<typeof Excalidraw>) {
        const { children: _ignored, ...rest } = props
        return (
          <Excalidraw {...rest}>
            <MainMenu>
              <MainMenu.DefaultItems.Export />
              <MainMenu.DefaultItems.SaveAsImage />
              <MainMenu.DefaultItems.SearchMenu />
              <MainMenu.DefaultItems.Help />
              <MainMenu.DefaultItems.ClearCanvas />
              <MainMenu.Separator />
              <MainMenu.DefaultItems.ToggleTheme />
              <MainMenu.DefaultItems.ChangeCanvasBackground />
            </MainMenu>
          </Excalidraw>
        )
      }
      return ExcalidrawWithMenu
    }),
  {
    ssr: false,
    loading: () => <div className="flex h-full items-center justify-center">Loading canvas...</div>,
  },
)

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface WhiteboardCanvasProps {
  whiteboardId: string
  initialData: ExcalidrawScene | null
  readOnly: boolean
}

function buildScene(
  elements: readonly Record<string, unknown>[],
  appState: Record<string, unknown>,
  files: Record<string, unknown>,
): ExcalidrawScene {
  return {
    elements: elements as Record<string, unknown>[],
    appState,
    files,
  }
}

export function WhiteboardCanvas({ whiteboardId, initialData, readOnly }: WhiteboardCanvasProps) {
  const isMobile = useIsMobile()
  const pathname = usePathname()
  const forceViewOnly = isMobile && !readOnly

  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSaveRef = useRef<number>(0)
  const wasDraggingRef = useRef(false)
  const savedHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const whiteboardIdRef = useRef(whiteboardId)
  const readOnlyRef = useRef(readOnly || forceViewOnly)

  // Fix: update refs inside useEffect, not during render
  useEffect(() => {
    whiteboardIdRef.current = whiteboardId
  }, [whiteboardId])

  useEffect(() => {
    readOnlyRef.current = readOnly || forceViewOnly
  }, [readOnly, forceViewOnly])

  const persistScene = useCallback(async (scene: ExcalidrawScene, options?: { silent?: boolean }) => {
    if (readOnlyRef.current) return
    if (!options?.silent) setSaveStatus('saving')
    try {
      await updateWhiteboard(whiteboardIdRef.current, { content: scene })
      if (!options?.silent) {
        setSaveStatus('saved')
        if (savedHideTimerRef.current) clearTimeout(savedHideTimerRef.current)
        savedHideTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000)
      }
    } catch {
      if (!options?.silent) setSaveStatus('error')
    }
  }, [])

  const saveFromApi = useCallback(
    (options?: { silent?: boolean }) => {
      if (!excalidrawAPI || readOnlyRef.current) return
      const elements = excalidrawAPI.getSceneElements()
      const appState = excalidrawAPI.getAppState()
      const files = excalidrawAPI.getFiles()
      void persistScene(buildScene(elements, appState, files), options)
    },
    [excalidrawAPI, persistScene],
  )

  const handleChange = useCallback(
    (elements: readonly unknown[], appState: unknown, files: unknown) => {
      if (readOnlyRef.current) return

      const scene = buildScene(
        elements as Record<string, unknown>[],
        appState as Record<string, unknown>,
        files as Record<string, unknown>,
      )
      if ((appState as any)?.editingElement != null) return
      const isDragging = (appState as { draggingElement?: unknown } | null)?.draggingElement != null

      // Strategy B — throttle during drag; immediate save when drag ends
      if (isDragging) {
        if (Date.now() - lastSaveRef.current > 1000) {
          lastSaveRef.current = Date.now()
          void persistScene(scene)
        }
        wasDraggingRef.current = true
      } else if (wasDraggingRef.current) {
        wasDraggingRef.current = false
        lastSaveRef.current = Date.now()
        void persistScene(scene)
      }

      // Strategy A — debounced autosave (1s)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        void persistScene(scene)
      }, 1000)
    },
    [persistScene],
  )

  // Strategy C — save on close / navigate
  useEffect(() => {
    const saveImmediately = () => saveFromApi({ silent: true })
    window.addEventListener('beforeunload', saveImmediately)
    return () => {
      window.removeEventListener('beforeunload', saveImmediately)
      saveImmediately()
    }
  }, [saveFromApi])

  const prevPathRef = useRef(pathname)
  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      saveFromApi({ silent: true })
      prevPathRef.current = pathname
    }
  }, [pathname, saveFromApi])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (savedHideTimerRef.current) clearTimeout(savedHideTimerRef.current)
    }
  }, [])

  return (
    <div className="relative flex h-full flex-col">
      {forceViewOnly && (
        <div className="shrink-0 border-b border-yellow-300 bg-yellow-50 px-3 py-2 text-center text-sm text-yellow-900">
          Editing is only available on desktop. Viewing in read-only mode.
        </div>
      )}

      {!readOnly && saveStatus !== 'idle' && (
        <div
          className={cn(
            'pointer-events-none absolute right-3 top-3 z-10 text-xs font-medium',
            saveStatus === 'saving' && 'text-zinc-500',
            saveStatus === 'saved' && 'text-green-600',
            saveStatus === 'error' && 'text-red-600',
          )}
        >
          {saveStatus === 'saving' && 'Saving...'}
          {saveStatus === 'saved' && 'Saved ✓'}
          {saveStatus === 'error' && 'Save failed'}
        </div>
      )}

      <div className="min-h-0 flex-1">
        <ExcalidrawBundle
          excalidrawAPI={(api: any) => setExcalidrawAPI(api)}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              saveToActiveFile: false,
            },
          }}
          initialData={
            initialData
              ? {
                  elements: initialData.elements as any,
                  appState: {
                    ...initialData.appState,
                    collaborators: new Map(),
                  },
                  files: initialData.files as any,
                }
              : {
                  elements: [],
                  appState: { collaborators: new Map() },
                  files: {},
                }
          }
          onChange={handleChange}
          viewModeEnabled={readOnly || forceViewOnly}
        />
      </div>
    </div>
  )
}
