'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  Minus,
  Link2,
  Undo,
  Redo,
  Check,
  Loader2,
  Clock,
} from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'

interface TiptapEditorProps {
  documentId: string
  initialTitle: string
  initialContent: any
  lastEditedAt?: string | null
  readOnly?: boolean
  onTitleChange?: (title: string) => void
  onSave?: (data: { title: string; content: any }) => Promise<void>
}

export function TiptapEditor({
  documentId,
  initialTitle,
  initialContent,
  lastEditedAt,
  readOnly = false,
  onTitleChange,
  onSave,
}: TiptapEditorProps) {
  const [title, setTitle] = useState(initialTitle)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [lastSaved, setLastSaved] = useState<Date | null>(
    lastEditedAt ? new Date(lastEditedAt) : null
  )
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Debounced save callback
  const triggerSave = useCallback(
    async (newTitle: string, newContent: any) => {
      setSaveStatus('saving')
      try {
        if (onSave) {
          await onSave({ title: newTitle, content: newContent })
        } else {
          await fetch(`/api/documents/${documentId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle, content: newContent }),
          })
        }
        setSaveStatus('saved')
        setLastSaved(new Date())
      } catch {
        setSaveStatus('unsaved')
      }
    },
    [documentId, onSave]
  )

  const scheduleAutosave = useCallback(
    (newTitle: string, newContent: any) => {
      if (readOnly) return
      setSaveStatus('unsaved')
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      saveTimeoutRef.current = setTimeout(() => {
        triggerSave(newTitle, newContent)
      }, 1200) // 1.2s debounce
    },
    [readOnly, triggerSave]
  )

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: { HTMLAttributes: { class: 'bg-muted p-3 rounded-lg font-mono text-xs my-2' } },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-indigo-600 underline cursor-pointer' },
      }),
      TaskList.configure({
        HTMLAttributes: { class: 'space-y-1 list-none p-0' },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: { class: 'flex items-start gap-2 text-xs' },
      }),
      Placeholder.configure({
        placeholder: 'Start writing your document here...',
      }),
    ],
    content: initialContent && Object.keys(initialContent).length > 0 ? initialContent : '',
    editable: !readOnly,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const json = editor.getJSON()
      scheduleAutosave(title, json)
    },
  })

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle)
    onTitleChange?.(newTitle)
    const content = editor?.getJSON() || {}
    scheduleAutosave(newTitle, content)
  }

  const setLink = () => {
    if (!editor) return
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('Enter link URL', previousUrl)

    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  if (!editor) return null

  return (
    <div className="flex flex-col h-full bg-card rounded-2xl border border-border overflow-hidden shadow-xs">
      {/* TOP HEADER: Title + Autosave Status */}
      <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
        <Input
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          disabled={readOnly}
          placeholder="Untitled Document"
          className="text-lg font-bold border-transparent hover:border-border focus:border-indigo-500 bg-transparent px-2 max-w-xl h-9"
        />

        {/* Autosave & Timestamp indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0 self-end sm:self-auto">
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <Check className="h-3.5 w-3.5" /> Saved
            </span>
          )}
          {saveStatus === 'unsaved' && (
            <span className="text-amber-500 font-medium">Unsaved changes</span>
          )}
          {lastSaved && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1 border-l border-border pl-2">
              <Clock className="h-3 w-3" /> {formatRelativeTime(lastSaved)}
            </span>
          )}
        </div>
      </div>

      {/* RICH TEXT TOOLBAR */}
      {!readOnly && (
        <div className="p-2 px-3 border-b border-border bg-muted/40 flex items-center gap-1 flex-wrap text-xs">
          {/* Headings */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`p-1.5 rounded hover:bg-background transition-colors ${
              editor.isActive('heading', { level: 1 }) ? 'bg-background text-indigo-600 shadow-xs' : 'text-muted-foreground'
            }`}
            title="Heading 1"
          >
            <Heading1 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`p-1.5 rounded hover:bg-background transition-colors ${
              editor.isActive('heading', { level: 2 }) ? 'bg-background text-indigo-600 shadow-xs' : 'text-muted-foreground'
            }`}
            title="Heading 2"
          >
            <Heading2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`p-1.5 rounded hover:bg-background transition-colors ${
              editor.isActive('heading', { level: 3 }) ? 'bg-background text-indigo-600 shadow-xs' : 'text-muted-foreground'
            }`}
            title="Heading 3"
          >
            <Heading3 className="h-4 w-4" />
          </button>

          <div className="h-4 w-px bg-border mx-1" />

          {/* Formats */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded hover:bg-background transition-colors ${
              editor.isActive('bold') ? 'bg-background text-indigo-600 shadow-xs font-bold' : 'text-muted-foreground'
            }`}
            title="Bold (Ctrl+B)"
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded hover:bg-background transition-colors ${
              editor.isActive('italic') ? 'bg-background text-indigo-600 shadow-xs' : 'text-muted-foreground'
            }`}
            title="Italic (Ctrl+I)"
          >
            <Italic className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`p-1.5 rounded hover:bg-background transition-colors ${
              editor.isActive('underline') ? 'bg-background text-indigo-600 shadow-xs' : 'text-muted-foreground'
            }`}
            title="Underline (Ctrl+U)"
          >
            <UnderlineIcon className="h-4 w-4" />
          </button>

          <div className="h-4 w-px bg-border mx-1" />

          {/* Lists */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded hover:bg-background transition-colors ${
              editor.isActive('bulletList') ? 'bg-background text-indigo-600 shadow-xs' : 'text-muted-foreground'
            }`}
            title="Bullet List"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-1.5 rounded hover:bg-background transition-colors ${
              editor.isActive('orderedList') ? 'bg-background text-indigo-600 shadow-xs' : 'text-muted-foreground'
            }`}
            title="Numbered List"
          >
            <ListOrdered className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            className={`p-1.5 rounded hover:bg-background transition-colors ${
              editor.isActive('taskList') ? 'bg-background text-indigo-600 shadow-xs' : 'text-muted-foreground'
            }`}
            title="Checklist"
          >
            <CheckSquare className="h-4 w-4" />
          </button>

          <div className="h-4 w-px bg-border mx-1" />

          {/* Blocks */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`p-1.5 rounded hover:bg-background transition-colors ${
              editor.isActive('blockquote') ? 'bg-background text-indigo-600 shadow-xs' : 'text-muted-foreground'
            }`}
            title="Quote"
          >
            <Quote className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={`p-1.5 rounded hover:bg-background transition-colors ${
              editor.isActive('codeBlock') ? 'bg-background text-indigo-600 shadow-xs' : 'text-muted-foreground'
            }`}
            title="Code Block"
          >
            <Code className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            className="p-1.5 rounded hover:bg-background transition-colors text-muted-foreground"
            title="Horizontal Divider"
          >
            <Minus className="h-4 w-4" />
          </button>

          <div className="h-4 w-px bg-border mx-1" />

          {/* Links & History */}
          <button
            type="button"
            onClick={setLink}
            className={`p-1.5 rounded hover:bg-background transition-colors ${
              editor.isActive('link') ? 'bg-background text-indigo-600 shadow-xs' : 'text-muted-foreground'
            }`}
            title="Insert Link"
          >
            <Link2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="p-1.5 rounded hover:bg-background transition-colors text-muted-foreground disabled:opacity-40"
            title="Undo"
          >
            <Undo className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="p-1.5 rounded hover:bg-background transition-colors text-muted-foreground disabled:opacity-40"
            title="Redo"
          >
            <Redo className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* EDITOR CONTENT CANVAS */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <EditorContent
          editor={editor}
          className="prose dark:prose-invert max-w-3xl mx-auto focus:outline-none min-h-[400px] text-sm leading-relaxed"
        />
      </div>
    </div>
  )
}
