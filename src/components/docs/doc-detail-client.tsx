'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { TiptapEditor } from '@/components/docs/tiptap-editor'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Loader2, Users, Lock, Unlock } from 'lucide-react'
import { toast } from 'sonner'

interface DocDetailClientProps {
  documentId: string
  currentUserId: string
}

export function DocDetailClient({ documentId, currentUserId }: DocDetailClientProps) {
  const [document, setDocument] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchDoc = async () => {
    try {
      const res = await fetch(`/api/documents/${documentId}`)
      const data = await res.json()
      if (res.ok && data.document) {
        setDocument(data.document)
      } else {
        throw new Error(data.error || 'Failed to load document')
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDoc()
  }, [documentId])

  if (loading) {
    return (
      <div className="py-24 text-center text-muted-foreground text-xs flex items-center justify-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading document...
      </div>
    )
  }

  if (!document) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-bold text-foreground">Document not found</h2>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/docs">Back to Documents</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 h-[calc(100vh-6rem)] flex flex-col">
      {/* Top Back Navigation */}
      <div className="flex items-center justify-between shrink-0">
        <Link
          href="/docs"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Documents
        </Link>

        {document.project && (
          <Badge variant="outline" className="text-xs gap-1">
            <span>{document.project.icon || '📁'}</span>
            <span>{document.project.name}</span>
          </Badge>
        )}
      </div>

      {/* Editor Canvas */}
      <div className="flex-1 min-h-0">
        <TiptapEditor
          documentId={document.id}
          initialTitle={document.title}
          initialContent={document.content}
          lastEditedAt={document.lastEditedAt || document.updatedAt}
        />
      </div>
    </div>
  )
}
