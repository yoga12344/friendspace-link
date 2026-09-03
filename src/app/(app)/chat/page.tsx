import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ChatLayout } from '@/components/chat/chat-layout'

export default async function ChatPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  return (
    <div className="h-[calc(100vh-3rem)]">
      <ChatLayout
        currentUserId={session.user.id}
        currentUserName={session.user.name || 'User'}
      />
    </div>
  )
}
