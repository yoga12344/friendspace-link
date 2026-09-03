'use client'

import { useState, useEffect, useCallback } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useSocket } from '@/lib/socket-client'
import { useWorkspaceStore } from '@/store/workspace-store'
import { getInitials, formatRelativeTime } from '@/lib/utils'
import {
  CheckSquare,
  FolderKanban,
  FileText,
  Paperclip,
  Calendar,
  MessageSquare,
  Users,
  Activity as ActivityIcon,
  Loader2,
} from 'lucide-react'

interface ActivityFeedProps {
  projectId?: string
  limit?: number
  showHeader?: boolean
}

function getActivityIcon(type: string, entityType: string) {
  switch (entityType) {
    case 'task':
      return <CheckSquare className="h-4 w-4 text-indigo-600" />
    case 'project':
      return <FolderKanban className="h-4 w-4 text-indigo-600" />
    case 'document':
      return <FileText className="h-4 w-4 text-emerald-600" />
    case 'file':
      return <Paperclip className="h-4 w-4 text-pink-600" />
    case 'event':
      return <Calendar className="h-4 w-4 text-amber-600" />
    case 'member':
      return <Users className="h-4 w-4 text-sky-600" />
    default:
      return <ActivityIcon className="h-4 w-4 text-muted-foreground" />
  }
}

function formatActivityAction(activity: any) {
  const actorName = activity.actor?.name || 'Someone'
  const entityName = activity.entityName || 'an item'

  switch (activity.type) {
    case 'TASK_CREATED':
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> created task{' '}
          <span className="font-medium text-foreground">&ldquo;{entityName}&rdquo;</span>
        </span>
      )
    case 'TASK_COMPLETED':
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> completed task{' '}
          <span className="font-medium text-foreground">&ldquo;{entityName}&rdquo;</span>
        </span>
      )
    case 'TASK_STATUS_CHANGED':
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> moved task{' '}
          <span className="font-medium text-foreground">&ldquo;{entityName}&rdquo;</span> to{' '}
          <Badge variant="outline" className="text-[10px] px-1 py-0 uppercase">
            {activity.metadata?.toStatus || 'updated'}
          </Badge>
        </span>
      )
    case 'TASK_ASSIGNED':
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> assigned task{' '}
          <span className="font-medium text-foreground">&ldquo;{entityName}&rdquo;</span>
        </span>
      )
    case 'TASK_COMMENT':
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> commented on{' '}
          <span className="font-medium text-foreground">&ldquo;{entityName}&rdquo;</span>
        </span>
      )
    case 'PROJECT_CREATED':
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> created project{' '}
          <span className="font-medium text-foreground">&ldquo;{entityName}&rdquo;</span>
        </span>
      )
    case 'DOCUMENT_CREATED':
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> created document{' '}
          <span className="font-medium text-foreground">&ldquo;{entityName}&rdquo;</span>
        </span>
      )
    case 'FILE_UPLOADED':
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> uploaded file{' '}
          <span className="font-medium text-foreground">&ldquo;{entityName}&rdquo;</span>
        </span>
      )
    case 'FILE_ATTACHED_TO_TASK':
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> attached file{' '}
          <span className="font-medium text-foreground">&ldquo;{entityName}&rdquo;</span> to task
        </span>
      )
    case 'EVENT_CREATED':
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> scheduled event{' '}
          <span className="font-medium text-foreground">&ldquo;{entityName}&rdquo;</span>
        </span>
      )
    default:
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> updated{' '}
          <span className="font-medium text-foreground">&ldquo;{entityName}&rdquo;</span>
        </span>
      )
  }
}

export function ActivityFeed({ projectId, limit = 20, showHeader = true }: ActivityFeedProps) {
  const currentWorkspace = useWorkspaceStore((s) => s.getCurrentWorkspace())
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const socket = useSocket()

  const fetchActivities = useCallback(async () => {
    if (!currentWorkspace?.id) return
    try {
      setLoading(true)
      const params = new URLSearchParams({
        workspaceId: currentWorkspace.id,
        limit: limit.toString(),
      })
      if (projectId) params.set('projectId', projectId)

      const res = await fetch(`/api/activity?${params.toString()}`)
      const data = await res.json()
      if (res.ok) {
        setActivities(data.activities || [])
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [currentWorkspace?.id, projectId, limit])

  useEffect(() => {
    fetchActivities()
  }, [fetchActivities])

  // Real-time listener for workspace activity
  useEffect(() => {
    if (!socket || !currentWorkspace?.id) return

    // Join workspace room for real-time updates
    socket.emit('workspace.join', { workspaceId: currentWorkspace.id })

    const handleNewActivity = (activity: any) => {
      // If scoped to a project, ignore other project's activity
      if (projectId && activity.projectId !== projectId) {
        return
      }
      setActivities((prev) => [activity, ...prev.slice(0, limit - 1)])
    }

    socket.on('activity:new', handleNewActivity)

    return () => {
      socket.off('activity:new', handleNewActivity)
    }
  }, [socket, currentWorkspace?.id, projectId, limit])

  if (loading && activities.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-indigo-600" /> Loading activity feed...
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="py-10 text-center text-xs text-muted-foreground">
        <ActivityIcon className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
        <p>No recent activity</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {showHeader && (
        <div className="flex items-center justify-between pb-1 border-b border-border">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Recent Activity
          </h3>
        </div>
      )}

      <div className="divide-y divide-border/60">
        {activities.map((activity) => (
          <div key={activity.id} className="py-2.5 flex items-start gap-3 text-xs">
            <Avatar className="h-7 w-7 mt-0.5 shrink-0">
              <AvatarImage src={activity.actor?.image || ''} alt={activity.actor?.name || 'User'} />
              <AvatarFallback className="text-[9px]">
                {getInitials(activity.actor?.name || 'FS')}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="text-foreground leading-snug">
                {formatActivityAction(activity)}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>{formatRelativeTime(activity.createdAt)}</span>
                {activity.project && !projectId && (
                  <>
                    <span>•</span>
                    <span className="font-medium text-foreground truncate max-w-[120px]">
                      {activity.project.icon || '📁'} {activity.project.name}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="p-1 rounded-md bg-muted/60 shrink-0">
              {getActivityIcon(activity.type, activity.entityType)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
