'use client'

import { io, Socket } from 'socket.io-client'

let socketInstance: Socket | null = null

export function getSocketClient(user?: { id: string; name: string }): Socket {
  if (socketInstance) {
    if (user && !socketInstance.connected && !socketInstance.active) {
      socketInstance.auth = { userId: user.id, name: user.name }
      socketInstance.connect()
    }
    return socketInstance
  }

  const socketUrl =
    process.env.NEXT_PUBLIC_SOCKET_URL ||
    (typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:3001`
      : 'http://localhost:3001')

  socketInstance = io(socketUrl, {
    autoConnect: !!user,
    auth: user ? { userId: user.id, name: user.name } : {},
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    transports: ['websocket', 'polling'],
  })

  return socketInstance
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect()
    socketInstance = null
  }
}

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

export function useSocket(): Socket | null {
  const { data: session } = useSession()
  const [socket, setSocket] = useState<Socket | null>(null)

  useEffect(() => {
    if (session?.user?.id) {
      const s = getSocketClient({ id: session.user.id, name: session.user.name || 'User' })
      setSocket(s)
    }
  }, [session?.user?.id, session?.user?.name])

  return socket
}

