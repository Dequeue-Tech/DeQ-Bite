import { prisma } from '@/config/database';
import { Prisma } from '@prisma/client';
import { verifyFirebaseIdToken } from '@/lib/firebase-admin';
import { AppError } from '@/middleware/errorHandler';

const FALLBACK_FIREBASE_PASSWORD = 'firebase-managed-account';
const PLACEHOLDER_EMAIL_DOMAIN = 'deq-firebase.local';
let firebaseUidColumnAvailable = true;

const userSelect = {
  id: true,
  email: true,
  phone: true,
  name: true,
  password: true,
  role: true,
  verified: true,
  createdAt: true,
  updatedAt: true,
} as const;

const isMissingFirebaseUidColumnError = (error: unknown): boolean => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code !== 'P2022') {
    return false;
  }

  const column = (error.meta as { column?: string } | undefined)?.column;
  return typeof column === 'string' && column.includes('firebaseUid');
};

type DecodedTokenLike = {
  uid?: string;
  email?: string;
  email_verified?: boolean;
  phone_number?: string;
  name?: string;
};

const normalizeEmail = (email?: string) => {
  const normalized = email?.trim().toLowerCase();
  return normalized || null;
};

const normalizePhone = (phone?: string) => {
  const normalized = phone?.trim().replace(/\s+/g, '');
  return normalized || null;
};

const buildPlaceholderEmail = (uid: string, phone?: string | null) => {
  const uidPart = uid.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 28) || 'firebase-user';
  const phonePart = (phone || '').replace(/[^0-9+]/g, '').replace(/\+/g, 'p').slice(-8);
  const suffix = phonePart ? `-${phonePart}` : '';
  return `${uidPart}${suffix}@${PLACEHOLDER_EMAIL_DOMAIN}`;
};

const isPlaceholderEmail = (email: string) => email.toLowerCase().endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`);

const inferUserName = (decoded: DecodedTokenLike, email: string | null, phone: string | null) => {
  const fromToken = decoded.name?.trim();
  if (fromToken) return fromToken;
  if (email) return email.split('@')[0] || 'Customer';
  if (phone) return `User ${phone.slice(-4)}`;
  return 'Customer';
};

const ensureUniquePhoneForUser = async (userId: string, phone: string) => {
  const owner = await prisma.user.findUnique({
    where: { phone },
    select: { id: true },
  });
  return !owner || owner.id === userId;
};

const ensureUniqueEmailForUser = async (userId: string, email: string) => {
  const owner = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  return !owner || owner.id === userId;
};

const getOrCreateUserFromDecodedToken = async (decoded: DecodedTokenLike) => {
  const uid = decoded.uid?.trim();
  if (!uid) {
    throw new AppError('Invalid Firebase token.', 401);
  }

  const normalizedEmail = normalizeEmail(decoded.email);
  const normalizedPhone = normalizePhone(decoded.phone_number);
  const emailVerified = Boolean(decoded.email_verified);

  let user:
    | {
        id: string;
        email: string;
        phone: string | null;
        name: string;
        password: string;
        role: 'CUSTOMER' | 'OWNER' | 'ADMIN' | 'STAFF' | 'CENTRAL_ADMIN' | 'KITCHEN_STAFF';
        verified: boolean;
        createdAt: Date;
        updatedAt: Date;
      }
    | null = null;

  if (firebaseUidColumnAvailable) {
    try {
      user = await prisma.user.findUnique({
        where: { firebaseUid: uid },
        select: userSelect,
      });
    } catch (error) {
      if (isMissingFirebaseUidColumnError(error)) {
        firebaseUidColumnAvailable = false;
      } else {
        throw error;
      }
    }
  }

  if (!user && normalizedEmail) {
    user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: userSelect,
    });
  }

  if (!user && normalizedPhone) {
    user = await prisma.user.findUnique({
      where: { phone: normalizedPhone },
      select: userSelect,
    });
  }

  if (user) {
    const updateData: {
      verified?: boolean;
      phone?: string;
      email?: string;
      name?: string;
    } = {};

    if (emailVerified && !user.verified) {
      updateData.verified = true;
    }

    if (normalizedPhone && user.phone !== normalizedPhone) {
      const canUsePhone = await ensureUniquePhoneForUser(user.id, normalizedPhone);
      if (canUsePhone) {
        updateData.phone = normalizedPhone;
      }
    }

    if (normalizedEmail && user.email !== normalizedEmail && isPlaceholderEmail(user.email)) {
      const canUseEmail = await ensureUniqueEmailForUser(user.id, normalizedEmail);
      if (canUseEmail) {
        updateData.email = normalizedEmail;
      }
    }

    if ((!user.name || user.name.trim().length < 2) && decoded.name?.trim()) {
      updateData.name = decoded.name.trim();
    }

    if (Object.keys(updateData).length > 0) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: updateData,
        select: userSelect,
      });
    }

    return user;
  }

  const emailForUser = normalizedEmail || buildPlaceholderEmail(uid, normalizedPhone);
  const userName = inferUserName(decoded, normalizedEmail, normalizedPhone);

  const baseData = {
    email: emailForUser,
    ...(normalizedPhone ? { phone: normalizedPhone } : {}),
    name: userName,
    password: FALLBACK_FIREBASE_PASSWORD,
    role: 'CUSTOMER' as const,
    verified: emailVerified || Boolean(normalizedPhone),
  };

  if (firebaseUidColumnAvailable) {
    try {
      return await prisma.user.create({
        data: {
          ...baseData,
          firebaseUid: uid,
        },
        select: userSelect,
      });
    } catch (error) {
      if (!isMissingFirebaseUidColumnError(error)) {
        throw error;
      }
      firebaseUidColumnAvailable = false;
    }
  }

  return prisma.user.create({
    data: baseData,
    select: userSelect,
  });
};

export const ensureAuthenticatedUserFromToken = async (token: string) => {
  const decoded = await verifyFirebaseIdToken(token);
  const user = await getOrCreateUserFromDecodedToken(decoded);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    verified: user.verified,
    phone: user.phone,
  };
};
