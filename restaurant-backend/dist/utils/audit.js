"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeCreateAuditLog = void 0;
const client_1 = require("@prisma/client");
const database_1 = require("../config/database");
const logger_1 = require("./logger");
const safeCreateAuditLog = async (data) => {
    try {
        await database_1.prisma.auditLog.create({ data });
    }
    catch (error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
            logger_1.logger.warn('Audit log table missing. Skipping audit log write.');
            return;
        }
        throw error;
    }
};
exports.safeCreateAuditLog = safeCreateAuditLog;
//# sourceMappingURL=audit.js.map