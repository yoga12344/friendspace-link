'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useWorkspaceStore } from '@/store/workspace-store'
import { CreateDocModal } from '@/components/docs/create-doc-modal'
import { getInitials, formatRelativeTime } from '@/lib/utils'
import {
  FileText,
  Plus,
  Search,
  Clock,
  Trash2,
  Loader2,
  FolderKanban,
  FileEdit,
} from 'lucide-react'
import { toast } from 'sonner'

interface DocsClientProps {
  currentUserId: string
}

export function DocsClient({ currentUserId }: DocsClientProps) {
  const currentWorkspace = useWorkspaceStore((s) => s.getCurrentWorkspace())
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [createModalOpen, setCreateModalOpen] = useState(false)

  const fetchDocs = useCallback(async () => {
    if (!currentWorkspace?.id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/documents?workspaceId=${currentWorkspace.id}`)
      const data = await res.json()
      if (res.ok) {
        setDocuments(data.documents || [])
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [currentWorkspace?.id])

  useEffect(() => {
    fetchDocs()
  }, [fetchDocs])

  const handleDeleteDoc = async (e: React.MouseEvent, docId: string, title: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return

    try {
      const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Delete failed')
      }
      toast.success('Document deleted')
      fetchDocs()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const filteredDocs = documents.filter((d) =>
    d.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-emerald-600" />
            Documents
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Rich-text notes, specifications, and shared team knowledge in{' '}
            <span className="font-semibold text-foreground">
              {currentWorkspace?.name || 'this workspace'}
            </span>
            .
          </p>
        </div>

        <Button
          onClick={() => setCreateModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 shrink-0"
        >
          <Plus className="h-4 w-4" /> New Document
        </Button>
      </div>

      {/* SEARCH BAR */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search documents by title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 text-xs h-9 max-w-md"
        />
      </div>

      {/* DOCUMENTS GRID */}
      {loading ? (
        <div className="py-20 text-center text-muted-foreground text-xs flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading documents...
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-border rounded-2xl bg-card">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 flex items-center justify-center mx-auto mb-3 text-2xl">
            📝
          </div>
          <h3 className="text-sm font-semibold text-foreground">No documents found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
            {search
              ? 'Try changing your search term.'
              : 'Create a rich-text document to collaborate on notes, guides, or specifications.'}
          </p>
          <Button
            size="sm"
            onClick={() => setCreateModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Create Document
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map((doc) => (
            <Link key={doc.id} href={`/docs/${doc.id}`}>
              <div className="bg-card p-5 rounded-xl border border-border hover:border-emerald-500 hover:shadow-md transition-all flex flex-col justify-between h-44 group cursor-pointer">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 flex items-center justify-center text-emerald-600 shrink-0">
                        <FileEdit className="h-4 w-4" />
                      </div>
                      <h3 className="font-bold text-sm text-foreground truncate group-hover:text-emerald-600 transition-colors">
                        {doc.title}
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteDoc(e, doc.id, doc.title)}
                      className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity p-1"
                      title="Delete document"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {doc.project && (
                    <Badge variant="outline" className="text-[10px] gap-1 mb-2">
                      <span>{doc.project.icon || '📁'}</span>
                      <span className="truncate">{doc.project.name}</span>
                    </Badge>
                  )}
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={doc.creator.image || ''} alt={doc.creator.name} />
                      <AvatarFallback className="text-[8px]">
                        {getInitials(doc.creator.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{doc.creator.name.split(' ')[0]}</span>
                  </div>

                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatRelativeTime(doc.updatedAt)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* CREATE DOCUMENT MODAL */}
      <CreateDocModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onDocumentCreated={() => {
          fetchDocs()
        }}
      />
    </div>
  )
}
