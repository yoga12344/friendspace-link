'use client'

import { useState, useEffect, useCallback } from 'react'
import { useWorkspaceStore } from '@/store/workspace-store'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Search,
  UserPlus,
  MoreHorizontal,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Trash2,
  Check,
  X,
  Clock,
  UserX,
  Loader2,
  Users,
  MessageSquare,
} from 'lucide-react'
import { getInitials, formatRelativeTime } from '@/lib/utils'
import { InviteModal } from '@/components/workspace/invite-modal'
import { toast } from 'sonner'
import Link from 'next/link'

interface MemberUser {
  id: string
  name: string
  username: string
  image: string | null
  status: 'ONLINE' | 'AWAY' | 'DO_NOT_DISTURB' | 'OFFLINE'
  lastActiveAt: string
}

interface WorkspaceMemberItem {
  id: string
  workspaceId: string
  userId: string
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
  joinedAt: string
  user: MemberUser
}

interface FriendItem {
  friendshipId: string
  friend: MemberUser
  since: string
}

interface FriendRequestItem {
  id: string
  senderId: string
  receiverId: string
  status: string
  createdAt: string
  sender?: MemberUser
  receiver?: MemberUser
}

interface MembersClientProps {
  currentUserId: string
}

export function MembersClient({ currentUserId }: MembersClientProps) {
  const currentWorkspace = useWorkspaceStore((s) => s.getCurrentWorkspace())
  const [members, setMembers] = useState<WorkspaceMemberItem[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)

  // Friends state
  const [friends, setFriends] = useState<FriendItem[]>([])
  const [incomingRequests, setIncomingRequests] = useState<FriendRequestItem[]>([])
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequestItem[]>([])
  const [loadingFriends, setLoadingFriends] = useState(false)

  // User search to add friend
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [userSearchResults, setUserSearchResults] = useState<MemberUser[]>([])
  const [searchingUsers, setSearchingUsers] = useState(false)
  const [sendingRequestId, setSendingRequestId] = useState<string | null>(null)

  // Fetch workspace members
  const fetchMembers = useCallback(async () => {
    if (!currentWorkspace?.id) return
    setLoadingMembers(true)
    try {
      const res = await fetch(`/api/workspaces/${currentWorkspace.id}/members`)
      const data = await res.json()
      if (res.ok) {
        setMembers(data.members || [])
      }
    } catch {
      toast.error('Failed to load members')
    } finally {
      setLoadingMembers(false)
    }
  }, [currentWorkspace?.id])

  // Fetch friends and friend requests
  const fetchFriendsData = useCallback(async () => {
    setLoadingFriends(true)
    try {
      const res = await fetch('/api/friends')
      const data = await res.json()
      if (res.ok) {
        setFriends(data.friends || [])
        setIncomingRequests(data.incomingRequests || [])
        setOutgoingRequests(data.outgoingRequests || [])
      }
    } catch {
      // ignore
    } finally {
      setLoadingFriends(false)
    }
  }, [])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  useEffect(() => {
    fetchFriendsData()
  }, [fetchFriendsData])

  // User search for adding friends
  useEffect(() => {
    if (userSearchQuery.trim().length < 2) {
      setUserSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setSearchingUsers(true)
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(userSearchQuery.trim())}`)
        const data = await res.json()
        if (res.ok) {
          setUserSearchResults(data.users || [])
        }
      } catch {
        // ignore
      } finally {
        setSearchingUsers(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [userSearchQuery])

  // Current user's role in this workspace
  const currentUserRole = currentWorkspace?.role || 'MEMBER'
  const isOwner = currentUserRole === 'OWNER'
  const isAdmin = currentUserRole === 'ADMIN'
  const canInvite = isOwner || isAdmin

  // Change member role
  const handleRoleChange = async (userId: string, newRole: 'ADMIN' | 'MEMBER') => {
    if (!currentWorkspace?.id) return
    try {
      const res = await fetch(`/api/workspaces/${currentWorkspace.id}/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update role')

      toast.success('Role updated')
      fetchMembers()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating role'
      toast.error(msg)
    }
  }

  // Remove member
  const handleRemoveMember = async (userId: string, userName: string) => {
    if (!currentWorkspace?.id) return
    if (!confirm(`Are you sure you want to remove ${userName} from this workspace?`)) return

    try {
      const res = await fetch(`/api/workspaces/${currentWorkspace.id}/members/${userId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to remove member')

      toast.success(`${userName} removed from workspace`)
      fetchMembers()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error removing member'
      toast.error(msg)
    }
  }

  // Friend Request Actions
  const handleAcceptFriendRequest = async (requestId: string) => {
    try {
      const res = await fetch(`/api/friends/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ACCEPT' }),
      })
      if (!res.ok) throw new Error('Failed to accept')
      toast.success('Friend request accepted!')
      fetchFriendsData()
    } catch {
      toast.error('Failed to accept request')
    }
  }

  const handleRejectFriendRequest = async (requestId: string) => {
    try {
      const res = await fetch(`/api/friends/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REJECT' }),
      })
      if (!res.ok) throw new Error('Failed to reject')
      toast.info('Friend request rejected')
      fetchFriendsData()
    } catch {
      toast.error('Failed to reject request')
    }
  }

  const handleCancelFriendRequest = async (requestId: string) => {
    try {
      const res = await fetch(`/api/friends/${requestId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to cancel')
      toast.info('Request cancelled')
      fetchFriendsData()
    } catch {
      toast.error('Failed to cancel request')
    }
  }

  const handleSendFriendRequest = async (targetUserId: string) => {
    setSendingRequestId(targetUserId)
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send request')

      if (data.isFriend) {
        toast.success('Connected as friends!')
      } else {
        toast.success('Friend request sent!')
      }
      setUserSearchQuery('')
      setUserSearchResults([])
      fetchFriendsData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error sending request'
      toast.error(msg)
    } finally {
      setSendingRequestId(null)
    }
  }

  const handleRemoveFriend = async (friendshipId: string, name: string) => {
    if (!confirm(`Remove ${name} from friends?`)) return
    try {
      const res = await fetch(`/api/friends/${friendshipId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to remove friend')
      toast.info(`${name} removed from friends`)
      fetchFriendsData()
    } catch {
      toast.error('Failed to remove friend')
    }
  }

  // Filter members by search
  const filteredMembers = members.filter(
    (m) =>
      m.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.user.username.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ONLINE':
        return 'bg-emerald-500'
      case 'AWAY':
        return 'bg-amber-500'
      case 'DO_NOT_DISTURB':
        return 'bg-rose-500'
      default:
        return 'bg-slate-400'
    }
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'OWNER':
        return (
          <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1 text-xs">
            <ShieldAlert className="h-3 w-3" /> Owner
          </Badge>
        )
      case 'ADMIN':
        return (
          <Badge variant="secondary" className="gap-1 text-xs text-indigo-700 dark:text-indigo-300">
            <ShieldCheck className="h-3 w-3" /> Admin
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
            <UserCheck className="h-3 w-3" /> Member
          </Badge>
        )
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Members & Friends
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage workspace members, collaborate with friends, and handle invites.
          </p>
        </div>

        {canInvite && currentWorkspace && (
          <Button
            onClick={() => setInviteOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shrink-0"
          >
            <UserPlus className="h-4 w-4" />
            Invite Members
          </Button>
        )}
      </div>

      {/* Tabs: Workspace Members vs Friends & Requests */}
      <Tabs defaultValue="members" className="space-y-4">
        <TabsList className="grid w-full sm:w-[400px] grid-cols-2">
          <TabsTrigger value="members" className="gap-2">
            <Users className="h-4 w-4" />
            Workspace ({members.length})
          </TabsTrigger>
          <TabsTrigger value="friends" className="gap-2 relative">
            <UserCheck className="h-4 w-4" />
            Friends ({friends.length})
            {incomingRequests.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                {incomingRequests.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* WORKSPACE MEMBERS TAB */}
        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-semibold">
                    {currentWorkspace?.name || 'Workspace'} Members
                  </CardTitle>
                  <CardDescription>
                    People who currently have access to this workspace.
                  </CardDescription>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search members..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 text-sm h-9"
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {loadingMembers ? (
                <div className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" /> Loading members...
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  {searchQuery ? 'No members found matching your search.' : 'No members in this workspace.'}
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredMembers.map((m) => {
                    const isSelf = m.userId === currentUserId
                    const canManageThisUser =
                      isOwner && !isSelf
                        ? true
                        : isAdmin && m.role === 'MEMBER' && !isSelf

                    return (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative shrink-0">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={m.user.image || ''} alt={m.user.name} />
                              <AvatarFallback className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 font-semibold text-xs">
                                {getInitials(m.user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span
                              className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${getStatusColor(
                                m.user.status
                              )}`}
                              title={m.user.status}
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm text-foreground truncate">
                                {m.user.name}
                              </p>
                              {isSelf && (
                                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-medium">
                                  You
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              @{m.user.username} · Joined {formatRelativeTime(m.joinedAt)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {getRoleBadge(m.role)}

                          {!isSelf && (
                            <Button
                              asChild
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-indigo-600"
                              title={`Message ${m.user.name}`}
                            >
                              <Link href={`/chat?dm=${m.user.id}`}>
                                <MessageSquare className="h-4 w-4" />
                              </Link>
                            </Button>
                          )}

                          {canManageThisUser && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                                  Manage Member
                                </DropdownMenuLabel>

                                {isOwner && (
                                  <>
                                    {m.role === 'MEMBER' ? (
                                      <DropdownMenuItem
                                        onClick={() => handleRoleChange(m.userId, 'ADMIN')}
                                        className="gap-2 cursor-pointer"
                                      >
                                        <ShieldCheck className="h-4 w-4 text-indigo-600" />
                                        <span>Promote to Admin</span>
                                      </DropdownMenuItem>
                                    ) : m.role === 'ADMIN' ? (
                                      <DropdownMenuItem
                                        onClick={() => handleRoleChange(m.userId, 'MEMBER')}
                                        className="gap-2 cursor-pointer"
                                      >
                                        <UserCheck className="h-4 w-4 text-muted-foreground" />
                                        <span>Demote to Member</span>
                                      </DropdownMenuItem>
                                    ) : null}
                                    <DropdownMenuSeparator />
                                  </>
                                )}

                                <DropdownMenuItem
                                  onClick={() => handleRemoveMember(m.userId, m.user.name)}
                                  className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span>Remove from workspace</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* FRIENDS TAB */}
        <TabsContent value="friends" className="space-y-6">
          {/* Add Friend Search */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Add Friends</CardTitle>
              <CardDescription>
                Search by name, username, or email to connect with friends.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="pl-8 text-sm"
                />
              </div>

              {searchingUsers && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching...
                </p>
              )}

              {userSearchResults.length > 0 && (
                <div className="border border-border rounded-lg divide-y divide-border mt-2 bg-card">
                  {userSearchResults.map((user) => {
                    const isAlreadyFriend = friends.some((f) => f.friend.id === user.id)
                    const isPendingOutgoing = outgoingRequests.some((r) => r.receiverId === user.id)
                    const isPendingIncoming = incomingRequests.some((r) => r.senderId === user.id)

                    return (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-3"
                      >
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.image || ''} alt={user.name} />
                            <AvatarFallback className="text-xs">
                              {getInitials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium leading-none">{user.name}</p>
                            <p className="text-xs text-muted-foreground">@{user.username}</p>
                          </div>
                        </div>

                        {isAlreadyFriend ? (
                          <Badge variant="secondary" className="text-xs">Friends</Badge>
                        ) : isPendingOutgoing ? (
                          <Badge variant="outline" className="text-xs text-muted-foreground gap-1">
                            <Clock className="h-3 w-3" /> Requested
                          </Badge>
                        ) : isPendingIncoming ? (
                          <span className="text-xs text-indigo-600 font-medium">
                            Sent you a request
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleSendFriendRequest(user.id)}
                            disabled={sendingRequestId === user.id}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 text-xs gap-1.5"
                          >
                            {sendingRequestId === user.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <UserPlus className="h-3.5 w-3.5" />
                            )}
                            Add Friend
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Incoming Friend Requests */}
          {incomingRequests.length > 0 && (
            <Card className="border-indigo-200 dark:border-indigo-900 bg-indigo-50/30 dark:bg-indigo-950/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold text-indigo-950 dark:text-indigo-200">
                    Incoming Friend Requests ({incomingRequests.length})
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-indigo-100 dark:divide-indigo-900">
                {incomingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between p-4"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={req.sender?.image || ''} alt={req.sender?.name || ''} />
                        <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700">
                          {getInitials(req.sender?.name || 'User')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-semibold">{req.sender?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          @{req.sender?.username} wants to connect
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleAcceptFriendRequest(req.id)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 text-xs gap-1"
                      >
                        <Check className="h-3.5 w-3.5" /> Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRejectFriendRequest(req.id)}
                        className="h-8 text-xs gap-1"
                      >
                        <X className="h-3.5 w-3.5" /> Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Outgoing Friend Requests */}
          {outgoingRequests.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-muted-foreground">
                  Sent Friend Requests ({outgoingRequests.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-border">
                {outgoingRequests.map((req) => (
                  <div key={req.id} className="flex items-center justify-between p-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={req.receiver?.image || ''} alt={req.receiver?.name || ''} />
                        <AvatarFallback className="text-xs">
                          {getInitials(req.receiver?.name || 'User')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{req.receiver?.name}</p>
                        <p className="text-xs text-muted-foreground">@{req.receiver?.username}</p>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCancelFriendRequest(req.id)}
                      className="text-xs text-muted-foreground hover:text-destructive h-8"
                    >
                      Cancel
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Friends List */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Your Friends ({friends.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingFriends ? (
                <div className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading friends...
                </div>
              ) : friends.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  You haven&apos;t added any friends yet. Use the search bar above to connect!
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {friends.map((item) => (
                    <div
                      key={item.friendshipId}
                      className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={item.friend.image || ''} alt={item.friend.name} />
                            <AvatarFallback className="text-xs">
                              {getInitials(item.friend.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background ${getStatusColor(
                              item.friend.status
                            )}`}
                          />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{item.friend.name}</p>
                          <p className="text-xs text-muted-foreground">@{item.friend.username}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs gap-1.5"
                        >
                          <Link href={`/chat?dm=${item.friend.id}`}>
                            <MessageSquare className="h-3.5 w-3.5" />
                            Message
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveFriend(item.friendshipId, item.friend.name)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          title="Remove friend"
                        >
                          <UserX className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invite Modal */}
      {currentWorkspace && (
        <InviteModal
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          workspaceId={currentWorkspace.id}
          workspaceName={currentWorkspace.name}
        />
      )}
    </div>
  )
}
