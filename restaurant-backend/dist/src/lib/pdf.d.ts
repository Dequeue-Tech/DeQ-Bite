export interface InvoiceData {
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
export declare function savePDFToStorage(pdfBuffer: Buffer, filename: string): Promise<string>;
export declare function cleanupOldInvoices(daysOld?: number): Promise<void>;
//# sourceMappingURL=pdf.d.ts.map