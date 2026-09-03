'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useWorkspaceStore } from '@/store/workspace-store'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface CreateEventModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialDate?: Date
  onEventCreated?: (event: any) => void
}

export function CreateEventModal({
  open,
  onOpenChange,
  initialDate,
  onEventCreated,
}: CreateEventModalProps) {
  const currentWorkspace = useWorkspaceStore((s) => s.getCurrentWorkspace())
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('10:00')
  const [endDate, setEndDate] = useState('')
  const [endTime, setEndTime] = useState('11:00')
  const [allDay, setAllDay] = useState(false)
  const [reminder, setReminder] = useState('15_MIN')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [projects, setProjects] = useState<any[]>([])
  const [workspaceMembers, setWorkspaceMembers] = useState<any[]>([])
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (initialDate) {
      const d = initialDate.toISOString().slice(0, 10)
      setStartDate(d)
      setEndDate(d)
    } else {
      const today = new Date().toISOString().slice(0, 10)
      setStartDate(today)
      setEndDate(today)
    }
  }, [initialDate, open])

  useEffect(() => {
    if (!open || !currentWorkspace?.id) return

    fetch(`/api/workspaces/${currentWorkspace.id}/projects`)
      .then((r) => r.json())
      .then((data) => {
        if (data.projects) setProjects(data.projects)
      })
      .catch(() => {})

    fetch(`/api/workspaces/${currentWorkspace.id}/members`)
      .then((r) => r.json())
      .then((data) => {
        if (data.members) setWorkspaceMembers(data.members)
      })
      .catch(() => {})
  }, [open, currentWorkspace?.id])

  const toggleAttendee = (userId: string) => {
    setSelectedAttendees((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('Event title is required')
      return
    }

    if (!currentWorkspace?.id) {
      toast.error('No workspace selected')
      return
    }

    setLoading(true)
    try {
      const startDateTime = allDay
        ? new Date(`${startDate}T00:00:00Z`).toISOString()
        : new Date(`${startDate}T${startTime}:00`).toISOString()

      const endDateTime = allDay
        ? new Date(`${endDate || startDate}T23:59:59Z`).toISOString()
        : new Date(`${endDate || startDate}T${endTime}:00`).toISOString()

      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: currentWorkspace.id,
          projectId: selectedProjectId || undefined,
          title: title.trim(),
          description: description.trim() || undefined,
          location: location.trim() || undefined,
          startAt: startDateTime,
          endAt: endDateTime,
          allDay,
          reminder: reminder || undefined,
          attendeeIds: selectedAttendees,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create event')

      toast.success('Event created!')
      setTitle('')
      setDescription('')
      setLocation('')
      setSelectedAttendees([])
      onOpenChange(false)
      onEventCreated?.(data.event)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleCreate}>
          <DialogHeader>
            <DialogTitle>New Event</DialogTitle>
            <DialogDescription>
              Schedule a meeting, presentation, deadline, or team event.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-1">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="event-title">Event Title *</Label>
              <Input
                id="event-title"
                placeholder="e.g. Sprint Planning, Project Demo, Sync"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                required
              />
            </div>

            {/* Date & Time */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Date & Time</Label>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allDay}
                    onChange={(e) => setAllDay(e.target.checked)}
                    className="rounded border-border text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>All day event</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-muted-foreground">Starts</span>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-8 text-xs"
                    required
                  />
                  {!allDay && (
                    <Input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="h-8 text-xs mt-1"
                    />
                  )}
                </div>

                <div>
                  <span className="text-[10px] text-muted-foreground">Ends</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-8 text-xs"
                    required
                  />
                  {!allDay && (
                    <Input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="h-8 text-xs mt-1"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <Label htmlFor="event-loc">Location / Link</Label>
              <Input
                id="event-loc"
                placeholder="e.g. Google Meet, Room 302, Discord"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={200}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="event-desc">Description</Label>
              <Textarea
                id="event-desc"
                placeholder="Event agenda or details..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
                rows={2}
              />
            </div>

            {/* Attendees Multi-Select */}
            {workspaceMembers.length > 0 && (
              <div className="space-y-1.5">
                <Label>Invite Attendees</Label>
                <div className="border border-border rounded-lg divide-y divide-border max-h-32 overflow-y-auto">
                  {workspaceMembers.map((m) => (
                    <label
                      key={m.userId}
                      className="flex items-center justify-between p-2 px-3 hover:bg-muted/40 cursor-pointer text-xs"
                    >
                      <span className="font-medium text-foreground">{m.user.name}</span>
                      <input
                        type="checkbox"
                        checked={selectedAttendees.includes(m.userId)}
                        onChange={() => toggleAttendee(m.userId)}
                        className="rounded border-border text-indigo-600 focus:ring-indigo-500"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !title.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Event
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
