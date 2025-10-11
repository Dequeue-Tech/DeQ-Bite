"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
router.get('/invoice/:invoiceId', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { invoiceId } = req.params;
    if (!invoiceId) {
        throw new errorHandler_1.AppError('Invoice ID is required', 400);
    }
    const invoices = await database_1.prisma.$queryRaw `
    SELECT "id", "pdfData", "pdfName" 
    FROM "invoices" 
    WHERE "id" = ${invoiceId} 
    AND "orderId" IN (
      SELECT "id" FROM "orders" WHERE "userId" = ${req.user.id}
    )
  `;
    if (!invoices || invoices.length === 0) {
        throw new errorHandler_1.AppError('Invoice not found', 404);
    }
    const invoice = invoices[0];
    if (!invoice.pdfData) {
        throw new errorHandler_1.AppError('PDF not available for this invoice', 404);
    }
    const pdfBuffer = invoice.pdfData;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${invoice.pdfName || 'invoice.pdf'}"`);
    res.send(pdfBuffer);
}));
exports.default = router;
//# sourceMappingURL=pdf.js.map