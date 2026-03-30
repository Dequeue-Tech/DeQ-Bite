// restaurant-backend/test-invoice.ts
import fs from 'fs';
import path from 'path';
import { generateInvoicePDF, InvoiceData } from './src/lib/pdf';

const invoiceData: InvoiceData = {
  restaurantName: 'Demo Restaurant',
  restaurantTagline: 'Tasty food, fast service',
  restaurantAddress: '123 Main St, City',
  restaurantCity: 'Mumbai',
  restaurantState: 'Maharashtra',
  restaurantPhone: '+911234567890',
  restaurantEmail: 'hello@demo.com',
  gstNumber: '27AABCU9603R1ZV',
  fssaiNumber: '12345678901234',
  customerName: 'Test Customer',
  customerPhone: '+919876543210',
  orderDate: '2026-03-28',
  orderTime: '12:34',
  tableNumber: '5',
  cashierName: 'Priya',
  invoiceNumber: 'INV-0001',
  paymentMode: 'CARD',
  items: [
    { name: 'Paneer Butter Masala', quantity: 1, price: 250, total: 250 },
    { name: 'Garlic Naan', quantity: 2, price: 45, total: 90 },
  ],
  subtotal: 340,
  discount: 0,
  taxPercent: 5,
  tax: 17,
  total: 357,
  amountPaid: 357,
  footerMessage: 'Thank you for dining with us!',
};

const pdfBuffer = generateInvoicePDF(invoiceData);
fs.writeFileSync(path.resolve('invoice-preview.pdf'), pdfBuffer);
console.log('invoice-preview.pdf written');