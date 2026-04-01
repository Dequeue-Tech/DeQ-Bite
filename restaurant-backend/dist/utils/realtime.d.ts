import { EventEmitter } from 'events';
export type RealtimeEvent = {
    eventId?: string;
    sourceInstanceId?: string;
    type: string;
    restaurantId: string;
    userId?: string;
    payload: any;
};
export declare const emitRestaurantEvent: (restaurantId: string, event: Omit<RealtimeEvent, "restaurantId">) => void;
export declare const onRestaurantEvent: (restaurantId: string, listener: (event: RealtimeEvent) => void) => () => EventEmitter<[never]>;
export declare const onUserEvent: (userId: string, listener: (event: RealtimeEvent) => void) => () => EventEmitter<[never]>;
export declare const getBufferedEvents: (input: {
    restaurantId: string;
    userId?: string;
    sinceEventId?: string;
}) => RealtimeEvent[];
//# sourceMappingURL=realtime.d.ts.map