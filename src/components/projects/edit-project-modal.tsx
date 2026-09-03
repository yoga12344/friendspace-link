'use client'

import { useState, useEffect } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Loader2, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface EditProjectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: {
    id: string
    name: string
    description: string | null
    icon: string | null
    color: string | null
    status: string
    dueDate: string | null
  } | null
  onProjectUpdated?: () => void
  onProjectDeleted?: () => void
}

const emojiIcons = ['📁', '🚀', '💻', '🎨', '📊', '⚡', '🎯', '📱', '🔬', '💡']

export function EditProjectModal({
  open,
  onOpenChange,
  project,
  onProjectUpdated,
  onProjectDeleted,
}: EditProjectModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('📁')
  const [status, setStatus] = useState<string>('ACTIVE')
  const [dueDate, setDueDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (project) {
      setName(project.name || '')
      setDescription(project.description || '')
      setIcon(project.icon || '📁')
      setStatus(project.status || 'ACTIVE')
      setDueDate(project.dueDate ? project.dueDate.slice(0, 10) : '')
    }
  }, [project])

  if (!project) return null

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          icon,
          status,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')

      toast.success('Project updated!')
      onOpenChange(false)
      onProjectUpdated?.()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${project.name}" and all its tasks?`)) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed')

      toast.success('Project deleted')
      onOpenChange(false)
      if (onProjectDeleted) {
        onProjectDeleted()
      } else {
        router.push('/projects')
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <form onSubmit={handleUpdate}>
          <DialogHeader>
            <DialogTitle>Project Settings</DialogTitle>
            <DialogDescription>
              Update project details or status.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label>Project Icon</Label>
              <div className="flex flex-wrap gap-1.5">
                {emojiIcons.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setIcon(em)}
                    className={`h-8 w-8 rounded-lg border text-sm flex items-center justify-center transition-all ${
                      icon === em
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950 scale-105'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-p-name">Project Name *</Label>
              <Input
                id="edit-p-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-p-desc">Description</Label>
              <Textarea
                id="edit-p-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-p-status">Status</Label>
                <select
                  id="edit-p-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="PLANNING">Planning</option>
                  <option value="ACTIVE">Active</option>
                  <option value="ON_HOLD">On Hold</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-p-due">Due Date</Label>
                <Input
                  id="edit-p-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            {/* Danger Zone */}
            <div className="pt-3 border-t border-border flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-destructive">Delete Project</p>
                <p className="text-[11px] text-muted-foreground">Remove this project and its tasks</p>
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
                className="h-8 text-xs gap-1"
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete
              </Button>
            </div>
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
              disabled={loading || !name.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
