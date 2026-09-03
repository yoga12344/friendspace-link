import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { DashboardClient } from '@/components/dashboard/dashboard-client'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const workspaceMembers = await db.workspaceMember.findMany({
    where: { userId: session.user.id },
    include: { workspace: { select: { id: true, name: true, icon: true, slug: true } } },
    orderBy: { joinedAt: 'asc' },
    take: 10,
  })

  return (
    <div className="p-4 md:p-6">
      <DashboardClient
        user={{
          id: session.user.id,
          name: session.user.name ?? 'User',
          email: session.user.email ?? '',
          image: session.user.image ?? null,
        }}
        workspaces={workspaceMembers.map((wm) => ({
          id: wm.workspace.id,
          name: wm.workspace.name,
          icon: wm.workspace.icon,
          slug: wm.workspace.slug,
          role: wm.role,
        }))}
      />
    </div>
  )
}
