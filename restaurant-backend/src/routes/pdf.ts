import { Router, Response } from 'express';
import { prisma } from '@/config/database';
import { authenticate } from '@/middleware/auth';
import { AppError, asyncHandler } from '@/middleware/errorHandler';
import { AuthenticatedRequest } from '@/types/api';

const router = Router();

// GET /api/pdf/invoice/:invoiceId - Get PDF for an invoice
router.get('/invoice/:invoiceId', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { invoiceId } = req.params;

  if (!invoiceId) {
    throw new AppError('Invoice ID is required', 400);
  }

  // Note: We're using Prisma's $queryRaw to directly access the pdfData column
  // since the TypeScript types might not be updated yet
  const invoices: any[] = await prisma.$queryRaw`
    SELECT "id", "pdfData", "pdfName" 
    FROM "invoices" 
    WHERE "id" = ${invoiceId} 
    AND "orderId" IN (
      SELECT "id" FROM "orders" WHERE "userId" = ${req.user!.id}
    )
  `;

  if (!invoices || invoices.length === 0) {
    throw new AppError('Invoice not found', 404);
  }

  const invoice = invoices[0];
  
  if (!invoice.pdfData) {
    throw new AppError('PDF not available for this invoice', 404);
  }

  // Convert stored PDF data back to buffer and send as response
  const pdfBuffer = invoice.pdfData;
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${invoice.pdfName || 'invoice.pdf'}"`);
  res.send(pdfBuffer);
}));

export default router;