'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Search, Plus, MessageSquare, Users, User } from 'lucide-react'
import { getInitials, formatRelativeTime } from '@/lib/utils'

export interface ConversationSummary {
  id: string
  type: 'DIRECT' | 'GROUP' | 'PROJECT'
  name: string
  icon?: string | null
  workspaceId?: string | null
  lastMessageAt: string
  unreadCount: number
  otherUser?: {
    id: string
    name: string
    username: string
    image: string | null
    status: string
  } | null
  lastMessage?: {
    id: string
    content: string
    senderId: string
    senderName: string
    createdAt: string
    deletedAt?: string | null
  } | null
  members?: {
    userId: string
    role: string
    name: string
    username: string
    image: string | null
  }[]
}

interface ConversationListProps {
  conversations: ConversationSummary[]
  activeConversationId: string | null
  onSelectConversation: (id: string) => void
  onNewConversation: () => void
  onlineUserIds: Set<string>
  searchQuery: string
  onSearchChange: (q: string) => void
}

export function ConversationList({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onlineUserIds,
  searchQuery,
  onSearchChange,
}: ConversationListProps) {
  const [filter, setFilter] = useState<'all' | 'direct' | 'group'>('all')

  const filteredConversations = conversations.filter((c) => {
    if (filter === 'direct' && c.type !== 'DIRECT') return false
    if (filter === 'group' && c.type !== 'GROUP') return false
    return true
  })

  return (
    <div className="h-full flex flex-col bg-card border-r border-border">
      {/* Top Header */}
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground text-sm flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4 text-indigo-600" />
            <span>Messages</span>
          </h2>
          <Button
            size="sm"
            onClick={onNewConversation}
            className="h-7 px-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Chat</span>
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 text-xs h-8 bg-muted/40"
          />
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1">
          <Button
            variant={filter === 'all' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('all')}
            className="h-6 text-[11px] px-2 rounded-full font-medium"
          >
            All
          </Button>
          <Button
            variant={filter === 'direct' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('direct')}
            className="h-6 text-[11px] px-2 rounded-full font-medium gap-1"
          >
            <User className="h-3 w-3" />
            Direct
          </Button>
          <Button
            variant={filter === 'group' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('group')}
            className="h-6 text-[11px] px-2 rounded-full font-medium gap-1"
          >
            <Users className="h-3 w-3" />
            Groups
          </Button>
        </div>
      </div>

      {/* Conversation List Items */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/50">
        {filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
            <p>No conversations found.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={onNewConversation}
              className="text-xs"
            >
              Start a new conversation
            </Button>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isActive = conv.id === activeConversationId
            const isDirect = conv.type === 'DIRECT'
            const isOnline = isDirect && conv.otherUser && onlineUserIds.has(conv.otherUser.id)

            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => onSelectConversation(conv.id)}
                className={`w-full flex items-center gap-3 p-3 text-left transition-colors relative ${
                  isActive
                    ? 'bg-indigo-50/70 dark:bg-indigo-950/40 text-foreground'
                    : 'hover:bg-muted/40 text-foreground/80'
                }`}
              >
                {/* Avatar with online dot */}
                <div className="relative shrink-0">
                  {isDirect ? (
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={conv.otherUser?.image || ''} alt={conv.name} />
                      <AvatarFallback className="text-xs font-medium">
                        {getInitials(conv.name)}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-indigo-100 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-900 flex items-center justify-center text-base">
                      {conv.icon || '👥'}
                    </div>
                  )}

                  {isDirect && (
                    <span
                      className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card ${
                        isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                      }`}
                      title={isOnline ? 'Online' : 'Offline'}
                    />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <p className="font-semibold text-xs truncate text-foreground">
                      {conv.name}
                    </p>
                    {conv.lastMessageAt && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatRelativeTime(conv.lastMessageAt)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-muted-foreground truncate">
                      {conv.lastMessage
                        ? `${conv.lastMessage.senderName.split(' ')[0]}: ${conv.lastMessage.content}`
                        : 'No messages yet'}
                    </p>

                    {conv.unreadCount > 0 && (
                      <span className="shrink-0 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
