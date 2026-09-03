'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { TaskListView } from '@/components/tasks/task-list-view'
import { TaskKanbanView } from '@/components/tasks/task-kanban-view'
import { CreateTaskModal } from '@/components/tasks/create-task-modal'
import { TaskDetailModal } from '@/components/tasks/task-detail-modal'
import { EditProjectModal } from '@/components/projects/edit-project-modal'
import { CreateDocModal } from '@/components/docs/create-doc-modal'
import { UploadFileModal } from '@/components/files/upload-file-modal'
import { ActivityFeed } from '@/components/activity/activity-feed'
import { getInitials, formatDate, formatRelativeTime, formatBytes } from '@/lib/utils'
import { toast } from 'sonner'
import {
  FolderKanban,
  CheckSquare,
  ListFilter,
  LayoutGrid,
  List,
  Plus,
  Settings,
  Users,
  Clock,
  Search,
  ArrowLeft,
  Loader2,
  Trash2,
  Activity,
  CheckCircle2,
  FileText,
  Paperclip,
  Download,
} from 'lucide-react'

interface ProjectDetailClientProps {
  projectId: string
  currentUserId: string
}

export function ProjectDetailClient({ projectId, currentUserId }: ProjectDetailClientProps) {
  const router = useRouter()
  const [project, setProject] = useState<any | null>(null)
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Filters & views
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban')
  const [taskSearch, setTaskSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL')

  // Project docs and files
  const [projectDocs, setProjectDocs] = useState<any[]>([])
  const [projectFiles, setProjectFiles] = useState<any[]>([])

  // Modals
  const [createTaskOpen, setCreateTaskOpen] = useState(false)
  const [createTaskInitialStatus, setCreateTaskInitialStatus] = useState<string>('TODO')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [editProjectOpen, setEditProjectOpen] = useState(false)
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [createDocOpen, setCreateDocOpen] = useState(false)
  const [uploadFileOpen, setUploadFileOpen] = useState(false)

  // Workspace members for adding to project
  const [workspaceMembers, setWorkspaceMembers] = useState<any[]>([])
  const [selectedMemberToAdd, setSelectedMemberToAdd] = useState('')

  const fetchProjectData = useCallback(async () => {
    try {
      const [projRes, tasksRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/projects/${projectId}/tasks`),
      ])

      const projData = await projRes.json()
      const tasksData = await tasksRes.json()

      if (projRes.ok && projData.project) {
        setProject(projData.project)

        const wsId = projData.project.workspaceId

        // Fetch workspace members to allow adding them
        if (wsId) {
          fetch(`/api/workspaces/${wsId}/members`)
            .then((r) => r.json())
            .then((m) => {
              if (m.members) setWorkspaceMembers(m.members)
            })
            .catch(() => {})

          // Fetch project documents
          fetch(`/api/documents?workspaceId=${wsId}&projectId=${projectId}`)
            .then((r) => r.json())
            .then((d) => {
              if (d.documents) setProjectDocs(d.documents)
            })
            .catch(() => {})

          // Fetch project files
          fetch(`/api/files?workspaceId=${wsId}&projectId=${projectId}`)
            .then((r) => r.json())
            .then((f) => {
              if (f.files) setProjectFiles(f.files)
            })
            .catch(() => {})
        }
      }

      if (tasksRes.ok && tasksData.tasks) {
        setTasks(tasksData.tasks)
      }
    } catch {
      toast.error('Failed to load project details')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchProjectData()
  }, [fetchProjectData])

  // Add member to project
  const handleAddMember = async () => {
    if (!selectedMemberToAdd) return
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: [selectedMemberToAdd] }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to add member')
      }
      toast.success('Member added to project!')
      setSelectedMemberToAdd('')
      setAddMemberOpen(false)
      fetchProjectData()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  // Remove member from project
  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Remove member from project?')) return
    try {
      const res = await fetch(`/api/projects/${projectId}/members/${userId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to remove member')
      }
      toast.success('Member removed')
      fetchProjectData()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

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
        fetchProjectData()
      }
    } catch {
      toast.error('Failed to update task')
    }
  }

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(taskSearch.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(taskSearch.toLowerCase()))
    const matchesPriority = priorityFilter === 'ALL' || t.priority === priorityFilter
    return matchesSearch && matchesPriority
  })

  if (loading) {
    return (
      <div className="py-24 text-center text-muted-foreground text-xs flex items-center justify-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading project...
      </div>
    )
  }

  if (!project) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-bold text-foreground">Project not found</h2>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/projects">Back to Projects</Link>
        </Button>
      </div>
    )
  }

  const stats = project.stats || { total: 0, COMPLETED: 0, progress: 0 }
  const isCreator = project.creatorId === currentUserId

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* TOP NAVIGATION & HEADER */}
      <div className="space-y-3">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Projects
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-5 rounded-2xl border border-border">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900 flex items-center justify-center text-2xl shrink-0">
              {project.icon || '📁'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-foreground">{project.name}</h1>
                <Badge variant="secondary" className="text-[10px]">
                  {project.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {project.description || 'No description provided'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditProjectOpen(true)}
              className="text-xs h-8 gap-1.5"
            >
              <Settings className="h-3.5 w-3.5" /> Settings
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setCreateTaskInitialStatus('TODO')
                setCreateTaskOpen(true)
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> New Task
            </Button>
          </div>
        </div>
      </div>

      {/* TABS: Tasks, Overview, Members, Activity */}
      <Tabs defaultValue="tasks" className="space-y-4">
        <TabsList className="bg-muted/60 p-1">
          <TabsTrigger value="tasks" className="text-xs gap-1.5">
            <CheckSquare className="h-3.5 w-3.5" /> Tasks ({tasks.length})
          </TabsTrigger>
          <TabsTrigger value="overview" className="text-xs gap-1.5">
            <FolderKanban className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="members" className="text-xs gap-1.5">
            <Users className="h-3.5 w-3.5" /> Members ({project.members?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="docs" className="text-xs gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Docs ({projectDocs.length})
          </TabsTrigger>
          <TabsTrigger value="files" className="text-xs gap-1.5">
            <Paperclip className="h-3.5 w-3.5" /> Files ({projectFiles.length})
          </TabsTrigger>
          <TabsTrigger value="activity" className="text-xs gap-1.5">
            <Activity className="h-3.5 w-3.5" /> Activity
          </TabsTrigger>
        </TabsList>

        {/* 1. TASKS TAB */}
        <TabsContent value="tasks" className="space-y-4">
          {/* Controls: Search, Priority filter, View toggle */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                  className="pl-8 text-xs h-8"
                />
              </div>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="h-8 text-xs rounded-md border border-input bg-background px-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">All Priorities</option>
                <option value="URGENT">Urgent ⚡</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>

            {/* View Mode Toggle: List vs Kanban */}
            <div className="flex items-center border border-border rounded-lg p-0.5 bg-muted/40 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  viewMode === 'list'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="List View"
              >
                <List className="h-3.5 w-3.5" />
                <span>List</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  viewMode === 'kanban'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Kanban View"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Kanban</span>
              </button>
            </div>
          </div>

          {/* VIEW CONTENT */}
          {viewMode === 'list' ? (
            <TaskListView
              tasks={filteredTasks}
              onSelectTask={(id) => setSelectedTaskId(id)}
              onToggleComplete={handleToggleComplete}
            />
          ) : (
            <TaskKanbanView
              tasks={filteredTasks}
              onSelectTask={(id) => setSelectedTaskId(id)}
              onAddTaskToColumn={(statusCol) => {
                setCreateTaskInitialStatus(statusCol)
                setCreateTaskOpen(true)
              }}
              onTaskStatusChanged={fetchProjectData}
            />
          )}
        </TabsContent>

        {/* 2. OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-card p-4 rounded-xl border border-border">
              <span className="text-xs text-muted-foreground">Completion Rate</span>
              <p className="text-2xl font-bold text-foreground mt-1">{stats.progress}%</p>
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden mt-2">
                <div
                  className="bg-indigo-600 h-1.5 rounded-full"
                  style={{ width: `${stats.progress}%` }}
                />
              </div>
            </div>

            <div className="bg-card p-4 rounded-xl border border-border">
              <span className="text-xs text-muted-foreground">Total Tasks</span>
              <p className="text-2xl font-bold text-foreground mt-1">{stats.total || 0}</p>
              <span className="text-[11px] text-emerald-600">
                {stats.COMPLETED || 0} completed
              </span>
            </div>

            <div className="bg-card p-4 rounded-xl border border-border">
              <span className="text-xs text-muted-foreground">Due Date</span>
              <p className="text-lg font-bold text-foreground mt-1">
                {project.dueDate ? formatDate(project.dueDate) : 'No deadline'}
              </p>
              <span className="text-[11px] text-muted-foreground">
                Created {formatDate(project.createdAt)}
              </span>
            </div>
          </div>

          <div className="bg-card p-5 rounded-xl border border-border space-y-3">
            <h3 className="text-sm font-semibold text-foreground">About Project</h3>
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {project.description || 'No detailed description provided for this project.'}
            </p>
          </div>
        </TabsContent>

        {/* 3. MEMBERS TAB */}
        <TabsContent value="members" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Project Members</h3>
              <p className="text-xs text-muted-foreground">
                Workspace collaborators who have access to this project
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedMemberToAdd}
                onChange={(e) => setSelectedMemberToAdd(e.target.value)}
                className="h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Select workspace member...</option>
                {workspaceMembers
                  .filter((wm) => !project.members?.some((pm: any) => pm.userId === wm.userId))
                  .map((wm) => (
                    <option key={wm.userId} value={wm.userId}>
                      {wm.user.name} (@{wm.user.username})
                    </option>
                  ))}
              </select>
              <Button
                size="sm"
                onClick={handleAddMember}
                disabled={!selectedMemberToAdd}
                className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Add Member
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {project.members?.map((m: any) => (
              <div
                key={m.id}
                className="bg-card p-3 rounded-xl border border-border flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={m.user.image || ''} alt={m.user.name} />
                    <AvatarFallback className="text-xs">
                      {getInitials(m.user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{m.user.name}</p>
                    <p className="text-[10px] text-muted-foreground">@{m.user.username}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-[10px]">
                    {m.role}
                  </Badge>
                  {m.userId !== project.creatorId && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(m.userId)}
                      className="text-muted-foreground hover:text-destructive p-1 rounded"
                      title="Remove member"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* DOCS TAB */}
        <TabsContent value="docs">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Documents associated with this project.
              </p>
              <Button
                size="sm"
                onClick={() => setCreateDocOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> New Document
              </Button>
            </div>

            {projectDocs.length === 0 ? (
              <div className="p-10 text-center border border-dashed border-border rounded-xl bg-card">
                <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-xs font-semibold text-foreground">No documents yet</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 mb-3">
                  Create notes, specs, or meeting notes for this project.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCreateDocOpen(true)}
                  className="text-xs h-7"
                >
                  Create Document
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {projectDocs.map((doc) => (
                  <Link key={doc.id} href={`/docs/${doc.id}`}>
                    <div className="bg-card p-4 rounded-xl border border-border hover:border-emerald-500 transition-all cursor-pointer group">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4 text-emerald-600" />
                        <h4 className="font-semibold text-xs text-foreground truncate group-hover:text-emerald-600 transition-colors">
                          {doc.title}
                        </h4>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Updated {formatRelativeTime(doc.updatedAt)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* FILES TAB */}
        <TabsContent value="files">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Files and assets uploaded to this project.
              </p>
              <Button
                size="sm"
                onClick={() => setUploadFileOpen(true)}
                className="bg-pink-600 hover:bg-pink-700 text-white text-xs h-8 gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Upload File
              </Button>
            </div>

            {projectFiles.length === 0 ? (
              <div className="p-10 text-center border border-dashed border-border rounded-xl bg-card">
                <Paperclip className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-xs font-semibold text-foreground">No files yet</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 mb-3">
                  Upload design assets, documents, or presentations.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setUploadFileOpen(true)}
                  className="text-xs h-7"
                >
                  Upload File
                </Button>
              </div>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden bg-card divide-y divide-border">
                {projectFiles.map((file) => (
                  <div
                    key={file.id}
                    className="p-3 px-4 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Paperclip className="h-4 w-4 text-pink-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{file.name}</p>
                        <span className="text-[10px] text-muted-foreground">
                          {formatBytes(file.size)} · {formatRelativeTime(file.createdAt)}
                        </span>
                      </div>
                    </div>

                    <a
                      href={`/api/files/${file.id}/download`}
                      download={file.name}
                      className="p-1.5 rounded text-muted-foreground hover:text-indigo-600 hover:bg-muted transition-colors shrink-0"
                      title="Download file"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* 4. ACTIVITY TAB */}
        <TabsContent value="activity">
          <div className="bg-card p-5 rounded-xl border border-border space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Project Activity</h3>
            <ActivityFeed projectId={project.id} showHeader={false} />
          </div>
        </TabsContent>
      </Tabs>

      {/* CREATE TASK MODAL */}
      <CreateTaskModal
        open={createTaskOpen}
        onOpenChange={setCreateTaskOpen}
        projectId={projectId}
        onTaskCreated={() => {
          fetchProjectData()
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
        onTaskUpdated={fetchProjectData}
        onTaskDeleted={() => {
          setSelectedTaskId(null)
          fetchProjectData()
        }}
      />

      {/* EDIT PROJECT MODAL */}
      <EditProjectModal
        open={editProjectOpen}
        onOpenChange={setEditProjectOpen}
        project={project}
        onProjectUpdated={fetchProjectData}
        onProjectDeleted={() => {
          router.push('/projects')
        }}
      />

      {/* CREATE DOC MODAL */}
      <CreateDocModal
        open={createDocOpen}
        onOpenChange={setCreateDocOpen}
        projectId={projectId}
        onDocumentCreated={() => {
          fetchProjectData()
        }}
      />

      {/* UPLOAD FILE MODAL */}
      <UploadFileModal
        open={uploadFileOpen}
        onOpenChange={setUploadFileOpen}
        projectId={projectId}
        onFileUploaded={() => {
          fetchProjectData()
        }}
      />
    </div>
  )
}
