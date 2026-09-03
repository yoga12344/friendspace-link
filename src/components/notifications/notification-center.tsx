'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useSocket } from '@/lib/socket-client'
import { useWorkspaceStore } from '@/store/workspace-store'
import { getInitials, formatRelativeTime } from '@/lib/utils'
import {
  Bell,
  CheckCheck,
  CheckSquare,
  MessageSquare,
  FileText,
  Paperclip,
  Calendar,
  Users,
  FolderKanban,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

function getNotificationIcon(type: string) {
  switch (type) {
    case 'TASK_ASSIGNED':
    case 'TASK_COMPLETED':
    case 'TASK_DUE':
    case 'TASK_STATUS_CHANGED':
    case 'TASK_COMMENT':
      return <CheckSquare className="h-3.5 w-3.5 text-indigo-600" />
    case 'MESSAGE':
    case 'MENTION':
      return <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
    case 'DOCUMENT_SHARED':
    case 'DOCUMENT_UPDATED':
      return <FileText className="h-3.5 w-3.5 text-emerald-600" />
    case 'FILE_SHARED':
      return <Paperclip className="h-3.5 w-3.5 text-pink-600" />
    case 'EVENT_INVITE':
    case 'EVENT_UPDATED':
      return <Calendar className="h-3.5 w-3.5 text-amber-600" />
    case 'PROJECT_MEMBER_ADDED':
      return <FolderKanban className="h-3.5 w-3.5 text-indigo-600" />
    default:
      return <Users className="h-3.5 w-3.5 text-slate-500" />
  }
}

export function NotificationCenter() {
  const currentWorkspace = useWorkspaceStore((s) => s.getCurrentWorkspace())
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [filterUnread, setFilterUnread] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const socket = useSocket()

  const fetchNotifications = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (currentWorkspace?.id) params.set('workspaceId', currentWorkspace.id)
      if (filterUnread) params.set('unread', 'true')

      const res = await fetch(`/api/notifications?${params.toString()}`)
      const data = await res.json()
      if (res.ok) {
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount || 0)
      }
    } catch {
      // ignore
    }
  }, [currentWorkspace?.id, filterUnread])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // Real-time listener for incoming notifications
  useEffect(() => {
    if (!socket) return

    const handleNewNotification = (notif: any) => {
      setNotifications((prev) => [notif, ...prev])
      setUnreadCount((prev) => prev + 1)
      toast.info(notif.title, {
        description: notif.body,
      })
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
      // Mark read
      fetch(`/api/notifications/${notif.id}/read`, { method: 'POST' }).catch(() => {})
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    }

    setOpen(false)
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 text-muted-foreground hover:text-foreground"
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-80 sm:w-96 p-0 shadow-lg border border-border bg-card rounded-xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-3 px-4 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-foreground">Notifications</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-semibold">
                {unreadCount} new
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterUnread(!filterUnread)}
              className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                filterUnread
                  ? 'bg-indigo-600 text-white font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Unread
            </button>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[10px] text-muted-foreground hover:text-indigo-600 flex items-center gap-1 transition-colors"
                title="Mark all as read"
              >
                <CheckCheck className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="max-h-[380px] overflow-y-auto divide-y divide-border">
          {notifications.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              <Bell className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
              <p>No notifications</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`p-3 px-4 flex items-start gap-3 hover:bg-muted/40 cursor-pointer transition-colors text-xs ${
                  !notif.read ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                }`}
              >
                <div className="relative shrink-0 mt-0.5">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={notif.actor?.image || ''} alt={notif.actor?.name || 'User'} />
                    <AvatarFallback className="text-[9px]">
                      {getInitials(notif.actor?.name || 'FS')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-background border border-border">
                    {getNotificationIcon(notif.type)}
                  </div>
                </div>

                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center justify-between gap-1">
                    <p className={`truncate text-foreground ${!notif.read ? 'font-bold' : 'font-medium'}`}>
                      {notif.title}
                    </p>
                    {!notif.read && (
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0" />
                    )}
                  </div>
                  {notif.body && (
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-snug">
                      {notif.body}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground pt-0.5">
                    {formatRelativeTime(notif.createdAt)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
