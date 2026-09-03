import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { InboxClient } from '@/components/inbox/inbox-client'

export const metadata = {
  title: 'Inbox — FriendSpace',
}

export default async function InboxPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }

  return <InboxClient />
}
