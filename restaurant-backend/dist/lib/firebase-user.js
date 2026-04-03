"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureAuthenticatedUserFromToken = void 0;
const database_1 = require("../config/database");
const client_1 = require("@prisma/client");
const firebase_admin_1 = require("./firebase-admin");
const errorHandler_1 = require("../middleware/errorHandler");
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
};
const isMissingFirebaseUidColumnError = (error) => {
    if (!(error instanceof client_1.Prisma.PrismaClientKnownRequestError)) {
        return false;
    }
    if (error.code !== 'P2022') {
        return false;
    }
    const column = error.meta?.column;
    return typeof column === 'string' && column.includes('firebaseUid');
};
const normalizeEmail = (email) => {
    const normalized = email?.trim().toLowerCase();
    return normalized || null;
};
const normalizePhone = (phone) => {
    const normalized = phone?.trim().replace(/\s+/g, '');
    return normalized || null;
};
const buildPlaceholderEmail = (uid, phone) => {
    const uidPart = uid.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 28) || 'firebase-user';
    const phonePart = (phone || '').replace(/[^0-9+]/g, '').replace(/\+/g, 'p').slice(-8);
    const suffix = phonePart ? `-${phonePart}` : '';
    return `${uidPart}${suffix}@${PLACEHOLDER_EMAIL_DOMAIN}`;
};
const isPlaceholderEmail = (email) => email.toLowerCase().endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`);
const inferUserName = (decoded, email, phone) => {
    const fromToken = decoded.name?.trim();
    if (fromToken)
        return fromToken;
    if (email)
        return email.split('@')[0] || 'Customer';
    if (phone)
        return `User ${phone.slice(-4)}`;
    return 'Customer';
};
const ensureUniquePhoneForUser = async (userId, phone) => {
    const owner = await database_1.prisma.user.findUnique({
        where: { phone },
        select: { id: true },
    });
    return !owner || owner.id === userId;
};
const ensureUniqueEmailForUser = async (userId, email) => {
    const owner = await database_1.prisma.user.findUnique({
        where: { email },
        select: { id: true },
    });
    return !owner || owner.id === userId;
};
const getOrCreateUserFromDecodedToken = async (decoded) => {
    const uid = decoded.uid?.trim();
    if (!uid) {
        throw new errorHandler_1.AppError('Invalid Firebase token.', 401);
    }
    const normalizedEmail = normalizeEmail(decoded.email);
    const normalizedPhone = normalizePhone(decoded.phone_number);
    const emailVerified = Boolean(decoded.email_verified);
    let user = null;
    if (firebaseUidColumnAvailable) {
        try {
            user = await database_1.prisma.user.findUnique({
                where: { firebaseUid: uid },
                select: userSelect,
            });
        }
        catch (error) {
            if (isMissingFirebaseUidColumnError(error)) {
                firebaseUidColumnAvailable = false;
            }
            else {
                throw error;
            }
        }
    }
    if (!user && normalizedEmail) {
        user = await database_1.prisma.user.findUnique({
            where: { email: normalizedEmail },
            select: userSelect,
        });
    }
    if (!user && normalizedPhone) {
        user = await database_1.prisma.user.findUnique({
            where: { phone: normalizedPhone },
            select: userSelect,
        });
    }
    if (user) {
        const updateData = {};
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
            user = await database_1.prisma.user.update({
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
        role: 'CUSTOMER',
        verified: emailVerified || Boolean(normalizedPhone),
    };
    if (firebaseUidColumnAvailable) {
        try {
            return await database_1.prisma.user.create({
                data: {
                    ...baseData,
                    firebaseUid: uid,
                },
                select: userSelect,
            });
        }
        catch (error) {
            if (!isMissingFirebaseUidColumnError(error)) {
                throw error;
            }
            firebaseUidColumnAvailable = false;
        }
    }
    return database_1.prisma.user.create({
        data: baseData,
        select: userSelect,
    });
};
const ensureAuthenticatedUserFromToken = async (token) => {
    const decoded = await (0, firebase_admin_1.verifyFirebaseIdToken)(token);
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
exports.ensureAuthenticatedUserFromToken = ensureAuthenticatedUserFromToken;
//# sourceMappingURL=firebase-user.js.map