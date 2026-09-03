import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { MyTasksClient } from '@/components/tasks/my-tasks-client'

export default async function TasksPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  return (
    <div className="p-6">
      <MyTasksClient currentUserId={session.user.id} />
    </div>
  )
}
