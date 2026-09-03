import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { MembersClient } from '@/components/members/members-client'

export default async function MembersPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  return (
    <div className="p-4 md:p-6">
      <MembersClient currentUserId={session.user.id} />
    </div>
  )
}
