export interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    attachments?: Array<{
        filename: string;
        content: Buffer;
        contentType: string;
    }>;
}
export declare function sendEmail(options: EmailOptions): Promise<boolean>;
export declare function generateInvoiceEmailTemplate(invoiceData: {
    customerName: string;
    invoiceNumber: string;
    orderDate: string;
    total: number;
    tableNumber: number;
    restaurantName: string;
}): string;
export declare function sendInvoiceEmail(email: string, invoiceData: {
    customerName: string;
    invoiceNumber: string;
    orderDate: string;
    total: number;
    tableNumber: number;
    restaurantName: string;
}, pdfBuffer: Buffer): Promise<boolean>;
export declare function sendOrderCompletionEmail(input: {
    to: string;
    customerName: string;
    restaurantName: string;
    invoiceNumber: string;
    orderId: string;
    totalInr: number;
    orderDate?: string;
    tableNumber?: number;
}, pdfBuffer: Buffer): Promise<boolean>;
export declare function sendOrderConfirmationEmail(input: {
    to: string;
    customerName: string;
    restaurantName: string;
    orderId: string;
}): Promise<boolean>;
//# sourceMappingURL=email.d.ts.map