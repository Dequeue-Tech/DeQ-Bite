"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getKOTOperationalSummary = exports.updateKOTPriority = exports.updateKOTStatus = exports.createKOTTicketForOrder = exports.KOTError = void 0;
const realtime_1 = require("../../utils/realtime");
const database_1 = require("../../config/database");
class KOTError extends Error {
    statusCode;
    constructor(message, statusCode = 400) {
        super(message);
        this.name = 'KOTError';
        this.statusCode = statusCode;
    }
}
exports.KOTError = KOTError;
const statusToOrderStatus = {
    PLACED: 'PENDING',
    PREPARING: 'PREPARING',
    READY: 'READY',
    SERVED: 'SERVED',
};
const transitions = {
    PLACED: ['PREPARING'],
    PREPARING: ['READY'],
    READY: ['SERVED'],
    SERVED: [],
};
const ACTIVE_STATUSES = ['PLACED', 'PREPARING', 'READY'];
const toMinutes = (from, to) => Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));
const average = (values) => {
    if (values.length === 0)
        return 0;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
};
const createKOTTicketForOrder = async (tx, params) => {
    const existing = await tx.kOTTicket.findUnique({ where: { orderId: params.orderId } });
    if (existing)
        return existing;
    const ticket = await tx.kOTTicket.create({
        data: {
            restaurantId: params.restaurantId,
            orderId: params.orderId,
            status: 'PLACED',
            priority: params.priority ?? 0,
            notes: params.note || null,
            createdByUserId: params.createdByUserId ?? null,
        },
    });
    await tx.kOTTicketEvent.create({
        data: {
            restaurantId: params.restaurantId,
            kotTicketId: ticket.id,
            toStatus: 'PLACED',
            changedByUserId: params.createdByUserId ?? null,
            note: params.note || 'KOT created from order placement',
        },
    });
    return ticket;
};
exports.createKOTTicketForOrder = createKOTTicketForOrder;
const updateKOTStatus = async (params) => {
    const result = await database_1.prisma.$transaction(async (tx) => {
        const ticket = await tx.kOTTicket.findFirst({
            where: {
                restaurantId: params.restaurantId,
                orderId: params.orderId,
            },
            include: {
                order: {
                    include: {
                        items: { include: { menuItem: true } },
                        table: true,
                    },
                },
            },
        });
        if (!ticket) {
            throw new KOTError('KOT ticket not found', 404);
        }
        const fromStatus = ticket.status;
        if (fromStatus === params.status) {
            return ticket;
        }
        if (!transitions[fromStatus].includes(params.status)) {
            throw new KOTError(`Invalid KOT transition: ${fromStatus} -> ${params.status}`, 400);
        }
        const now = new Date();
        const updated = await tx.kOTTicket.update({
            where: { id: ticket.id },
            data: {
                status: params.status,
                preparingAt: params.status === 'PREPARING' ? now : ticket.preparingAt,
                readyAt: params.status === 'READY' ? now : ticket.readyAt,
                servedAt: params.status === 'SERVED' ? now : ticket.servedAt,
            },
            include: {
                order: {
                    include: {
                        items: { include: { menuItem: true } },
                        table: true,
                    },
                },
            },
        });
        await tx.kOTTicketEvent.create({
            data: {
                restaurantId: params.restaurantId,
                kotTicketId: ticket.id,
                fromStatus,
                toStatus: params.status,
                changedByUserId: params.changedByUserId ?? null,
                note: params.note ?? null,
            },
        });
        await tx.order.update({
            where: { id: params.orderId },
            data: {
                status: statusToOrderStatus[params.status],
            },
        });
        return updated;
    });
    (0, realtime_1.emitRestaurantEvent)(params.restaurantId, {
        type: 'kot.updated',
        payload: {
            ticket: result,
            orderId: params.orderId,
            status: params.status,
        },
    });
    return result;
};
exports.updateKOTStatus = updateKOTStatus;
const updateKOTPriority = async (params) => {
    if (!Number.isInteger(params.priority) || params.priority < -5 || params.priority > 5) {
        throw new KOTError('Priority must be an integer between -5 and 5', 400);
    }
    const result = await database_1.prisma.$transaction(async (tx) => {
        const ticket = await tx.kOTTicket.findFirst({
            where: {
                restaurantId: params.restaurantId,
                orderId: params.orderId,
            },
            include: {
                order: {
                    include: {
                        items: { include: { menuItem: true } },
                        table: true,
                    },
                },
            },
        });
        if (!ticket) {
            throw new KOTError('KOT ticket not found', 404);
        }
        if (ticket.priority === params.priority && !params.note?.trim()) {
            return ticket;
        }
        const updated = await tx.kOTTicket.update({
            where: { id: ticket.id },
            data: {
                priority: params.priority,
                notes: params.note?.trim() ? params.note.trim() : ticket.notes,
            },
            include: {
                order: {
                    include: {
                        items: { include: { menuItem: true } },
                        table: true,
                    },
                },
            },
        });
        await tx.kOTTicketEvent.create({
            data: {
                restaurantId: params.restaurantId,
                kotTicketId: ticket.id,
                fromStatus: ticket.status,
                toStatus: ticket.status,
                changedByUserId: params.changedByUserId ?? null,
                note: `Priority ${ticket.priority} -> ${params.priority}${params.note?.trim() ? ` | ${params.note.trim()}` : ''}`,
            },
        });
        return updated;
    });
    (0, realtime_1.emitRestaurantEvent)(params.restaurantId, {
        type: 'kot.priority.updated',
        payload: {
            ticket: result,
            orderId: params.orderId,
            priority: params.priority,
        },
    });
    return result;
};
exports.updateKOTPriority = updateKOTPriority;
const getKOTOperationalSummary = async (params) => {
    const now = params.now || new Date();
    const configuredThreshold = Number(process.env['KOT_OVERDUE_MINUTES'] || 20);
    const overdueThresholdMinutes = Math.max(5, params.overdueThresholdMinutes ?? configuredThreshold);
    const activeTickets = await database_1.prisma.kOTTicket.findMany({
        where: {
            restaurantId: params.restaurantId,
            status: {
                in: ACTIVE_STATUSES,
            },
        },
        include: {
            order: {
                include: {
                    table: true,
                    user: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    items: {
                        select: {
                            id: true,
                            quantity: true,
                        },
                    },
                },
            },
        },
        orderBy: [{ priority: 'desc' }, { updatedAt: 'asc' }],
    });
    const byStatus = {
        PLACED: 0,
        PREPARING: 0,
        READY: 0,
        SERVED: 0,
    };
    const ticketAges = activeTickets.map((ticket) => {
        const status = ticket.status;
        byStatus[status] += 1;
        const stageStartedAt = status === 'PREPARING'
            ? ticket.preparingAt || ticket.placedAt
            : status === 'READY'
                ? ticket.readyAt || ticket.preparingAt || ticket.placedAt
                : ticket.placedAt;
        const minutesOpen = toMinutes(ticket.placedAt, now);
        const minutesInStage = toMinutes(stageStartedAt, now);
        const overdue = minutesOpen >= overdueThresholdMinutes;
        return {
            id: ticket.id,
            orderId: ticket.orderId,
            status,
            priority: ticket.priority,
            placedAt: ticket.placedAt,
            tableNumber: ticket.order.table.number,
            customerName: ticket.order.user?.name || 'Walk-in',
            itemCount: ticket.order.items.reduce((sum, item) => sum + item.quantity, 0),
            minutesOpen,
            minutesInStage,
            overdue,
        };
    });
    const servedOneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const servedLastHour = await database_1.prisma.kOTTicket.count({
        where: {
            restaurantId: params.restaurantId,
            status: 'SERVED',
            servedAt: {
                gte: servedOneHourAgo,
            },
        },
    });
    const dayStart = new Date(now);
    dayStart.setUTCHours(0, 0, 0, 0);
    const servedToday = await database_1.prisma.kOTTicket.findMany({
        where: {
            restaurantId: params.restaurantId,
            status: 'SERVED',
            servedAt: {
                gte: dayStart,
            },
        },
        select: {
            placedAt: true,
            preparingAt: true,
            readyAt: true,
            servedAt: true,
        },
    });
    const prepDurations = servedToday
        .map((ticket) => {
        if (!ticket.preparingAt)
            return null;
        const end = ticket.readyAt || ticket.servedAt;
        if (!end)
            return null;
        return toMinutes(ticket.preparingAt, end);
    })
        .filter((value) => typeof value === 'number');
    const fulfillmentDurations = servedToday
        .map((ticket) => {
        if (!ticket.servedAt)
            return null;
        return toMinutes(ticket.placedAt, ticket.servedAt);
    })
        .filter((value) => typeof value === 'number');
    const overdueCount = ticketAges.filter((ticket) => ticket.overdue).length;
    const avgTicketAgeMinutes = average(ticketAges.map((ticket) => ticket.minutesOpen));
    return {
        generatedAt: now,
        thresholdMinutes: overdueThresholdMinutes,
        queue: {
            totalActive: activeTickets.length,
            byStatus,
            overdueCount,
            avgTicketAgeMinutes,
            throughputLastHour: servedLastHour,
            avgPrepMinutesToday: average(prepDurations),
            avgFulfillmentMinutesToday: average(fulfillmentDurations),
        },
        topAgingTickets: ticketAges.sort((a, b) => b.minutesOpen - a.minutesOpen).slice(0, 12),
    };
};
exports.getKOTOperationalSummary = getKOTOperationalSummary;
//# sourceMappingURL=kot.service.js.map