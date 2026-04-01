import { KOTStatus, Prisma, PrismaClient } from '@prisma/client';
import { emitRestaurantEvent } from '@/utils/realtime';
import { prisma } from '@/config/database';

export class KOTError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'KOTError';
    this.statusCode = statusCode;
  }
}

type Tx = Prisma.TransactionClient | PrismaClient;

const statusToOrderStatus: Record<KOTStatus, 'PENDING' | 'PREPARING' | 'READY' | 'SERVED'> = {
  PLACED: 'PENDING',
  PREPARING: 'PREPARING',
  READY: 'READY',
  SERVED: 'SERVED',
};

const transitions: Record<KOTStatus, KOTStatus[]> = {
  PLACED: ['PREPARING'],
  PREPARING: ['READY'],
  READY: ['SERVED'],
  SERVED: [],
};

const ACTIVE_STATUSES: KOTStatus[] = ['PLACED', 'PREPARING', 'READY'];
const staleWriteMessage = 'This order was just updated by someone else. Refreshing…';

const toMinutes = (from: Date, to: Date) => Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));

const average = (values: number[]) => {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
};

export const createKOTTicketForOrder = async (
  tx: Tx,
  params: {
    restaurantId: string;
    orderId: string;
    priority?: number;
    note?: string | undefined;
    createdByUserId?: string | undefined;
  }
) => {
  const existing = await tx.kOTTicket.findUnique({ where: { orderId: params.orderId } });
  if (existing) return existing;

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

export const updateKOTStatus = async (params: {
  restaurantId: string;
  orderId: string;
  status: KOTStatus;
  changedByUserId?: string | undefined;
  note?: string | undefined;
  expectedOrderUpdatedAt?: string | undefined;
}) => {
  if (!params.restaurantId?.trim()) {
    throw new KOTError('Restaurant ID is required', 400);
  }
  if (!params.orderId?.trim()) {
    throw new KOTError('Order ID is required', 400);
  }

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
    if (params.expectedOrderUpdatedAt) {
      const expected = new Date(params.expectedOrderUpdatedAt);
      if (Number.isNaN(expected.getTime())) {
        throw new KOTError('Invalid expectedOrderUpdatedAt', 400);
      }
      if (ticket.order.updatedAt.getTime() !== expected.getTime()) {
        throw new KOTError(staleWriteMessage, 409);
      }
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

    const updatedOrder = await tx.order.update({
      where: { id: ticket.orderId },
      data: {
        status: statusToOrderStatus[params.status],
      },
      include: {
        table: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            menuItem: true,
          },
        },
      },
    });

    return { ticket: updated, order: updatedOrder };
  });

  emitRestaurantEvent(params.restaurantId, {
    type: 'kot.updated',
    payload: {
      ticket: result.ticket,
      orderId: params.orderId,
      status: params.status,
    },
  });
  emitRestaurantEvent(params.restaurantId, {
    type: 'order.updated',
    userId: result.order.userId,
    payload: {
      order: {
        id: result.order.id,
        orderId: result.order.id,
        order_id: result.order.id,
        userId: result.order.userId,
        tableId: result.order.tableId,
        status: result.order.status,
        paymentStatus: result.order.paymentStatus,
        paymentProvider: result.order.paymentProvider,
        paidAmountPaise: result.order.paidAmountPaise,
        dueAmountPaise: result.order.dueAmountPaise,
        totalPaise: result.order.totalPaise,
        updatedAt: result.order.updatedAt,
        createdAt: result.order.createdAt,
        table: result.order.table,
        user: result.order.user,
        items: result.order.items,
        subtotalPaise: result.order.subtotalPaise,
        taxPaise: result.order.taxPaise,
        discountPaise: result.order.discountPaise,
      },
    },
  });

  return result.ticket;
};

export const updateKOTPriority = async (params: {
  restaurantId: string;
  orderId: string;
  priority: number;
  changedByUserId?: string | undefined;
  note?: string | undefined;
}) => {
  if (!params.restaurantId?.trim()) {
    throw new KOTError('Restaurant ID is required', 400);
  }
  if (!params.orderId?.trim()) {
    throw new KOTError('Order ID is required', 400);
  }

  if (!Number.isInteger(params.priority) || params.priority < -5 || params.priority > 5) {
    throw new KOTError('Priority must be an integer between -5 and 5', 400);
  }

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

  emitRestaurantEvent(params.restaurantId, {
    type: 'kot.priority.updated',
    payload: {
      ticket: result,
      orderId: params.orderId,
      priority: params.priority,
    },
  });

  return result;
};

export const getKOTOperationalSummary = async (params: {
  restaurantId: string;
  now?: Date;
  overdueThresholdMinutes?: number;
}) => {
  const now = params.now || new Date();
  const configuredThreshold = Number(process.env['KOT_OVERDUE_MINUTES'] || 20);
  const overdueThresholdMinutes = Math.max(5, params.overdueThresholdMinutes ?? configuredThreshold);

  const activeTickets = await prisma.kOTTicket.findMany({
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

  const byStatus: Record<KOTStatus, number> = {
    PLACED: 0,
    PREPARING: 0,
    READY: 0,
    SERVED: 0,
  };

  const ticketAges = activeTickets.map((ticket: any) => {
    const status = ticket.status as KOTStatus;
    byStatus[status] += 1;
    const stageStartedAt =
      status === 'PREPARING'
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
      itemCount: ticket.order.items.reduce((sum: number, item: any) => sum + item.quantity, 0),
      minutesOpen,
      minutesInStage,
      overdue,
    };
  });

  const servedOneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const servedLastHour = await prisma.kOTTicket.count({
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
  const servedToday = await prisma.kOTTicket.findMany({
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
    .map((ticket: any) => {
      if (!ticket.preparingAt) return null;
      const end = ticket.readyAt || ticket.servedAt;
      if (!end) return null;
      return toMinutes(ticket.preparingAt, end);
    })
    .filter((value: number | null): value is number => typeof value === 'number');

  const fulfillmentDurations = servedToday
    .map((ticket: any) => {
      if (!ticket.servedAt) return null;
      return toMinutes(ticket.placedAt, ticket.servedAt);
    })
    .filter((value: number | null): value is number => typeof value === 'number');

  const overdueCount = ticketAges.filter((ticket: any) => ticket.overdue).length;
  const avgTicketAgeMinutes = average(ticketAges.map((ticket: any) => ticket.minutesOpen));

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
    topAgingTickets: ticketAges.sort((a: any, b: any) => b.minutesOpen - a.minutesOpen).slice(0, 12),
  };
};
