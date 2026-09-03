import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, verifyWorkspaceMember } from '@/lib/workspace-auth'

// GET /api/dashboard — aggregated workspace dashboard data
export async function GET(req: Request) {
  const { error, session } = await requireAuth()
  if (error) return error

  const userId = session!.user.id
  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspaceId')

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
  }

  const { error: wsError } = await verifyWorkspaceMember(workspaceId)
  if (wsError) return wsError

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  const nextWeek = new Date(now.getTime() + 7 * 86400000)

  // Run bounded aggregated queries in parallel
  const [
    myTasksCount,
    projectsCount,
    unreadCount,
    workspace,
    myTasks,
    upcomingEvents,
    upcomingTasks,
    recentConversations,
  ] = await Promise.all([
    // 1. Total active tasks assigned to current user
    db.task.count({
      where: {
        workspaceId,
        assignees: { some: { userId } },
        status: { not: 'COMPLETED' },
      },
    }),

    // 2. Total active projects
    db.project.count({
      where: { workspaceId, status: { not: 'ARCHIVED' } },
    }),

    // 3. Unread notifications for this user in this workspace
    db.notification.count({
      where: { userId, workspaceId, read: false },
    }),

    // 4. Workspace details
    db.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true, icon: true, slug: true },
    }),

    // 5. My Tasks categorized (limit 15)
    db.task.findMany({
      where: {
        workspaceId,
        assignees: { some: { userId } },
        status: { not: 'COMPLETED' },
      },
      take: 15,
      orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
      include: {
        project: { select: { id: true, name: true, icon: true } },
        assignees: {
          include: {
            user: { select: { id: true, name: true, username: true, image: true } },
          },
        },
      },
    }),

    // 6. Upcoming Calendar Events (next 7 days, limit 6)
    db.event.findMany({
      where: {
        workspaceId,
        startAt: { gte: startOfToday, lte: nextWeek },
      },
      take: 6,
      orderBy: { startAt: 'asc' },
      include: {
        project: { select: { id: true, name: true, icon: true } },
      },
    }),

    // 7. Upcoming Task Deadlines (next 7 days, limit 6)
    db.task.findMany({
      where: {
        workspaceId,
        dueDate: { gte: startOfToday, lte: nextWeek },
        status: { not: 'COMPLETED' },
      },
      take: 6,
      orderBy: { dueDate: 'asc' },
      select: {
        id: true,
        title: true,
        dueDate: true,
        priority: true,
        status: true,
        projectId: true,
      },
    }),

    // 8. Recent Conversations (limit 6)
    db.conversation.findMany({
      where: {
        members: { some: { userId } },
        OR: [{ workspaceId }, { workspaceId: null }],
      },
      take: 6,
      orderBy: { updatedAt: 'desc' },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, username: true, image: true } },
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { content: true, createdAt: true },
        },
        _count: {
          select: {
            messages: {
              where: {
                senderId: { not: userId },
                reads: { none: { userId } },
              },
            },
          },
        },
      },
    }),
  ])

  // Split tasks into Overdue, Today, Upcoming
  const overdueTasks: typeof myTasks = []
  const todayTasks: typeof myTasks = []
  const upcomingTaskList: typeof myTasks = []
  const noDueDateTasks: typeof myTasks = []

  for (const t of myTasks) {
    if (!t.dueDate) {
      noDueDateTasks.push(t)
    } else {
      const d = new Date(t.dueDate)
      if (d < startOfToday) {
        overdueTasks.push(t)
      } else if (d <= endOfToday) {
        todayTasks.push(t)
      } else {
        upcomingTaskList.push(t)
      }
    }
  }

  // Format upcoming schedule items
  const upcomingSchedule = [
    ...upcomingEvents.map((e) => ({
      id: e.id,
      title: e.title,
      date: e.startAt,
      isEvent: true,
      location: e.location,
      project: e.project,
    })),
    ...upcomingTasks.map((t) => ({
      id: t.id,
      title: t.title,
      date: t.dueDate!,
      isEvent: false,
      priority: t.priority,
      status: t.status,
      projectId: t.projectId,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Format conversations
  const formattedConvs = recentConversations.map((c) => {
    let name = c.name
    let image = null
    if (c.type === 'DIRECT') {
      const other = c.members.find((m) => m.userId !== userId)?.user
      name = other?.name || 'Direct Message'
      image = other?.image || null
    }

    return {
      id: c.id,
      name,
      type: c.type,
      image,
      lastMessage: c.messages[0]?.content || 'No messages yet',
      updatedAt: c.messages[0]?.createdAt || c.updatedAt,
      unreadCount: c._count.messages,
    }
  })

  return NextResponse.json({
    workspace,
    stats: {
      myTasks: myTasksCount,
      projects: projectsCount,
      upcoming: upcomingSchedule.length,
      unread: unreadCount,
    },
    tasks: {
      overdue: overdueTasks,
      today: todayTasks,
      upcoming: upcomingTaskList,
      noDueDate: noDueDateTasks,
    },
    upcomingSchedule,
    recentConversations: formattedConvs,
  })
}
