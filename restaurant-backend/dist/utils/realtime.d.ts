import { EventEmitter } from 'events';
export type RealtimeEvent = {
    type: string;
    restaurantId: string;
    payload: any;
};
export declare const emitRestaurantEvent: (restaurantId: string, event: Omit<RealtimeEvent, "restaurantId">) => void;
export declare const onRestaurantEvent: (restaurantId: string, listener: (event: RealtimeEvent) => void) => () => EventEmitter<[never]>;
//# sourceMappingURL=realtime.d.ts.map