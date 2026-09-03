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
import { Badge } from '@/components/ui/badge'
import { useWorkspaceStore } from '@/store/workspace-store'
import { toast } from 'sonner'
import { Loader2, Plus, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface CreateTaskModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId?: string
  workspaceId?: string
  onTaskCreated?: (task: any) => void
}

export function CreateTaskModal({
  open,
  onOpenChange,
  projectId: defaultProjectId,
  onTaskCreated,
}: CreateTaskModalProps) {
  const currentWorkspace = useWorkspaceStore((s) => s.getCurrentWorkspace())
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED'>('TODO')
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM')
  const [dueDate, setDueDate] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState(defaultProjectId || '')

  // Available projects (if not passed)
  const [projects, setProjects] = useState<any[]>([])
  // Available workspace members for assignees
  const [members, setMembers] = useState<any[]>([])
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([])

  // Tags
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<{ name: string; color: string }[]>([])

  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (defaultProjectId) {
      setSelectedProjectId(defaultProjectId)
    }
  }, [defaultProjectId])

  useEffect(() => {
    if (!open || !currentWorkspace?.id) return

    // Fetch projects for selector
    fetch(`/api/workspaces/${currentWorkspace.id}/projects`)
      .then((r) => r.json())
      .then((data) => {
        if (data.projects) {
          setProjects(data.projects)
          if (!defaultProjectId && data.projects.length > 0 && !selectedProjectId) {
            setSelectedProjectId(data.projects[0].id)
          }
        }
      })
      .catch(() => {})

    // Fetch workspace members for assignees
    fetch(`/api/workspaces/${currentWorkspace.id}/members`)
      .then((r) => r.json())
      .then((data) => {
        if (data.members) {
          setMembers(data.members)
        }
      })
      .catch(() => {})
  }, [open, currentWorkspace?.id, defaultProjectId, selectedProjectId])

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const clean = tagInput.trim().replace(',', '').toLowerCase()
      if (clean && !tags.some((t) => t.name === clean)) {
        setTags((prev) => [...prev, { name: clean, color: '#6366f1' }])
        setTagInput('')
      }
    }
  }

  const handleRemoveTag = (name: string) => {
    setTags((prev) => prev.filter((t) => t.name !== name))
  }

  const toggleAssignee = (userId: string) => {
    setSelectedAssignees((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('Task title is required')
      return
    }

    if (!selectedProjectId) {
      toast.error('Please select a project for this task')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          status,
          priority,
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
          assigneeIds: selectedAssignees,
          tags: tags.length > 0 ? tags : undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create task')

      toast.success('Task created!')
      setTitle('')
      setDescription('')
      setStatus('TODO')
      setPriority('MEDIUM')
      setDueDate('')
      setSelectedAssignees([])
      setTags([])
      onOpenChange(false)

      if (onTaskCreated) {
        onTaskCreated(data.task)
      } else {
        router.refresh()
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleCreate}>
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
            <DialogDescription>
              Add a new task to your project workflow.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-1">
            {/* Project Selector (if multiple available or opened globally) */}
            <div className="space-y-1.5">
              <Label htmlFor="task-project">Project *</Label>
              <select
                id="task-project"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {projects.length === 0 ? (
                  <option value="">No projects in this workspace</option>
                ) : (
                  projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.icon || '📁'} {p.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Task Title */}
            <div className="space-y-1.5">
              <Label htmlFor="task-title">Task Title *</Label>
              <Input
                id="task-title"
                placeholder="What needs to be done?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="task-desc">Description</Label>
              <Textarea
                id="task-desc"
                placeholder="Add context, details, or acceptance criteria..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                rows={3}
              />
            </div>

            {/* Status & Priority */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="task-status">Status</Label>
                <select
                  id="task-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="BACKLOG">Backlog</option>
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="REVIEW">Review</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="task-priority">Priority</Label>
                <select
                  id="task-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent ⚡</option>
                </select>
              </div>
            </div>

            {/* Due Date */}
            <div className="space-y-1.5">
              <Label htmlFor="task-due">Due Date</Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="text-xs"
              />
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <Label htmlFor="task-tags">Tags</Label>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {tags.map((t) => (
                  <Badge
                    key={t.name}
                    variant="secondary"
                    className="text-[11px] gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                  >
                    #{t.name}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t.name)}
                      className="hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Input
                id="task-tags"
                placeholder="Type tag and press Enter (e.g. frontend, bug)..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                className="text-xs"
              />
            </div>

            {/* Assignees */}
            {members.length > 0 && (
              <div className="space-y-1.5">
                <Label>Assignees</Label>
                <div className="border border-border rounded-lg divide-y divide-border max-h-32 overflow-y-auto">
                  {members.map((m) => {
                    const isSelected = selectedAssignees.includes(m.userId)
                    return (
                      <label
                        key={m.userId}
                        className="flex items-center justify-between p-2 px-3 hover:bg-muted/40 cursor-pointer text-xs"
                      >
                        <span className="font-medium text-foreground">{m.user.name}</span>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleAssignee(m.userId)}
                          className="rounded border-border text-indigo-600 focus:ring-indigo-500"
                        />
                      </label>
                    )
                  })}
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
              disabled={loading || !title.trim() || !selectedProjectId}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
