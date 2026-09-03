'use client'

import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getInitials, formatDate } from '@/lib/utils'
import { CheckCircle2, Circle, Clock, CheckSquare } from 'lucide-react'

interface TaskListViewProps {
  tasks: any[]
  onSelectTask: (taskId: string) => void
  onToggleComplete?: (task: any) => void
}

function getPriorityBadge(priority: string) {
  switch (priority) {
    case 'URGENT':
      return <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 text-[10px] font-bold">Urgent ⚡</Badge>
    case 'HIGH':
      return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 text-[10px]">High</Badge>
    case 'MEDIUM':
      return <Badge className="bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 text-[10px]">Medium</Badge>
    case 'LOW':
    default:
      return <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[10px]">Low</Badge>
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'COMPLETED':
      return <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Completed</span>
    case 'IN_PROGRESS':
      return <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">In Progress</span>
    case 'REVIEW':
      return <span className="text-[11px] font-semibold text-violet-600 dark:text-violet-400">Review</span>
    case 'BACKLOG':
      return <span className="text-[11px] font-semibold text-muted-foreground">Backlog</span>
    case 'TODO':
    default:
      return <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">To Do</span>
  }
}

export function TaskListView({ tasks, onSelectTask, onToggleComplete }: TaskListViewProps) {
  if (tasks.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground text-xs">
        No tasks found in this view.
      </div>
    )
  }

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
              <th className="py-2.5 px-4 w-8"></th>
              <th className="py-2.5 px-3 min-w-[200px]">Task</th>
              <th className="py-2.5 px-3 w-32">Assignee</th>
              <th className="py-2.5 px-3 w-28">Priority</th>
              <th className="py-2.5 px-3 w-28">Status</th>
              <th className="py-2.5 px-4 w-32 text-right">Due Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tasks.map((task) => {
              const isCompleted = task.status === 'COMPLETED'
              const checklists = task.checklists || []
              const completedChecklists = checklists.filter((c: any) => c.checked).length

              return (
                <tr
                  key={task.id}
                  onClick={() => onSelectTask(task.id)}
                  className="hover:bg-muted/30 transition-colors cursor-pointer group"
                >
                  {/* Status Checkbox */}
                  <td
                    className="py-3 px-4"
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleComplete?.(task)
                    }}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 hover:text-muted-foreground" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground hover:text-emerald-500" />
                    )}
                  </td>

                  {/* Title & Tags & Checklists */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`font-medium ${
                          isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'
                        }`}
                      >
                        {task.title}
                      </span>

                      {task.tags &&
                        task.tags.map((tag: any) => (
                          <span
                            key={tag.id}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                          >
                            #{tag.name}
                          </span>
                        ))}

                      {checklists.length > 0 && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <CheckSquare className="h-3 w-3" />
                          {completedChecklists}/{checklists.length}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Assignees */}
                  <td className="py-3 px-3">
                    <div className="flex items-center -space-x-1.5 overflow-hidden">
                      {task.assignees && task.assignees.length > 0 ? (
                        task.assignees.map((a: any) => (
                          <Avatar
                            key={a.userId}
                            className="h-6 w-6 border-2 border-background"
                            title={a.user.name}
                          >
                            <AvatarImage src={a.user.image || ''} alt={a.user.name} />
                            <AvatarFallback className="text-[9px]">
                              {getInitials(a.user.name)}
                            </AvatarFallback>
                          </Avatar>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-[11px]">—</span>
                      )}
                    </div>
                  </td>

                  {/* Priority */}
                  <td className="py-3 px-3">{getPriorityBadge(task.priority)}</td>

                  {/* Status */}
                  <td className="py-3 px-3">{getStatusBadge(task.status)}</td>

                  {/* Due Date */}
                  <td className="py-3 px-4 text-right">
                    {task.dueDate ? (
                      <span className="text-[11px] text-muted-foreground flex items-center justify-end gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(task.dueDate)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-[11px]">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
