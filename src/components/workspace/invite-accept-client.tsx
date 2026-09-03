'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useWorkspaceStore } from '@/store/workspace-store'

interface InviteAcceptClientProps {
  token: string
  workspace: {
    id: string
    name: string
    icon: string | null
  }
  user: {
    id: string
    name?: string | null
    email?: string | null
  } | null
  isAlreadyMember: boolean
  targetEmail?: string | null
}

export function InviteAcceptClient({
  token,
  workspace,
  user,
  isAlreadyMember,
  targetEmail,
}: InviteAcceptClientProps) {
  const [loading, setLoading] = useState(false)
  const [declineLoading, setDeclineLoading] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [declined, setDeclined] = useState(false)
  const router = useRouter()
  const setCurrentWorkspace = useWorkspaceStore((s) => s.setCurrentWorkspace)

  if (!user) {
    return (
      <div className="space-y-3 pt-2">
        <p className="text-xs text-muted-foreground">
          Sign in or create an account to accept this invitation.
        </p>
        <div className="flex flex-col gap-2">
          <Button asChild className="bg-indigo-600 hover:bg-indigo-700 text-white w-full">
            <Link href={`/login?callbackUrl=/invite/${token}`}>
              Sign in to Accept
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/register">
              Create an Account
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  if (isAlreadyMember) {
    return (
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-center gap-2 text-indigo-600 dark:text-indigo-400 font-medium text-sm">
          <CheckCircle2 className="h-5 w-5" />
          <span>You are already a member!</span>
        </div>
        <Button
          onClick={() => {
            setCurrentWorkspace(workspace.id)
            router.push('/dashboard')
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white w-full"
        >
          Go to Workspace
        </Button>
      </div>
    )
  }

  // Email mismatch check
  if (targetEmail && user.email?.toLowerCase() !== targetEmail.toLowerCase()) {
    return (
      <div className="space-y-4 pt-2">
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-700 dark:text-amber-400 text-left space-y-1">
          <p className="font-semibold">Account mismatch</p>
          <p>This invite was sent to <span className="font-mono">{targetEmail}</span>.</p>
          <p>You are currently logged in as <span className="font-mono">{user.email}</span>.</p>
        </div>
        <Button asChild variant="outline" className="w-full">
          <Link href={`/login?callbackUrl=/invite/${token}`}>
            Switch Account
          </Link>
        </Button>
      </div>
    )
  }

  if (accepted) {
    return (
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium text-sm">
          <CheckCircle2 className="h-5 w-5" />
          <span>Invitation accepted!</span>
        </div>
        <Button
          onClick={() => {
            setCurrentWorkspace(workspace.id)
            router.push('/dashboard')
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white w-full"
        >
          Enter Workspace
        </Button>
      </div>
    )
  }

  if (declined) {
    return (
      <div className="space-y-3 pt-2">
        <p className="text-sm text-muted-foreground">You declined this invitation.</p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/dashboard">Go to Home</Link>
        </Button>
      </div>
    )
  }

  const handleAccept = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/invitations/${token}/accept`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to accept invitation')
      }

      toast.success(`Joined ${workspace.name}!`)
      setAccepted(true)
      setCurrentWorkspace(workspace.id)
      router.refresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error accepting invite'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleDecline = async () => {
    setDeclineLoading(true)
    try {
      const res = await fetch(`/api/invitations/${token}/decline`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to decline invitation')
      }
      toast.info('Invitation declined')
      setDeclined(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error declining invite'
      toast.error(msg)
    } finally {
      setDeclineLoading(false)
    }
  }

  return (
    <div className="space-y-3 pt-2">
      <p className="text-xs text-muted-foreground">
        Joining as <span className="font-medium text-foreground">{user.name}</span> ({user.email})
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          onClick={handleAccept}
          disabled={loading || declineLoading}
          className="bg-indigo-600 hover:bg-indigo-700 text-white flex-1"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Accept Invitation
        </Button>
        <Button
          onClick={handleDecline}
          disabled={loading || declineLoading}
          variant="outline"
          className="flex-1"
        >
          {declineLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Decline
        </Button>
      </div>
    </div>
  )
}
