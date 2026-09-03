'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { useWorkspaceStore } from '@/store/workspace-store'
import {
  Search,
  CheckSquare,
  FolderKanban,
  FileText,
  Paperclip,
  Calendar,
  MessageSquare,
  Users,
  Plus,
  Home,
  Settings,
  Loader2,
  ArrowRight,
} from 'lucide-react'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenCreateTask?: () => void
  onOpenCreateProject?: () => void
  onOpenCreateDoc?: () => void
  onOpenUploadFile?: () => void
  onOpenCreateEvent?: () => void
}

export function CommandPalette({
  open,
  onOpenChange,
  onOpenCreateTask,
  onOpenCreateProject,
  onOpenCreateDoc,
  onOpenUploadFile,
  onOpenCreateEvent,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any>({
    projects: [],
    tasks: [],
    documents: [],
    files: [],
    events: [],
    members: [],
    messages: [],
  })
  const currentWorkspace = useWorkspaceStore((s) => s.getCurrentWorkspace())
  const router = useRouter()
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  // Global keydown handler for Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onOpenChange])

  // Debounced search
  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults({
        projects: [],
        tasks: [],
        documents: [],
        files: [],
        events: [],
        members: [],
        messages: [],
      })
      return
    }

    if (!query.trim() || !currentWorkspace?.id) {
      setLoading(false)
      setResults({
        projects: [],
        tasks: [],
        documents: [],
        files: [],
        events: [],
        members: [],
        messages: [],
      })
      return
    }

    setLoading(true)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)

    debounceTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?workspaceId=${currentWorkspace.id}&q=${encodeURIComponent(query.trim())}`
        )
        const data = await res.json()
        if (res.ok) {
          setResults(data.results || {})
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [query, open, currentWorkspace?.id])

  const navigateTo = (url: string) => {
    onOpenChange(false)
    router.push(url)
  }

  const triggerAction = (action?: () => void) => {
    onOpenChange(false)
    if (action) action()
  }

  const hasResults =
    results.projects?.length > 0 ||
    results.tasks?.length > 0 ||
    results.documents?.length > 0 ||
    results.files?.length > 0 ||
    results.events?.length > 0 ||
    results.members?.length > 0 ||
    results.messages?.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-2xl bg-card border border-border shadow-2xl rounded-2xl overflow-hidden gap-0">
        <DialogTitle className="sr-only">Search and Command Palette</DialogTitle>

        {/* Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border bg-background">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search anything (tasks, docs, files, people)..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            autoFocus
          />
          {loading && <Loader2 className="h-4 w-4 text-indigo-600 animate-spin shrink-0" />}
          <kbd className="hidden sm:inline-block text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded border border-border font-mono">
            ESC
          </kbd>
        </div>

        {/* Results / Commands Scroll Container */}
        <div className="max-h-[420px] overflow-y-auto p-2 divide-y divide-border/60">
          {query.trim().length > 0 ? (
            /* Search Results */
            <div>
              {loading ? (
                <div className="py-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-600" /> Searching workspace...
                </div>
              ) : !hasResults ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  No results found for &ldquo;{query}&rdquo;
                </div>
              ) : (
                <div className="space-y-4 p-1">
                  {/* Tasks */}
                  {results.tasks?.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wider">
                        Tasks
                      </h4>
                      {results.tasks.map((task: any) => (
                        <div
                          key={task.id}
                          onClick={() =>
                            navigateTo(
                              task.project?.id
                                ? `/projects/${task.project.id}?task=${task.id}`
                                : `/tasks`
                            )
                          }
                          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-muted cursor-pointer text-xs group"
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <CheckSquare className="h-4 w-4 text-indigo-600 shrink-0" />
                            <span className="font-medium text-foreground truncate">{task.title}</span>
                            {task.project && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                                {task.project.name}
                              </span>
                            )}
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Projects */}
                  {results.projects?.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wider">
                        Projects
                      </h4>
                      {results.projects.map((proj: any) => (
                        <div
                          key={proj.id}
                          onClick={() => navigateTo(`/projects/${proj.id}`)}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-muted cursor-pointer text-xs group"
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <span className="text-sm shrink-0">{proj.icon || '📁'}</span>
                            <span className="font-medium text-foreground truncate">{proj.name}</span>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Documents */}
                  {results.documents?.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wider">
                        Documents
                      </h4>
                      {results.documents.map((doc: any) => (
                        <div
                          key={doc.id}
                          onClick={() => navigateTo(`/docs/${doc.id}`)}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-muted cursor-pointer text-xs group"
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <FileText className="h-4 w-4 text-emerald-600 shrink-0" />
                            <span className="font-medium text-foreground truncate">{doc.title}</span>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Files */}
                  {results.files?.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wider">
                        Files
                      </h4>
                      {results.files.map((file: any) => (
                        <div
                          key={file.id}
                          onClick={() => navigateTo(`/files`)}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-muted cursor-pointer text-xs group"
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <Paperclip className="h-4 w-4 text-pink-600 shrink-0" />
                            <span className="font-medium text-foreground truncate">{file.name}</span>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Events */}
                  {results.events?.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wider">
                        Calendar Events
                      </h4>
                      {results.events.map((ev: any) => (
                        <div
                          key={ev.id}
                          onClick={() => navigateTo(`/calendar?event=${ev.id}`)}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-muted cursor-pointer text-xs group"
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <Calendar className="h-4 w-4 text-amber-600 shrink-0" />
                            <span className="font-medium text-foreground truncate">{ev.title}</span>
                            {ev.location && (
                              <span className="text-[10px] text-muted-foreground truncate">
                                • {ev.location}
                              </span>
                            )}
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* People */}
                  {results.members?.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wider">
                        People
                      </h4>
                      {results.members.map((m: any) => (
                        <div
                          key={m.id}
                          onClick={() => navigateTo(`/members`)}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-muted cursor-pointer text-xs group"
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <Users className="h-4 w-4 text-sky-600 shrink-0" />
                            <span className="font-medium text-foreground truncate">{m.user?.name}</span>
                            <span className="text-[10px] text-muted-foreground truncate">
                              @{m.user?.username}
                            </span>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Commands Palette Defaults */
            <div className="space-y-3 p-1">
              {/* Navigation */}
              <div>
                <h4 className="text-[11px] font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wider">
                  Navigation
                </h4>
                <div className="grid grid-cols-1 gap-0.5">
                  {[
                    { label: 'Go Home', icon: Home, url: '/' },
                    { label: 'Go Chat', icon: MessageSquare, url: '/chat' },
                    { label: 'Go Projects', icon: FolderKanban, url: '/projects' },
                    { label: 'Go Tasks', icon: CheckSquare, url: '/tasks' },
                    { label: 'Go Docs', icon: FileText, url: '/docs' },
                    { label: 'Go Files', icon: Paperclip, url: '/files' },
                    { label: 'Go Calendar', icon: Calendar, url: '/calendar' },
                    { label: 'Go Members', icon: Users, url: '/members' },
                  ].map((item) => (
                    <div
                      key={item.url}
                      onClick={() => navigateTo(item.url)}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-muted cursor-pointer text-xs text-foreground group"
                    >
                      <div className="flex items-center gap-2.5">
                        <item.icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                        <span>{item.label}</span>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div>
                <h4 className="text-[11px] font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wider">
                  Quick Actions
                </h4>
                <div className="grid grid-cols-1 gap-0.5">
                  {[
                    { label: 'New Task', icon: Plus, action: onOpenCreateTask },
                    { label: 'New Project', icon: Plus, action: onOpenCreateProject },
                    { label: 'New Document', icon: Plus, action: onOpenCreateDoc },
                    { label: 'Upload File', icon: Plus, action: onOpenUploadFile },
                    { label: 'New Event', icon: Plus, action: onOpenCreateEvent },
                  ].map((item) => (
                    <div
                      key={item.label}
                      onClick={() => triggerAction(item.action)}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-muted cursor-pointer text-xs text-foreground group"
                    >
                      <div className="flex items-center gap-2.5">
                        <item.icon className="h-4 w-4 text-indigo-600" />
                        <span>{item.label}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">Action</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
