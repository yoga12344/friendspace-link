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
import { useWorkspaceStore } from '@/store/workspace-store'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface CreateProjectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onProjectCreated?: (project: any) => void
}

const emojiIcons = ['📁', '🚀', '💻', '🎨', '📊', '⚡', '🎯', '📱', '🔬', '💡']
const colorOptions = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6']

export function CreateProjectModal({
  open,
  onOpenChange,
  onProjectCreated,
}: CreateProjectModalProps) {
  const currentWorkspace = useWorkspaceStore((s) => s.getCurrentWorkspace())
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('📁')
  const [color, setColor] = useState('#6366f1')
  const [status, setStatus] = useState<'PLANNING' | 'ACTIVE' | 'ON_HOLD'>('ACTIVE')
  const [dueDate, setDueDate] = useState('')
  const [loading, setLoading] = useState(false)

  // Workspace members to optionally select
  const [workspaceMembers, setWorkspaceMembers] = useState<any[]>([])
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const router = useRouter()

  useEffect(() => {
    if (!open || !currentWorkspace?.id) return

    fetch(`/api/workspaces/${currentWorkspace.id}/members`)
      .then((r) => r.json())
      .then((data) => {
        if (data.members) {
          setWorkspaceMembers(data.members)
        }
      })
      .catch(() => {})
  }, [open, currentWorkspace?.id])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Project name is required')
      return
    }

    if (!currentWorkspace?.id) {
      toast.error('No workspace selected')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/workspaces/${currentWorkspace.id}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          icon,
          color,
          status,
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
          memberIds: selectedMembers,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create project')

      toast.success('Project created!')
      setName('')
      setDescription('')
      setIcon('📁')
      setDueDate('')
      setSelectedMembers([])
      onOpenChange(false)
      if (onProjectCreated) {
        onProjectCreated(data.project)
      } else {
        router.refresh()
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((mId) => mId !== id) : [...prev, id]
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleCreate}>
          <DialogHeader>
            <DialogTitle>Create Project</DialogTitle>
            <DialogDescription>
              Organize tasks, track progress, and collaborate in {currentWorkspace?.name || 'this workspace'}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-1">
            {/* Icon & Color */}
            <div className="space-y-2">
              <Label>Project Icon & Theme</Label>
              <div className="flex items-center gap-4">
                <div className="flex flex-wrap gap-1.5 flex-1">
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

                <div className="flex gap-1 border-l border-border pl-3 shrink-0">
                  {colorOptions.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`h-6 w-6 rounded-full transition-transform ${
                        color === c ? 'scale-125 ring-2 ring-indigo-500' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="proj-name">Project Name *</Label>
              <Input
                id="proj-name"
                placeholder="e.g. Mobile App Redesign, Final Year Project"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="proj-desc">Description (Optional)</Label>
              <Textarea
                id="proj-desc"
                placeholder="What is this project aiming to accomplish?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={2}
              />
            </div>

            {/* Status & Due Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="proj-status">Status</Label>
                <select
                  id="proj-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="PLANNING">Planning</option>
                  <option value="ACTIVE">Active</option>
                  <option value="ON_HOLD">On Hold</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="proj-due">Target Due Date</Label>
                <Input
                  id="proj-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            {/* Workspace Members to Add */}
            {workspaceMembers.length > 0 && (
              <div className="space-y-1.5">
                <Label>Team Members</Label>
                <div className="border border-border rounded-lg divide-y divide-border max-h-32 overflow-y-auto">
                  {workspaceMembers.map((m) => (
                    <label
                      key={m.userId}
                      className="flex items-center justify-between p-2 px-3 hover:bg-muted/40 cursor-pointer text-xs"
                    >
                      <span className="font-medium text-foreground">{m.user.name}</span>
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(m.userId)}
                        onChange={() => toggleMember(m.userId)}
                        className="rounded border-border text-indigo-600 focus:ring-indigo-500"
                      />
                    </label>
                  ))}
                </div>
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
              disabled={loading || !name.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
