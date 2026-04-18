import { Request } from 'express';
export declare const extractIdempotencyKey: (req: Request) => string | null;
export declare const claimIdempotencyKey: (input: {
    scope: string;
    key: string;
    ttlSeconds?: number;
}) => Promise<boolean>;
//# sourceMappingURL=idempotency.d.ts.map