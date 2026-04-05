import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';

const JWT_SECRET = process.env.JWT_SECRET;
let io = null;

export const initSocket = (httpServer, corsOrigin = []) => {
  if (io) return io;

  io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    },
    path: '/socket.io',
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const rawToken = String(token).replace('Bearer ', '');
      const decoded = jwt.verify(rawToken, JWT_SECRET);
      socket.userId = decoded.id;
      return next();
    } catch (error) {
      return next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[socket] connect ${socket.id} user:${socket.userId}`);
    if (socket.userId) {
      socket.join(socket.userId);
    }
  });

  return io;
};

export const getIo = () => io;
