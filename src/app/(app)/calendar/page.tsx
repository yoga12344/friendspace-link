import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { CalendarClient } from '@/components/calendar/calendar-client'

export const metadata = {
  title: 'Calendar | FriendSpace',
  description: 'Team events, meetings, and project deadlines',
}

export default async function CalendarPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }

  return <CalendarClient currentUserId={session.user.id} />
}
