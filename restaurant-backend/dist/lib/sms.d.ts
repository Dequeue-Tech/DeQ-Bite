export interface SMSOptions {
    to: string;
    message: string;
}
export declare function sendSMS(options: SMSOptions): Promise<boolean>;
export declare function sendOrderConfirmationSMS(phone: string, orderData: {
    customerName: string;
    orderId: string;
    total: number;
    tableNumber: number;
    restaurantName: string;
}): Promise<boolean>;
export declare function sendOrderCompletionSMS(phone: string, data: {
    customerName: string;
    restaurantName: string;
    invoiceNumber: string;
    total: number;
    invoiceUrl: string;
}): Promise<boolean>;
//# sourceMappingURL=sms.d.ts.map