import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { FilesClient } from '@/components/files/files-client'

export const metadata = {
  title: 'Files | FriendSpace',
  description: 'Team file storage and asset sharing',
}

export default async function FilesPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }

  return <FilesClient currentUserId={session.user.id} />
}
