"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTenantContext = exports.runWithTenantContext = void 0;
const async_hooks_1 = require("async_hooks");
const defaultContext = {
    restaurantId: null,
    bypassIsolation: false,
};
const tenantContextStore = new async_hooks_1.AsyncLocalStorage();
const runWithTenantContext = (context, callback) => {
    const nextContext = {
        restaurantId: context.restaurantId ?? null,
        bypassIsolation: context.bypassIsolation ?? false,
    };
    return tenantContextStore.run(nextContext, callback);
};
exports.runWithTenantContext = runWithTenantContext;
const getTenantContext = () => {
    return tenantContextStore.getStore() ?? defaultContext;
};
exports.getTenantContext = getTenantContext;
//# sourceMappingURL=tenant-context.js.map