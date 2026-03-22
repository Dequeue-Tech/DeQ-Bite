"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachTenantContext = void 0;
const tenant_context_1 = require("../context/tenant-context");
const isPlatformRoute = (path) => path.startsWith('/api/platform');
const attachTenantContext = (req, _res, next) => {
    const isCentralAdmin = req.user?.role === 'CENTRAL_ADMIN';
    const bypassIsolation = isCentralAdmin || isPlatformRoute(req.originalUrl || req.url || '');
    const restaurantId = req.restaurant?.id || null;
    (0, tenant_context_1.runWithTenantContext)({
        restaurantId,
        bypassIsolation,
    }, () => next());
};
exports.attachTenantContext = attachTenantContext;
//# sourceMappingURL=tenantContext.js.map