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
import { TextSelection } from '@tiptap/pm/state'

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

// Backspace inside a list item. Architecture: only intervene when the
// cursor sits at the very start of the <li>'s first block. Past attempts
// to handle every Backspace position produced cascading edge cases, so
// the guard at $from.index(liDepth) !== 0 keeps us out of any "cursor
// inside a 2nd+ block of an <li>" situation — those go to ProseMirror's
// default, which correctly joins with the previous block.
//
// When the cursor IS at the start of the <li>'s first block:
//   - Empty <li> with a previous sibling -> surgical delete that folds
//     any nested children into the previous <li>. Avoids joinBackward,
//     which can pick the wrong boundary in deep nests and yank entire
//     subtrees up a level.
//   - Otherwise -> liftListItem. Strips the bullet marker and leaves the
//     text where it is. Covers both "Backspace removes a non-empty
//     bullet's marker" (Notion-style indent-left UX) and the original
//     "text moved into the heading above" bug, which was the default
//     joinBackward dragging the first bullet's text up into the heading.
function handleListBackspace(ed: any, event: KeyboardEvent): boolean {
  const { selection } = ed.state
  if (!selection.empty) return false

  const { $from } = selection
  if ($from.parentOffset !== 0) return false

  const itemType = ed.isActive('taskItem')
    ? 'taskItem'
    : ed.isActive('listItem')
      ? 'listItem'
      : null
  if (!itemType) return false

  let liDepth = -1
  for (let d = $from.depth; d >= 0; d--) {
    if ($from.node(d).type.name === itemType) {
      liDepth = d
      break
    }
  }
  if (liDepth < 0) return false

  if ($from.index(liDepth) !== 0) return false

  const liNode = $from.node(liDepth)
  const firstChild = liNode.firstChild
  const isItemEmpty = !firstChild || firstChild.content.size === 0
  const isFirstItemOfList = $from.index(liDepth - 1) === 0

  if (isItemEmpty && !isFirstItemOfList) {
    const liStart = $from.before(liDepth)
    const liEnd = $from.after(liDepth)
    const prevLiInnerEnd = liStart - 1

    const nestedNodes: any[] = []
    for (let i = 1; i < liNode.childCount; i++) {
      nestedNodes.push(liNode.child(i))
    }

    const tr = ed.state.tr
    tr.delete(liStart, liEnd)

    let insertPos = prevLiInnerEnd
    for (const node of nestedNodes) {
      tr.insert(insertPos, node)
      insertPos += node.nodeSize
    }

    const cursorPos = Math.min(insertPos, tr.doc.content.size)
    tr.setSelection(TextSelection.near(tr.doc.resolve(cursorPos)))

    event.preventDefault()
    ed.view.dispatch(tr)
    return true
  }

  if (!ed.can().liftListItem(itemType)) return false
  event.preventDefault()
  ed.chain().focus().liftListItem(itemType).run()
  return true
}

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
      // Tab and Backspace overrides. Single principle: trust ProseMirror's
      // primitives, only override when defaults can't express the behavior
      // we want, and when we do override, build surgical transactions
      // (never joinBackward, which walks the doc tree looking for any
      // joinable boundary and can collapse the wrong level).
      handleKeyDown: (_view, event) => {
        const ed = editorRef.current
        if (!ed) return false

        if (event.key === 'Backspace') {
          return handleListBackspace(ed, event)
        }

        if (event.key !== 'Tab') return false
        if (ed.isActive('table')) return false

        event.preventDefault()

        const itemType = ed.isActive('taskItem')
          ? 'taskItem'
          : ed.isActive('listItem')
            ? 'listItem'
            : null

        if (itemType) {
          if (event.shiftKey) {
            ed.chain().focus().liftListItem(itemType).run()
          } else {
            ed.chain().focus().sinkListItem(itemType).run()
          }
          return true
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
