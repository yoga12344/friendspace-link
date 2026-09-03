import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ProjectsClient } from '@/components/projects/projects-client'

export default async function ProjectsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  return (
    <div className="p-6">
      <ProjectsClient currentUserId={session.user.id} />
    </div>
  )
}
