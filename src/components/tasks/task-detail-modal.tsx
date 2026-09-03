'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getInitials, formatRelativeTime, formatBytes } from '@/lib/utils'
import { toast } from 'sonner'
import {
  CheckSquare,
  Clock,
  User,
  Plus,
  Trash2,
  Send,
  Loader2,
  X,
  Tag,
  CheckCircle2,
  AlertCircle,
  FolderKanban,
  Paperclip,
  Download,
} from 'lucide-react'

interface TaskDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskId: string | null
  onTaskUpdated?: () => void
  onTaskDeleted?: () => void
  currentUserId: string
}

export function TaskDetailModal({
  open,
  onOpenChange,
  taskId,
  onTaskUpdated,
  onTaskDeleted,
  currentUserId,
}: TaskDetailModalProps) {
  const [task, setTask] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)

  // Edit fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<string>('TODO')
  const [priority, setPriority] = useState<string>('MEDIUM')
  const [dueDate, setDueDate] = useState('')

  // New checklist item
  const [newChecklistText, setNewChecklistText] = useState('')
  const [addingChecklist, setAddingChecklist] = useState(false)

  // New comment
  const [newCommentText, setNewCommentText] = useState('')
  const [postingComment, setPostingComment] = useState(false)

  // New tag
  const [newTagText, setNewTagText] = useState('')

  // Available workspace members for assigning
  const [workspaceMembers, setWorkspaceMembers] = useState<any[]>([])
  const [showAssignDropdown, setShowAssignDropdown] = useState(false)

  const fetchTaskDetails = async () => {
    if (!taskId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}`)
      const data = await res.json()
      if (res.ok && data.task) {
        setTask(data.task)
        setTitle(data.task.title)
        setDescription(data.task.description || '')
        setStatus(data.task.status)
        setPriority(data.task.priority)
        setDueDate(data.task.dueDate ? data.task.dueDate.slice(0, 10) : '')

        // Fetch workspace members for assignees
        if (data.task.workspaceId) {
          fetch(`/api/workspaces/${data.task.workspaceId}/members`)
            .then((r) => r.json())
            .then((m) => {
              if (m.members) setWorkspaceMembers(m.members)
            })
            .catch(() => {})
        }
      }
    } catch {
      toast.error('Failed to load task details')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && taskId) {
      fetchTaskDetails()
    }
  }, [open, taskId])

  if (!task && loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] p-8 text-center">
          <DialogTitle className="sr-only">Loading Task</DialogTitle>
          <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading task details...
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!task) return null

  // Save changes to title/desc/status/priority/due date
  const handleSaveField = async (fields: Record<string, any>) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update')

      setTask(data.task)
      onTaskUpdated?.()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  // Checklists
  const handleToggleChecklist = async (checklistId: string, currentChecked: boolean) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}/checklists/${checklistId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checked: !currentChecked }),
      })
      if (res.ok) {
        setTask((prev: any) => ({
          ...prev,
          checklists: prev.checklists.map((c: any) =>
            c.id === checklistId ? { ...c, checked: !currentChecked } : c
          ),
        }))
        onTaskUpdated?.()
      }
    } catch {
      toast.error('Failed to toggle checklist item')
    }
  }

  const handleAddChecklist = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newChecklistText.trim()) return

    setAddingChecklist(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}/checklists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newChecklistText.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setTask((prev: any) => ({
          ...prev,
          checklists: [...prev.checklists, data.item],
        }))
        setNewChecklistText('')
        onTaskUpdated?.()
      }
    } catch {
      toast.error('Failed to add checklist item')
    } finally {
      setAddingChecklist(false)
    }
  }

  const handleDeleteChecklist = async (checklistId: string) => {
    try {
      await fetch(`/api/tasks/${task.id}/checklists/${checklistId}`, { method: 'DELETE' })
      setTask((prev: any) => ({
        ...prev,
        checklists: prev.checklists.filter((c: any) => c.id !== checklistId),
      }))
      onTaskUpdated?.()
    } catch {
      toast.error('Failed to delete checklist item')
    }
  }

  // Tags
  const handleAddTag = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const clean = newTagText.trim().replace(',', '').toLowerCase()
      if (!clean) return

      try {
        const res = await fetch(`/api/tasks/${task.id}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: clean }),
        })
        const data = await res.json()
        if (res.ok) {
          setTask((prev: any) => ({
            ...prev,
            tags: [...prev.tags, data.tag],
          }))
          setNewTagText('')
          onTaskUpdated?.()
        }
      } catch {
        toast.error('Failed to add tag')
      }
    }
  }

  const handleDeleteTag = async (tagId: string) => {
    try {
      await fetch(`/api/tasks/${task.id}/tags/${tagId}`, { method: 'DELETE' })
      setTask((prev: any) => ({
        ...prev,
        tags: prev.tags.filter((t: any) => t.id !== tagId),
      }))
      onTaskUpdated?.()
    } catch {
      toast.error('Failed to remove tag')
    }
  }

  // Assignees
  const handleAssignUser = async (userId: string) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}/assignees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: [userId] }),
      })
      if (res.ok) {
        toast.success('Assignee added')
        setShowAssignDropdown(false)
        fetchTaskDetails()
        onTaskUpdated?.()
      }
    } catch {
      toast.error('Failed to assign user')
    }
  }

  const handleUnassignUser = async (userId: string) => {
    try {
      await fetch(`/api/tasks/${task.id}/assignees/${userId}`, { method: 'DELETE' })
      setTask((prev: any) => ({
        ...prev,
        assignees: prev.assignees.filter((a: any) => a.userId !== userId),
      }))
      onTaskUpdated?.()
    } catch {
      toast.error('Failed to unassign user')
    }
  }

  // Attachments
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const fileAttachmentRef = useRef<HTMLInputElement>(null)

  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAttachment(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('workspaceId', task.workspaceId)
      formData.append('taskId', task.id)
      if (task.projectId) formData.append('projectId', task.projectId)

      const res = await fetch('/api/files', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')

      toast.success('Attachment added')
      fetchTaskDetails()
      onTaskUpdated?.()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setUploadingAttachment(false)
      if (fileAttachmentRef.current) fileAttachmentRef.current.value = ''
    }
  }

  const handleDeleteAttachment = async (fileId: string) => {
    try {
      await fetch(`/api/files/${fileId}`, { method: 'DELETE' })
      setTask((prev: any) => ({
        ...prev,
        attachments: (prev.attachments || []).filter((a: any) => a.id !== fileId),
      }))
      onTaskUpdated?.()
    } catch {
      toast.error('Failed to remove attachment')
    }
  }

  // Comments
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCommentText.trim()) return

    setPostingComment(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newCommentText.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setTask((prev: any) => ({
          ...prev,
          comments: [...prev.comments, data.comment],
        }))
        setNewCommentText('')
      }
    } catch {
      toast.error('Failed to post comment')
    } finally {
      setPostingComment(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    try {
      await fetch(`/api/tasks/${task.id}/comments/${commentId}`, { method: 'DELETE' })
      setTask((prev: any) => ({
        ...prev,
        comments: prev.comments.filter((c: any) => c.id !== commentId),
      }))
    } catch {
      toast.error('Failed to delete comment')
    }
  }

  // Delete task
  const handleDeleteTask = async () => {
    if (!confirm(`Delete task "${task.title}"?`)) return
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')

      toast.success('Task deleted')
      onOpenChange(false)
      onTaskDeleted?.()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const completedChecklists = task.checklists.filter((c: any) => c.checked).length
  const totalChecklists = task.checklists.length
  const checklistPercent =
    totalChecklists > 0 ? Math.round((completedChecklists / totalChecklists) * 100) : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] p-0 overflow-hidden flex flex-col max-h-[85vh]">
        {/* HEADER BAR */}
        <div className="p-4 border-b border-border bg-card shrink-0 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {task.project && (
                <Badge variant="outline" className="text-xs gap-1">
                  <span>{task.project.icon || '📁'}</span>
                  <span>{task.project.name}</span>
                </Badge>
              )}

              {/* Status Selector */}
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value)
                  handleSaveField({ status: e.target.value })
                }}
                className="h-7 text-xs rounded-md border border-input bg-background px-2 font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="BACKLOG">Backlog</option>
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="REVIEW">Review</option>
                <option value="COMPLETED">Completed</option>
              </select>

              {/* Priority Selector */}
              <select
                value={priority}
                onChange={(e) => {
                  setPriority(e.target.value)
                  handleSaveField({ priority: e.target.value })
                }}
                className="h-7 text-xs rounded-md border border-input bg-background px-2 font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent ⚡</option>
              </select>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteTask}
              className="h-7 text-xs text-muted-foreground hover:text-destructive gap-1"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete</span>
            </Button>
          </div>

          {/* Editable Title */}
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title.trim() && title !== task.title) {
                handleSaveField({ title: title.trim() })
              }
            }}
            className="text-base font-bold tracking-tight border-transparent hover:border-border focus:border-indigo-500 px-1 h-9"
          />
        </div>

        {/* SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Metadata Row: Due Date & Assignees */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-border text-xs">
            {/* Due date */}
            <div className="space-y-1">
              <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Due Date
              </span>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value)
                  handleSaveField({
                    dueDate: e.target.value ? new Date(e.target.value).toISOString() : null,
                  })
                }}
                className="h-8 text-xs w-44"
              />
            </div>

            {/* Assignees */}
            <div className="space-y-1">
              <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Assignees ({task.assignees.length})
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {task.assignees.map((a: any) => (
                  <div
                    key={a.userId}
                    className="flex items-center gap-1.5 bg-muted rounded-full pl-1 pr-2 py-0.5 text-[11px]"
                  >
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={a.user.image || ''} alt={a.user.name} />
                      <AvatarFallback className="text-[9px]">
                        {getInitials(a.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{a.user.name.split(' ')[0]}</span>
                    <button
                      type="button"
                      onClick={() => handleUnassignUser(a.userId)}
                      className="text-muted-foreground hover:text-destructive ml-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}

                <div className="relative">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAssignDropdown(!showAssignDropdown)}
                    className="h-6 text-[10px] px-2 rounded-full gap-1"
                  >
                    <Plus className="h-3 w-3" /> Assign
                  </Button>

                  {showAssignDropdown && (
                    <div className="absolute top-7 left-0 z-50 bg-card border border-border rounded-lg shadow-lg p-1 w-44 divide-y divide-border">
                      {workspaceMembers.map((m: any) => {
                        const isAssigned = task.assignees.some((a: any) => a.userId === m.userId)
                        if (isAssigned) return null
                        return (
                          <button
                            key={m.userId}
                            type="button"
                            onClick={() => handleAssignUser(m.userId)}
                            className="w-full text-left p-1.5 text-xs hover:bg-muted rounded flex items-center gap-2"
                          >
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={m.user.image || ''} alt={m.user.name} />
                              <AvatarFallback className="text-[9px]">
                                {getInitials(m.user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate">{m.user.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => {
                if (description !== (task.description || '')) {
                  handleSaveField({ description: description.trim() || null })
                }
              }}
              placeholder="Add description..."
              rows={3}
              className="text-xs"
            />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" /> Tags
            </Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {task.tags.map((t: any) => (
                <Badge
                  key={t.id}
                  variant="secondary"
                  className="text-[11px] gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                >
                  #{t.name}
                  <button
                    type="button"
                    onClick={() => handleDeleteTag(t.id)}
                    className="hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}

              <Input
                placeholder="+ Add tag..."
                value={newTagText}
                onChange={(e) => setNewTagText(e.target.value)}
                onKeyDown={handleAddTag}
                className="h-6 text-[11px] w-28 px-2"
              />
            </div>
          </div>

          {/* Checklists */}
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <CheckSquare className="h-3.5 w-3.5 text-indigo-600" />
                Checklist ({completedChecklists}/{totalChecklists})
              </Label>
              {totalChecklists > 0 && (
                <span className="text-[11px] text-muted-foreground">{checklistPercent}%</span>
              )}
            </div>

            {totalChecklists > 0 && (
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-indigo-600 h-1.5 transition-all duration-300"
                  style={{ width: `${checklistPercent}%` }}
                />
              </div>
            )}

            <div className="space-y-1.5">
              {task.checklists.map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 p-1.5 px-2 rounded-md hover:bg-muted/40 transition-colors text-xs"
                >
                  <label className="flex items-center gap-2 cursor-pointer min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => handleToggleChecklist(item.id, item.checked)}
                      className="rounded border-border text-indigo-600 focus:ring-indigo-500"
                    />
                    <span
                      className={`truncate ${
                        item.checked ? 'line-through text-muted-foreground' : 'text-foreground'
                      }`}
                    >
                      {item.content}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleDeleteChecklist(item.id)}
                    className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}

              {/* Add checklist input */}
              <form onSubmit={handleAddChecklist} className="flex gap-2 mt-1">
                <Input
                  placeholder="Add an item..."
                  value={newChecklistText}
                  onChange={(e) => setNewChecklistText(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={addingChecklist || !newChecklistText.trim()}
                  className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
                >
                  Add
                </Button>
              </form>
            </div>
          </div>

          {/* Attachments Section */}
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5 text-indigo-600" />
                Attachments ({(task.attachments || []).length})
              </Label>
              <div>
                <input
                  ref={fileAttachmentRef}
                  type="file"
                  onChange={handleUploadAttachment}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingAttachment}
                  onClick={() => fileAttachmentRef.current?.click()}
                  className="h-6 text-[10px] gap-1 px-2"
                >
                  {uploadingAttachment ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                  Add File
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              {(task.attachments || []).length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic">No attachments</p>
              ) : (
                task.attachments.map((att: any) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate font-medium text-foreground">{att.name}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        ({formatBytes(att.size)})
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <a
                        href={`/api/files/${att.id}/download`}
                        download={att.name}
                        className="p-1 rounded text-muted-foreground hover:text-indigo-600"
                        title="Download"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDeleteAttachment(att.id)}
                        className="p-1 rounded text-muted-foreground hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Comments Section */}
          <div className="space-y-3 pt-2 border-t border-border">
            <Label className="text-xs font-semibold text-foreground">
              Comments ({task.comments.length})
            </Label>

            {/* Comments list */}
            <div className="space-y-2.5 max-h-44 overflow-y-auto pr-1">
              {task.comments.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No comments yet</p>
              ) : (
                task.comments.map((comment: any) => {
                  const isAuthor = comment.authorId === currentUserId
                  return (
                    <div key={comment.id} className="flex gap-2.5 text-xs">
                      <Avatar className="h-6 w-6 mt-0.5">
                        <AvatarImage src={comment.author.image || ''} alt={comment.author.name} />
                        <AvatarFallback className="text-[9px]">
                          {getInitials(comment.author.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 bg-muted/50 rounded-lg p-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-foreground text-[11px]">
                            {comment.author.name}
                          </span>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span>{formatRelativeTime(comment.createdAt)}</span>
                            {isAuthor && (
                              <button
                                type="button"
                                onClick={() => handleDeleteComment(comment.id)}
                                className="hover:text-destructive"
                                title="Delete comment"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-foreground whitespace-pre-wrap break-words text-xs">
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Comment Composer */}
            <form onSubmit={handleAddComment} className="flex gap-2">
              <Input
                placeholder="Write a comment..."
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                className="h-8 text-xs"
              />
              <Button
                type="submit"
                size="sm"
                disabled={postingComment || !newCommentText.trim()}
                className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
              >
                {postingComment ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </Button>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
