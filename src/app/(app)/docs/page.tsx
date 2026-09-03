import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { DocsClient } from '@/components/docs/docs-client'

export const metadata = {
  title: 'Documents | FriendSpace',
  description: 'Team notes, documentation, and specs',
}

export default async function DocsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }

  return <DocsClient currentUserId={session.user.id} />
}
