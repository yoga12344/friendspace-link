import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { DocDetailClient } from '@/components/docs/doc-detail-client'

type Props = {
  params: Promise<{ documentId: string }>
}

export const metadata = {
  title: 'Document Editor | FriendSpace',
  description: 'Rich-text team document editor',
}

export default async function DocumentDetailPage({ params }: Props) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }

  const { documentId } = await params

  return <DocDetailClient documentId={documentId} currentUserId={session.user.id} />
}
