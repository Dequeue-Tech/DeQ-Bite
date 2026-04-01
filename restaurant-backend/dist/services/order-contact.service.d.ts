type PlacementContact = {
    name: string;
    email: string;
    phone: string;
};
export declare const resolveOrderPlacementContact: (order: {
    specialInstructions?: string | null;
    deliveryCustomerName?: string | null;
    deliveryCustomerPhone?: string | null;
    user?: {
        name?: string | null;
    } | null;
}) => PlacementContact;
export declare const orderContactMarkers: {
    ORDER_CONTACT_MARKER: string;
    DELIVERY_EMAIL_MARKER: string;
};
export {};
//# sourceMappingURL=order-contact.service.d.ts.map