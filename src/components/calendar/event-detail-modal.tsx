'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getInitials, formatDate, formatRelativeTime } from '@/lib/utils'
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Trash2,
  Bell,
  CheckCircle2,
  FolderKanban,
} from 'lucide-react'
import { toast } from 'sonner'

interface EventDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  event: any | null
  currentUserId: string
  onEventDeleted?: () => void
}

export function EventDetailModal({
  open,
  onOpenChange,
  event,
  currentUserId,
  onEventDeleted,
}: EventDetailModalProps) {
  const [deleting, setDeleting] = useState(false)

  if (!event) return null

  const isCreator = event.creatorId === currentUserId

  const handleDelete = async () => {
    if (!confirm(`Delete event "${event.title}"?`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/events/${event.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete event')

      toast.success('Event deleted')
      onOpenChange(false)
      onEventDeleted?.()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setDeleting(false)
    }
  }

  const formatEventTime = (start: string, end: string, allDay: boolean) => {
    if (allDay) return 'All day'
    const s = new Date(start)
    const e = new Date(end)
    const timeStr = s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const endStr = e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return `${timeStr} - ${endStr}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle className="text-lg font-bold text-foreground">
              {event.title}
            </DialogTitle>
            {isCreator && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
                className="h-7 text-xs text-muted-foreground hover:text-destructive gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4 py-3 text-xs">
          {/* Time & Date */}
          <div className="flex items-start gap-2.5 text-muted-foreground">
            <Clock className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">{formatDate(event.startAt)}</p>
              <p className="text-[11px]">
                {formatEventTime(event.startAt, event.endAt, event.allDay)}
              </p>
            </div>
          </div>

          {/* Location */}
          {event.location && (
            <div className="flex items-center gap-2.5 text-muted-foreground">
              <MapPin className="h-4 w-4 text-rose-500 shrink-0" />
              <span className="font-medium text-foreground">{event.location}</span>
            </div>
          )}

          {/* Project */}
          {event.project && (
            <div className="flex items-center gap-2.5">
              <FolderKanban className="h-4 w-4 text-indigo-600 shrink-0" />
              <Badge variant="outline" className="text-xs gap-1">
                <span>{event.project.icon || '📁'}</span>
                <span>{event.project.name}</span>
              </Badge>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="p-3 bg-muted/40 rounded-lg text-foreground whitespace-pre-wrap leading-relaxed">
              {event.description}
            </div>
          )}

          {/* Attendees */}
          {event.attendees && event.attendees.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border">
              <span className="text-muted-foreground font-semibold flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Attendees ({event.attendees.length})
              </span>
              <div className="grid grid-cols-2 gap-2">
                {event.attendees.map((a: any) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-2 p-1.5 px-2 rounded-md bg-muted/30"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={a.user.image || ''} alt={a.user.name} />
                      <AvatarFallback className="text-[9px]">
                        {getInitials(a.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{a.user.name}</p>
                      <span className="text-[9px] text-muted-foreground capitalize">
                        {a.status.toLowerCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Creator info */}
          <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Organized by {event.creator?.name || 'Team member'}</span>
            <span>Created {formatRelativeTime(event.createdAt)}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
