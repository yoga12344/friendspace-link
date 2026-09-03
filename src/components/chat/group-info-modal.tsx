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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { getInitials } from '@/lib/utils'
import { toast } from 'sonner'
import { Loader2, ShieldCheck, UserX, LogOut } from 'lucide-react'

interface GroupMember {
  userId: string
  role: string
  name: string
  username: string
  image: string | null
  status: string
}

interface GroupInfoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversation: {
    id: string
    name: string
    icon: string | null
    createdById: string | null
    members: GroupMember[]
  } | null
  currentUserId: string
  onConversationUpdated?: () => void
  onLeaveConversation?: () => void
}

export function GroupInfoModal({
  open,
  onOpenChange,
  conversation,
  currentUserId,
  onConversationUpdated,
  onLeaveConversation,
}: GroupInfoModalProps) {
  const [name, setName] = useState(conversation?.name || '')
  const [loading, setLoading] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  if (!conversation) return null

  const currentMember = conversation.members.find((m) => m.userId === currentUserId)
  const isCreator = conversation.createdById === currentUserId
  const isAdmin = isCreator || currentMember?.role === 'ADMIN'

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    try {
      const res = await fetch(`/api/conversations/${conversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update')

      toast.success('Group name updated')
      onConversationUpdated?.()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveMember = async (userId: string, memberName: string) => {
    if (!confirm(`Remove ${memberName} from this group?`)) return

    setRemovingId(userId)
    try {
      const res = await fetch(`/api/conversations/${conversation.id}/members/${userId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to remove member')

      toast.success(`${memberName} removed from group`)
      onConversationUpdated?.()
    } catch {
      toast.error('Failed to remove member')
    } finally {
      setRemovingId(null)
    }
  }

  const handleLeaveGroup = async () => {
    if (!confirm('Leave this group conversation?')) return

    try {
      const res = await fetch(`/api/conversations/${conversation.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to leave group')

      toast.info('You left the group')
      onOpenChange(false)
      onLeaveConversation?.()
    } catch {
      toast.error('Failed to leave group')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{conversation.icon || '👥'}</span>
            <span>{conversation.name}</span>
          </DialogTitle>
          <DialogDescription>
            {conversation.members.length} members in this group
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Rename Form (Admins only) */}
          {isAdmin && (
            <form onSubmit={handleUpdateName} className="space-y-2">
              <Label htmlFor="group-name-input">Group Name</Label>
              <div className="flex gap-2">
                <Input
                  id="group-name-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Group name"
                  maxLength={50}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={loading || !name.trim() || name === conversation.name}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                  Save
                </Button>
              </div>
            </form>
          )}

          {/* Members List */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Members
            </Label>
            <div className="border border-border rounded-lg divide-y divide-border max-h-56 overflow-y-auto">
              {conversation.members.map((member) => {
                const isThisMemberAdmin =
                  member.userId === conversation.createdById || member.role === 'ADMIN'

                return (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between p-2.5 px-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={member.image || ''} alt={member.name} />
                        <AvatarFallback className="text-xs font-medium">
                          {getInitials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium truncate">{member.name}</p>
                          {member.userId === currentUserId && (
                            <span className="text-[10px] bg-muted px-1 rounded text-muted-foreground">
                              You
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          @{member.username}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isThisMemberAdmin && (
                        <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 py-0 text-indigo-600">
                          <ShieldCheck className="h-3 w-3" /> Admin
                        </Badge>
                      )}

                      {isAdmin && member.userId !== currentUserId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveMember(member.userId, member.name)}
                          disabled={removingId === member.userId}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          title="Remove from group"
                        >
                          {removingId === member.userId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <UserX className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Leave Group */}
          <div className="pt-2 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLeaveGroup}
              className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20 gap-1.5"
            >
              <LogOut className="h-4 w-4" />
              Leave Group
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
