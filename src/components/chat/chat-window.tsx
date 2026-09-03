'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Paperclip,
  Smile,
  Send,
  Loader2,
  Check,
  CheckCheck,
  MoreVertical,
  Reply,
  Edit2,
  Trash2,
  FileText,
  Download,
  X,
  Info,
} from 'lucide-react'
import { getInitials, formatBytes } from '@/lib/utils'
import { ImagePreviewModal } from '@/components/chat/image-preview-modal'
import { GroupInfoModal } from '@/components/chat/group-info-modal'
import { toast } from 'sonner'

export interface MessageItem {
  id: string
  conversationId: string
  content: string
  senderId: string
  sender: {
    id: string
    name: string
    username: string
    image: string | null
  }
  replyTo?: {
    id: string
    content: string
    senderName: string
  } | null
  reactions: {
    id: string
    emoji: string
    userId: string
  }[]
  attachments: {
    id?: string
    name: string
    url: string
    size: number
    mimeType: string
  }[]
  reads: {
    userId: string
    readAt: string
  }[]
  editedAt?: string | null
  deletedAt?: string | null
  createdAt: string
  sending?: boolean
  failed?: boolean
}

interface ChatWindowProps {
  conversationId: string
  currentUserId: string
  currentUserName: string
  onBackMobile?: () => void
  isOnline?: boolean
  onlineUserIds: Set<string>
  onEmitTypingStart?: (conversationId: string) => void
  onEmitTypingStop?: (conversationId: string) => void
  typingUsers: string[]
  conversationDetails?: any
  onConversationUpdated?: () => void
  onLeaveConversation?: () => void
}

const COMMON_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉']

export function ChatWindow({
  conversationId,
  currentUserId,
  currentUserName,
  onBackMobile,
  isOnline,
  onlineUserIds,
  onEmitTypingStart,
  onEmitTypingStop,
  typingUsers,
  conversationDetails,
  onConversationUpdated,
  onLeaveConversation,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [loadingMessages, setLoadingMessages] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)

  // Input & composer state
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [replyingTo, setReplyingTo] = useState<MessageItem | null>(null)
  const [editingMessage, setEditingMessage] = useState<MessageItem | null>(null)
  const [editContent, setEditContent] = useState('')
  const [pendingAttachments, setPendingAttachments] = useState<
    { name: string; url: string; size: number; mimeType: string }[]
  >([])
  const [uploadingFile, setUploadingFile] = useState(false)

  // Modals
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const [groupInfoOpen, setGroupInfoOpen] = useState(false)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch initial messages
  const fetchMessages = useCallback(async () => {
    setLoadingMessages(true)
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages?limit=30`)
      const data = await res.json()
      if (res.ok) {
        setMessages(data.messages || [])
        setNextCursor(data.nextCursor || null)
        // Mark as read
        fetch(`/api/conversations/${conversationId}/read`, { method: 'POST' }).catch(() => {})
      }
    } catch {
      toast.error('Failed to load messages')
    } finally {
      setLoadingMessages(false)
    }
  }, [conversationId])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!loadingMessages && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' })
    }
  }, [loadingMessages, conversationId])

  // Load older messages (cursor pagination)
  const handleLoadOlder = async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)

    const prevScrollHeight = messagesContainerRef.current?.scrollHeight || 0

    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/messages?limit=30&cursor=${nextCursor}`
      )
      const data = await res.json()
      if (res.ok) {
        setMessages((prev) => [...(data.messages || []), ...prev])
        setNextCursor(data.nextCursor || null)

        // Maintain scroll position after prepending
        setTimeout(() => {
          if (messagesContainerRef.current) {
            const newScrollHeight = messagesContainerRef.current.scrollHeight
            messagesContainerRef.current.scrollTop =
              newScrollHeight - prevScrollHeight
          }
        }, 50)
      }
    } catch {
      toast.error('Failed to load older messages')
    } finally {
      setLoadingMore(false)
    }
  }

  // Handle typing indicator debouncing
  const handleInputChange = (val: string) => {
    setInputText(val)

    if (onEmitTypingStart) {
      onEmitTypingStart(conversationId)
    }

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(() => {
      if (onEmitTypingStop) {
        onEmitTypingStop(conversationId)
      }
    }, 2000)
  }

  // Send message
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const trimmed = inputText.trim()
    if (!trimmed && pendingAttachments.length === 0) return

    const tempId = `temp-${Date.now()}`
    const optimisticMessage: MessageItem = {
      id: tempId,
      conversationId,
      content: trimmed,
      senderId: currentUserId,
      sender: {
        id: currentUserId,
        name: currentUserName,
        username: 'you',
        image: null,
      },
      replyTo: replyingTo
        ? {
            id: replyingTo.id,
            content: replyingTo.content,
            senderName: replyingTo.sender.name,
          }
        : null,
      reactions: [],
      attachments: [...pendingAttachments],
      reads: [],
      createdAt: new Date().toISOString(),
      sending: true,
    }

    setMessages((prev) => [...prev, optimisticMessage])
    setInputText('')
    const currentReplying = replyingTo
    setReplyingTo(null)
    const currentAttachments = [...pendingAttachments]
    setPendingAttachments([])
    setSending(true)

    // Scroll to bottom
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 50)

    if (onEmitTypingStop) onEmitTypingStop(conversationId)

    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: trimmed,
          replyToId: currentReplying?.id || null,
          attachments: currentAttachments,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send')

      // Replace optimistic message with server message
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? data.message : m))
      )
    } catch (err: any) {
      toast.error('Failed to send message')
      // Mark as failed
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, sending: false, failed: true } : m
        )
      )
    } finally {
      setSending(false)
    }
  }

  // Retry failed message
  const handleRetryMessage = async (failedMsg: MessageItem) => {
    setMessages((prev) => prev.filter((m) => m.id !== failedMsg.id))
    setInputText(failedMsg.content)
    setPendingAttachments(failedMsg.attachments)
  }

  // File upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploadingFile(true)
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Upload failed')

        setPendingAttachments((prev) => [...prev, data.file])
      }
      toast.success('File attached')
    } catch (err: any) {
      toast.error(err.message || 'File upload failed')
    } finally {
      setUploadingFile(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Edit message
  const handleSaveEdit = async () => {
    if (!editingMessage || !editContent.trim()) return

    try {
      const res = await fetch(`/api/messages/${editingMessage.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to edit')

      setMessages((prev) =>
        prev.map((m) =>
          m.id === editingMessage.id
            ? { ...m, content: data.message.content, editedAt: data.message.editedAt }
            : m
        )
      )
      setEditingMessage(null)
      setEditContent('')
      toast.success('Message updated')
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  // Delete message
  const handleDeleteMessage = async (msgId: string) => {
    if (!confirm('Delete this message?')) return

    try {
      const res = await fetch(`/api/messages/${msgId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? { ...m, content: 'Message deleted', deletedAt: new Date().toISOString() }
            : m
        )
      )
      toast.success('Message deleted')
    } catch {
      toast.error('Failed to delete message')
    }
  }

  // Reaction toggle
  const handleToggleReaction = async (msgId: string, emoji: string) => {
    try {
      const res = await fetch(`/api/messages/${msgId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error('Failed to react')

      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== msgId) return m
          if (data.removed) {
            return {
              ...m,
              reactions: m.reactions.filter((r) => r.id !== data.reactionId),
            }
          } else {
            return {
              ...m,
              reactions: [...m.reactions, data.reaction],
            }
          }
        })
      )
    } catch {
      toast.error('Error toggling reaction')
    }
  }

  // Scroll to replied message
  const scrollToMessage = (targetId: string) => {
    const el = document.getElementById(`msg-${targetId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('bg-indigo-50/80', 'dark:bg-indigo-950/50')
      setTimeout(() => {
        el.classList.remove('bg-indigo-50/80', 'dark:bg-indigo-950/50')
      }, 1500)
    }
  }

  const isGroup = conversationDetails?.type === 'GROUP'
  const displayName = conversationDetails?.name || 'Chat'
  const displayIcon = conversationDetails?.icon || '👥'

  return (
    <div className="h-full flex flex-col bg-background">
      {/* HEADER */}
      <div className="h-14 px-4 border-b border-border bg-card flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {onBackMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBackMobile}
              className="h-8 w-8 md:hidden"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}

          <div className="relative shrink-0">
            {isGroup ? (
              <div className="h-9 w-9 rounded-full bg-indigo-100 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-900 flex items-center justify-center text-base">
                {displayIcon}
              </div>
            ) : (
              <Avatar className="h-9 w-9">
                <AvatarImage
                  src={conversationDetails?.otherUser?.image || ''}
                  alt={displayName}
                />
                <AvatarFallback className="text-xs font-semibold">
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>
            )}

            {!isGroup && (
              <span
                className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card ${
                  isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                }`}
              />
            )}
          </div>

          <div className="min-w-0">
            <h3 className="font-semibold text-sm text-foreground truncate">
              {displayName}
            </h3>
            <p className="text-[11px] text-muted-foreground truncate">
              {isGroup
                ? `${conversationDetails?.members?.length || 0} members`
                : isOnline
                ? '🟢 Online'
                : 'Offline'}
            </p>
          </div>
        </div>

        {isGroup && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setGroupInfoOpen(true)}
            className="h-8 w-8 text-muted-foreground"
            title="Group info"
          >
            <Info className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* MESSAGES THREAD */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
      >
        {nextCursor && (
          <div className="text-center pb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLoadOlder}
              disabled={loadingMore}
              className="text-xs text-muted-foreground hover:text-foreground h-7"
            >
              {loadingMore ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
              ) : null}
              Load older messages
            </Button>
          </div>
        )}

        {loadingMessages ? (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-2">
            <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center text-xl">
              💬
            </div>
            <p className="font-semibold text-sm text-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Say hello and start the conversation!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isSelf = msg.senderId === currentUserId
            const isDeleted = !!msg.deletedAt

            // Group reactions by emoji
            const reactionCounts = msg.reactions.reduce<Record<string, { count: number; users: string[] }>>(
              (acc, r) => {
                if (!acc[r.emoji]) acc[r.emoji] = { count: 0, users: [] }
                acc[r.emoji].count++
                acc[r.emoji].users.push(r.userId)
                return acc
              },
              {}
            )

            return (
              <div
                key={msg.id}
                id={`msg-${msg.id}`}
                className={`group flex gap-2.5 transition-colors rounded-lg p-1.5 ${
                  isSelf ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {/* Avatar */}
                {!isSelf && (
                  <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                    <AvatarImage src={msg.sender.image || ''} alt={msg.sender.name} />
                    <AvatarFallback className="text-[10px]">
                      {getInitials(msg.sender.name)}
                    </AvatarFallback>
                  </Avatar>
                )}

                {/* Bubble Container */}
                <div
                  className={`flex flex-col max-w-[85%] sm:max-w-[70%] ${
                    isSelf ? 'items-end' : 'items-start'
                  }`}
                >
                  {/* Sender Name in group */}
                  {!isSelf && isGroup && (
                    <span className="text-[10px] font-medium text-muted-foreground ml-1 mb-0.5">
                      {msg.sender.name}
                    </span>
                  )}

                  {/* Reply Reference Bubble */}
                  {msg.replyTo && (
                    <button
                      type="button"
                      onClick={() => scrollToMessage(msg.replyTo!.id)}
                      className="text-left text-[11px] mb-1 px-2.5 py-1 rounded bg-muted/60 border-l-2 border-indigo-500 text-muted-foreground max-w-full truncate hover:bg-muted transition-colors cursor-pointer"
                    >
                      <span className="font-semibold text-foreground/80 mr-1">
                        ↳ {msg.replyTo.senderName}:
                      </span>
                      <span>{msg.replyTo.content}</span>
                    </button>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={`relative px-3.5 py-2 rounded-2xl text-xs leading-relaxed ${
                      isSelf
                        ? 'bg-indigo-600 text-white rounded-tr-xs'
                        : 'bg-muted/80 text-foreground border border-border/40 rounded-tl-xs'
                    } ${isDeleted ? 'italic text-muted-foreground bg-muted/40' : ''}`}
                  >
                    {/* In-place edit mode */}
                    {editingMessage?.id === msg.id ? (
                      <div className="space-y-2 py-1 min-w-[220px]">
                        <Input
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="text-xs h-8 bg-background text-foreground"
                          autoFocus
                        />
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingMessage(null)}
                            className="h-6 text-[10px] px-2"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSaveEdit}
                            className="h-6 text-[10px] px-2 bg-indigo-500 text-white"
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>

                        {/* Attachments */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-2 space-y-1.5">
                            {msg.attachments.map((att, idx) => {
                              const isImage = att.mimeType.startsWith('image/')
                              if (isImage) {
                                return (
                                  <div
                                    key={idx}
                                    onClick={() => setPreviewImageUrl(att.url)}
                                    className="relative w-48 h-36 rounded-lg overflow-hidden border border-border/50 cursor-pointer hover:opacity-95 transition-opacity"
                                  >
                                    <img
                                      src={att.url}
                                      alt={att.name}
                                      className="object-cover w-full h-full"
                                    />
                                  </div>
                                )
                              }
                              return (
                                <a
                                  key={idx}
                                  href={att.url}
                                  download={att.name}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`flex items-center gap-2 p-2 rounded-lg border text-[11px] transition-colors ${
                                    isSelf
                                      ? 'bg-indigo-700/60 border-indigo-500 text-white hover:bg-indigo-700'
                                      : 'bg-card border-border hover:bg-muted'
                                  }`}
                                >
                                  <FileText className="h-4 w-4 shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate font-medium">{att.name}</p>
                                    <p className="text-[9px] opacity-75">{formatBytes(att.size)}</p>
                                  </div>
                                  <Download className="h-3.5 w-3.5 shrink-0 opacity-80" />
                                </a>
                              )
                            })}
                          </div>
                        )}
                      </>
                    )}

                    {/* Metadata: time + edited + receipts */}
                    <div
                      className={`flex items-center gap-1 mt-1 text-[9px] select-none justify-end ${
                        isSelf ? 'text-indigo-200' : 'text-muted-foreground'
                      }`}
                    >
                      {msg.editedAt && <span>(edited)</span>}
                      <span>
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>

                      {isSelf && (
                        <span>
                          {msg.sending ? (
                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          ) : msg.failed ? (
                            <span className="text-rose-300 font-bold">Failed</span>
                          ) : msg.reads && msg.reads.length > 0 ? (
                            <span title="Read"><CheckCheck className="h-3 w-3 text-sky-200" /></span>
                          ) : (
                            <span title="Sent"><Check className="h-3 w-3" /></span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Failed message retry */}
                  {msg.failed && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRetryMessage(msg)}
                      className="text-[10px] text-rose-500 hover:text-rose-600 h-5 px-1 mt-0.5"
                    >
                      Message failed to send. Click to retry.
                    </Button>
                  )}

                  {/* Reactions row */}
                  {Object.keys(reactionCounts).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {Object.entries(reactionCounts).map(([emoji, { count, users }]) => {
                        const hasReacted = users.includes(currentUserId)
                        return (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleToggleReaction(msg.id, emoji)}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] border transition-colors ${
                              hasReacted
                                ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-950 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
                                : 'bg-card border-border hover:bg-muted text-foreground'
                            }`}
                          >
                            <span>{emoji}</span>
                            <span className="text-[10px] font-semibold">{count}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Hover Action Toolbar */}
                {!isDeleted && (
                  <div
                    className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0 self-center ${
                      isSelf ? 'mr-1' : 'ml-1'
                    }`}
                  >
                    {/* Quick Reactions */}
                    <div className="hidden sm:flex items-center bg-card border border-border rounded-full p-0.5 shadow-xs">
                      {COMMON_REACTIONS.slice(0, 3).map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleToggleReaction(msg.id, emoji)}
                          className="hover:scale-125 px-1 py-0.5 text-xs transition-transform"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>

                    {/* Reply */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setReplyingTo(msg)}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      title="Reply"
                    >
                      <Reply className="h-3.5 w-3.5" />
                    </Button>

                    {/* Edit (own message only) */}
                    {isSelf && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingMessage(msg)
                          setEditContent(msg.content)
                        }}
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="Edit"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    {/* Delete (own message or group admin) */}
                    {isSelf && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* TYPING INDICATOR BANNER */}
      {typingUsers.length > 0 && (
        <div className="px-4 py-1 text-[11px] text-muted-foreground bg-muted/30 italic flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
          <span>
            {typingUsers.length === 1
              ? `${typingUsers[0]} is typing...`
              : `${typingUsers.join(', ')} are typing...`}
          </span>
        </div>
      )}

      {/* REPLY PREVIEW BANNER */}
      {replyingTo && (
        <div className="px-4 py-2 bg-muted/60 border-t border-border flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Reply className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
            <div className="truncate">
              <span className="font-semibold text-foreground">
                Replying to {replyingTo.sender.name}:{' '}
              </span>
              <span className="text-muted-foreground">{replyingTo.content}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setReplyingTo(null)}
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* PENDING ATTACHMENTS CHIP LIST */}
      {pendingAttachments.length > 0 && (
        <div className="px-4 py-2 border-t border-border bg-card flex flex-wrap gap-2">
          {pendingAttachments.map((att, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1.5 bg-muted rounded-md px-2.5 py-1 text-xs text-foreground border border-border"
            >
              <FileText className="h-3.5 w-3.5 text-indigo-600" />
              <span className="truncate max-w-[140px] font-medium">{att.name}</span>
              <button
                type="button"
                onClick={() =>
                  setPendingAttachments((prev) => prev.filter((_, i) => i !== idx))
                }
                className="text-muted-foreground hover:text-foreground ml-1"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* COMPOSER */}
      <div className="p-3 border-t border-border bg-card">
        <form onSubmit={handleSendMessage} className="flex items-end gap-2">
          {/* File input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            multiple
            className="hidden"
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingFile}
            className="h-9 w-9 text-muted-foreground hover:text-foreground shrink-0"
            title="Attach file"
          >
            {uploadingFile ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
          </Button>

          {/* Quick Emoji Picker Button */}
          <div className="relative">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setEmojiPickerOpen(!emojiPickerOpen)}
              className="h-9 w-9 text-muted-foreground hover:text-foreground shrink-0"
              title="Add emoji"
            >
              <Smile className="h-4 w-4" />
            </Button>

            {emojiPickerOpen && (
              <div className="absolute bottom-11 left-0 z-50 bg-card border border-border rounded-xl shadow-lg p-2 flex gap-1 bg-popover">
                {COMMON_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setInputText((prev) => prev + emoji)
                      setEmojiPickerOpen(false)
                    }}
                    className="h-8 w-8 hover:bg-muted rounded text-base flex items-center justify-center transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Text input area */}
          <div className="flex-1 min-w-0">
            <textarea
              value={inputText}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
              rows={1}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500 max-h-32 min-h-[38px]"
            />
          </div>

          {/* Send button */}
          <Button
            type="submit"
            size="icon"
            disabled={sending || (!inputText.trim() && pendingAttachments.length === 0)}
            className="h-9 w-9 bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 rounded-lg"
            title="Send message"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>

      {/* MODALS */}
      <ImagePreviewModal
        open={!!previewImageUrl}
        onOpenChange={(open) => !open && setPreviewImageUrl(null)}
        imageUrl={previewImageUrl}
      />

      {isGroup && (
        <GroupInfoModal
          open={groupInfoOpen}
          onOpenChange={setGroupInfoOpen}
          conversation={conversationDetails}
          currentUserId={currentUserId}
          onConversationUpdated={onConversationUpdated}
          onLeaveConversation={onLeaveConversation}
        />
      )}
    </div>
  )
}
