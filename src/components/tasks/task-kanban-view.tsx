'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getInitials, formatDate } from '@/lib/utils'
import {
  Clock,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Plus,
  MessageSquare,
} from 'lucide-react'
import { toast } from 'sonner'

interface TaskKanbanViewProps {
  tasks: any[]
  onSelectTask: (taskId: string) => void
  onAddTaskToColumn?: (status: string) => void
  onTaskStatusChanged?: () => void
}

const COLUMNS: { id: string; label: string; color: string }[] = [
  { id: 'BACKLOG', label: 'Backlog', color: 'border-slate-400 dark:border-slate-600' },
  { id: 'TODO', label: 'To Do', color: 'border-amber-500' },
  { id: 'IN_PROGRESS', label: 'In Progress', color: 'border-indigo-500' },
  { id: 'REVIEW', label: 'Review', color: 'border-violet-500' },
  { id: 'COMPLETED', label: 'Completed', color: 'border-emerald-500' },
]

export function TaskKanbanView({
  tasks,
  onSelectTask,
  onAddTaskToColumn,
  onTaskStatusChanged,
}: TaskKanbanViewProps) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)

  const moveTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Status update failed')
      onTaskStatusChanged?.()
    } catch {
      toast.error('Failed to move task')
    }
  }

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId)
    setDraggedTaskId(taskId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId
    if (taskId) {
      moveTaskStatus(taskId, targetStatus)
    }
    setDraggedTaskId(null)
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 pt-1 items-start min-h-[500px]">
      {COLUMNS.map((col, idx) => {
        const columnTasks = tasks.filter((t) => t.status === col.id)

        return (
          <div
            key={col.id}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.id)}
            className="w-72 shrink-0 bg-muted/40 rounded-xl border border-border flex flex-col max-h-[calc(100vh-14rem)]"
          >
            {/* Column Header */}
            <div className={`p-3 border-t-4 ${col.color} border-b border-border/60 flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-foreground tracking-tight">
                  {col.label}
                </span>
                <span className="text-[10px] bg-background border border-border px-1.5 py-0.5 rounded-full font-bold text-muted-foreground">
                  {columnTasks.length}
                </span>
              </div>

              {onAddTaskToColumn && (
                <button
                  type="button"
                  onClick={() => onAddTaskToColumn(col.id)}
                  className="h-6 w-6 rounded-md hover:bg-background/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  title={`Add task to ${col.label}`}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Column Task Cards */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 min-h-[120px]">
              {columnTasks.length === 0 ? (
                <div className="py-8 text-center text-[11px] text-muted-foreground/60 italic">
                  Drop tasks here
                </div>
              ) : (
                columnTasks.map((task) => {
                  const checklists = task.checklists || []
                  const completedChecklists = checklists.filter((c: any) => c.checked).length
                  const commentCount = task._count?.comments || 0

                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onClick={() => onSelectTask(task.id)}
                      className="bg-card p-3 rounded-lg border border-border/80 shadow-xs hover:border-indigo-500 hover:shadow-sm transition-all cursor-pointer group"
                    >
                      {/* Tags & Priority */}
                      <div className="flex items-center justify-between gap-1.5 mb-1.5">
                        <div className="flex flex-wrap gap-1">
                          {task.tags &&
                            task.tags.map((t: any) => (
                              <span
                                key={t.id}
                                className="text-[9px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-medium"
                              >
                                #{t.name}
                              </span>
                            ))}
                        </div>

                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                            task.priority === 'URGENT'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                              : task.priority === 'HIGH'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                              : task.priority === 'MEDIUM'
                              ? 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {task.priority}
                        </span>
                      </div>

                      {/* Title */}
                      <h4 className="text-xs font-semibold text-foreground line-clamp-2 mb-2 leading-snug">
                        {task.title}
                      </h4>

                      {/* Footer Row: Assignees, Checklists, Comments, Due Date */}
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                        <div className="flex items-center gap-2">
                          {/* Assignees */}
                          <div className="flex items-center -space-x-1.5">
                            {task.assignees && task.assignees.length > 0 ? (
                              task.assignees.map((a: any) => (
                                <Avatar
                                  key={a.userId}
                                  className="h-5 w-5 border border-background"
                                  title={a.user.name}
                                >
                                  <AvatarImage src={a.user.image || ''} alt={a.user.name} />
                                  <AvatarFallback className="text-[8px]">
                                    {getInitials(a.user.name)}
                                  </AvatarFallback>
                                </Avatar>
                              ))
                            ) : null}
                          </div>

                          {/* Checklists progress */}
                          {checklists.length > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px]">
                              <CheckSquare className="h-3 w-3" />
                              {completedChecklists}/{checklists.length}
                            </span>
                          )}

                          {/* Comments count */}
                          {commentCount > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px]">
                              <MessageSquare className="h-3 w-3" />
                              {commentCount}
                            </span>
                          )}
                        </div>

                        {/* Due date */}
                        {task.dueDate && (
                          <span className="flex items-center gap-1 text-[10px]">
                            <Clock className="h-2.5 w-2.5" />
                            {formatDate(task.dueDate)}
                          </span>
                        )}
                      </div>

                      {/* Quick Move Buttons (accessible fallback for drag and drop) */}
                      <div className="mt-2 pt-1 border-t border-dashed border-border/40 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                        {idx > 0 ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              moveTaskStatus(task.id, COLUMNS[idx - 1].id)
                            }}
                            className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                          >
                            <ChevronLeft className="h-3 w-3" /> {COLUMNS[idx - 1].label}
                          </button>
                        ) : <span />}

                        {idx < COLUMNS.length - 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              moveTaskStatus(task.id, COLUMNS[idx + 1].id)
                            }}
                            className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                          >
                            {COLUMNS[idx + 1].label} <ChevronRight className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
