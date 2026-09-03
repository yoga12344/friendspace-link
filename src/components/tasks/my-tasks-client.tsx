'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useWorkspaceStore } from '@/store/workspace-store'
import { CreateTaskModal } from '@/components/tasks/create-task-modal'
import { TaskDetailModal } from '@/components/tasks/task-detail-modal'
import { getInitials, formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import {
  CheckSquare,
  Plus,
  Search,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Calendar,
  CalendarCheck,
  Loader2,
  FolderKanban,
} from 'lucide-react'

interface MyTasksClientProps {
  currentUserId: string
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

export function MyTasksClient({ currentUserId }: MyTasksClientProps) {
  const currentWorkspace = useWorkspaceStore((s) => s.getCurrentWorkspace())
  const [categorized, setCategorized] = useState<{
    overdue: any[]
    today: any[]
    upcoming: any[]
    noDueDate: any[]
    completed: any[]
  }>({
    overdue: [],
    today: [],
    upcoming: [],
    noDueDate: [],
    completed: [],
  })
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL')

  // Modals
  const [createTaskOpen, setCreateTaskOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (currentWorkspace?.id) params.set('workspaceId', currentWorkspace.id)
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (priorityFilter !== 'ALL') params.set('priority', priorityFilter)

      const res = await fetch(`/api/tasks?${params.toString()}`)
      const data = await res.json()
      if (res.ok && data.categorized) {
        setCategorized(data.categorized)
        setTotalCount(data.tasks?.length || 0)
      }
    } catch {
      toast.error('Failed to load your tasks')
    } finally {
      setLoading(false)
    }
  }, [currentWorkspace?.id, statusFilter, priorityFilter])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  // Quick toggle task completed
  const handleToggleComplete = async (task: any) => {
    const newStatus = task.status === 'COMPLETED' ? 'TODO' : 'COMPLETED'
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        fetchTasks()
      }
    } catch {
      toast.error('Failed to update task')
    }
  }

  const filterTaskList = (list: any[]) => {
    return list.filter((t) => {
      const matchesSearch =
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        (t.description && t.description.toLowerCase().includes(search.toLowerCase()))
      return matchesSearch
    })
  }

  const renderTaskSection = (
    title: string,
    tasks: any[],
    icon: React.ReactNode,
    badgeColor: string,
    defaultExpanded = true
  ) => {
    const filtered = filterTaskList(tasks)
    if (filtered.length === 0) return null

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-foreground">
          {icon}
          <span>{title}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${badgeColor}`}>
            {filtered.length}
          </span>
        </div>

        <div className="border border-border rounded-xl overflow-hidden bg-card divide-y divide-border">
          {filtered.map((task) => {
            const isCompleted = task.status === 'COMPLETED'

            return (
              <div
                key={task.id}
                onClick={() => setSelectedTaskId(task.id)}
                className="flex items-center justify-between p-3 px-4 hover:bg-muted/30 transition-colors cursor-pointer group gap-3"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Complete checkbox */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleComplete(task)
                    }}
                    className="shrink-0"
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 hover:text-muted-foreground" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground hover:text-emerald-500" />
                    )}
                  </button>

                  <div className="min-w-0">
                    <p
                      className={`text-xs font-semibold truncate ${
                        isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'
                      }`}
                    >
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                      {task.project && (
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          {task.project.icon || '📁'} {task.project.name}
                        </span>
                      )}
                      {task.tags?.map((t: any) => (
                        <span key={t.id} className="text-muted-foreground">
                          #{t.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {getPriorityBadge(task.priority)}

                  {task.dueDate && (
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(task.dueDate)}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <CheckSquare className="h-6 w-6 text-indigo-600" />
            My Tasks
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tasks assigned to you across your projects ({totalCount} total)
          </p>
        </div>

        <Button
          onClick={() => setCreateTaskOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5 shrink-0"
        >
          <Plus className="h-4 w-4" /> New Task
        </Button>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs h-9"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 text-xs rounded-md border border-input bg-background px-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="REVIEW">Review</option>
            <option value="BACKLOG">Backlog</option>
            <option value="COMPLETED">Completed</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="h-9 text-xs rounded-md border border-input bg-background px-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Priorities</option>
            <option value="URGENT">Urgent ⚡</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      {/* SECTIONS */}
      {loading ? (
        <div className="py-20 text-center text-muted-foreground text-xs flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your tasks...
        </div>
      ) : totalCount === 0 ? (
        <div className="p-12 text-center border border-dashed border-border rounded-2xl bg-card">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 flex items-center justify-center mx-auto mb-3 text-2xl">
            <CheckSquare className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">No tasks assigned to you</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
            {search || statusFilter !== 'ALL' || priorityFilter !== 'ALL'
              ? 'Try changing your search query or filters.'
              : 'Tasks assigned to you in any project will appear here organized by deadline.'}
          </p>
          <Button
            size="sm"
            onClick={() => setCreateTaskOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Create Task
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overdue */}
          {renderTaskSection(
            'Overdue',
            categorized.overdue,
            <AlertCircle className="h-4 w-4 text-rose-500" />,
            'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
          )}

          {/* Today */}
          {renderTaskSection(
            'Due Today',
            categorized.today,
            <Calendar className="h-4 w-4 text-amber-500" />,
            'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
          )}

          {/* Upcoming */}
          {renderTaskSection(
            'Upcoming',
            categorized.upcoming,
            <CalendarCheck className="h-4 w-4 text-sky-500" />,
            'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
          )}

          {/* No Due Date */}
          {renderTaskSection(
            'No Due Date',
            categorized.noDueDate,
            <Clock className="h-4 w-4 text-muted-foreground" />,
            'bg-muted text-muted-foreground'
          )}

          {/* Completed */}
          {renderTaskSection(
            'Completed',
            categorized.completed,
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
            'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
          )}
        </div>
      )}

      {/* CREATE TASK MODAL */}
      <CreateTaskModal
        open={createTaskOpen}
        onOpenChange={setCreateTaskOpen}
        onTaskCreated={() => {
          fetchTasks()
        }}
      />

      {/* TASK DETAIL MODAL */}
      <TaskDetailModal
        open={!!selectedTaskId}
        onOpenChange={(open) => {
          if (!open) setSelectedTaskId(null)
        }}
        taskId={selectedTaskId}
        currentUserId={currentUserId}
        onTaskUpdated={fetchTasks}
        onTaskDeleted={() => {
          setSelectedTaskId(null)
          fetchTasks()
        }}
      />
    </div>
  )
}
