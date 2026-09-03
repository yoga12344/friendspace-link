import http from 'http'
import { Server as SocketIOServer, Socket } from 'socket.io'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
})

// Environment port support (standard on Render, Railway, Fly.io, etc.)
const PORT = process.env.PORT
  ? parseInt(process.env.PORT)
  : process.env.SOCKET_PORT
  ? parseInt(process.env.SOCKET_PORT)
  : 3001

const INTERNAL_SECRET =
  process.env.SOCKET_BROADCAST_SECRET ||
  process.env.INTERNAL_SECRET ||
  'friendspace-internal-secret'

// Configured allowed origins
const ALLOWED_ORIGINS: string[] = []
if (process.env.SOCKET_ALLOWED_ORIGIN) {
  ALLOWED_ORIGINS.push(...process.env.SOCKET_ALLOWED_ORIGIN.split(',').map((o) => o.trim()))
}
if (process.env.NEXT_PUBLIC_APP_URL) {
  ALLOWED_ORIGINS.push(process.env.NEXT_PUBLIC_APP_URL.trim())
}
// Default development origins
if (process.env.NODE_ENV !== 'production' || ALLOWED_ORIGINS.length === 0) {
  ALLOWED_ORIGINS.push('http://localhost:3000', 'http://127.0.0.1:3000')
}

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true // Allow non-browser requests or same-origin
  if (process.env.NODE_ENV !== 'production') return true
  return ALLOWED_ORIGINS.some((allowed) => allowed === origin || allowed === '*')
}

// Track active sockets per user: userId -> Set<socketId>
const userSockets = new Map<string, Set<string>>()
// Track user info per socket: socketId -> { id, name }
const socketUsers = new Map<string, { id: string; name: string }>()

const server = http.createServer(async (req, res) => {
  const requestOrigin = req.headers.origin

  // Check CORS for HTTP routes
  if (isOriginAllowed(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin || '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

  // Minimal public health check for load balancers & monitoring
  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok' }))
    return
  }

  // Internal Presence check endpoint
  if (req.method === 'GET' && url.pathname === '/presence') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ onlineUserIds: Array.from(userSockets.keys()) }))
    return
  }

  // Internal Broadcast endpoint called by Next.js API routes
  if (req.method === 'POST' && url.pathname === '/broadcast') {
    const authHeader = req.headers.authorization
    if (authHeader !== `Bearer ${INTERNAL_SECRET}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Unauthorized broadcast' }))
      return
    }

    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })

    req.on('end', () => {
      try {
        const { room, event, data } = JSON.parse(body)
        if (!event) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Event name is required' }))
          return
        }

        if (room) {
          io.to(room).emit(event, data)
        } else {
          io.emit(event, data)
        }

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true }))
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid JSON body' }))
      }
    })
    return
  }

  res.writeHead(404)
  res.end()
})

const io = new SocketIOServer(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true)
      } else {
        callback(new Error('CORS origin not allowed'))
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 30000,
  pingInterval: 10000,
})

// Authentication middleware for Socket.IO: verify user existence in DB
io.use(async (socket: Socket, next) => {
  const userId =
    socket.handshake.auth?.userId ||
    socket.handshake.query?.userId

  if (!userId || typeof userId !== 'string') {
    return next(new Error('Authentication required: Missing userId'))
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    })

    if (!user) {
      return next(new Error('Authentication failed: User does not exist'))
    }

    socket.data.userId = user.id
    socket.data.name = user.name || 'User'
    next()
  } catch (err: any) {
    // Database connection error during handshake
    console.error('Socket authentication DB error:', err?.message || err)
    next(new Error('Authentication error: Unable to verify user'))
  }
})

io.on('connection', (socket: Socket) => {
  const userId = socket.data.userId
  const name = socket.data.name

  // Register socket
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set())
    // Broadcast user is online
    io.emit('user.online', { userId, status: 'ONLINE' })
  }
  userSockets.get(userId)!.add(socket.id)
  socketUsers.set(socket.id, { id: userId, name })

  // Auto-join personal user room for direct notifications
  socket.join(`user:${userId}`)

  // Send current online users to the newly connected socket
  socket.emit('presence.sync', {
    onlineUserIds: Array.from(userSockets.keys()),
  })

  // Secure workspace room subscription: verify caller is an active workspace member
  socket.on('workspace.join', async ({ workspaceId }: { workspaceId: string }) => {
    if (!workspaceId) return
    try {
      const member = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId,
          },
        },
      })
      if (member) {
        socket.join(`workspace:${workspaceId}`)
      }
    } catch {
      // ignore
    }
  })

  // Secure room subscription: verify caller is an actual member of the conversation
  socket.on('conversation.join', async ({ conversationId }: { conversationId: string }) => {
    if (!conversationId) return

    try {
      const membership = await prisma.conversationMember.findUnique({
        where: {
          conversationId_userId: {
            conversationId,
            userId,
          },
        },
      })

      if (membership) {
        socket.join(`conversation:${conversationId}`)
      } else {
        socket.emit('error.unauthorized', {
          message: 'You are not a member of this conversation',
          conversationId,
        })
      }
    } catch {
      // ignore
    }
  })

  socket.on('conversation.leave', ({ conversationId }: { conversationId: string }) => {
    if (conversationId) {
      socket.leave(`conversation:${conversationId}`)
    }
  })

  // Real-time typing indicators
  socket.on('typing.start', ({ conversationId }: { conversationId: string }) => {
    if (!conversationId) return
    socket.to(`conversation:${conversationId}`).emit('typing.started', {
      conversationId,
      userId,
      name,
    })
  })

  socket.on('typing.stop', ({ conversationId }: { conversationId: string }) => {
    if (!conversationId) return
    socket.to(`conversation:${conversationId}`).emit('typing.stopped', {
      conversationId,
      userId,
    })
  })

  // Disconnect handler
  socket.on('disconnect', () => {
    socketUsers.delete(socket.id)
    const sockets = userSockets.get(userId)
    if (sockets) {
      sockets.delete(socket.id)
      if (sockets.size === 0) {
        userSockets.delete(userId)
        io.emit('user.offline', { userId, status: 'OFFLINE' })
      }
    }
  })
})

server.listen(PORT, () => {
  console.log(`⚡ Real-time Socket.IO Server running on port ${PORT}`)
})

// Graceful shutdown handlers
async function handleShutdown(signal: string) {
  console.log(`[Socket.IO Server] Received ${signal}. Shutting down gracefully...`)
  io.close(() => {
    server.close(async () => {
      await prisma.$disconnect()
      console.log('[Socket.IO Server] Shutdown complete.')
      process.exit(0)
    })
  })
  // Fallback timeout
  setTimeout(() => {
    console.error('[Socket.IO Server] Shutdown timed out. Forcing exit.')
    process.exit(1)
  }, 5000)
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'))
process.on('SIGINT', () => handleShutdown('SIGINT'))
