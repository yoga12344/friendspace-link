import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { SettingsClient } from '@/components/settings/settings-client'

export const metadata = {
  title: 'Settings — FriendSpace',
}

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      bio: true,
      image: true,
      timezone: true,
    },
  })

  if (!user) redirect('/login')

  return <SettingsClient initialUser={user} />
}
