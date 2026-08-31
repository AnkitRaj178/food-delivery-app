import { Server } from 'socket.io'

// Build allowed-origins list from FRONTEND_URL env var (comma-separated).
// Falls back to localhost:5173 for local dev when the variable is not set.
function getAllowedOrigins() {
  return (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
}

let io

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: getAllowedOrigins(),
      methods: ['GET', 'POST'],
    },
  })


  io.on('connection', (socket) => {
    socket.on('join_room', (orderId) => {
      const room = typeof orderId === 'string' ? orderId.trim() : ''
      if (!room) return
      socket.join(room)
    })
  })

  return io
}

export function getIo() {
  if (!io) {
    throw new Error('Socket.io not initialized')
  }
  return io
}
