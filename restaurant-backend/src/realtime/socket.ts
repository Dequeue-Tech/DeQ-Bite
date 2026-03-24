import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { prisma } from '@/config/database';
import { ensureAuthenticatedUserFromToken } from '@/lib/firebase-user';
import { logger } from '@/utils/logger';
import { setSocketServer } from '@/utils/realtime';

const getAllowedOrigins = () => {
  return [
    process.env.FRONTEND_URL?.replace(/\/$/, ''),
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'http://localhost:3001',
    'https://bite-delivery.dequeue.co.in',
    'https://de-q-restaurants-frontend.vercel.app',
    'https://bite.dequeue.co.in',
    'https://demo.bite.dequeue.co.in',
  ].filter(Boolean) as string[];
};

const isAllowedOrigin = (origin: string, allowedOrigins: string[]) => {
  if (allowedOrigins.includes(origin)) return true;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== 'https:') return false;
    return parsed.hostname === 'bite.dequeue.co.in' || parsed.hostname.endsWith('.bite.dequeue.co.in');
  } catch {
    return false;
  }
};

const resolveRestaurantId = async (identifier?: string | null) => {
  if (!identifier) return null;
  const normalized = identifier.trim().toLowerCase();
  if (!normalized) return null;

  const restaurant = await prisma.restaurant.findFirst({
    where: {
      active: true,
      OR: [{ id: normalized }, { slug: normalized }, { subdomain: normalized }],
    },
    select: { id: true },
  });

  return restaurant?.id || null;
};

const authenticateSocket = async (socket: Socket, next: (err?: Error) => void) => {
  try {
    const token =
      (socket.handshake.auth?.['token'] as string | undefined) ||
      (socket.handshake.query?.['token'] as string | undefined);

    if (!token) {
      return next(new Error('Unauthorized'));
    }

    const user = await ensureAuthenticatedUserFromToken(token);

    socket.data.userId = user.id;
    socket.data.userRole = user.role;
    return next();
  } catch (error) {
    return next(new Error('Unauthorized'));
  }
};

const joinRestaurantRoom = async (socket: Socket, restaurant?: string | null) => {
  const restaurantId = await resolveRestaurantId(restaurant);
  if (!restaurantId) return;
  socket.join(`restaurant:${restaurantId}`);
  socket.data.restaurantId = restaurantId;
};

export const initSocketServer = (server: HttpServer) => {
  const io = new SocketIOServer(server, {
    cors: {
      origin: (origin, callback) => {
        const allowedOrigins = getAllowedOrigins();
        if (!origin) return callback(null, true);
        const normalizedOrigin = origin.replace(/\/$/, '');
        if (isAllowedOrigin(normalizedOrigin, allowedOrigins)) {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string | undefined;
    if (userId) {
      socket.join(`user:${userId}`);
    }

    socket.on('restaurant.join', async (payload?: { restaurant?: string }) => {
      await joinRestaurantRoom(socket, payload?.restaurant || null);
    });

    socket.on('restaurant.leave', async (payload?: { restaurant?: string }) => {
      const restaurantId = await resolveRestaurantId(payload?.restaurant || null);
      if (!restaurantId) return;
      socket.leave(`restaurant:${restaurantId}`);
      if (socket.data.restaurantId === restaurantId) {
        socket.data.restaurantId = undefined;
      }
    });
  });

  setSocketServer(io);
  logger.info('Socket.io server initialized');

  return io;
};
