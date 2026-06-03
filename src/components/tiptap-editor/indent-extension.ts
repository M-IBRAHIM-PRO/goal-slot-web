import { Extension } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    blockIndent: {
      indentBlock: () => ReturnType
      outdentBlock: () => ReturnType
    }
  }
}

export interface IndentOptions {
  types: string[]
  minLevel: number
  maxLevel: number
}

// Adds an `indent` attribute (clamped to [minLevel, maxLevel]) to paragraph
// and heading nodes so Tab / Shift-Tab can indent plain text the same way
// they sink / lift list items. Rendered via `data-indent` so the CSS layer
// can apply consistent padding-left without hardcoding pixel math here.
export const IndentExtension = Extension.create<IndentOptions>({
  name: 'blockIndent',

  addOptions() {
    return {
      types: ['paragraph', 'heading'],
      minLevel: 0,
      maxLevel: 6,
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => {
              const raw = element.getAttribute('data-indent')
              const n = raw ? parseInt(raw, 10) : 0
              return Number.isFinite(n) && n > 0 ? n : 0
            },
            renderHTML: (attributes) => {
              const level = (attributes.indent as number) || 0
              if (!level) return {}
              return { 'data-indent': String(level) }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    const adjust = (delta: number) => () => ({ state, tr, dispatch }: any) => {
      const { selection } = state
      const { from, to } = selection
      let touched = false

      state.doc.nodesBetween(from, to, (node: any, pos: number) => {
        if (!this.options.types.includes(node.type.name)) return true
        const current = (node.attrs.indent as number) || 0
        const next = Math.max(
          this.options.minLevel,
          Math.min(this.options.maxLevel, current + delta),
        )
        if (next === current) return true
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next })
        touched = true
        return true
      })

      if (touched && dispatch) dispatch(tr)
      return touched
    }

    return {
      indentBlock: adjust(1),
      outdentBlock: adjust(-1),
    }
  },
})
