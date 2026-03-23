"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSocketServer = void 0;
const socket_io_1 = require("socket.io");
const database_1 = require("../config/database");
const firebase_user_1 = require("../lib/firebase-user");
const logger_1 = require("../utils/logger");
const realtime_1 = require("../utils/realtime");
const getAllowedOrigins = () => {
    return [
        process.env.FRONTEND_URL?.replace(/\/$/, ''),
        'http://localhost:5174',
        'http://localhost:3000',
        'http://localhost:3001',
        'https://de-q-restaurants-frontend.vercel.app',
        'https://bite.dequeue.co.in',
        'https://demo.bite.dequeue.co.in',
    ].filter(Boolean);
};
const resolveRestaurantId = async (identifier) => {
    if (!identifier)
        return null;
    const normalized = identifier.trim().toLowerCase();
    if (!normalized)
        return null;
    const restaurant = await database_1.prisma.restaurant.findFirst({
        where: {
            active: true,
            OR: [{ id: normalized }, { slug: normalized }, { subdomain: normalized }],
        },
        select: { id: true },
    });
    return restaurant?.id || null;
};
const authenticateSocket = async (socket, next) => {
    try {
        const token = socket.handshake.auth?.['token'] ||
            socket.handshake.query?.['token'];
        if (!token) {
            return next(new Error('Unauthorized'));
        }
        const user = await (0, firebase_user_1.ensureAuthenticatedUserFromToken)(token);
        socket.data.userId = user.id;
        socket.data.userRole = user.role;
        return next();
    }
    catch (error) {
        return next(new Error('Unauthorized'));
    }
};
const joinRestaurantRoom = async (socket, restaurant) => {
    const restaurantId = await resolveRestaurantId(restaurant);
    if (!restaurantId)
        return;
    socket.join(`restaurant:${restaurantId}`);
    socket.data.restaurantId = restaurantId;
};
const initSocketServer = (server) => {
    const io = new socket_io_1.Server(server, {
        cors: {
            origin: (origin, callback) => {
                const allowedOrigins = getAllowedOrigins();
                if (!origin)
                    return callback(null, true);
                if (allowedOrigins.includes(origin.replace(/\/$/, ''))) {
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
        const userId = socket.data.userId;
        if (userId) {
            socket.join(`user:${userId}`);
        }
        socket.on('restaurant.join', async (payload) => {
            await joinRestaurantRoom(socket, payload?.restaurant || null);
        });
        socket.on('restaurant.leave', async (payload) => {
            const restaurantId = await resolveRestaurantId(payload?.restaurant || null);
            if (!restaurantId)
                return;
            socket.leave(`restaurant:${restaurantId}`);
            if (socket.data.restaurantId === restaurantId) {
                socket.data.restaurantId = undefined;
            }
        });
    });
    (0, realtime_1.setSocketServer)(io);
    logger_1.logger.info('Socket.io server initialized');
    return io;
};
exports.initSocketServer = initSocketServer;
//# sourceMappingURL=socket.js.map