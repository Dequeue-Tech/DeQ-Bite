export interface SMSOptions {
    to: string;
    message: string;
}
export declare function sendSMS(options: SMSOptions): Promise<boolean>;
export declare function generateInvoiceSMSMessage(invoiceData: {
    customerName: string;
    invoiceNumber: string;
    total: number;
    restaurantName: string;
}): string;
export declare function sendInvoiceSMS(phone: string, invoiceData: {
    customerName: string;
    invoiceNumber: string;
    total: number;
    restaurantName: string;
}): Promise<boolean>;
export declare function sendOrderConfirmationSMS(phone: string, orderData: {
    customerName: string;
    orderId: string;
    total: number;
    tableNumber: number;
    restaurantName: string;
}): Promise<boolean>;
//# sourceMappingURL=sms.d.ts.map