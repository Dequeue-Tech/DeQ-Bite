import { isPrivateBucket as checkPrivateBucket } from './b2-storage';
export declare const isPrivateBucket: typeof checkPrivateBucket;
export interface InvoiceItem {
    name: string;
    quantity: number;
    price: number;
    total: number;
}
export interface InvoiceData {
    restaurantName: string;
    restaurantTagline?: string;
    restaurantAddress?: string;
    restaurantCity?: string;
    restaurantState?: string;
    restaurantPhone?: string;
    restaurantEmail?: string;
    gstNumber?: string;
    fssaiNumber?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    orderDate: string;
    orderTime?: string;
    tableNumber?: string;
    cashierName?: string;
    invoiceNumber: string;
    paymentMode?: string;
    paymentMethod?: string;
    items: InvoiceItem[];
    subtotal: number;
    discount?: number;
    taxPercent?: number;
    tax: number;
    total: number;
    amountPaid?: number;
    changeReturned?: number;
    footerMessage?: string;
}
export declare function generateInvoicePDF(invoiceData: InvoiceData): Buffer;
export declare function savePDFToStorage(pdfBuffer: Buffer, filename: string): Promise<{
    pdfPath: string | null;
    pdfData: Buffer | null;
    pdfName: string | null;
    b2FileId?: string;
}>;
export declare function downloadPDFFromStorage(fileName: string): Promise<Buffer>;
export declare function getPDFDownloadUrl(fileName: string): Promise<string>;
export declare function cleanupOldInvoices(daysOld?: number): Promise<void>;
//# sourceMappingURL=pdf.d.ts.map