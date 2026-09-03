'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useWorkspaceStore } from '@/store/workspace-store'
import { CreateEventModal } from '@/components/calendar/create-event-modal'
import { EventDetailModal } from '@/components/calendar/event-detail-modal'
import { TaskDetailModal } from '@/components/tasks/task-detail-modal'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  CheckCircle2,
  CheckSquare,
  MapPin,
  Users,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

interface CalendarClientProps {
  currentUserId: string
}

type ViewMode = 'month' | 'week' | 'day'

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export function CalendarClient({ currentUserId }: CalendarClientProps) {
  const currentWorkspace = useWorkspaceStore((s) => s.getCurrentWorkspace())
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [events, setEvents] = useState<any[]>([])
  const [taskEvents, setTaskEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Modals
  const [createEventOpen, setCreateEventOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [selectedSlotDate, setSelectedSlotDate] = useState<Date | undefined>(undefined)

  const fetchCalendarData = useCallback(async () => {
    if (!currentWorkspace?.id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/events?workspaceId=${currentWorkspace.id}`)
      const data = await res.json()
      if (res.ok) {
        setEvents(data.events || [])
        setTaskEvents(data.taskEvents || [])
      }
    } catch {
      toast.error('Failed to load calendar events')
    } finally {
      setLoading(false)
    }
  }, [currentWorkspace?.id])

  useEffect(() => {
    fetchCalendarData()
  }, [fetchCalendarData])

  // Navigation handlers
  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    } else if (viewMode === 'week') {
      setCurrentDate(new Date(currentDate.getTime() - 7 * 86400000))
    } else {
      setCurrentDate(new Date(currentDate.getTime() - 86400000))
    }
  }

  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
    } else if (viewMode === 'week') {
      setCurrentDate(new Date(currentDate.getTime() + 7 * 86400000))
    } else {
      setCurrentDate(new Date(currentDate.getTime() + 86400000))
    }
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  // Month grid calculations
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Week view dates
  const currentDayOfWeek = currentDate.getDay()
  const startOfWeek = new Date(currentDate)
  startOfWeek.setDate(currentDate.getDate() - currentDayOfWeek)

  const weekDates: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek)
    d.setDate(startOfWeek.getDate() + i)
    weekDates.push(d)
  }

  // Helper to get events for a date string (YYYY-MM-DD)
  const getItemsForDate = (dateStr: string) => {
    const matchedEvents = events.filter((e) => e.startAt?.slice(0, 10) === dateStr)
    const matchedTasks = taskEvents.filter((t) => t.startAt?.slice(0, 10) === dateStr)
    return { events: matchedEvents, tasks: matchedTasks }
  }

  const isToday = (d: number, m: number, y: number) => {
    const today = new Date()
    return d === today.getDate() && m === today.getMonth() && y === today.getFullYear()
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-indigo-600" />
            Calendar
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Meetings, deadlines, and project milestones in{' '}
            <span className="font-semibold text-foreground">
              {currentWorkspace?.name || 'this workspace'}
            </span>
            .
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View mode switcher */}
          <div className="flex items-center border border-border rounded-lg p-0.5 bg-muted/40">
            {(['month', 'week', 'day'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                  viewMode === mode
                    ? 'bg-card text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          <Button
            onClick={() => {
              setSelectedSlotDate(new Date())
              setCreateEventOpen(true)
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5 shrink-0"
          >
            <Plus className="h-4 w-4" /> New Event
          </Button>
        </div>
      </div>

      {/* CALENDAR CONTROLS */}
      <div className="flex items-center justify-between bg-card p-3 px-4 rounded-xl border border-border">
        <div className="flex items-center gap-2">
          <h2 className="font-bold text-base text-foreground">
            {MONTH_NAMES[month]} {year}
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToday}
            className="h-7 text-xs px-2.5 ml-2"
          >
            Today
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrev}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNext}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center text-muted-foreground text-xs flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading calendar...
        </div>
      ) : (
        <>
          {/* 1. MONTH VIEW */}
          {viewMode === 'month' && (
            <div className="border border-border rounded-xl overflow-hidden bg-card shadow-xs">
              {/* Day headers */}
              <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-[11px] font-semibold text-muted-foreground py-2">
                {DAYS_OF_WEEK.map((day) => (
                  <div key={day}>{day}</div>
                ))}
              </div>

              {/* Day cells grid */}
              <div className="grid grid-cols-7 divide-x divide-y divide-border">
                {/* Empty leading cells */}
                {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-[100px] p-2 bg-muted/10 opacity-40" />
                ))}

                {/* Day cells */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1
                  const cellDate = new Date(year, month, dayNum)
                  const dateStr = cellDate.toISOString().slice(0, 10)
                  const { events: dayEvents, tasks: dayTasks } = getItemsForDate(dateStr)
                  const today = isToday(dayNum, month, year)

                  return (
                    <div
                      key={`day-${dayNum}`}
                      onClick={() => {
                        setSelectedSlotDate(cellDate)
                        setCreateEventOpen(true)
                      }}
                      className="min-h-[100px] p-1.5 hover:bg-muted/20 transition-colors cursor-pointer flex flex-col justify-between group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                            today
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'text-foreground'
                          }`}
                        >
                          {dayNum}
                        </span>

                        <Plus className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>

                      {/* Events & Task Pills */}
                      <div className="space-y-1 overflow-y-auto max-h-20 flex-1">
                        {/* Real Calendar Events */}
                        {dayEvents.map((ev) => (
                          <div
                            key={ev.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedEvent(ev)
                            }}
                            className="p-1 px-1.5 rounded text-[10px] font-medium bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900 truncate hover:opacity-85 transition-opacity"
                            title={ev.title}
                          >
                            📅 {ev.title}
                          </div>
                        ))}

                        {/* Task Due Dates on Calendar (Requirement 14) */}
                        {dayTasks.map((tk) => (
                          <div
                            key={tk.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedTaskId(tk.taskId)
                            }}
                            className="p-1 px-1.5 rounded text-[10px] font-medium bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900 truncate hover:opacity-85 transition-opacity flex items-center gap-1"
                            title={`Task: ${tk.title}`}
                          >
                            <CheckSquare className="h-2.5 w-2.5 shrink-0" />
                            <span className="truncate">{tk.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 2. WEEK VIEW */}
          {viewMode === 'week' && (
            <div className="border border-border rounded-xl overflow-hidden bg-card shadow-xs">
              <div className="grid grid-cols-7 divide-x divide-border">
                {weekDates.map((date) => {
                  const dateStr = date.toISOString().slice(0, 10)
                  const { events: dayEvents, tasks: dayTasks } = getItemsForDate(dateStr)
                  const today = isToday(date.getDate(), date.getMonth(), date.getFullYear())

                  return (
                    <div key={dateStr} className="min-h-[400px] flex flex-col">
                      <div className="p-3 border-b border-border text-center bg-muted/30">
                        <span className="text-[11px] font-medium text-muted-foreground uppercase">
                          {DAYS_OF_WEEK[date.getDay()]}
                        </span>
                        <p
                          className={`text-base font-bold mt-0.5 mx-auto h-7 w-7 rounded-full flex items-center justify-center ${
                            today ? 'bg-indigo-600 text-white' : 'text-foreground'
                          }`}
                        >
                          {date.getDate()}
                        </p>
                      </div>

                      <div className="p-2 space-y-2 flex-1 overflow-y-auto">
                        {dayEvents.map((ev) => (
                          <div
                            key={ev.id}
                            onClick={() => setSelectedEvent(ev)}
                            className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-900 text-xs cursor-pointer hover:shadow-xs transition-shadow"
                          >
                            <p className="font-semibold text-indigo-700 dark:text-indigo-300 truncate">
                              {ev.title}
                            </p>
                            {ev.location && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1 truncate">
                                <MapPin className="h-2.5 w-2.5" /> {ev.location}
                              </span>
                            )}
                          </div>
                        ))}

                        {dayTasks.map((tk) => (
                          <div
                            key={tk.id}
                            onClick={() => setSelectedTaskId(tk.taskId)}
                            className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-900 text-xs cursor-pointer hover:shadow-xs transition-shadow"
                          >
                            <div className="flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300 truncate">
                              <CheckSquare className="h-3 w-3 shrink-0" />
                              <span className="truncate">{tk.title}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground mt-1 block">
                              Status: {tk.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 3. DAY VIEW */}
          {viewMode === 'day' && (
            <div className="border border-border rounded-xl overflow-hidden bg-card p-6 space-y-4 shadow-xs">
              <div className="border-b border-border pb-3">
                <h3 className="font-bold text-lg text-foreground">
                  {currentDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </h3>
              </div>

              {(() => {
                const dateStr = currentDate.toISOString().slice(0, 10)
                const { events: dayEvents, tasks: dayTasks } = getItemsForDate(dateStr)

                if (dayEvents.length === 0 && dayTasks.length === 0) {
                  return (
                    <div className="py-16 text-center text-muted-foreground text-xs italic">
                      No events or tasks scheduled for this day.
                    </div>
                  )
                }

                return (
                  <div className="space-y-3">
                    {dayEvents.map((ev) => (
                      <div
                        key={ev.id}
                        onClick={() => setSelectedEvent(ev)}
                        className="p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 flex items-center justify-between gap-4 cursor-pointer hover:shadow-sm transition-all"
                      >
                        <div className="space-y-1 min-w-0">
                          <h4 className="font-bold text-sm text-foreground">{ev.title}</h4>
                          <p className="text-xs text-muted-foreground">
                            {ev.allDay ? 'All day' : `${new Date(ev.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(ev.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                          </p>
                          {ev.location && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {ev.location}
                            </span>
                          )}
                        </div>

                        {ev.attendees && (
                          <div className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" /> {ev.attendees.length} attendees
                          </div>
                        )}
                      </div>
                    ))}

                    {dayTasks.map((tk) => (
                      <div
                        key={tk.id}
                        onClick={() => setSelectedTaskId(tk.taskId)}
                        className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 flex items-center justify-between gap-4 cursor-pointer hover:shadow-sm transition-all"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <CheckSquare className="h-4 w-4 text-amber-600" />
                            <h4 className="font-bold text-sm text-foreground">{tk.title}</h4>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Task deadline · Status: {tk.status} · Priority: {tk.priority}
                          </p>
                        </div>

                        <Badge variant="outline" className="text-xs shrink-0">
                          Task Deadline
                        </Badge>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          )}
        </>
      )}

      {/* CREATE EVENT MODAL */}
      <CreateEventModal
        open={createEventOpen}
        onOpenChange={setCreateEventOpen}
        initialDate={selectedSlotDate}
        onEventCreated={() => {
          fetchCalendarData()
        }}
      />

      {/* EVENT DETAIL MODAL */}
      <EventDetailModal
        open={!!selectedEvent}
        onOpenChange={(open) => {
          if (!open) setSelectedEvent(null)
        }}
        event={selectedEvent}
        currentUserId={currentUserId}
        onEventDeleted={() => {
          setSelectedEvent(null)
          fetchCalendarData()
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
        onTaskUpdated={fetchCalendarData}
        onTaskDeleted={() => {
          setSelectedTaskId(null)
          fetchCalendarData()
        }}
      />
    </div>
  )
}
