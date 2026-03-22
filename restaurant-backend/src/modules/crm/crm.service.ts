import { Prisma, PrismaClient } from '@prisma/client';

const pointsPer100Rupees = Number(process.env['LOYALTY_POINTS_PER_100_RUPEES'] || 1);

type Tx = Prisma.TransactionClient | PrismaClient;
type ProfileShape = {
  totalOrders: number;
  totalSpendPaise: number;
  loyaltyPoints: number;
  lastOrderAt?: Date | null;
  createdAt?: Date;
};

export type CrmSegment = 'NEW' | 'LOYAL' | 'HIGH_VALUE' | 'AT_RISK' | 'REGULAR';

const DAY_MS = 24 * 60 * 60 * 1000;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const daysSince = (value: Date | null | undefined, now: Date) => {
  if (!value) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((now.getTime() - value.getTime()) / DAY_MS));
};

const computeTier = (totalSpendPaise: number) => {
  if (totalSpendPaise >= 1500000) return 'PLATINUM';
  if (totalSpendPaise >= 750000) return 'GOLD';
  if (totalSpendPaise >= 300000) return 'SILVER';
  return 'BRONZE';
};

const calculateEarnedPoints = (orderTotalPaise: number) => {
  const blocks = Math.floor(orderTotalPaise / 10000);
  return Math.max(0, blocks * pointsPer100Rupees);
};

export const classifyCrmSegment = (profile: ProfileShape, now = new Date()): CrmSegment => {
  const inactiveDays = daysSince(profile.lastOrderAt, now);
  const spendInr = profile.totalSpendPaise / 100;

  if (profile.totalOrders <= 2 && inactiveDays <= 21) return 'NEW';
  if (inactiveDays >= 45 && profile.totalOrders > 0) return 'AT_RISK';
  if (profile.totalOrders >= 8 || profile.loyaltyPoints >= 400) return 'LOYAL';
  if (spendInr >= 10000 || profile.totalOrders >= 12) return 'HIGH_VALUE';
  return 'REGULAR';
};

export const computeCrmHealth = (profile: ProfileShape, now = new Date()) => {
  const inactiveDays = daysSince(profile.lastOrderAt, now);
  const spendInr = profile.totalSpendPaise / 100;

  const recencyScore = inactiveDays === Number.POSITIVE_INFINITY ? 10 : clamp(100 - inactiveDays * 1.8, 10, 100);
  const frequencyScore = clamp(profile.totalOrders * 8, 10, 100);
  const monetaryScore = clamp((spendInr / 20000) * 100, 10, 100);
  const loyaltyScore = clamp((profile.loyaltyPoints / 800) * 100, 10, 100);

  const score = Math.round(recencyScore * 0.45 + frequencyScore * 0.25 + monetaryScore * 0.2 + loyaltyScore * 0.1);
  const risk = score >= 75 ? 'LOW' : score >= 45 ? 'MEDIUM' : 'HIGH';

  return {
    score,
    risk,
    inactiveDays: Number.isFinite(inactiveDays) ? inactiveDays : null,
  };
};

export const buildCrmSegmentsSummary = (
  profiles: ProfileShape[],
  now = new Date()
) => {
  const counts: Record<CrmSegment, number> = {
    NEW: 0,
    LOYAL: 0,
    HIGH_VALUE: 0,
    AT_RISK: 0,
    REGULAR: 0,
  };

  profiles.forEach((profile) => {
    counts[classifyCrmSegment(profile, now)] += 1;
  });

  const total = profiles.length || 1;
  return {
    totalCustomers: profiles.length,
    segments: Object.entries(counts).map(([segment, count]) => ({
      segment,
      count,
      sharePct: Math.round((count / total) * 100),
    })),
  };
};

export const syncCustomerOrderProfile = async (
  tx: Tx,
  params: {
    restaurantId: string;
    userId: string;
    orderId: string;
    totalPaise: number;
    couponId?: string | null;
    couponCode?: string | null;
    discountPaise?: number;
    createdByUserId?: string | undefined;
  }
) => {
  const existing = await tx.customerProfile.findUnique({
    where: {
      restaurantId_userId: {
        restaurantId: params.restaurantId,
        userId: params.userId,
      },
    },
  });

  const earnedPoints = calculateEarnedPoints(params.totalPaise);
  const totalSpendPaise = (existing?.totalSpendPaise || 0) + params.totalPaise;

  const profile = await tx.customerProfile.upsert({
    where: {
      restaurantId_userId: {
        restaurantId: params.restaurantId,
        userId: params.userId,
      },
    },
    update: {
      totalOrders: { increment: 1 },
      totalSpendPaise: { increment: params.totalPaise },
      loyaltyPoints: { increment: earnedPoints },
      lastOrderAt: new Date(),
      tier: computeTier(totalSpendPaise),
    },
    create: {
      restaurantId: params.restaurantId,
      userId: params.userId,
      totalOrders: 1,
      totalSpendPaise: params.totalPaise,
      loyaltyPoints: earnedPoints,
      lastOrderAt: new Date(),
      tier: computeTier(totalSpendPaise),
    },
  });

  if (earnedPoints > 0) {
    await tx.loyaltyLedger.create({
      data: {
        restaurantId: params.restaurantId,
        customerProfileId: profile.id,
        orderId: params.orderId,
        points: earnedPoints,
        type: 'EARN',
        reason: 'Points earned from POS order',
        createdByUserId: params.createdByUserId ?? null,
      },
    });
  }

  if (params.couponCode) {
    await tx.couponRedemption.create({
      data: {
        restaurantId: params.restaurantId,
        customerProfileId: profile.id,
        orderId: params.orderId,
        couponId: params.couponId || null,
        couponCode: params.couponCode,
        discountPaise: params.discountPaise || 0,
      },
    });
  }

  return profile;
};

export const redeemLoyaltyPoints = async (
  tx: Tx,
  params: {
    restaurantId: string;
    userId: string;
    points: number;
    reason?: string | undefined;
    createdByUserId?: string | undefined;
  }
) => {
  const profile = await tx.customerProfile.findUnique({
    where: {
      restaurantId_userId: {
        restaurantId: params.restaurantId,
        userId: params.userId,
      },
    },
  });

  if (!profile) {
    throw new Error('Customer profile not found');
  }

  if (params.points <= 0) {
    throw new Error('Points must be greater than 0');
  }

  if (profile.loyaltyPoints < params.points) {
    throw new Error('Insufficient loyalty points');
  }

  const updated = await tx.customerProfile.update({
    where: { id: profile.id },
    data: { loyaltyPoints: { decrement: params.points } },
  });

  await tx.loyaltyLedger.create({
    data: {
      restaurantId: params.restaurantId,
      customerProfileId: profile.id,
      points: -params.points,
      type: 'REDEEM',
      reason: params.reason || 'Loyalty redemption',
      createdByUserId: params.createdByUserId ?? null,
    },
  });

  return updated;
};
