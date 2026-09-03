'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useSocket } from '@/lib/socket-client'
import { useWorkspaceStore } from '@/store/workspace-store'
import { getInitials, formatRelativeTime } from '@/lib/utils'
import {
  Inbox,
  CheckCheck,
  CheckSquare,
  MessageSquare,
  FileText,
  Paperclip,
  Calendar,
  Users,
  FolderKanban,
  Loader2,
  Filter,
} from 'lucide-react'
import { toast } from 'sonner'

function getNotificationIcon(type: string) {
  switch (type) {
    case 'TASK_ASSIGNED':
    case 'TASK_COMPLETED':
    case 'TASK_DUE':
    case 'TASK_STATUS_CHANGED':
    case 'TASK_COMMENT':
      return <CheckSquare className="h-4 w-4 text-indigo-600" />
    case 'MESSAGE':
    case 'MENTION':
      return <MessageSquare className="h-4 w-4 text-blue-600" />
    case 'DOCUMENT_SHARED':
    case 'DOCUMENT_UPDATED':
      return <FileText className="h-4 w-4 text-emerald-600" />
    case 'FILE_SHARED':
      return <Paperclip className="h-4 w-4 text-pink-600" />
    case 'EVENT_INVITE':
    case 'EVENT_UPDATED':
      return <Calendar className="h-4 w-4 text-amber-600" />
    case 'PROJECT_MEMBER_ADDED':
      return <FolderKanban className="h-4 w-4 text-indigo-600" />
    default:
      return <Users className="h-4 w-4 text-slate-500" />
  }
}

export function InboxClient() {
  const currentWorkspace = useWorkspaceStore((s) => s.getCurrentWorkspace())
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'tasks' | 'messages' | 'docs'>('all')
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const socket = useSocket()

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (currentWorkspace?.id) params.set('workspaceId', currentWorkspace.id)
      if (activeFilter === 'unread') params.set('unread', 'true')

      const res = await fetch(`/api/notifications?${params.toString()}`)
      const data = await res.json()
      if (res.ok) {
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount || 0)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [currentWorkspace?.id, activeFilter])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // Real-time listener
  useEffect(() => {
    if (!socket) return

    const handleNewNotification = (notif: any) => {
      setNotifications((prev) => [notif, ...prev])
      setUnreadCount((prev) => prev + 1)
    }

    const handleReadNotification = ({ id }: { id: string }) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    }

    const handleReadAll = () => {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
    }

    socket.on('notification:new', handleNewNotification)
    socket.on('notification:read', handleReadNotification)
    socket.on('notification:read-all', handleReadAll)

    return () => {
      socket.off('notification:new', handleNewNotification)
      socket.off('notification:read', handleReadNotification)
      socket.off('notification:read-all', handleReadAll)
    }
  }, [socket])

  const handleNotificationClick = async (notif: any) => {
    if (!notif.read) {
      fetch(`/api/notifications/${notif.id}/read`, { method: 'POST' }).catch(() => {})
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    }

    if (notif.link) {
      router.push(notif.link)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: currentWorkspace?.id }),
      })
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
      toast.success('All marked as read')
    } catch {
      toast.error('Failed to mark all as read')
    }
  }

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'unread') return !n.read
    if (activeFilter === 'tasks')
      return (
        n.type === 'TASK_ASSIGNED' ||
        n.type === 'TASK_COMPLETED' ||
        n.type === 'TASK_DUE' ||
        n.type === 'TASK_STATUS_CHANGED' ||
        n.type === 'TASK_COMMENT'
      )
    if (activeFilter === 'messages') return n.type === 'MESSAGE' || n.type === 'MENTION'
    if (activeFilter === 'docs')
      return n.type === 'DOCUMENT_SHARED' || n.type === 'DOCUMENT_UPDATED'
    return true
  })

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground">Inbox</h1>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs px-2 py-0.5 font-semibold">
                {unreadCount} unread
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Notifications and updates for your account
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleMarkAllRead}
            className="text-xs h-8 gap-1.5 self-start sm:self-auto"
          >
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </Button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 border-b border-border pb-2 overflow-x-auto">
        {[
          { key: 'all', label: 'All' },
          { key: 'unread', label: 'Unread' },
          { key: 'tasks', label: 'Tasks' },
          { key: 'messages', label: 'Messages' },
          { key: 'docs', label: 'Documents' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveFilter(tab.key as any)}
            className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
              activeFilter === tab.key
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" /> Loading notifications...
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="py-16 text-center text-xs text-muted-foreground space-y-2">
            <Inbox className="h-8 w-8 text-muted-foreground/30 mx-auto" />
            <p className="font-medium text-foreground">All caught up!</p>
            <p>No notifications match your current filter</p>
          </div>
        ) : (
          filteredNotifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              className={`p-4 flex items-start gap-4 hover:bg-muted/30 cursor-pointer transition-colors ${
                !notif.read ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
              }`}
            >
              <div className="relative shrink-0 mt-0.5">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={notif.actor?.image || ''} alt={notif.actor?.name || 'User'} />
                  <AvatarFallback className="text-xs">
                    {getInitials(notif.actor?.name || 'FS')}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-background border border-border">
                  {getNotificationIcon(notif.type)}
                </div>
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-xs text-foreground truncate ${!notif.read ? 'font-bold' : 'font-medium'}`}>
                    {notif.title}
                  </p>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatRelativeTime(notif.createdAt)}
                  </span>
                </div>
                {notif.body && (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {notif.body}
                  </p>
                )}
                {notif.workspace && (
                  <div className="pt-0.5">
                    <span className="text-[10px] text-muted-foreground/80 bg-muted px-1.5 py-0.5 rounded">
                      {notif.workspace.name}
                    </span>
                  </div>
                )}
              </div>

              {!notif.read && (
                <div className="shrink-0 self-center">
                  <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block" />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
