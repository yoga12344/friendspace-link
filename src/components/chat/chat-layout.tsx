'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  ConversationList,
  type ConversationSummary,
} from '@/components/chat/conversation-list'
import { ChatWindow } from '@/components/chat/chat-window'
import { NewConversationModal } from '@/components/chat/new-conversation-modal'
import { getSocketClient } from '@/lib/socket-client'
import { MessageSquare, Wifi, WifiOff } from 'lucide-react'
import { toast } from 'sonner'
import { useWorkspaceStore } from '@/store/workspace-store'

interface ChatLayoutProps {
  currentUserId: string
  currentUserName: string
}

export function ChatLayout({ currentUserId, currentUserName }: ChatLayoutProps) {
  const searchParams = useSearchParams()
  const initialDmUserId = searchParams.get('dm')
  const initialConversationId = searchParams.get('c')
  const currentWorkspace = useWorkspaceStore((s) => s.getCurrentWorkspace())

  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    initialConversationId
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [newModalOpen, setNewModalOpen] = useState(false)

  // Real-time socket state
  const [connected, setConnected] = useState(false)
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set())
  const [typingUsers, setTypingUsers] = useState<string[]>([])

  // Mobile view toggle
  const [showMobileChat, setShowMobileChat] = useState(!!initialConversationId)

  // Fetch all conversations for user
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations')
      const data = await res.json()
      if (res.ok) {
        setConversations(data.conversations || [])
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // Handle ?dm=userId from URL (e.g. clicked "Message" on members page)
  useEffect(() => {
    if (!initialDmUserId) return

    async function openOrCreateDm() {
      try {
        const res = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'DIRECT',
            targetUserId: initialDmUserId,
            workspaceId: currentWorkspace?.id || null,
          }),
        })
        const data = await res.json()
        if (res.ok && data.conversation) {
          setActiveConversationId(data.conversation.id)
          setShowMobileChat(true)
          fetchConversations()
        }
      } catch {
        toast.error('Error opening conversation')
      }
    }

    openOrCreateDm()
  }, [initialDmUserId, currentWorkspace?.id, fetchConversations])

  // Socket.IO setup
  useEffect(() => {
    const socket = getSocketClient({ id: currentUserId, name: currentUserName })

    function onConnect() {
      setConnected(true)
    }

    function onDisconnect() {
      setConnected(false)
    }

    function onPresenceSync(data: { onlineUserIds: string[] }) {
      setOnlineUserIds(new Set(data.onlineUserIds))
    }

    function onUserOnline(data: { userId: string }) {
      setOnlineUserIds((prev) => new Set([...Array.from(prev), data.userId]))
    }

    function onUserOffline(data: { userId: string }) {
      setOnlineUserIds((prev) => {
        const updated = new Set(prev)
        updated.delete(data.userId)
        return updated
      })
    }

    function onConversationCreated() {
      fetchConversations()
    }

    function onConversationUpdated() {
      fetchConversations()
    }

    function onMessageCreated(data: { conversationId: string; message: any }) {
      // Update lastMessage on conversation list
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === data.conversationId) {
            const isCurrentActive = c.id === activeConversationId
            return {
              ...c,
              lastMessageAt: data.message.createdAt,
              lastMessage: {
                id: data.message.id,
                content: data.message.content,
                senderId: data.message.senderId,
                senderName: data.message.sender.name,
                createdAt: data.message.createdAt,
              },
              unreadCount: isCurrentActive ? 0 : c.unreadCount + 1,
            }
          }
          return c
        })
      )
    }

    function onTypingStarted(data: {
      conversationId: string
      userId: string
      name: string
    }) {
      if (data.conversationId === activeConversationId && data.userId !== currentUserId) {
        setTypingUsers((prev) =>
          prev.includes(data.name) ? prev : [...prev, data.name]
        )
      }
    }

    function onTypingStopped(data: { conversationId: string; userId: string }) {
      if (data.conversationId === activeConversationId) {
        setTypingUsers([])
      }
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('presence.sync', onPresenceSync)
    socket.on('user.online', onUserOnline)
    socket.on('user.offline', onUserOffline)
    socket.on('conversation.created', onConversationCreated)
    socket.on('conversation.updated', onConversationUpdated)
    socket.on('message.created', onMessageCreated)
    socket.on('typing.started', onTypingStarted)
    socket.on('typing.stopped', onTypingStopped)

    if (socket.connected) {
      setConnected(true)
    }

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('presence.sync', onPresenceSync)
      socket.off('user.online', onUserOnline)
      socket.off('user.offline', onUserOffline)
      socket.off('conversation.created', onConversationCreated)
      socket.off('conversation.updated', onConversationUpdated)
      socket.off('message.created', onMessageCreated)
      socket.off('typing.started', onTypingStarted)
      socket.off('typing.stopped', onTypingStopped)
    }
  }, [currentUserId, currentUserName, activeConversationId, fetchConversations])

  // Join active conversation room via socket
  useEffect(() => {
    if (!activeConversationId) return
    const socket = getSocketClient()
    socket.emit('conversation.join', { conversationId: activeConversationId })

    // Clear typing users when switching rooms
    setTypingUsers([])

    // Mark as read in local conversation state
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversationId ? { ...c, unreadCount: 0 } : c
      )
    )

    return () => {
      socket.emit('conversation.leave', { conversationId: activeConversationId })
    }
  }, [activeConversationId])

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id)
    setShowMobileChat(true)
  }

  const handleEmitTypingStart = (cId: string) => {
    const socket = getSocketClient()
    socket.emit('typing.start', { conversationId: cId })
  }

  const handleEmitTypingStop = (cId: string) => {
    const socket = getSocketClient()
    socket.emit('typing.stop', { conversationId: cId })
  }

  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId
  )

  const isOtherUserOnline =
    activeConversation?.type === 'DIRECT' &&
    activeConversation.otherUser &&
    onlineUserIds.has(activeConversation.otherUser.id)

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {/* Subtle Connection Status pill */}
      <div className="absolute top-2 right-4 z-30 pointer-events-none">
        <div
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border shadow-xs transition-colors ${
            connected
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-900 dark:text-emerald-300'
              : 'bg-amber-50/80 border-amber-200 text-amber-700 dark:bg-amber-950/60 dark:border-amber-900 dark:text-amber-300'
          }`}
        >
          {connected ? (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Connected</span>
            </>
          ) : (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span>Reconnecting...</span>
            </>
          )}
        </div>
      </div>

      {/* Main Dual-Pane View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane: Conversation List (hidden on mobile if chat active) */}
        <div
          className={`w-full md:w-80 shrink-0 h-full ${
            showMobileChat ? 'hidden md:flex' : 'flex'
          }`}
        >
          <ConversationList
            conversations={conversations}
            activeConversationId={activeConversationId}
            onSelectConversation={handleSelectConversation}
            onNewConversation={() => setNewModalOpen(true)}
            onlineUserIds={onlineUserIds}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>

        {/* Right Pane: Chat Window */}
        <div
          className={`flex-1 h-full ${
            !showMobileChat ? 'hidden md:flex' : 'flex'
          }`}
        >
          {activeConversationId ? (
            <ChatWindow
              key={activeConversationId}
              conversationId={activeConversationId}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              onBackMobile={() => setShowMobileChat(false)}
              isOnline={!!isOtherUserOnline}
              onlineUserIds={onlineUserIds}
              onEmitTypingStart={handleEmitTypingStart}
              onEmitTypingStop={handleEmitTypingStop}
              typingUsers={typingUsers}
              conversationDetails={activeConversation}
              onConversationUpdated={fetchConversations}
              onLeaveConversation={() => {
                setActiveConversationId(null)
                setShowMobileChat(false)
                fetchConversations()
              }}
            />
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center bg-card">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center text-3xl mb-3 shadow-inner">
                💬
              </div>
              <h2 className="text-lg font-bold text-foreground">
                Your conversations will appear here
              </h2>
              <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
                Select a conversation from the left, or click &quot;New Chat&quot; to message friends or start a group discussion.
              </p>
              <button
                type="button"
                onClick={() => setNewModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-xs"
              >
                + Start a conversation
              </button>
            </div>
          )}
        </div>
      </div>

      {/* New Conversation Modal */}
      <NewConversationModal
        open={newModalOpen}
        onOpenChange={setNewModalOpen}
        onConversationSelected={(id) => {
          setActiveConversationId(id)
          setShowMobileChat(true)
          fetchConversations()
        }}
        currentUserId={currentUserId}
      />
    </div>
  )
}
