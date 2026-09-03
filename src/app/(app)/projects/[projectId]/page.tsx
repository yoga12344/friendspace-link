import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ProjectDetailClient } from '@/components/projects/project-detail-client'

type Props = {
  params: Promise<{ projectId: string }>
}

export default async function ProjectDetailPage({ params }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const { projectId } = await params

  return (
    <div className="p-6">
      <ProjectDetailClient projectId={projectId} currentUserId={session.user.id} />
    </div>
  )
}
