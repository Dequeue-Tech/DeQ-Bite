import { Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import { logger } from '@/utils/logger';

export const safeCreateAuditLog = async (data: Prisma.AuditLogCreateInput) => {
  try {
    await prisma.auditLog.create({ data });
  } catch (error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
      // Table doesn't exist yet (migrations not applied). Skip to avoid breaking core flows.
      logger.warn('Audit log table missing. Skipping audit log write.');
      return;
    }
    throw error;
  }
};
