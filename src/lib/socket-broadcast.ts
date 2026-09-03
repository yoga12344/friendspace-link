const INTERNAL_SOCKET_URL =
  process.env.SOCKET_INTERNAL_URL || 'http://127.0.0.1:3001'
const INTERNAL_SECRET =
  process.env.INTERNAL_SECRET || 'friendspace-internal-secret'

export async function emitSocketEvent(
  room: string | null,
  event: string,
  data: any
) {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2000)

    await fetch(`${INTERNAL_SOCKET_URL}/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${INTERNAL_SECRET}`,
      },
      body: JSON.stringify({ room, event, data }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
  } catch {
    // Non-blocking catch: if socket server is restarting or offline, REST endpoints succeed
  }
}
