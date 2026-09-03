import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const memberships = await db.workspaceMember.findMany({
    where: { userId: session.user.id },
    include: {
      workspace: {
        select: { id: true, name: true, slug: true, icon: true },
      },
    },
    orderBy: { joinedAt: 'asc' },
  })

  const initialWorkspaces = memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    slug: m.workspace.slug,
    icon: m.workspace.icon,
    role: m.role,
  }))

  return (
    <AppShell
      user={{
        id: session.user.id,
        name: session.user.name ?? 'User',
        email: session.user.email ?? '',
        image: session.user.image ?? null,
      }}
      initialWorkspaces={initialWorkspaces}
    >
      {children}
    </AppShell>
  )
}
