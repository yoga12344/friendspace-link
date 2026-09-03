import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/workspace-auth'

// GET /api/tasks — My Tasks list assigned to the authenticated user
export async function GET(req: Request) {
  const { error, session } = await requireAuth()
  if (error) return error

  const userId = session!.user.id
  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspaceId')
  const statusFilter = searchParams.get('status')
  const priorityFilter = searchParams.get('priority')
  const projectId = searchParams.get('projectId')

  // Find all tasks assigned to the user
  const tasks = await db.task.findMany({
    where: {
      assignees: {
        some: { userId },
      },
      ...(workspaceId ? { workspaceId } : {}),
      ...(statusFilter ? { status: statusFilter as any } : {}),
      ...(priorityFilter ? { priority: priorityFilter as any } : {}),
      ...(projectId ? { projectId } : {}),
    },
    include: {
      project: {
        select: { id: true, name: true, icon: true, color: true },
      },
      creator: {
        select: { id: true, name: true, username: true, image: true },
      },
      assignees: {
        include: {
          user: {
            select: { id: true, name: true, username: true, image: true },
          },
        },
      },
      tags: true,
      checklists: true,
      _count: {
        select: { comments: true },
      },
    },
    take: 100,
    orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
  })

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  const categorized = {
    overdue: [] as typeof tasks,
    today: [] as typeof tasks,
    upcoming: [] as typeof tasks,
    noDueDate: [] as typeof tasks,
    completed: [] as typeof tasks,
  }

  for (const task of tasks) {
    if (task.status === 'COMPLETED') {
      categorized.completed.push(task)
    } else if (!task.dueDate) {
      categorized.noDueDate.push(task)
    } else {
      const due = new Date(task.dueDate)
      if (due < startOfToday) {
        categorized.overdue.push(task)
      } else if (due <= endOfToday) {
        categorized.today.push(task)
      } else {
        categorized.upcoming.push(task)
      }
    }
  }

  return NextResponse.json({
    tasks,
    categorized,
  })
}
