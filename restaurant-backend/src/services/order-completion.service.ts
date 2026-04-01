import { prisma } from '@/config/database';
import { generateInvoicePDF, getPDFDownloadUrl, savePDFToStorage } from '@/lib/pdf';
import { sendOrderCompletionEmail } from '@/lib/email';
import { sendOrderCompletionSMS } from '@/lib/sms';
import { emitRestaurantEvent } from '@/utils/realtime';
import { logger } from '@/utils/logger';
import { resolveOrderPlacementContact } from '@/services/order-contact.service';

const DELIVERY_METHODS = ['EMAIL', 'SMS'] as const;

const withRetries = async <T>(label: string, fn: () => Promise<T>, retries = 2): Promise<T> => {
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      attempt += 1;
      if (attempt > retries) break;
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }

  throw new Error(`${label} failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
};

const buildInvoiceData = (
  order: any,
  invoiceNumber: string,
  placementContact: { name: string; email: string; phone: string }
) => {
  const taxPercent = order.subtotalPaise > 0
    ? Math.round((order.taxPaise / order.subtotalPaise) * 100)
    : undefined;

  return {
    restaurantName: order.restaurant?.name ?? 'Restaurant',
    ...(order.restaurant?.address ? { restaurantAddress: order.restaurant.address } : {}),
    ...(order.restaurant?.city ? { restaurantCity: order.restaurant.city } : {}),
    ...(order.restaurant?.state ? { restaurantState: order.restaurant.state } : {}),
    ...(order.restaurant?.phone ? { restaurantPhone: order.restaurant.phone } : {}),
    ...(order.restaurant?.email ? { restaurantEmail: order.restaurant.email } : {}),
    ...(order.restaurant?.gstNumber ? { gstNumber: order.restaurant.gstNumber } : {}),
    ...(taxPercent !== undefined ? { taxPercent } : {}),
    customerName: placementContact.name || 'Guest',
    customerEmail: placementContact.email || '',
    ...(placementContact.phone ? { customerPhone: placementContact.phone } : {}),
    invoiceNumber,
    orderDate: order.createdAt.toLocaleDateString('en-IN'),
    items: (order.items || []).map((item: any) => ({
      name: item.menuItem?.name || 'Item',
      quantity: item.quantity,
      price: item.pricePaise / 100,
      total: (item.pricePaise * item.quantity) / 100,
    })),
    subtotal: order.subtotalPaise / 100,
    tax: order.taxPaise / 100,
    total: order.totalPaise / 100,
    tableNumber: order.table?.number ? String(order.table.number) : 'N/A',
    paymentMethod: `${order.paymentProvider || 'RAZORPAY'}`,
  };
};

const ensureInvoiceRecord = async (order: any) => {
  const existing = await prisma.invoice.findUnique({
    where: { orderId: order.id },
  });

  const invoiceNumber = existing?.invoiceNumber || `INV-${Date.now()}-${order.id.substring(0, 8).toUpperCase()}`;
  const placementContact = resolveOrderPlacementContact(order);
  const invoiceData = buildInvoiceData(order, invoiceNumber, placementContact);

  if (existing?.pdfName && existing?.pdfPath) {
    return { invoice: existing, invoiceData };
  }

  const pdfBuffer = await withRetries('invoice-pdf-generate', async () => generateInvoicePDF(invoiceData));
  const pdfStorage = await withRetries('invoice-storage-upload', async () =>
    savePDFToStorage(pdfBuffer, `invoice-${invoiceNumber}.pdf`)
  );

  if (existing) {
    const updated = await prisma.invoice.update({
      where: { id: existing.id },
      data: {
        pdfPath: pdfStorage.pdfPath,
        pdfData: pdfStorage.pdfData,
        pdfName: pdfStorage.pdfName,
      },
    });
    return { invoice: updated, invoiceData };
  }

  const created = await prisma.invoice.create({
    data: {
      orderId: order.id,
      invoiceNumber,
      sentVia: [],
      emailSent: false,
      smsSent: false,
      pdfPath: pdfStorage.pdfPath,
      pdfData: pdfStorage.pdfData,
      pdfName: pdfStorage.pdfName,
    },
  });

  return { invoice: created, invoiceData };
};

export const processOrderCompletionNotifications = async (orderId: string) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      restaurant: {
        select: {
          id: true,
          name: true,
          address: true,
          city: true,
          state: true,
          phone: true,
          email: true,
          gstNumber: true,
        },
      },
      table: { select: { number: true } },
      user: { select: { id: true, name: true, email: true, phone: true } },
      items: { include: { menuItem: { select: { name: true } } } },
      invoice: true,
    },
  });

  if (!order) return;
  if (order.status !== 'COMPLETED' || order.paymentStatus !== 'COMPLETED') return;

  const placementContact = resolveOrderPlacementContact(order);
  const placedOrderEmail = placementContact.email;
  const placedOrderPhone = placementContact.phone;
  const placedOrderName = placementContact.name || 'Guest';

  const { invoice } = await ensureInvoiceRecord(order);
  let invoiceUrl = invoice.pdfPath || null;

  if (invoice.pdfName) {
    try {
      invoiceUrl = await getPDFDownloadUrl(invoice.pdfName);
    } catch {
      // fall back to stored path when signed URL generation fails
    }
  }

  let emailSent = invoice.emailSent;
  let smsSent = invoice.smsSent;

  if (!emailSent && placedOrderEmail) {
    emailSent = await withRetries('invoice-email-send', async () =>
      sendOrderCompletionEmail({
        to: placedOrderEmail,
        customerName: placedOrderName,
        restaurantName: order.restaurant?.name || 'Restaurant',
        invoiceNumber: invoice.invoiceNumber,
        orderId: order.id,
        totalInr: order.totalPaise / 100,
        invoiceUrl,
      })
    );
  }

  if (!smsSent && placedOrderPhone && invoiceUrl) {
    smsSent = await withRetries('invoice-sms-send', async () =>
      sendOrderCompletionSMS(placedOrderPhone, {
        customerName: placedOrderName,
        restaurantName: order.restaurant?.name || 'Restaurant',
        invoiceNumber: invoice.invoiceNumber,
        total: order.totalPaise / 100,
        invoiceUrl,
      })
    );
  }

  const sentVia = Array.from(new Set([
    ...(invoice.sentVia || []),
    ...(emailSent ? ['EMAIL'] : []),
    ...(smsSent ? ['SMS'] : []),
  ]));

  const updatedInvoice = await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      sentVia,
      emailSent,
      smsSent,
    },
  });

  emitRestaurantEvent(order.restaurantId, {
    type: 'invoice.ready',
    userId: order.userId,
    payload: {
      orderId: order.id,
      invoiceId: updatedInvoice.id,
      invoiceNumber: updatedInvoice.invoiceNumber,
      invoiceUrl,
      delivery: {
        emailSent,
        smsSent,
      },
    },
  });

  logger.info('Order completion workflow processed', {
    orderId: order.id,
    restaurantId: order.restaurantId,
    userId: order.userId,
    deliveredVia: sentVia,
    availableMethods: DELIVERY_METHODS,
  });
};
