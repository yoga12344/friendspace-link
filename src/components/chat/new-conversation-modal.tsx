'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getInitials } from '@/lib/utils'
import { toast } from 'sonner'
import { Loader2, Search, User, Users, MessageSquare, Plus } from 'lucide-react'
import { useWorkspaceStore } from '@/store/workspace-store'

interface UserItem {
  id: string
  name: string
  username: string
  image: string | null
  status?: string
}

interface NewConversationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConversationSelected: (conversationId: string) => void
  currentUserId: string
}

const emojiIcons = ['👥', '🚀', '📚', '💼', '🎮', '💡', '🎨', '✈️', '⚡', '☕']

export function NewConversationModal({
  open,
  onOpenChange,
  onConversationSelected,
  currentUserId,
}: NewConversationModalProps) {
  const currentWorkspace = useWorkspaceStore((s) => s.getCurrentWorkspace())
  const [activeTab, setActiveTab] = useState<'direct' | 'group'>('direct')

  // Available users (from friends + workspace members)
  const [users, setUsers] = useState<UserItem[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Group creation state
  const [groupName, setGroupName] = useState('')
  const [groupIcon, setGroupIcon] = useState('👥')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [startingDmId, setStartingDmId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    async function loadContacts() {
      setLoadingUsers(true)
      try {
        const uniqueUsers = new Map<string, UserItem>()

        // 1. Fetch workspace members if workspace active
        if (currentWorkspace?.id) {
          const res = await fetch(`/api/workspaces/${currentWorkspace.id}/members`)
          const data = await res.json()
          if (data.members) {
            data.members.forEach((m: any) => {
              if (m.user.id !== currentUserId) {
                uniqueUsers.set(m.user.id, m.user)
              }
            })
          }
        }

        // 2. Fetch friends
        const resFriends = await fetch('/api/friends')
        const dataFriends = await resFriends.json()
        if (dataFriends.friends) {
          dataFriends.friends.forEach((f: any) => {
            if (f.friend.id !== currentUserId) {
              uniqueUsers.set(f.friend.id, f.friend)
            }
          })
        }

        setUsers(Array.from(uniqueUsers.values()))
      } catch {
        // ignore
      } finally {
        setLoadingUsers(false)
      }
    }

    loadContacts()
  }, [open, currentWorkspace?.id, currentUserId])

  // Direct message click
  const handleStartDirect = async (targetUserId: string) => {
    setStartingDmId(targetUserId)
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'DIRECT',
          targetUserId,
          workspaceId: currentWorkspace?.id || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start conversation')

      onConversationSelected(data.conversation.id)
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setStartingDmId(null)
    }
  }

  // Create Group click
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!groupName.trim()) {
      toast.error('Please enter a group name')
      return
    }

    if (selectedUserIds.length === 0) {
      toast.error('Please select at least one member')
      return
    }

    setCreatingGroup(true)
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'GROUP',
          name: groupName.trim(),
          icon: groupIcon,
          workspaceId: currentWorkspace?.id || null,
          memberIds: selectedUserIds,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create group')

      toast.success('Group created!')
      setGroupName('')
      setSelectedUserIds([])
      onConversationSelected(data.conversation.id)
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setCreatingGroup(false)
    }
  }

  const toggleSelectUser = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((uId) => uId !== id) : [...prev, id]
    )
  }

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>New Conversation</DialogTitle>
          <DialogDescription>
            Start a direct message or create a group conversation.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="direct" className="gap-2">
              <User className="h-4 w-4" />
              Direct Message
            </TabsTrigger>
            <TabsTrigger value="group" className="gap-2">
              <Users className="h-4 w-4" />
              Group Chat
            </TabsTrigger>
          </TabsList>

          {/* DIRECT MESSAGE TAB */}
          <TabsContent value="direct" className="space-y-3 pt-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search people..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-sm h-9"
              />
            </div>

            <div className="border border-border rounded-lg divide-y divide-border max-h-64 overflow-y-auto">
              {loadingUsers ? (
                <div className="p-6 text-center text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading contacts...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  {searchQuery ? 'No contacts match your search' : 'No contacts found'}
                </div>
              ) : (
                filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleStartDirect(user.id)}
                    disabled={startingDmId === user.id}
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={user.image || ''} alt={user.name} />
                        <AvatarFallback className="text-xs">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium leading-none">{user.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">@{user.username}</p>
                      </div>
                    </div>

                    <div className="text-muted-foreground">
                      {startingDmId === user.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MessageSquare className="h-4 w-4" />
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </TabsContent>

          {/* GROUP CHAT TAB */}
          <TabsContent value="group" className="space-y-4 pt-2">
            <form onSubmit={handleCreateGroup} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-group-name">Group Name *</Label>
                <Input
                  id="new-group-name"
                  placeholder="e.g. Goa Trip, Project Alpha"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  maxLength={50}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>Group Icon</Label>
                <div className="flex flex-wrap gap-1.5">
                  {emojiIcons.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setGroupIcon(emoji)}
                      className={`h-8 w-8 rounded-lg border text-sm flex items-center justify-center transition-all ${
                        groupIcon === emoji
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950 scale-105'
                          : 'border-border hover:bg-muted'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Select Members ({selectedUserIds.length})</Label>
                <div className="border border-border rounded-lg divide-y divide-border max-h-44 overflow-y-auto">
                  {users.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">
                      No contacts available to add
                    </div>
                  ) : (
                    users.map((user) => {
                      const isSelected = selectedUserIds.includes(user.id)
                      return (
                        <label
                          key={user.id}
                          className="flex items-center justify-between p-2.5 px-3 hover:bg-muted/40 cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={user.image || ''} alt={user.name} />
                              <AvatarFallback className="text-[10px]">
                                {getInitials(user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-xs font-medium">{user.name}</p>
                              <p className="text-[10px] text-muted-foreground">@{user.username}</p>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectUser(user.id)}
                            className="h-4 w-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
                          />
                        </label>
                      )
                    })
                  )}
                </div>
              </div>

              <Button
                type="submit"
                disabled={creatingGroup || !groupName.trim() || selectedUserIds.length === 0}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
              >
                {creatingGroup ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Create Group
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
