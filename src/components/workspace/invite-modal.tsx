'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, Copy, Check, Link as LinkIcon, Send } from 'lucide-react'

interface InviteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  workspaceName: string
}

export function InviteModal({
  open,
  onOpenChange,
  workspaceId,
  workspaceName,
}: InviteModalProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [generatedLink, setGeneratedLink] = useState('')
  const [linkLoading, setLinkLoading] = useState(false)

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      toast.error('Please enter an email address')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send invitation')
      }

      toast.success(`Invitation sent to ${email}`)
      setGeneratedLink(data.inviteUrl)
      setEmail('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invite failed'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateLink = async () => {
    setLinkLoading(true)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create invite link')
      }

      setGeneratedLink(data.inviteUrl)
      await navigator.clipboard.writeText(data.inviteUrl)
      setCopied(true)
      toast.success('Invite link copied to clipboard!')
      setTimeout(() => setCopied(false), 3000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate link'
      toast.error(msg)
    } finally {
      setLinkLoading(false)
    }
  }

  const handleCopyExisting = async () => {
    if (!generatedLink) return
    await navigator.clipboard.writeText(generatedLink)
    setCopied(true)
    toast.success('Link copied!')
    setTimeout(() => setCopied(false), 3000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Invite people</DialogTitle>
          <DialogDescription>
            Invite friends or teammates to join <span className="font-semibold text-foreground">&quot;{workspaceName}&quot;</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Email Invite Form */}
          <form onSubmit={handleSendInvite} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <div className="flex gap-2">
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="friend@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
                <Button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-1.5" />
                      Send invitation
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground uppercase tracking-wider">
                Or share invite link
              </span>
            </div>
          </div>

          {/* Quick link generate & copy */}
          <div className="space-y-2">
            {generatedLink ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={generatedLink}
                    className="text-xs bg-muted/40 font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCopyExisting}
                    className="shrink-0 gap-1.5"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 text-emerald-500" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Valid for 7 days. Anyone with this link can join as a Member.
                </p>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={handleGenerateLink}
                disabled={linkLoading}
                className="w-full gap-2"
              >
                {linkLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LinkIcon className="h-4 w-4" />
                )}
                Copy invite link
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
