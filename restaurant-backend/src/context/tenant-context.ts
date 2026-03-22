import { AsyncLocalStorage } from 'async_hooks';

export type TenantContext = {
  restaurantId: string | null;
  bypassIsolation: boolean;
};

const defaultContext: TenantContext = {
  restaurantId: null,
  bypassIsolation: false,
};

const tenantContextStore = new AsyncLocalStorage<TenantContext>();

export const runWithTenantContext = <T>(context: Partial<TenantContext>, callback: () => T): T => {
  const nextContext: TenantContext = {
    restaurantId: context.restaurantId ?? null,
    bypassIsolation: context.bypassIsolation ?? false,
  };

  return tenantContextStore.run(nextContext, callback);
};

export const getTenantContext = (): TenantContext => {
  return tenantContextStore.getStore() ?? defaultContext;
};
