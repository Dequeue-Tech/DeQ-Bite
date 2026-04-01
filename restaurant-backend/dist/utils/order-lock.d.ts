import { Request } from 'express';
export declare const extractExpectedUpdatedAt: (req: Request) => Date | null;
export declare const hasVersionConflict: (input: {
    expectedUpdatedAt: Date;
    currentUpdatedAt: Date;
}) => boolean;
//# sourceMappingURL=order-lock.d.ts.map