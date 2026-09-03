'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  CheckSquare,
  FolderKanban,
  FileText,
  MessageSquare,
  Upload,
  CalendarPlus,
  Calendar,
  Building2,
  Clock,
  ArrowRight,
  Loader2,
  AlertCircle,
  Users,
  Bell,
  CheckCircle2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { CreateTaskModal } from '@/components/tasks/create-task-modal'
import { CreateProjectModal } from '@/components/projects/create-project-modal'
import { CreateDocModal } from '@/components/docs/create-doc-modal'
import { UploadFileModal } from '@/components/files/upload-file-modal'
import { CreateEventModal } from '@/components/calendar/create-event-modal'
import { TaskDetailModal } from '@/components/tasks/task-detail-modal'
import { EventDetailModal } from '@/components/calendar/event-detail-modal'
import { ActivityFeed } from '@/components/activity/activity-feed'
import { useWorkspaceStore } from '@/store/workspace-store'
import { getInitials, formatRelativeTime, formatDate } from '@/lib/utils'

interface Workspace {
  id: string
  name: string
  icon: string | null
  slug: string
  role: string
}

interface DashboardClientProps {
  user: {
    id: string
    name: string
    email: string
    image: string | null
  }
  workspaces: Workspace[]
}

function getGreeting(name: string): string {
  const hour = new Date().getHours()
  const firstName = name.split(' ')[0]
  if (hour < 12) return `Good morning, ${firstName} 👋`
  if (hour < 17) return `Good afternoon, ${firstName} 👋`
  return `Good evening, ${firstName} 👋`
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'URGENT':
      return 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200'
    case 'HIGH':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200'
    case 'MEDIUM':
      return 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200'
    default:
      return 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200'
  }
}

export function DashboardClient({ user, workspaces }: DashboardClientProps) {
  const currentWorkspace = useWorkspaceStore((s) => s.getCurrentWorkspace())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Creation modals state
  const [createTaskOpen, setCreateTaskOpen] = useState(false)
  const [createProjectOpen, setCreateProjectOpen] = useState(false)
  const [createDocOpen, setCreateDocOpen] = useState(false)
  const [uploadFileOpen, setUploadFileOpen] = useState(false)
  const [createEventOpen, setCreateEventOpen] = useState(false)

  // Detail modals state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null)

  // Fetch aggregated dashboard data
  const fetchDashboardData = useCallback(async () => {
    if (!currentWorkspace?.id) return
    try {
      setLoading(true)
      const res = await fetch(`/api/dashboard?workspaceId=${currentWorkspace.id}`)
      const json = await res.json()
      if (res.ok) {
        setData(json)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [currentWorkspace?.id])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  const quickActions = [
    {
      label: 'New Task',
      icon: CheckSquare,
      onClick: () => setCreateTaskOpen(true),
      color: 'text-indigo-600',
      bg: 'bg-indigo-50 dark:bg-indigo-950/50',
    },
    {
      label: 'New Project',
      icon: FolderKanban,
      onClick: () => setCreateProjectOpen(true),
      color: 'text-blue-600',
      bg: 'bg-blue-50 dark:bg-blue-950/50',
    },
    {
      label: 'New Doc',
      icon: FileText,
      onClick: () => setCreateDocOpen(true),
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-950/50',
    },
    {
      label: 'Upload File',
      icon: Upload,
      onClick: () => setUploadFileOpen(true),
      color: 'text-pink-600',
      bg: 'bg-pink-50 dark:bg-pink-950/50',
    },
    {
      label: 'New Event',
      icon: CalendarPlus,
      onClick: () => setCreateEventOpen(true),
      color: 'text-amber-600',
      bg: 'bg-amber-50 dark:bg-amber-950/50',
    },
  ]

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* 1. TOP HEADER & GREETING */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">
            {getGreeting(user.name)}
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
            {currentWorkspace ? (
              <>
                Here&apos;s what&apos;s happening in{' '}
                <strong className="text-foreground">{currentWorkspace.name}</strong>.
              </>
            ) : (
              "Here's what's happening in your workspace."
            )}
          </p>
        </div>

        {/* Workspace indicator pill */}
        {currentWorkspace && (
          <div className="flex items-center gap-2 self-start sm:self-auto bg-muted/60 border border-border px-3 py-1.5 rounded-xl text-xs">
            <span className="text-base">{currentWorkspace.icon || '💼'}</span>
            <span className="font-semibold text-foreground">{currentWorkspace.name}</span>
            <Badge variant="outline" className="text-[10px] h-4 px-1 uppercase font-semibold">
              {currentWorkspace.role}
            </Badge>
          </div>
        )}
      </div>

      {/* 2. QUICK ACTIONS BAR */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
        {quickActions.map((action) => {
          const Icon = action.icon
          return (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border bg-card hover:bg-muted/60 transition-all text-left group shadow-xs cursor-pointer"
            >
              <div className={`p-2 rounded-lg ${action.bg} ${action.color} shrink-0`}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {action.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* 3. OVERVIEW CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              My Tasks
            </p>
            <p className="text-2xl font-bold text-foreground mt-0.5">
              {loading ? '-' : data?.stats?.myTasks ?? 0}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600">
            <CheckSquare className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Projects
            </p>
            <p className="text-2xl font-bold text-foreground mt-0.5">
              {loading ? '-' : data?.stats?.projects ?? 0}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600">
            <FolderKanban className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Upcoming
            </p>
            <p className="text-2xl font-bold text-foreground mt-0.5">
              {loading ? '-' : data?.stats?.upcoming ?? 0}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600">
            <Calendar className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Unread
            </p>
            <p className="text-2xl font-bold text-foreground mt-0.5">
              {loading ? '-' : data?.stats?.unread ?? 0}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600">
            <Bell className="h-5 w-5" />
          </div>
        </Card>
      </div>

      {/* 4. MAIN CONTENT GRID (2 COLUMNS ON DESKTOP) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT 2-COLUMNS: My Tasks + Activity Feed */}
        <div className="lg:col-span-2 space-y-6">
          {/* MY TASKS SECTION */}
          <Card className="shadow-xs">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-foreground">My Tasks</CardTitle>
                <CardDescription className="text-xs">
                  Active tasks assigned to you across projects
                </CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm" className="h-7 text-xs text-indigo-600">
                <Link href="/tasks">View all</Link>
              </Button>
            </CardHeader>

            <CardContent className="p-4 pt-2">
              {loading ? (
                <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-600" /> Loading tasks...
                </div>
              ) : !data?.tasks ||
                (data.tasks.overdue.length === 0 &&
                  data.tasks.today.length === 0 &&
                  data.tasks.upcoming.length === 0 &&
                  data.tasks.noDueDate.length === 0) ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  <CheckCircle2 className="h-7 w-7 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="font-medium text-foreground">You&apos;re all caught up!</p>
                  <p>No active tasks assigned to you right now.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCreateTaskOpen(true)}
                    className="mt-3 text-xs h-7 gap-1"
                  >
                    Create a task
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 divide-y divide-border/60">
                  {/* Overdue */}
                  {data.tasks.overdue.length > 0 && (
                    <div className="pt-2">
                      <p className="text-[11px] font-bold text-rose-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" /> Overdue
                      </p>
                      <div className="space-y-1.5">
                        {data.tasks.overdue.map((task: any) => (
                          <div
                            key={task.id}
                            onClick={() => setSelectedTaskId(task.id)}
                            className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card hover:bg-muted/40 transition-colors cursor-pointer text-xs"
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <p className="font-semibold text-foreground truncate">{task.title}</p>
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                                {task.project && <span>{task.project.name}</span>}
                                {task.dueDate && (
                                  <span className="text-rose-600 font-medium">
                                    Due {formatDate(task.dueDate)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Badge
                              variant="outline"
                              className={`text-[10px] uppercase ${getPriorityColor(task.priority)}`}
                            >
                              {task.priority}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Due Today */}
                  {data.tasks.today.length > 0 && (
                    <div className="pt-2">
                      <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> Due Today
                      </p>
                      <div className="space-y-1.5">
                        {data.tasks.today.map((task: any) => (
                          <div
                            key={task.id}
                            onClick={() => setSelectedTaskId(task.id)}
                            className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card hover:bg-muted/40 transition-colors cursor-pointer text-xs"
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <p className="font-semibold text-foreground truncate">{task.title}</p>
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                                {task.project && <span>{task.project.name}</span>}
                                <span className="text-indigo-600 font-medium">Today</span>
                              </div>
                            </div>
                            <Badge
                              variant="outline"
                              className={`text-[10px] uppercase ${getPriorityColor(task.priority)}`}
                            >
                              {task.priority}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upcoming / No Due Date */}
                  {(data.tasks.upcoming.length > 0 || data.tasks.noDueDate.length > 0) && (
                    <div className="pt-2">
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                        Upcoming Tasks
                      </p>
                      <div className="space-y-1.5">
                        {[...data.tasks.upcoming, ...data.tasks.noDueDate]
                          .slice(0, 5)
                          .map((task: any) => (
                            <div
                              key={task.id}
                              onClick={() => setSelectedTaskId(task.id)}
                              className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card hover:bg-muted/40 transition-colors cursor-pointer text-xs"
                            >
                              <div className="min-w-0 flex-1 pr-2">
                                <p className="font-semibold text-foreground truncate">{task.title}</p>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                                  {task.project && <span>{task.project.name}</span>}
                                  {task.dueDate && <span>Due {formatDate(task.dueDate)}</span>}
                                </div>
                              </div>
                              <Badge
                                variant="outline"
                                className={`text-[10px] uppercase ${getPriorityColor(task.priority)}`}
                              >
                                {task.priority}
                              </Badge>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* RECENT ACTIVITY SECTION */}
          <Card className="shadow-xs">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold text-foreground">Recent Activity</CardTitle>
              <CardDescription className="text-xs">
                Real-time workspace activity and updates
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <ActivityFeed limit={8} showHeader={false} />
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Upcoming Schedule + Recent Conversations */}
        <div className="space-y-6">
          {/* UPCOMING SCHEDULE (Events & Deadlines) */}
          <Card className="shadow-xs">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-foreground">
                  Upcoming Schedule
                </CardTitle>
                <CardDescription className="text-xs">Next 7 days</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm" className="h-7 text-xs text-indigo-600">
                <Link href="/calendar">Calendar</Link>
              </Button>
            </CardHeader>

            <CardContent className="p-4 pt-2">
              {loading ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-600 mx-auto" />
                </div>
              ) : !data?.upcomingSchedule || data.upcomingSchedule.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  <Calendar className="h-6 w-6 text-muted-foreground/30 mx-auto mb-1.5" />
                  <p>No upcoming events or deadlines</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {data.upcomingSchedule.map((item: any) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (item.isEvent) setSelectedEvent(item)
                        else setSelectedTaskId(item.id)
                      }}
                      className="p-2.5 rounded-lg border border-border hover:bg-muted/40 cursor-pointer transition-colors text-xs flex items-start gap-2.5"
                    >
                      <div className="p-1 rounded-md bg-muted shrink-0 mt-0.5">
                        {item.isEvent ? (
                          <Calendar className="h-3.5 w-3.5 text-amber-600" />
                        ) : (
                          <CheckSquare className="h-3.5 w-3.5 text-indigo-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{item.title}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatDate(item.date)}
                          {item.location ? ` • ${item.location}` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* RECENT CONVERSATIONS */}
          <Card className="shadow-xs">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-foreground">
                  Conversations
                </CardTitle>
                <CardDescription className="text-xs">Direct messages & groups</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm" className="h-7 text-xs text-indigo-600">
                <Link href="/chat">Chat</Link>
              </Button>
            </CardHeader>

            <CardContent className="p-4 pt-2">
              {loading ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-600 mx-auto" />
                </div>
              ) : !data?.recentConversations || data.recentConversations.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  <MessageSquare className="h-6 w-6 text-muted-foreground/30 mx-auto mb-1.5" />
                  <p>No conversations yet</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {data.recentConversations.map((conv: any) => (
                    <Link key={conv.id} href={`/chat?c=${conv.id}`}>
                      <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40 transition-colors cursor-pointer border border-transparent hover:border-border">
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarImage src={conv.image || ''} alt={conv.name} />
                          <AvatarFallback className="text-[10px]">
                            {getInitials(conv.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-foreground truncate">
                              {conv.name}
                            </p>
                            {conv.unreadCount > 0 && (
                              <span className="h-3.5 min-w-[14px] px-1 rounded-full bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center">
                                {conv.unreadCount}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {conv.lastMessage}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CREATION MODALS */}
      <CreateTaskModal open={createTaskOpen} onOpenChange={setCreateTaskOpen} />
      <CreateProjectModal open={createProjectOpen} onOpenChange={setCreateProjectOpen} />
      <CreateDocModal open={createDocOpen} onOpenChange={setCreateDocOpen} />
      <UploadFileModal open={uploadFileOpen} onOpenChange={setUploadFileOpen} />
      <CreateEventModal open={createEventOpen} onOpenChange={setCreateEventOpen} />

      {/* DETAIL INSPECTION MODALS */}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          currentUserId={user.id}
          open={!!selectedTaskId}
          onOpenChange={(isOpen) => {
            if (!isOpen) setSelectedTaskId(null)
          }}
          onTaskUpdated={fetchDashboardData}
          onTaskDeleted={fetchDashboardData}
        />
      )}

      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          currentUserId={user.id}
          open={!!selectedEvent}
          onOpenChange={(isOpen) => {
            if (!isOpen) setSelectedEvent(null)
          }}
          onEventDeleted={fetchDashboardData}
        />
      )}
    </div>
  )
}
