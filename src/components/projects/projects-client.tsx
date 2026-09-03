'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useWorkspaceStore } from '@/store/workspace-store'
import { CreateProjectModal } from '@/components/projects/create-project-modal'
import { getInitials, formatDate } from '@/lib/utils'
import {
  FolderKanban,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Users,
  Loader2,
  Filter,
} from 'lucide-react'

interface ProjectsClientProps {
  currentUserId: string
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'PLANNING':
      return <Badge className="bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 text-[10px]">Planning</Badge>
    case 'ACTIVE':
      return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-[10px]">Active</Badge>
    case 'ON_HOLD':
      return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 text-[10px]">On Hold</Badge>
    case 'COMPLETED':
      return <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-[10px]">Completed</Badge>
    case 'ARCHIVED':
      return <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[10px]">Archived</Badge>
    default:
      return null
  }
}

export function ProjectsClient({ currentUserId }: ProjectsClientProps) {
  const currentWorkspace = useWorkspaceStore((s) => s.getCurrentWorkspace())
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [createModalOpen, setCreateModalOpen] = useState(false)

  const fetchProjects = useCallback(async () => {
    if (!currentWorkspace?.id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/workspaces/${currentWorkspace.id}/projects`)
      const data = await res.json()
      if (res.ok) {
        setProjects(data.projects || [])
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [currentWorkspace?.id])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase()))
    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <FolderKanban className="h-6 w-6 text-indigo-600" />
            Projects
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage projects, collaborate on tasks, and track team progress in{' '}
            <span className="font-semibold text-foreground">
              {currentWorkspace?.name || 'your workspace'}
            </span>
            .
          </p>
        </div>

        <Button
          onClick={() => setCreateModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5 shrink-0"
        >
          <Plus className="h-4 w-4" /> New Project
        </Button>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects by name or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs h-9"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {['ALL', 'ACTIVE', 'PLANNING', 'ON_HOLD', 'COMPLETED'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white'
                  : 'bg-muted/70 text-muted-foreground hover:text-foreground'
              }`}
            >
              {st === 'ALL' ? 'All Projects' : st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* PROJECTS GRID */}
      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-xs flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading projects...
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-border rounded-2xl bg-card">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 flex items-center justify-center mx-auto mb-3 text-2xl">
            📁
          </div>
          <h3 className="text-sm font-semibold text-foreground">No projects found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
            {search || statusFilter !== 'ALL'
              ? 'Try changing your search query or filter.'
              : 'Create your first project to start organizing tasks and collaborating with your team.'}
          </p>
          <Button
            size="sm"
            onClick={() => setCreateModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Create Project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((p) => {
            const stats = p.stats || { totalTasks: 0, completedTasks: 0, progress: 0 }

            return (
              <Link key={p.id} href={`/projects/${p.id}`}>
                <div className="bg-card p-5 rounded-xl border border-border hover:border-indigo-500 hover:shadow-md transition-all flex flex-col justify-between h-full group cursor-pointer">
                  <div>
                    {/* Header: Icon, Name & Status */}
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900 flex items-center justify-center text-xl shrink-0 group-hover:scale-105 transition-transform">
                          {p.icon || '📁'}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm text-foreground truncate group-hover:text-indigo-600 transition-colors">
                            {p.name}
                          </h3>
                          <p className="text-[11px] text-muted-foreground">
                            Created by {p.creator.name.split(' ')[0]}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0">{getStatusBadge(p.status)}</div>
                    </div>

                    {/* Description */}
                    {p.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
                        {p.description}
                      </p>
                    )}
                  </div>

                  {/* Footer stats & members */}
                  <div className="pt-3 border-t border-border space-y-3">
                    {/* Progress bar */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                        <span>Tasks ({stats.completedTasks}/{stats.totalTasks})</span>
                        <span className="font-bold text-foreground">{stats.progress}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-indigo-600 h-1.5 transition-all duration-300 rounded-full"
                          style={{ width: `${stats.progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Members & Due Date */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-0.5">
                      <div className="flex items-center -space-x-1.5 overflow-hidden">
                        {p.members && p.members.length > 0 ? (
                          p.members.slice(0, 4).map((m: any) => (
                            <Avatar
                              key={m.userId}
                              className="h-6 w-6 border-2 border-background"
                              title={m.user.name}
                            >
                              <AvatarImage src={m.user.image || ''} alt={m.user.name} />
                              <AvatarFallback className="text-[9px]">
                                {getInitials(m.user.name)}
                              </AvatarFallback>
                            </Avatar>
                          ))
                        ) : (
                          <span className="text-[11px] flex items-center gap-1">
                            <Users className="h-3 w-3" /> 1 member
                          </span>
                        )}
                        {p.members && p.members.length > 4 && (
                          <span className="h-6 w-6 rounded-full bg-muted text-muted-foreground text-[9px] font-bold flex items-center justify-center border-2 border-background">
                            +{p.members.length - 4}
                          </span>
                        )}
                      </div>

                      {p.dueDate && (
                        <div className="flex items-center gap-1 text-[11px]">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span>{formatDate(p.dueDate)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* CREATE PROJECT MODAL */}
      <CreateProjectModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onProjectCreated={() => {
          fetchProjects()
        }}
      />
    </div>
  )
}
