'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useWorkspaceStore } from '@/store/workspace-store'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface CreateDocModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId?: string
  onDocumentCreated?: (doc: any) => void
}

export function CreateDocModal({
  open,
  onOpenChange,
  projectId: defaultProjectId,
  onDocumentCreated,
}: CreateDocModalProps) {
  const currentWorkspace = useWorkspaceStore((s) => s.getCurrentWorkspace())
  const [title, setTitle] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState(defaultProjectId || '')
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (defaultProjectId) setSelectedProjectId(defaultProjectId)
  }, [defaultProjectId])

  useEffect(() => {
    if (!open || !currentWorkspace?.id) return

    fetch(`/api/workspaces/${currentWorkspace.id}/projects`)
      .then((r) => r.json())
      .then((data) => {
        if (data.projects) setProjects(data.projects)
      })
      .catch(() => {})
  }, [open, currentWorkspace?.id])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('Document title is required')
      return
    }

    if (!currentWorkspace?.id) {
      toast.error('No workspace selected')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: currentWorkspace.id,
          projectId: selectedProjectId || undefined,
          title: title.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create document')

      toast.success('Document created!')
      setTitle('')
      setSelectedProjectId(defaultProjectId || '')
      onOpenChange(false)

      if (onDocumentCreated) {
        onDocumentCreated(data.document)
      } else {
        router.push(`/docs/${data.document.id}`)
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <form onSubmit={handleCreate}>
          <DialogHeader>
            <DialogTitle>New Document</DialogTitle>
            <DialogDescription>
              Create a rich text document for notes, specs, or shared knowledge.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="doc-title">Document Title *</Label>
              <Input
                id="doc-title"
                placeholder="e.g. Product Architecture, Meeting Notes"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                required
              />
            </div>

            {projects.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="doc-project">Project (Optional)</Label>
                <select
                  id="doc-project"
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">General Workspace Document</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.icon || '📁'} {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !title.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Document
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
