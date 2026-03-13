import { isPrivateBucket as checkPrivateBucket } from './b2-storage';
export declare const isPrivateBucket: typeof checkPrivateBucket;
export interface InvoiceData {
    fssaiNumber?: string;
    cashierName?: string;
    gstNumber?: string;
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    invoiceNumber: string;
    orderDate: string;
    items: Array<{
        name: string;
        quantity: number;
        price: number;
        total: number;
    }>;
    subtotal: number;
    tax: number;
    total: number;
    tableNumber: number;
    restaurantName: string;
    restaurantAddress?: string;
    restaurantPhone?: string;
    paymentMethod?: string;
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