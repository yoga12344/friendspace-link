import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'
import { InviteAcceptClient } from '@/components/workspace/invite-accept-client'
import { Building2, AlertCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Params = { params: Promise<{ token: string }> }

export default async function InvitePage({ params }: Params) {
  const { token } = await params
  const session = await auth()

  const invitation = await db.invitation.findUnique({
    where: { token },
    include: {
      workspace: { select: { id: true, name: true, icon: true, description: true } },
      sender: { select: { id: true, name: true, username: true, image: true } },
    },
  })

  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full p-8 border border-border rounded-xl bg-card text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive mx-auto flex items-center justify-center">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Invitation Not Found</h1>
          <p className="text-sm text-muted-foreground">
            This invitation link is invalid or may have been deleted.
          </p>
          <Button asChild className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <Link href="/dashboard">Go to Home</Link>
          </Button>
        </div>
      </div>
    )
  }

  const isExpired = new Date() > invitation.expiresAt
  if (isExpired || invitation.status === 'EXPIRED') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full p-8 border border-border rounded-xl bg-card text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 mx-auto flex items-center justify-center">
            <Clock className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Invitation Expired</h1>
          <p className="text-sm text-muted-foreground">
            This invitation link expired on {new Date(invitation.expiresAt).toLocaleDateString()}.
            Please ask {invitation.sender.name} to send a new invite.
          </p>
          <Button asChild variant="outline">
            <Link href="/dashboard">Go to Home</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (invitation.status === 'DECLINED') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full p-8 border border-border rounded-xl bg-card text-center space-y-4">
          <h1 className="text-xl font-bold text-foreground">Invitation Declined</h1>
          <p className="text-sm text-muted-foreground">
            This invitation has been declined.
          </p>
          <Button asChild variant="outline">
            <Link href="/dashboard">Go to Home</Link>
          </Button>
        </div>
      </div>
    )
  }

  // Check if current logged-in user is already a member
  let isAlreadyMember = false
  if (session?.user?.id) {
    const member = await db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: invitation.workspaceId,
          userId: session.user.id,
        },
      },
    })
    if (member) isAlreadyMember = true
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="max-w-md w-full border border-border rounded-2xl bg-card p-6 sm:p-8 shadow-sm text-center space-y-6">
        {/* Workspace Icon / Avatar */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900 flex items-center justify-center text-3xl shadow-inner">
          {invitation.workspace.icon || <Building2 className="h-8 w-8 text-indigo-600" />}
        </div>

        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Join {invitation.workspace.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{invitation.sender.name}</span> (@{invitation.sender.username}) invited you to collaborate in FriendSpace.
          </p>
          {invitation.workspace.description && (
            <p className="text-xs text-muted-foreground/80 italic mt-2">
              &quot;{invitation.workspace.description}&quot;
            </p>
          )}
        </div>

        <InviteAcceptClient
          token={token}
          workspace={invitation.workspace}
          user={session?.user ?? null}
          isAlreadyMember={isAlreadyMember}
          targetEmail={invitation.email}
        />
      </div>
    </div>
  )
}
