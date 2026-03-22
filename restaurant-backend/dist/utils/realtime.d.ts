import { EventEmitter } from 'events';
import type { Server as SocketIOServer } from 'socket.io';
export type RealtimeEvent = {
    type: string;
    restaurantId: string;
    userId?: string;
    payload: any;
};
export declare const setSocketServer: (io: SocketIOServer) => void;
export declare const emitRestaurantEvent: (restaurantId: string, event: Omit<RealtimeEvent, "restaurantId">) => void;
export declare const onRestaurantEvent: (restaurantId: string, listener: (event: RealtimeEvent) => void) => () => EventEmitter<[never]>;
//# sourceMappingURL=realtime.d.ts.map