'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Table } from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import Typography from '@tiptap/extension-typography'
import Underline from '@tiptap/extension-underline'
import { EditorContent, useEditor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import { common, createLowlight } from 'lowlight'

import './tiptap-editor.css'

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bold,
  Check,
  CheckSquare,
  Code,
  Copy,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Plus,
  Quote,
  Redo,
  Strikethrough,
  Table as TableIcon,
  Trash2,
  Underline as UnderlineIcon,
  Undo,
} from 'lucide-react'

import { cn } from '@/lib/utils'

import { IndentExtension } from './indent-extension'
import { ResizableImage } from './resizable-image'
import { SlashCommands } from './slash-commands'

// Create lowlight instance with common languages
const lowlight = createLowlight(common)

// Normalize stored HTML before handing it to ProseMirror. Notes that
// went through earlier versions of this editor accumulated structural
// noise that breaks downstream commands like sinkListItem:
//   - Empty <p data-indent="N"> blocks left over from a bug where Tab
//     in a list fell through to indentBlock.
//   - Adjacent <ul>/<ol> blocks of the same type separated by empty
//     paragraphs, so what should be one list renders as several. A
//     lone <li> inside its own <ul> cannot be sunk because the command
//     requires a previous sibling.
//   - data-indent attributes on paragraphs nested inside <li>, which
//     pushed text far to the right of its bullet marker.
// This runs once per content prop change and is a no-op for clean HTML.
function normalizeEditorHtml(html: string): string {
  if (typeof window === 'undefined' || !html) return html
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')

    doc.querySelectorAll('p[data-indent]').forEach((p) => {
      const hasText = (p.textContent || '').trim().length > 0
      const hasMedia = p.querySelector('img, a, code, video, audio')
      if (!hasText && !hasMedia) p.remove()
    })

    doc.querySelectorAll('li [data-indent]').forEach((el) => {
      el.removeAttribute('data-indent')
    })

    const mergeAdjacentLists = (tag: 'ul' | 'ol') => {
      let merged = true
      while (merged) {
        merged = false
        const lists = Array.from(doc.querySelectorAll(tag))
        for (const list of lists) {
          let next = list.nextElementSibling
          while (
            next &&
            next.tagName === 'P' &&
            !(next.textContent || '').trim() &&
            !next.querySelector('img, a, code, video, audio')
          ) {
            const after = next.nextElementSibling
            next.remove()
            next = after
          }
          if (next && next.tagName.toLowerCase() === tag) {
            while (next.firstChild) list.appendChild(next.firstChild)
            next.remove()
            merged = true
            break
          }
        }
      }
    }
    mergeAdjacentLists('ul')
    mergeAdjacentLists('ol')

    return doc.body.innerHTML
  } catch {
    return html
  }
}

interface TiptapEditorProps {
  content?: string
  onChange?: (html: string, json: any) => void
  placeholder?: string
  className?: string
  editable?: boolean
  /**
   * Called once when the underlying Tiptap editor is mounted, with the
   * editor instance. Lets callers run commands (insertContent, focus,
   * setContent…) without re-mounting via key changes. Receives null on
   * unmount so callers can drop their reference.
   */
  onReady?: (editor: ReturnType<typeof useEditor> | null) => void
}

export function TiptapEditor({
  content = '',
  onChange,
  placeholder = "Type '/' for commands...",
  className,
  editable = true,
  onReady,
}: TiptapEditorProps) {
  const [isCopied, setIsCopied] = useState(false)
  const [isInTable, setIsInTable] = useState(false)
  // editorProps.handleKeyDown runs inside the useEditor config closure,
  // before the `editor` const exists. A ref kept in sync via useEffect
  // below gives the handler a stable accessor.
  const editorRef = useRef<ReturnType<typeof useEditor>>(null)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        codeBlock: false, // We use CodeBlockLowlight instead
        dropcursor: {
          color: '#FFCC00',
          width: 4,
        },
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'heading') {
            return `Heading ${node.attrs.level}`
          }
          return placeholder
        },
        emptyEditorClass: 'is-editor-empty',
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: 'task-list',
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'task-item',
        },
      }),
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: {
          class: 'code-block',
        },
      }),
      ResizableImage,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'editor-link',
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'editor-table',
        },
      }),
      TableRow,
      TableCell,
      TableHeader,
      Highlight.configure({
        multicolor: true,
      }),
      Typography,
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      Color,
      IndentExtension,
      SlashCommands,
    ],
    content: normalizeEditorHtml(content),
    editable,
    editorProps: {
      attributes: {
        class: 'tiptap-editor-content',
      },
      // Word, Notion, and Google Docs ship paste payloads stuffed with
      // mso-* styles, font tags, and unnecessary wrapper divs that make
      // bullet toggles and indent commands silently no-op (the cursor
      // ends up in a <span> or wrapper <div> instead of a paragraph).
      // Strip the noise before ProseMirror parses the HTML so pasted
      // content behaves like content typed in the editor.
      transformPastedHTML: (html) => {
        if (typeof window === 'undefined' || !html) return html
        let cleaned = html
          .replace(/<!--[\s\S]*?-->/g, '')
          .replace(/<\/?(meta|style|link|script|o:p|w:[\w-]+|m:[\w-]+)[^>]*>/gi, '')
          .replace(/<\/?(font)[^>]*>/gi, '')
          .replace(/\sclass="[^"]*"/gi, '')
          .replace(/\sstyle="[^"]*mso-[^"]*"/gi, '')
          .replace(/\sstyle="\s*"/gi, '')
        try {
          const doc = new DOMParser().parseFromString(cleaned, 'text/html')
          doc.querySelectorAll('b[id^="docs-internal-guid"]').forEach((el) => {
            const parent = el.parentNode
            if (!parent) return
            while (el.firstChild) parent.insertBefore(el.firstChild, el)
            parent.removeChild(el)
          })
          doc.querySelectorAll('div').forEach((div) => {
            if (div.children.length === 0 && div.textContent?.trim()) {
              const p = doc.createElement('p')
              p.innerHTML = div.innerHTML
              div.replaceWith(p)
            }
          })
          // Strip layout-only inline styles (padding, margin, text-indent)
          // from every element. These survive a copy from Notion / Word /
          // Google Docs and would otherwise render as a huge gap between
          // bullet markers and text once parsed by ProseMirror.
          const layoutStyleRe = /\s*(padding|margin|text-indent)[\w-]*\s*:[^;]+;?/gi
          doc.querySelectorAll('[style]').forEach((el) => {
            const before = el.getAttribute('style') || ''
            const after = before.replace(layoutStyleRe, '').trim()
            if (!after) el.removeAttribute('style')
            else el.setAttribute('style', after)
          })
          // Also strip our own data-indent attribute on any node that lives
          // inside a list item, mirroring the runtime CSS guard.
          doc.querySelectorAll('li [data-indent]').forEach((el) => {
            el.removeAttribute('data-indent')
          })
          cleaned = doc.body.innerHTML
        } catch {
          // If parsing throws (very malformed HTML), fall back to the
          // regex-cleaned string and let ProseMirror do its best.
        }
        return cleaned
      },
      handleDrop: (view, event, slice, moved) => {
        // Handle image drops
        if (!moved && event.dataTransfer?.files.length) {
          const files = Array.from(event.dataTransfer.files)
          const images = files.filter((file) => file.type.startsWith('image/'))

          if (images.length > 0) {
            event.preventDefault()
            images.forEach((image) => {
              const reader = new FileReader()
              reader.onload = (e) => {
                const result = e.target?.result
                if (typeof result === 'string') {
                  editor
                    ?.chain()
                    .focus()
                    .insertContent({ type: 'image', attrs: { src: result } })
                    .run()
                }
              }
              reader.readAsDataURL(image)
            })
            return true
          }
        }
        return false
      },
      handlePaste: (view, event) => {
        // Handle image pastes
        const items = Array.from(event.clipboardData?.items || [])
        const images = items.filter((item) => item.type.startsWith('image/'))

        if (images.length > 0) {
          event.preventDefault()
          images.forEach((item) => {
            const file = item.getAsFile()
            if (file) {
              const reader = new FileReader()
              reader.onload = (e) => {
                const result = e.target?.result
                if (typeof result === 'string') {
                  editor
                    ?.chain()
                    .focus()
                    .insertContent({ type: 'image', attrs: { src: result } })
                    .run()
                }
              }
              reader.readAsDataURL(file)
            }
          })
          return true
        }
        return false
      },
      // Tab + Shift-Tab. Scoped to the editor via editorProps (not a
      // document-level listener) so it doesn't steal Tab from inputs
      // elsewhere on the page (share dialog, settings, etc).
      //
      // Three cases, checked in order:
      //   1. Inside a table cell -> return false so the Table extension's
      //      built-in Tab handler navigates between cells.
      //   2. Inside any list item (bullet, ordered, task) -> sink / lift.
      //      sinkListItem can refuse if the item is the first child of
      //      its parent list (ProseMirror constraint); in that case we
      //      fall through to block indent so the user still sees a
      //      response instead of a dead key.
      //   3. Anywhere else (paragraph, heading, including across a
      //      multi-line selection) -> indent / outdent the block via the
      //      IndentExtension, which writes a data-indent attribute the
      //      CSS layer renders as padding-left.
      handleKeyDown: (_view, event) => {
        const ed = editorRef.current
        if (!ed) return false

        // Backspace at the very start of a list item should unwrap the
        // bullet (lift to parent list or to a paragraph if top level),
        // not merge the text into the previous block. ProseMirror's
        // default joinBackward behavior is what produces the "my bullet
        // text just moved up into the heading above" behavior users
        // run into. Only intercept when the selection is empty and the
        // cursor sits at parentOffset 0 of a list item.
        if (event.key === 'Backspace') {
          const { selection } = ed.state
          if (!selection.empty) return false
          if (selection.$from.parentOffset !== 0) return false

          const inTaskItem = ed.isActive('taskItem')
          const inListItem = ed.isActive('listItem')
          if (!inTaskItem && !inListItem) return false

          const itemType = inTaskItem ? 'taskItem' : 'listItem'
          if (!ed.can().liftListItem(itemType)) return false

          event.preventDefault()
          ed.chain().focus().liftListItem(itemType).run()
          return true
        }

        if (event.key !== 'Tab') return false

        if (ed.isActive('table')) return false

        event.preventDefault()

        const inTaskItem = ed.isActive('taskItem')
        const inListItem = ed.isActive('listItem')

        if (inTaskItem || inListItem) {
          const itemType = inTaskItem ? 'taskItem' : 'listItem'
          // Inside a list item we *only* sink / lift. We never fall
          // through to indentBlock, because that would write a
          // data-indent attribute onto the <p> nested inside the <li>,
          // which then renders as a huge gap between the bullet and the
          // text (and stacks on every Tab press). When sink / lift
          // refuses (e.g. first child of its list, top-level item), we
          // swallow Tab so the browser doesn't shift focus out of the
          // editor, but we make no further change.

          // Detect whether the selection spans more than one list item
          // of the active type. If it does, hand off to ProseMirror's
          // native sink/lift so all selected items move together as a
          // group — the parent-only wrapper below only makes sense for
          // a single-item cursor, and trying to apply it to a range
          // ends up only sinking the first item and lifting only that
          // first item's children, leaving the rest of the selection
          // unmoved (which is the user-visible "Tab does nothing on a
          // multi-line selection" bug).
          const { from: selFrom, to: selTo } = ed.state.selection
          const itemPositions = new Set<number>()
          ed.state.doc.nodesBetween(selFrom, selTo, (node, pos) => {
            if (node.type.name === itemType) itemPositions.add(pos)
          })
          const isMultiItem = itemPositions.size > 1

          if (isMultiItem) {
            if (event.shiftKey) {
              ed.chain().focus().liftListItem(itemType).run()
            } else {
              ed.chain().focus().sinkListItem(itemType).run()
            }
            return true
          }

          if (event.shiftKey) {
            const lifted = ed.can().liftListItem(itemType)
            if (lifted) {
              ed.chain().focus().liftListItem(itemType).run()
            }
            return true
          } else {
            const sunk = ed.can().sinkListItem(itemType)
            if (sunk) {
              // Detect whether the current list item has any nested list
              // children. ProseMirror's sinkListItem always moves the
              // entire subtree, which means indenting a parent that has
              // its own nested bullets pushes the children down too.
              // The user expectation here (and what Bear/Roam do, even
              // though Notion does not) is that only the parent moves
              // and the former children stay at their original visual
              // level by becoming siblings of the now-indented parent.
              const { $from } = ed.state.selection
              let liDepth = -1
              for (let d = $from.depth; d >= 0; d--) {
                if ($from.node(d).type.name === itemType) {
                  liDepth = d
                  break
                }
              }
              let childCount = 0
              if (liDepth >= 0) {
                const liNode = $from.node(liDepth)
                for (let i = 0; i < liNode.childCount; i++) {
                  const c = liNode.child(i)
                  if (
                    c.type.name === 'bulletList' ||
                    c.type.name === 'orderedList' ||
                    c.type.name === 'taskList'
                  ) {
                    childCount += c.childCount
                  }
                }
              }

              ed.chain().focus().sinkListItem(itemType).run()

              // After the sink, lift each former child once so they end
              // up at the parent's new level instead of one deeper. Each
              // iteration re-reads the doc because the previous lift
              // shifted positions.
              const parentCursor = ed.state.selection.from
              for (let i = 0; i < childCount; i++) {
                const { $from: cf } = ed.state.selection
                let pDepth = -1
                for (let d = cf.depth; d >= 0; d--) {
                  if (cf.node(d).type.name === itemType) {
                    pDepth = d
                    break
                  }
                }
                if (pDepth < 0) break
                const pNode = cf.node(pDepth)
                const pStart = cf.before(pDepth)
                let offset = 1
                let firstChildItemPos = -1
                for (let j = 0; j < pNode.childCount; j++) {
                  const c = pNode.child(j)
                  if (
                    (c.type.name === 'bulletList' ||
                      c.type.name === 'orderedList' ||
                      c.type.name === 'taskList') &&
                    c.childCount > 0
                  ) {
                    firstChildItemPos = pStart + offset + 1 + 1
                    break
                  }
                  offset += c.nodeSize
                }
                if (firstChildItemPos < 0) break
                ed
                  .chain()
                  .setTextSelection(firstChildItemPos)
                  .liftListItem(itemType)
                  .run()
              }
              ed.chain().setTextSelection(parentCursor).run()
            }
            // Whether sink succeeded or not, swallow Tab so we never
            // fall through to indentBlock from inside a list item.
            return true
          }
        }

        if (event.shiftKey) {
          ed.chain().focus().outdentBlock().run()
        } else {
          ed.chain().focus().indentBlock().run()
        }
        return true
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML(), editor.getJSON())
    },
    onSelectionUpdate: ({ editor }) => {
      setIsInTable(editor.isActive('table'))
    },
  })

  // Keep editorRef in sync so editorProps.handleKeyDown (defined inside
  // the useEditor config closure, where `editor` doesn't yet exist) has
  // a stable accessor to the live editor.
  useEffect(() => {
    editorRef.current = editor ?? null
  }, [editor])

  // Expose the editor instance to callers that need to run commands
  // (insertContent, focus, etc.) without re-mounting via key changes.
  useEffect(() => {
    if (!onReady) return
    onReady(editor ?? null)
    return () => onReady(null)
  }, [editor, onReady])

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!editor) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+A in code block - select only code block content
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        if (editor.isActive('codeBlock')) {
          e.preventDefault()
          e.stopPropagation()

          // Find the code block node position
          const { state } = editor
          const { $from } = state.selection

          // Walk up to find the codeBlock node
          for (let depth = $from.depth; depth >= 0; depth--) {
            const node = $from.node(depth)
            if (node.type.name === 'codeBlock') {
              const start = $from.before(depth) + 1
              const end = start + node.content.size
              editor.chain().focus().setTextSelection({ from: start, to: end }).run()
              return
            }
          }
        }
      }

    }

    // Use capture phase to intercept before ProseMirror.
    // Note: Tab is handled separately via editorProps.handleKeyDown so
    // it stays scoped to the editor and doesn't steal Tab from other
    // inputs on the page.
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [editor])

  const copyAsMarkdown = useCallback(() => {
    if (!editor) return
    // Simple HTML to text conversion
    const text = editor.getText()
    navigator.clipboard.writeText(text)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }, [editor])

  const copyAsHTML = useCallback(() => {
    if (!editor) return
    navigator.clipboard.writeText(editor.getHTML())
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }, [editor])

  const addImage = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const result = e.target?.result
          if (typeof result === 'string') {
            editor
              ?.chain()
              .focus()
              .insertContent({ type: 'image', attrs: { src: result } })
              .run()
          }
        }
        reader.readAsDataURL(file)
      }
    }
    input.click()
  }, [editor])

  const setLink = useCallback(() => {
    if (!editor) return
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('URL', previousUrl)

    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])

  const addTable = useCallback(() => {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }, [editor])

  if (!editor) return null

  return (
    <div className={cn('tiptap-editor', className)}>
      {/* Toolbar */}
      {editable && (
        <div className="tiptap-toolbar">
          <div className="toolbar-group">
            <button
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              className="toolbar-btn"
              title="Undo"
            >
              <Undo className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              className="toolbar-btn"
              title="Redo"
            >
              <Redo className="h-4 w-4" />
            </button>
          </div>

          <div className="toolbar-divider" />

          <div className="toolbar-group">
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={cn('toolbar-btn', editor.isActive('heading', { level: 1 }) && 'is-active')}
              title="Heading 1"
            >
              <Heading1 className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={cn('toolbar-btn', editor.isActive('heading', { level: 2 }) && 'is-active')}
              title="Heading 2"
            >
              <Heading2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              className={cn('toolbar-btn', editor.isActive('heading', { level: 3 }) && 'is-active')}
              title="Heading 3"
            >
              <Heading3 className="h-4 w-4" />
            </button>
          </div>

          <div className="toolbar-divider" />

          <div className="toolbar-group">
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={cn('toolbar-btn', editor.isActive('bold') && 'is-active')}
              title="Bold (Ctrl+B)"
            >
              <Bold className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={cn('toolbar-btn', editor.isActive('italic') && 'is-active')}
              title="Italic (Ctrl+I)"
            >
              <Italic className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={cn('toolbar-btn', editor.isActive('underline') && 'is-active')}
              title="Underline (Ctrl+U)"
            >
              <UnderlineIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleStrike().run()}
              className={cn('toolbar-btn', editor.isActive('strike') && 'is-active')}
              title="Strikethrough"
            >
              <Strikethrough className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleCode().run()}
              className={cn('toolbar-btn', editor.isActive('code') && 'is-active')}
              title="Inline Code"
            >
              <Code className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHighlight().run()}
              className={cn('toolbar-btn', editor.isActive('highlight') && 'is-active')}
              title="Highlight"
            >
              <Highlighter className="h-4 w-4" />
            </button>
          </div>

          <div className="toolbar-divider" />

          <div className="toolbar-group">
            <button
              onClick={() => editor.chain().focus().clearIndent().toggleBulletList().run()}
              className={cn('toolbar-btn', editor.isActive('bulletList') && 'is-active')}
              title="Bullet List"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().clearIndent().toggleOrderedList().run()}
              className={cn('toolbar-btn', editor.isActive('orderedList') && 'is-active')}
              title="Numbered List"
            >
              <ListOrdered className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().clearIndent().toggleTaskList().run()}
              className={cn('toolbar-btn', editor.isActive('taskList') && 'is-active')}
              title="Task List"
            >
              <CheckSquare className="h-4 w-4" />
            </button>
          </div>

          <div className="toolbar-divider" />

          <div className="toolbar-group">
            <button
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              className={cn('toolbar-btn', editor.isActive('blockquote') && 'is-active')}
              title="Quote"
            >
              <Quote className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              className={cn('toolbar-btn', editor.isActive('codeBlock') && 'is-active')}
              title="Code Block"
            >
              <Code className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              className="toolbar-btn"
              title="Divider"
            >
              <Minus className="h-4 w-4" />
            </button>
          </div>

          <div className="toolbar-divider" />

          <div className="toolbar-group">
            <button onClick={addImage} className="toolbar-btn" title="Add Image">
              <ImageIcon className="h-4 w-4" />
            </button>
            <button
              onClick={setLink}
              className={cn('toolbar-btn', editor.isActive('link') && 'is-active')}
              title="Add Link"
            >
              <LinkIcon className="h-4 w-4" />
            </button>
            <button onClick={addTable} className="toolbar-btn" title="Add Table">
              <TableIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="toolbar-divider" />

          <div className="toolbar-group">
            <button
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
              className={cn('toolbar-btn', editor.isActive({ textAlign: 'left' }) && 'is-active')}
              title="Align Left"
            >
              <AlignLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
              className={cn('toolbar-btn', editor.isActive({ textAlign: 'center' }) && 'is-active')}
              title="Align Center"
            >
              <AlignCenter className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
              className={cn('toolbar-btn', editor.isActive({ textAlign: 'right' }) && 'is-active')}
              title="Align Right"
            >
              <AlignRight className="h-4 w-4" />
            </button>
          </div>

          <div className="toolbar-group ml-auto">
            <button onClick={copyAsHTML} className={cn('toolbar-btn', isCopied && 'is-copied')} title="Copy as HTML">
              {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}

      {/* Bubble Menu - appears when text is selected */}
      {editor && editable && (
        <BubbleMenu editor={editor} className="bubble-menu">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={cn('bubble-btn', editor.isActive('bold') && 'is-active')}
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={cn('bubble-btn', editor.isActive('italic') && 'is-active')}
          >
            <Italic className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={cn('bubble-btn', editor.isActive('underline') && 'is-active')}
          >
            <UnderlineIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={cn('bubble-btn', editor.isActive('strike') && 'is-active')}
          >
            <Strikethrough className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={cn('bubble-btn', editor.isActive('code') && 'is-active')}
          >
            <Code className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            className={cn('bubble-btn', editor.isActive('highlight') && 'is-active')}
          >
            <Highlighter className="h-4 w-4" />
          </button>
          <button onClick={setLink} className={cn('bubble-btn', editor.isActive('link') && 'is-active')}>
            <LinkIcon className="h-4 w-4" />
          </button>
        </BubbleMenu>
      )}

      {/* Table Controls - appears when cursor is in a table */}
      {editor && editable && isInTable && (
        <div className="table-controls">
          <div className="table-controls-group">
            <span className="table-controls-label">Row</span>
            <button
              onClick={() => editor.chain().focus().addRowBefore().run()}
              className="table-controls-btn"
              title="Add row above"
            >
              <ArrowUp className="h-3 w-3" />
              <Plus className="h-3 w-3" />
            </button>
            <button
              onClick={() => editor.chain().focus().addRowAfter().run()}
              className="table-controls-btn"
              title="Add row below"
            >
              <ArrowDown className="h-3 w-3" />
              <Plus className="h-3 w-3" />
            </button>
            <button
              onClick={() => editor.chain().focus().deleteRow().run()}
              className="table-controls-btn table-controls-btn-danger"
              title="Delete row"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
          <div className="table-controls-divider" />
          <div className="table-controls-group">
            <span className="table-controls-label">Column</span>
            <button
              onClick={() => editor.chain().focus().addColumnBefore().run()}
              className="table-controls-btn"
              title="Add column left"
            >
              <ArrowLeft className="h-3 w-3" />
              <Plus className="h-3 w-3" />
            </button>
            <button
              onClick={() => editor.chain().focus().addColumnAfter().run()}
              className="table-controls-btn"
              title="Add column right"
            >
              <ArrowRight className="h-3 w-3" />
              <Plus className="h-3 w-3" />
            </button>
            <button
              onClick={() => editor.chain().focus().deleteColumn().run()}
              className="table-controls-btn table-controls-btn-danger"
              title="Delete column"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
          <div className="table-controls-divider" />
          <button
            onClick={() => editor.chain().focus().deleteTable().run()}
            className="table-controls-btn table-controls-btn-danger"
            title="Delete table"
          >
            <Trash2 className="h-4 w-4" />
            <span className="text-xs">Table</span>
          </button>
        </div>
      )}

      {/* Editor Content */}
      <EditorContent editor={editor} className="flex min-h-0 flex-1 flex-col" />
    </div>
  )
}

export default TiptapEditor
