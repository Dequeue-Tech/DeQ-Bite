export type TenantContext = {
    restaurantId: string | null;
    bypassIsolation: boolean;
};
export declare const runWithTenantContext: <T>(context: Partial<TenantContext>, callback: () => T) => T;
export declare const getTenantContext: () => TenantContext;
//# sourceMappingURL=tenant-context.d.ts.map