import { Router, Response } from 'express';
import { prisma } from '@/config/database';
import jwt from 'jsonwebtoken';
import { AppError, asyncHandler } from '@/middleware/errorHandler';
import { AuthenticatedRequest } from '@/types/api';
import path from 'path';
import fs from 'fs/promises';

const router = Router();

// GET /api/pdf/invoice/:invoiceId - Get PDF for an invoice
router.get('/invoice/:invoiceId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { invoiceId } = req.params;

  if (!invoiceId) {
    throw new AppError('Invoice ID is required', 400);
  }

  // Fetch invoice. We will allow public download only if a public pdfPath exists.
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      pdfData: true,
      pdfName: true,
      pdfPath: true,
      order: { select: { userId: true } },
    },
  });

  if (!invoice) {
    throw new AppError('Invoice not found', 404);
  }

  // Try to extract token if present
  let token: string | undefined;
  const authHeader = req.get('Authorization') || req.headers['authorization'];
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  // If no token provided, allow download only when a public pdfPath exists (served by express.static)
  if (!token) {
    // If PDF bytes exist in DB, allow public download (useful when frontend opens link without auth)
    if (invoice.pdfData) {
      const pdfBuffer = Buffer.from(invoice.pdfData as Uint8Array);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${invoice.pdfName || 'invoice.pdf'}"`);
      res.setHeader('Content-Length', String(pdfBuffer.length));
      return res.send(pdfBuffer);
    }
    if (invoice.pdfPath && invoice.pdfPath.startsWith('/invoices/')) {
      // Build absolute path on disk
      const rel = invoice.pdfPath.replace(/^\//, '');
      const absPath = path.join(process.cwd(), rel);

      try {
        await fs.access(absPath);
        // Redirect to the public URL so browser can fetch it directly
        return res.redirect(invoice.pdfPath);
      } catch (err) {
        throw new AppError('PDF file not found on server', 404);
      }
    }

    throw new AppError('Access denied. No token provided.', 401);
  }

  // Token provided: verify and ensure ownership
  if (!process.env.JWT_SECRET) {
    throw new AppError('Server configuration error', 500);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
    const userId = decoded?.id;
    if (!userId) throw new AppError('Invalid token', 401);

    if (invoice.order?.userId !== userId) {
      throw new AppError('Access denied. You do not own this invoice.', 403);
    }

    // Serve PDF from db if available, else from public path
    if (invoice.pdfData) {
      const pdfBuffer = Buffer.from(invoice.pdfData as Uint8Array);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${invoice.pdfName || 'invoice.pdf'}"`);
      res.setHeader('Content-Length', String(pdfBuffer.length));
      return res.send(pdfBuffer);
    }

    if (invoice.pdfPath && invoice.pdfPath.startsWith('/invoices/')) {
      return res.redirect(invoice.pdfPath);
    }

    throw new AppError('PDF not available for this invoice', 404);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('Invalid token', 401);
  }
}));

export default router;