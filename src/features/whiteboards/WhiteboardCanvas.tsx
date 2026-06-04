'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'

import { updateWhiteboard } from '@/lib/api/whiteboards'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'

import { WHITEBOARDS_QUERY_KEY } from './hooks/use-whiteboards'
import type { ExcalidrawScene, Whiteboard } from './types'

const ExcalidrawCanvasInner = dynamic(
  () => import('./excalidraw-canvas-inner').then((mod) => mod.ExcalidrawCanvasInner),
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

interface ExcalidrawAppStateSlice {
  editingElement?: unknown
  draggingElement?: unknown
}

function hasEditingElement(appState: unknown): boolean {
  return (
    typeof appState === 'object' &&
    appState !== null &&
    'editingElement' in appState &&
    (appState as ExcalidrawAppStateSlice).editingElement != null
  )
}

function buildScene(
  elements: readonly Record<string, unknown>[],
  appState: Record<string, unknown>,
  files: Record<string, unknown>,
): ExcalidrawScene {
  const {
    collaborators: _c,
    editingElement: _e,
    draggingElement: _d,
    openMenu: _m,
    openPopup: _p,
    contextMenu: _ctx,
    ...persistedAppState
  } = appState

  return {
    elements: elements as Record<string, unknown>[],
    appState: persistedAppState,
    files,
  }
}

function toInitialData(initialData: ExcalidrawScene | null) {
  if (!initialData) {
    return {
      elements: [],
      appState: { collaborators: new Map() },
      files: {},
    }
  }
  return {
    elements: initialData.elements as any,
    appState: {
      ...initialData.appState,
      collaborators: new Map(),
    },
    files: (initialData.files ?? {}) as any,
  }
}

const UI_OPTIONS = {
  canvasActions: {
    loadScene: false,
    saveToActiveFile: false,
  },
} as const

function WhiteboardCanvasComponent({ whiteboardId, initialData, readOnly }: WhiteboardCanvasProps) {
  const isMobile = useIsMobile()
  const pathname = usePathname()
  const forceViewOnly = isMobile && !readOnly
  const queryClient = useQueryClient()

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSaveRef = useRef<number>(0)
  const wasDraggingRef = useRef(false)
  const savedHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const whiteboardIdRef = useRef(whiteboardId)
  const readOnlyRef = useRef(readOnly || forceViewOnly)
  const excalidrawAPIRef = useRef<any>(null)
  const isReadyRef = useRef(false)
  const lastPersistedHashRef = useRef<string | null>(null)

  useEffect(() => {
    whiteboardIdRef.current = whiteboardId
    isReadyRef.current = false
    lastPersistedHashRef.current = null
  }, [whiteboardId])

  useEffect(() => {
    readOnlyRef.current = readOnly || forceViewOnly
  }, [readOnly, forceViewOnly])

  const handleExcalidrawAPI = useCallback((api: any) => {
    excalidrawAPIRef.current = api
    requestAnimationFrame(() => {
      isReadyRef.current = true
    })
  }, [])

  const excalidrawInitialData = useMemo(() => toInitialData(initialData), [whiteboardId])

  const patchListCache = useCallback(
    (targetId: string, scene: ExcalidrawScene) => {
      queryClient.setQueryData<Whiteboard[]>(WHITEBOARDS_QUERY_KEY, (prev) => {
        if (!prev) return prev
        return prev.map((w) => (w.id === targetId ? { ...w, content: scene } : w))
      })
    },
    [queryClient],
  )

  const persistScene = useCallback(
    async (scene: ExcalidrawScene, targetId: string, options?: { silent?: boolean }) => {
      if (readOnlyRef.current) return

      const hash = JSON.stringify(scene)
      if (hash === lastPersistedHashRef.current) return

      if (!options?.silent) setSaveStatus('saving')
      try {
        await updateWhiteboard(targetId, { content: scene })
        lastPersistedHashRef.current = hash
        patchListCache(targetId, scene)
        if (!options?.silent) {
          setSaveStatus('saved')
          if (savedHideTimerRef.current) clearTimeout(savedHideTimerRef.current)
          savedHideTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000)
        }
      } catch {
        if (!options?.silent) setSaveStatus('error')
      }
    },
    [patchListCache],
  )

  const saveFromApi = useCallback(
    (targetId: string, options?: { silent?: boolean }) => {
      const api = excalidrawAPIRef.current
      if (!api || readOnlyRef.current) return
      const elements = api.getSceneElements()
      const appState = api.getAppState()
      const files = api.getFiles()
      void persistScene(buildScene(elements, appState, files), targetId, options)
    },
    [persistScene],
  )

  const handleChange = useCallback(
    (elements: readonly unknown[], appState: unknown, files: unknown) => {
      if (!isReadyRef.current || readOnlyRef.current) return
      if (hasEditingElement(appState)) return

      const scene = buildScene(
        elements as Record<string, unknown>[],
        appState as Record<string, unknown>,
        files as Record<string, unknown>,
      )

      const isDragging =
        typeof appState === 'object' &&
        appState !== null &&
        'draggingElement' in appState &&
        (appState as ExcalidrawAppStateSlice).draggingElement != null

      if (isDragging) {
        if (Date.now() - lastSaveRef.current > 1000) {
          lastSaveRef.current = Date.now()
          void persistScene(scene, whiteboardIdRef.current)
        }
        wasDraggingRef.current = true
      } else if (wasDraggingRef.current) {
        wasDraggingRef.current = false
        lastSaveRef.current = Date.now()
        void persistScene(scene, whiteboardIdRef.current)
        if (debounceRef.current) {
          clearTimeout(debounceRef.current)
          debounceRef.current = null
        }
      }

      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        void persistScene(scene, whiteboardIdRef.current)
      }, 1000)
    },
    [persistScene],
  )

  useEffect(() => {
    const idAtMount = whiteboardId
    return () => {
      saveFromApi(idAtMount, { silent: true })
    }
  }, [whiteboardId, saveFromApi])

  useEffect(() => {
    const saveImmediately = () => saveFromApi(whiteboardIdRef.current, { silent: true })
    window.addEventListener('beforeunload', saveImmediately)
    return () => window.removeEventListener('beforeunload', saveImmediately)
  }, [saveFromApi])

  const prevPathRef = useRef(pathname)
  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      saveFromApi(whiteboardIdRef.current, { silent: true })
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

      <div className="goalslot-whiteboard-canvas min-h-0 flex-1">
        <ExcalidrawCanvasInner
          key={whiteboardId}
          excalidrawAPI={handleExcalidrawAPI}
          UIOptions={UI_OPTIONS}
          initialData={excalidrawInitialData}
          onChange={handleChange}
          viewModeEnabled={readOnly || forceViewOnly}
        />
      </div>
    </div>
  )
}

/** Ignore cache-driven initialData updates while the same board is open. */
export const WhiteboardCanvas = memo(
  WhiteboardCanvasComponent,
  (prev, next) => prev.whiteboardId === next.whiteboardId && prev.readOnly === next.readOnly,
)
