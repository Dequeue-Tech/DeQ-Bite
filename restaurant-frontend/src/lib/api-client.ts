import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  ApplicationVerifier,
  ConfirmationResult,
  GoogleAuthProvider,
  GithubAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: any[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'CUSTOMER' | 'OWNER' | 'ADMIN' | 'STAFF' | 'CENTRAL_ADMIN' | 'KITCHEN_STAFF';
  restaurantRole?: 'OWNER' | 'ADMIN' | 'STAFF' | null;
  verified: boolean;
  createdAt: string;
  updatedAt?: string;
  totalOrders?: number;
  totalSpent?: number;
  recentOrders?: Array<{
    id: string;
    status: string;
    totalPaise: number;
    createdAt: string;
    table?: {
      number?: number;
      location?: string | null;
    };
  }>;
}

export interface RestaurantSummary {
  id: string;
  name: string;
  slug?: string;
  subdomain?: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  email?: string | null;
  phone?: string | null;
  cuisineTypes?: string[];
  status?: 'PENDING_APPROVAL' | 'APPROVED' | 'SUSPENDED';
  paymentCollectionTiming?: 'BEFORE_MEAL' | 'AFTER_MEAL';
  cashPaymentEnabled?: boolean;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RestaurantMembership {
  id: string;
  name: string;
  slug?: string;
  subdomain?: string;
  role: 'OWNER' | 'ADMIN' | 'STAFF';
  status?: 'PENDING_APPROVAL' | 'APPROVED' | 'SUSPENDED';
  paymentCollectionTiming?: 'BEFORE_MEAL' | 'AFTER_MEAL';
  cashPaymentEnabled?: boolean;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Offer {
  id: string;
  name: string;
  description?: string | null;
  code?: string | null;
  discountType: 'PERCENT' | 'FIXED';
  value: number;
  minOrderPaise?: number | null;
  maxDiscountPaise?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RestaurantUserEntry {
  membershipId: string;
  role: 'OWNER' | 'ADMIN' | 'STAFF';
  active: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    role: 'CUSTOMER' | 'OWNER' | 'ADMIN' | 'STAFF' | 'CENTRAL_ADMIN' | 'KITCHEN_STAFF';
    createdAt: string;
  };
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  phone?: string;
  password: string;
}

export type OAuthProviderType = 'GOOGLE' | 'GITHUB' | 'APPLE';

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  pricePaise: number;
  image?: string;
  categoryId: string;
  available: boolean;
  preparationTime: number;
  ingredients: string[];
  allergens: string[];
  isVeg: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  spiceLevel: 'NONE' | 'MILD' | 'MEDIUM' | 'HOT' | 'EXTRA_HOT';
  category: {
    id: string;
    name: string;
  };
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  image?: string;
  active: boolean;
  sortOrder: number;
}

export interface Table {
  id: string;
  number: number;
  capacity: number;
  location?: string;
  active: boolean;
}

export interface Order {
  id: string;
  userId: string;
  tableId: string;
  isDelivery?: boolean;
  deliveryStatus?: DeliveryStatus | null;
  sourceSystem?: MarketplaceSourceSystem;
  externalOrderId?: string | null;
  status: 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'SERVED' | 'COMPLETED' | 'CANCELLED';
  items: OrderItem[];
  subtotalPaise: number;
  taxPaise: number;
  discountPaise: number;
  totalPaise: number;
  paidAmountPaise?: number;
  dueAmountPaise?: number;
  couponId?: string | null;
  paymentId?: string;
  paymentTransactionId?: string | null;
  paymentProvider?: 'RAZORPAY' | 'PAYTM' | 'PHONEPE' | 'CASH';
  paymentStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_PAID';
  paymentCollectionTiming?: 'BEFORE_MEAL' | 'AFTER_MEAL';
  specialInstructions?: string;
  estimatedTime?: number;
  createdAt: string;
  updatedAt: string;
  table?: Table;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  quantity: number;
  pricePaise: number;
  notes?: string;
  menuItem: MenuItem;
}

export type DeliveryStatus =
  | 'PLACED'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export interface DeliveryMeta {
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  landmark?: string;
  riderName?: string;
  riderPhone?: string;
  deliveryStatus: DeliveryStatus;
}

export interface DeliveryOrder extends Order {
  deliveryMeta: DeliveryMeta;
}

export type KOTStatus = 'PLACED' | 'PREPARING' | 'READY' | 'SERVED';

export interface KOTTicket {
  id: string;
  restaurantId: string;
  orderId: string;
  status: KOTStatus;
  priority: number;
  notes?: string | null;
  placedAt: string;
  preparingAt?: string | null;
  readyAt?: string | null;
  servedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  order?: Order;
  events?: Array<{
    id: string;
    fromStatus?: KOTStatus | null;
    toStatus: KOTStatus;
    changedByUserId?: string | null;
    changedAt: string;
    note?: string | null;
  }>;
}

export interface KOTOperationalSummary {
  generatedAt: string;
  thresholdMinutes: number;
  queue: {
    totalActive: number;
    byStatus: Record<KOTStatus, number>;
    overdueCount: number;
    avgTicketAgeMinutes: number;
    throughputLastHour: number;
    avgPrepMinutesToday: number;
    avgFulfillmentMinutesToday: number;
  };
  topAgingTickets: Array<{
    id: string;
    orderId: string;
    status: KOTStatus;
    priority: number;
    placedAt: string;
    tableNumber: number;
    customerName: string;
    itemCount: number;
    minutesOpen: number;
    minutesInStage: number;
    overdue: boolean;
  }>;
}

export interface RawMaterial {
  id: string;
  restaurantId: string;
  name: string;
  sku?: string | null;
  unit: string;
  currentStock: number;
  reorderLevel: number;
  costPerUnitPaise: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryAlert {
  id: string;
  restaurantId: string;
  rawMaterialId: string;
  type: string;
  thresholdValue?: number | null;
  currentValue: number;
  acknowledged: boolean;
  acknowledgedAt?: string | null;
  createdAt: string;
  rawMaterial?: RawMaterial;
}

export interface PurchaseOrder {
  id: string;
  restaurantId: string;
  vendorName: string;
  status: 'DRAFT' | 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';
  notes?: string | null;
  expectedDeliveryAt?: string | null;
  receivedAt?: string | null;
  totalCostPaise: number;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: string;
    purchaseOrderId: string;
    rawMaterialId: string;
    quantityOrdered: number;
    quantityReceived: number;
    unitCostPaise: number;
    rawMaterial?: RawMaterial;
  }>;
}

export interface CustomerProfile {
  id: string;
  restaurantId: string;
  userId: string;
  loyaltyPoints: number;
  totalOrders: number;
  totalSpendPaise: number;
  lastOrderAt?: string | null;
  tier: string;
  notes?: string | null;
  segment?: 'NEW' | 'LOYAL' | 'HIGH_VALUE' | 'AT_RISK' | 'REGULAR';
  health?: {
    score: number;
    risk: 'LOW' | 'MEDIUM' | 'HIGH';
    inactiveDays?: number | null;
  };
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  };
}

export interface AnalyticsSnapshot {
  id: string;
  restaurantId: string;
  periodType: 'DAILY' | 'WEEKLY';
  periodStart: string;
  periodEnd: string;
  revenuePaise: number;
  orderCount: number;
  avgOrderValuePaise: number;
  topItems: Array<{ menuItemId: string; name: string; quantity: number; revenuePaise: number }>;
  peakHours: Array<{ hour: number; orders: number }>;
  metrics: Record<string, unknown>;
  insights: string;
  recommendations: string;
  generatedAt: string;
}

export interface AnalyticsOverview {
  period: {
    start: string;
    end: string;
    previousStart: string;
    previousEnd: string;
    days: number;
  };
  summary: {
    revenuePaise: number;
    completedOrders: number;
    totalOrders: number;
    cancelledOrders: number;
    avgOrderValuePaise: number;
    uniqueCustomers: number;
    repeatCustomers: number;
    cancellationRatePct: number;
    paymentCompletionRatePct: number;
    repeatCustomerRatePct: number;
    topItems: Array<{ menuItemId: string; name: string; quantity: number; revenuePaise: number }>;
    peakHours: Array<{ hour: number; orders: number }>;
  };
  deltas: {
    revenuePct: number;
    completedOrdersPct: number;
    avgOrderValuePct: number;
    uniqueCustomersPct: number;
    repeatCustomerRatePct: number;
  };
  previous: {
    revenuePaise: number;
    completedOrders: number;
    totalOrders: number;
    cancelledOrders: number;
    avgOrderValuePaise: number;
    uniqueCustomers: number;
    repeatCustomers: number;
    cancellationRatePct: number;
    paymentCompletionRatePct: number;
    repeatCustomerRatePct: number;
    topItems: Array<{ menuItemId: string; name: string; quantity: number; revenuePaise: number }>;
    peakHours: Array<{ hour: number; orders: number }>;
  };
}

export interface CrmOverview {
  summary: {
    totalCustomers: number;
    segments: Array<{
      segment: 'NEW' | 'LOYAL' | 'HIGH_VALUE' | 'AT_RISK' | 'REGULAR';
      count: number;
      sharePct: number;
    }>;
  };
  atRisk: CustomerProfile[];
  highValue: CustomerProfile[];
}

export interface PosSyncLog {
  id: string;
  restaurantId: string;
  sourceSystem: string;
  eventType: string;
  externalOrderId?: string | null;
  payload?: Record<string, unknown> | null;
  status: string;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MarketplaceSourceSystem = 'ZOMATO' | 'SWIGGY';

export type MarketplacePaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIALLY_PAID';

export interface MarketplaceOrderItemInput {
  menuItemId?: string;
  menuItemName?: string;
  quantity: number;
  notes?: string;
}

export interface MarketplaceOrderInput {
  externalOrderId: string;
  customer: {
    name: string;
    phone?: string;
    email?: string;
    address: string;
    landmark?: string;
  };
  items: MarketplaceOrderItemInput[];
  specialInstructions?: string;
  paymentProvider?: 'RAZORPAY' | 'PAYTM' | 'PHONEPE' | 'CASH';
  paymentStatus?: MarketplacePaymentStatus;
  paidAmountPaise?: number;
}

export interface MarketplaceOrderSummary {
  orderId: string;
  sourceSystem: MarketplaceSourceSystem;
  externalOrderId?: string | null;
  syncLogId: string;
  syncedAt: string;
  status: string;
  paymentStatus: string;
  totalPaise: number;
  createdAt: string;
  customerName?: string | null;
  customerPhone?: string | null;
  deliveryAddress?: string | null;
  tableNumber?: number | null;
  itemsCount: number;
}

class ApiClient {
  private api: AxiosInstance;
  private blockedRootSegments = new Set([
    '',
    'auth',
    'onboarding',
    'restaurants',
    'admin',
    'central-admin',
    'cart',
    'checkout',
    'kitchen',
    'menu',
    'orders',
    'pos',
    'api',
    '_next',
    'favicon.ico',
  ]);

  private decodeJwtPayload(token: string): Record<string, unknown> | null {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
      const base64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
      const json = atob(padded);
      return JSON.parse(json) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private isUsableFirebaseIdToken(token: string | null): token is string {
    if (!token) return false;
    const payload = this.decodeJwtPayload(token);
    if (!payload) return false;

    const issuer = payload['iss'];
    const audience = payload['aud'];
    const expiry = payload['exp'];

    if (typeof issuer !== 'string' || !issuer.startsWith('https://securetoken.google.com/')) {
      return false;
    }
    if (typeof audience !== 'string' || !audience) {
      return false;
    }
    if (typeof expiry !== 'number') {
      return false;
    }

    // Treat tokens that expire within 30 seconds as expired to avoid race conditions.
    return expiry * 1000 > Date.now() + 30_000;
  }

  constructor() {
    this.api = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 25000, // Reduced to 25 seconds to prevent timeouts
    });

    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      async (config) => {
        const token = await this.getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        const slug = this.getRestaurantSlug();
        if (slug) {
          config.headers['x-restaurant-slug'] = slug;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          this.clearAuthToken();
          signOut(auth).catch(() => undefined);
          if (typeof window !== 'undefined') {
            window.location.href = '/auth/signin';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Get base URL for the API
  getBaseURL(): string {
    return this.api.defaults.baseURL?.replace('/api', '') || 'http://localhost:5000';
  }

  private async getAuthToken(): Promise<string | null> {
    const firebaseUser = auth.currentUser;
    if (firebaseUser) {
      try {
        const token = await firebaseUser.getIdToken();
        this.setAuthToken(token);
        return token;
      } catch (_error) {
        // Fall through to local token fallback.
      }
    }

    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('auth_token');
      if (this.isUsableFirebaseIdToken(storedToken)) {
        return storedToken;
      }
      this.clearAuthToken();
    }
    return null;
  }

  private setAuthToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
  }

  private clearAuthToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  }

  setSelectedRestaurantSlug(slug: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('selected_restaurant_slug', slug.toLowerCase());
      window.dispatchEvent(new Event('restaurant-context-updated'));
    }
  }

  getSelectedRestaurantSlug(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selected_restaurant_slug');
    }
    return null;
  }

  setSelectedTableNumber(tableNumber: string | number): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('selected_table_number', String(tableNumber));
      window.dispatchEvent(new Event('restaurant-context-updated'));
    }
  }

  getSelectedTableNumber(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selected_table_number');
    }
    return null;
  }

  clearSelectedTableNumber(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('selected_table_number');
      window.dispatchEvent(new Event('restaurant-context-updated'));
    }
  }

  private getRestaurantSlugFromPath(): string | null {
    if (typeof window === 'undefined') return null;
    const first = window.location.pathname.split('/').filter(Boolean)[0] || '';
    if (!first || this.blockedRootSegments.has(first)) return null;
    if (first.includes('.')) return null;
    return first.toLowerCase();
  }

  private getRestaurantSlug(): string | null {
    if (typeof window === 'undefined') return null;

    const pathSlug = this.getRestaurantSlugFromPath();
    if (pathSlug) return pathSlug;

    const selectedSlug = this.getSelectedRestaurantSlug();
    if (selectedSlug) return selectedSlug.toLowerCase();

    // const devSlug = process.env.NEXT_PUBLIC_DEV_RESTAURANT_SLUG || process.env.NEXT_PUBLIC_DEV_SUBDOMAIN;
    // if (devSlug) return devSlug.toLowerCase();

    return null;
  }

  getActiveRestaurantSlug(): string | null {
    return this.getRestaurantSlug();
  }

  buildTenantApiUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.getBaseURL()}/api${this.buildTenantEndpoint(cleanPath)}`;
  }

  buildRestaurantPath(path: string): string {
    const slug = this.getRestaurantSlug();
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    if (!slug) return cleanPath;
    return `/${slug}${cleanPath}`;
  }

  private buildTenantEndpoint(path: string): string {
    const slug = this.getRestaurantSlug();
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    if (!slug) return cleanPath;
    return `/restaurants/${slug}${cleanPath}`;
  }

  getEventStreamUrl(token: string): string {
    const base = this.buildTenantApiUrl('/events');
    const hasQuery = base.includes('?');
    const connector = hasQuery ? '&' : '?';
    return `${base}${connector}token=${encodeURIComponent(token)}`;
  }

  async syncFirebaseSession(payload: { name?: string; phone?: string } = {}, token?: string): Promise<User> {
    const response = await this.api.post<ApiResponse<{ user: User }>>('/auth/session', payload, {
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
    });
    if (response.data.success && response.data.data) {
      return response.data.data.user;
    }
    throw new Error(response.data.error || response.data.message || 'Failed to synchronize user session');
  }

  private async completeFirebaseSignIn(payload: { name?: string; phone?: string } = {}): Promise<AuthResponse> {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      throw new Error('Firebase user session is not available');
    }

    // Force-refresh to avoid stale/expired cached tokens during sign-in handoff.
    const token = await firebaseUser.getIdToken(true);
    this.setAuthToken(token);
    const user = await this.syncFirebaseSession(payload, token);
    return { user, token };
  }

  // Authentication methods
  async login(data: LoginData): Promise<AuthResponse> {
    await signInWithEmailAndPassword(auth, data.email, data.password);
    return this.completeFirebaseSignIn();
  }

  async register(data: RegisterData): Promise<AuthResponse> {
    const credential = await createUserWithEmailAndPassword(auth, data.email, data.password);
    await updateProfile(credential.user, {
      displayName: data.name,
    });
    return this.completeFirebaseSignIn({
      name: data.name,
      ...(data.phone ? { phone: data.phone } : {}),
    });
  }

  async loginWithOAuth(provider: OAuthProviderType): Promise<AuthResponse> {
    const selectedProvider =
      provider === 'GOOGLE'
        ? new GoogleAuthProvider()
        : provider === 'GITHUB'
          ? new GithubAuthProvider()
          : new OAuthProvider('apple.com');

    await signInWithPopup(auth, selectedProvider);
    return this.completeFirebaseSignIn();
  }

  async startPhoneOtp(phoneNumber: string, appVerifier: ApplicationVerifier): Promise<ConfirmationResult> {
    return signInWithPhoneNumber(auth, phoneNumber, appVerifier);
  }

  async verifyPhoneOtp(
    confirmationResult: ConfirmationResult,
    otpCode: string,
    payload: { name?: string; phone?: string } = {}
  ): Promise<AuthResponse> {
    await confirmationResult.confirm(otpCode);
    return this.completeFirebaseSignIn(payload);
  }

  async sendPasswordReset(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email);
  }

  async syncCurrentFirebaseUser(payload: { name?: string; phone?: string } = {}): Promise<AuthResponse> {
    return this.completeFirebaseSignIn(payload);
  }

  async getProfile(): Promise<User> {
    const response = await this.api.get<ApiResponse<{ user: User }>>('/auth/me');
    if (response.data.success && response.data.data) {
      return response.data.data.user;
    }
    throw new Error(response.data.error || 'Failed to get profile');
  }

  async getEnhancedProfile(): Promise<any> {
    const response = await this.api.get<ApiResponse<{ user: any }>>('/auth/profile');
    if (response.data.success && response.data.data) {
      return response.data.data.user;
    }
    throw new Error(response.data.error || 'Failed to get enhanced profile');
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    void currentPassword;
    void newPassword;
    throw new Error('Password updates are managed by Firebase Authentication.');
  }

  async logout(): Promise<void> {
    await signOut(auth);
    this.clearAuthToken();
  }

  // Payment methods
  async createPayment(orderId: string, paymentProvider?: 'RAZORPAY' | 'PAYTM' | 'PHONEPE'): Promise<any> {
    const response = await this.api.post<ApiResponse>(this.buildTenantEndpoint('/payments/create'), { orderId, paymentProvider });
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to create payment');
  }

  async getPaymentProviders(): Promise<string[]> {
    const response = await this.api.get<ApiResponse>(this.buildTenantEndpoint('/payments/providers'));
    if (response.data.success) {
      return response.data.data.providers || [];
    }
    throw new Error(response.data.error || 'Failed to fetch payment providers');
  }

  async verifyPayment(paymentData: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }): Promise<any> {
    try {
      const response = await this.api.post<ApiResponse>(this.buildTenantEndpoint('/payments/verify'), paymentData);
      if (response.data.success) {
        return response.data.data;
      }
      
      // Provide more specific error messages based on backend response
      const errorMessage = response.data.error || 'Payment verification failed';
      
      // Handle specific error cases
      if (errorMessage.includes('signature')) {
        throw new Error('Payment verification failed due to invalid signature. Please try again.');
      } else if (errorMessage.includes('not found')) {
        throw new Error('Order not found. Please contact support.');
      } else if (errorMessage.includes('successful')) {
        throw new Error('Payment was not successful. Please check your payment method and try again.');
      } else if (errorMessage.includes('already')) {
        throw new Error('Payment already verified.');
      }
      
      throw new Error(errorMessage);
    } catch (error: any) {
      // Provide more specific error messages
      if (error.code === 'ECONNABORTED') {
        throw new Error('Network timeout. Please check your internet connection and try again.');
      } else if (!error.response) {
        throw new Error('Network error. Please check your internet connection and try again.');
      }
      throw error;
    }
  }

  async getPaymentStatus(orderId: string): Promise<any> {
    const response = await this.api.get<ApiResponse>(this.buildTenantEndpoint(`/payments/status/${orderId}`));
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to get payment status');
  }

  // Invoice methods
  async generateInvoice(orderId: string, methods: ('EMAIL' | 'SMS')[]): Promise<any> {
    const response = await this.api.post<ApiResponse>(this.buildTenantEndpoint('/invoices/generate'), {
      orderId,
      methods,
    });
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to generate invoice');
  }

  async getInvoice(orderId: string): Promise<any> {
    const response = await this.api.get<ApiResponse>(this.buildTenantEndpoint(`/invoices/${orderId}`));
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to get invoice');
  }

  async getUserInvoices(): Promise<any[]> {
    const response = await this.api.get<ApiResponse>(this.buildTenantEndpoint('/invoices/user/list'));
    if (response.data.success) {
      return response.data.data.invoices;
    }
    throw new Error(response.data.error || 'Failed to get invoices');
  }

  async resendInvoice(invoiceId: string, methods: ('EMAIL' | 'SMS')[]): Promise<any> {
    const response = await this.api.post<ApiResponse>(this.buildTenantEndpoint(`/invoices/${invoiceId}/resend`), {
      methods,
    });
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to resend invoice');
  }

  // PDF download
  async downloadInvoicePdf(invoiceId: string): Promise<{ blob: Blob; filename: string }> {
    // Use a direct GET to the PDF endpoint with auth header; expect application/pdf
    const url = this.buildTenantEndpoint(`/pdf/invoice/${invoiceId}`);
    const response = await this.api.get(url, { responseType: 'blob' });

    // Try to extract filename from Content-Disposition
    const contentDisposition = response.headers['content-disposition'] as string | undefined;
    let filename = 'invoice.pdf';
    if (contentDisposition) {
      const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(contentDisposition);
      const raw = decodeURIComponent(match?.[1] || match?.[2] || '');
      if (raw) filename = raw;
    }

    return { blob: response.data as Blob, filename };
  }

  // Refresh/regenerate the stored PDF for an invoice
  async refreshInvoicePdf(invoiceId: string): Promise<any> {
    const response = await this.api.post<ApiResponse>(this.buildTenantEndpoint(`/invoices/${invoiceId}/refresh-pdf`));
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to refresh invoice PDF');
  }

  // Menu methods
  async getMenuItems(categoryId?: string): Promise<ApiResponse<MenuItem[]>> {
    const params = categoryId ? `?categoryId=${categoryId}` : '';
    const response = await this.api.get<ApiResponse<MenuItem[]>>(this.buildTenantEndpoint(`/menu${params}`));
    return response.data;
  }

  async getMenuItem(id: string): Promise<ApiResponse<MenuItem>> {
    const response = await this.api.get<ApiResponse<MenuItem>>(this.buildTenantEndpoint(`/menu/${id}`));
    return response.data;
  }

  async getAdminMenuItems(): Promise<ApiResponse<MenuItem[]>> {
    const response = await this.api.get<ApiResponse<MenuItem[]>>(this.buildTenantEndpoint('/menu/admin/all'));
    return response.data;
  }

  async createMenuItem(payload: {
    name: string;
    description?: string;
    pricePaise: number;
    image?: string;
    categoryId: string;
    available?: boolean;
    preparationTime?: number;
    ingredients?: string[];
    allergens?: string[];
    isVeg?: boolean;
    isVegan?: boolean;
    isGlutenFree?: boolean;
    spiceLevel?: 'NONE' | 'MILD' | 'MEDIUM' | 'HOT' | 'EXTRA_HOT';
  }): Promise<ApiResponse<MenuItem>> {
    const response = await this.api.post<ApiResponse<MenuItem>>(this.buildTenantEndpoint('/menu'), payload);
    return response.data;
  }

  async updateMenuItem(id: string, payload: Partial<{
    name: string;
    description: string;
    pricePaise: number;
    image: string;
    categoryId: string;
    available: boolean;
    preparationTime: number;
    ingredients: string[];
    allergens: string[];
    isVeg: boolean;
    isVegan: boolean;
    isGlutenFree: boolean;
    spiceLevel: 'NONE' | 'MILD' | 'MEDIUM' | 'HOT' | 'EXTRA_HOT';
  }>): Promise<ApiResponse<MenuItem>> {
    const response = await this.api.put<ApiResponse<MenuItem>>(this.buildTenantEndpoint(`/menu/${id}`), payload);
    return response.data;
  }

  async updateMenuAvailability(id: string, available: boolean): Promise<ApiResponse<MenuItem>> {
    const response = await this.api.patch<ApiResponse<MenuItem>>(this.buildTenantEndpoint(`/menu/${id}/availability`), { available });
    return response.data;
  }

  async deleteMenuItem(id: string): Promise<ApiResponse<any>> {
    const response = await this.api.delete<ApiResponse<any>>(this.buildTenantEndpoint(`/menu/${id}`));
    return response.data;
  }

  // Category methods
  async getCategories(): Promise<ApiResponse<Category[]>> {
    const response = await this.api.get<ApiResponse<Category[]>>(this.buildTenantEndpoint('/categories'));
    return response.data;
  }

  async getCategory(id: string): Promise<ApiResponse<Category>> {
    const response = await this.api.get<ApiResponse<Category>>(this.buildTenantEndpoint(`/categories/${id}`));
    return response.data;
  }

  // Table methods
  async getTables(): Promise<ApiResponse<Table[]>> {
    const response = await this.api.get<ApiResponse<Table[]>>(this.buildTenantEndpoint('/tables'));
    return response.data;
  }

  async getAvailableTables(): Promise<ApiResponse<Table[]>> {
    const response = await this.api.get<ApiResponse<Table[]>>(this.buildTenantEndpoint('/tables/available'));
    return response.data;
  }

  // Order methods
  async createOrder(orderData: {
    tableId: string;
    items: { menuItemId: string; quantity: number; notes?: string }[];
    specialInstructions?: string;
    couponCode?: string;
    paymentProvider?: 'RAZORPAY' | 'PAYTM' | 'PHONEPE' | 'CASH';
  }): Promise<ApiResponse<Order>> {
    console.log('Sending order data to backend:', orderData);
    console.log('API URL:', this.api.defaults.baseURL);
    console.log('Headers:', this.api.defaults.headers);
    
    const response = await this.api.post<ApiResponse<Order>>(this.buildTenantEndpoint('/orders'), orderData);
    console.log('Order creation response:', response);
    return response.data;
  }

  async getOrders(): Promise<ApiResponse<Order[]>> {
    const response = await this.api.get<ApiResponse<Order[]>>(this.buildTenantEndpoint('/orders'));
    return response.data;
  }

  async getOrdersPage(page = 1, limit = 20): Promise<ApiResponse<Order[]>> {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    const response = await this.api.get<ApiResponse<Order[]>>(this.buildTenantEndpoint(`/orders?${params.toString()}`));
    return response.data;
  }

  async getRestaurantOrders(channel: 'ALL' | 'DINE_IN' | 'DELIVERY' | MarketplaceSourceSystem = 'ALL'): Promise<ApiResponse<Order[]>> {
    const params = new URLSearchParams();
    if (channel !== 'ALL') {
      params.set('channel', channel);
    }
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await this.api.get<ApiResponse<Order[]>>(this.buildTenantEndpoint(`/orders/restaurant/all${suffix}`));
    return response.data;
  }

  async getRestaurantOrdersPage(
    page = 1,
    limit = 20,
    channel: 'ALL' | 'DINE_IN' | 'DELIVERY' | MarketplaceSourceSystem = 'ALL'
  ): Promise<ApiResponse<Order[]>> {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (channel !== 'ALL') {
      params.set('channel', channel);
    }
    const response = await this.api.get<ApiResponse<Order[]>>(this.buildTenantEndpoint(`/orders/restaurant/all?${params.toString()}`));
    return response.data;
  }

  async getOrder(id: string): Promise<ApiResponse<Order>> {
    const response = await this.api.get<ApiResponse<Order>>(this.buildTenantEndpoint(`/orders/${id}`));
    return response.data;
  }

  async updateOrderStatus(id: string, status: string): Promise<ApiResponse<Order>> {
    const response = await this.api.put<ApiResponse<Order>>(this.buildTenantEndpoint(`/orders/${id}/status`), { status });
    return response.data;
  }

  async cancelOrder(id: string): Promise<ApiResponse<Order>> {
    const response = await this.api.put<ApiResponse<Order>>(this.buildTenantEndpoint(`/orders/${id}/cancel`));
    return response.data;
  }

  async addOrderItems(orderId: string, payload: {
    items: { menuItemId: string; quantity: number; notes?: string }[];
    specialInstructions?: string;
  }): Promise<ApiResponse<Order>> {
    const response = await this.api.post<ApiResponse<Order>>(this.buildTenantEndpoint(`/orders/${orderId}/items`), payload);
    return response.data;
  }

  async applyCouponToOrder(orderId: string, couponCode: string): Promise<ApiResponse<Order>> {
    const response = await this.api.post<ApiResponse<Order>>(this.buildTenantEndpoint(`/orders/${orderId}/apply-coupon`), { couponCode });
    return response.data;
  }

  // Delivery methods
  async getDeliveryOrders(): Promise<ApiResponse<DeliveryOrder[]>> {
    const response = await this.api.get<ApiResponse<DeliveryOrder[]>>(this.buildTenantEndpoint('/delivery/orders/restaurant/all'));
    return response.data;
  }

  async assignDeliveryRider(orderId: string, payload: { riderName: string; riderPhone: string }): Promise<ApiResponse<DeliveryOrder>> {
    const response = await this.api.put<ApiResponse<DeliveryOrder>>(this.buildTenantEndpoint(`/delivery/orders/${orderId}/assign-rider`), payload);
    return response.data;
  }

  async updateDeliveryOrderStatus(orderId: string, deliveryStatus: DeliveryStatus): Promise<ApiResponse<DeliveryOrder>> {
    const response = await this.api.put<ApiResponse<DeliveryOrder>>(this.buildTenantEndpoint(`/delivery/orders/${orderId}/status`), { deliveryStatus });
    return response.data;
  }

  // Coupon methods
  async validateCoupon(code: string, subtotalPaise: number): Promise<any> {
    const response = await this.api.post<ApiResponse>(this.buildTenantEndpoint('/coupons/validate'), { code, subtotalPaise });
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to validate coupon');
  }

  async getCoupons(): Promise<any> {
    const response = await this.api.get<ApiResponse>(this.buildTenantEndpoint('/coupons'));
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to fetch coupons');
  }

  async createCoupon(payload: any): Promise<any> {
    const response = await this.api.post<ApiResponse>(this.buildTenantEndpoint('/coupons'), payload);
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to create coupon');
  }

  async updateCoupon(id: string, payload: any): Promise<any> {
    const response = await this.api.put<ApiResponse>(this.buildTenantEndpoint(`/coupons/${id}`), payload);
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to update coupon');
  }

  // KOT methods
  async getKotTickets(status?: KOTStatus): Promise<KOTTicket[]> {
    const query = status ? `?status=${status}` : '';
    const response = await this.api.get<ApiResponse<KOTTicket[]>>(this.buildTenantEndpoint(`/kot/tickets${query}`));
    if (response.data.success) {
      return response.data.data || [];
    }
    throw new Error(response.data.error || 'Failed to fetch KOT tickets');
  }

  async getKotTicketByOrder(orderId: string): Promise<KOTTicket> {
    const response = await this.api.get<ApiResponse<KOTTicket>>(this.buildTenantEndpoint(`/kot/tickets/order/${orderId}`));
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to fetch KOT ticket');
  }

  async updateKotStatus(orderId: string, status: KOTStatus, note?: string): Promise<KOTTicket> {
    const response = await this.api.patch<ApiResponse<KOTTicket>>(this.buildTenantEndpoint(`/kot/tickets/order/${orderId}/status`), {
      status,
      note,
    });
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to update KOT status');
  }

  async updateKotPriority(orderId: string, priority: number, note?: string): Promise<KOTTicket> {
    const response = await this.api.patch<ApiResponse<KOTTicket>>(this.buildTenantEndpoint(`/kot/tickets/order/${orderId}/priority`), {
      priority,
      note,
    });
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to update KOT priority');
  }

  async getKotSummary(overdueMinutes?: number): Promise<KOTOperationalSummary> {
    const query = typeof overdueMinutes === 'number' ? `?overdueMinutes=${encodeURIComponent(String(overdueMinutes))}` : '';
    const response = await this.api.get<ApiResponse<KOTOperationalSummary>>(this.buildTenantEndpoint(`/kot/summary${query}`));
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to fetch KOT summary');
  }

  // Inventory methods
  async getRawMaterials(): Promise<RawMaterial[]> {
    const response = await this.api.get<ApiResponse<RawMaterial[]>>(this.buildTenantEndpoint('/inventory/raw-materials'));
    if (response.data.success) {
      return response.data.data || [];
    }
    throw new Error(response.data.error || 'Failed to fetch raw materials');
  }

  async createRawMaterial(payload: {
    name: string;
    sku?: string;
    unit: string;
    currentStock?: number;
    reorderLevel?: number;
    costPerUnitPaise?: number;
  }): Promise<RawMaterial> {
    const response = await this.api.post<ApiResponse<RawMaterial>>(this.buildTenantEndpoint('/inventory/raw-materials'), payload);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to create raw material');
  }

  async saveMenuRecipe(payload: {
    menuItemId: string;
    ingredients: Array<{ rawMaterialId: string; quantity: number; wasteFactorPct?: number }>;
  }): Promise<void> {
    const response = await this.api.post<ApiResponse>(this.buildTenantEndpoint('/inventory/recipes'), payload);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to save recipe mapping');
    }
  }

  async getMenuRecipe(menuItemId: string): Promise<any[]> {
    const response = await this.api.get<ApiResponse<any[]>>(this.buildTenantEndpoint(`/inventory/recipes/menu/${menuItemId}`));
    if (response.data.success) {
      return response.data.data || [];
    }
    throw new Error(response.data.error || 'Failed to fetch recipe mapping');
  }

  async getInventoryAlerts(openOnly = true): Promise<InventoryAlert[]> {
    const response = await this.api.get<ApiResponse<InventoryAlert[]>>(
      this.buildTenantEndpoint(`/inventory/alerts?open=${openOnly ? 'true' : 'false'}`)
    );
    if (response.data.success) {
      return response.data.data || [];
    }
    throw new Error(response.data.error || 'Failed to fetch inventory alerts');
  }

  async acknowledgeInventoryAlert(alertId: string): Promise<InventoryAlert> {
    const response = await this.api.patch<ApiResponse<InventoryAlert>>(this.buildTenantEndpoint(`/inventory/alerts/${alertId}/ack`));
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to acknowledge inventory alert');
  }

  async getPurchaseOrders(): Promise<PurchaseOrder[]> {
    const response = await this.api.get<ApiResponse<PurchaseOrder[]>>(this.buildTenantEndpoint('/inventory/purchase-orders'));
    if (response.data.success) {
      return response.data.data || [];
    }
    throw new Error(response.data.error || 'Failed to fetch purchase orders');
  }

  async createPurchaseOrder(payload: {
    vendorName: string;
    notes?: string;
    expectedDeliveryAt?: string;
    items: Array<{ rawMaterialId: string; quantityOrdered: number; unitCostPaise: number }>;
  }): Promise<PurchaseOrder> {
    const response = await this.api.post<ApiResponse<PurchaseOrder>>(this.buildTenantEndpoint('/inventory/purchase-orders'), payload);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to create purchase order');
  }

  async receivePurchaseOrderStock(
    purchaseOrderId: string,
    payload: { items: Array<{ rawMaterialId: string; quantityReceived: number; unitCostPaise?: number }> }
  ): Promise<void> {
    const response = await this.api.post<ApiResponse>(this.buildTenantEndpoint(`/inventory/purchase-orders/${purchaseOrderId}/receive`), payload);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to receive purchase order stock');
    }
  }

  // CRM methods
  async getCustomers(query?: string): Promise<CustomerProfile[]> {
    const queryString = query ? `?q=${encodeURIComponent(query)}` : '';
    const response = await this.api.get<ApiResponse<CustomerProfile[]>>(this.buildTenantEndpoint(`/crm/customers${queryString}`));
    if (response.data.success) {
      return response.data.data || [];
    }
    throw new Error(response.data.error || 'Failed to fetch customers');
  }

  async getCustomersAdvanced(params?: {
    q?: string;
    tier?: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
    segment?: 'NEW' | 'LOYAL' | 'HIGH_VALUE' | 'AT_RISK' | 'REGULAR';
    minPoints?: number;
    sortBy?: 'LOYALTY' | 'SPEND' | 'LAST_ORDER';
    direction?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }): Promise<{ data: CustomerProfile[]; pagination?: ApiResponse['pagination'] }> {
    const search = new URLSearchParams();
    if (params?.q) search.set('q', params.q);
    if (params?.tier) search.set('tier', params.tier);
    if (params?.segment) search.set('segment', params.segment);
    if (typeof params?.minPoints === 'number') search.set('minPoints', String(params.minPoints));
    if (params?.sortBy) search.set('sortBy', params.sortBy);
    if (params?.direction) search.set('direction', params.direction);
    if (typeof params?.page === 'number') search.set('page', String(params.page));
    if (typeof params?.limit === 'number') search.set('limit', String(params.limit));

    const suffix = search.toString() ? `?${search.toString()}` : '';
    const response = await this.api.get<ApiResponse<CustomerProfile[]>>(this.buildTenantEndpoint(`/crm/customers${suffix}`));
    if (response.data.success) {
      return {
        data: response.data.data || [],
        pagination: response.data.pagination,
      };
    }
    throw new Error(response.data.error || 'Failed to fetch customers');
  }

  async getCrmOverview(): Promise<CrmOverview> {
    const response = await this.api.get<ApiResponse<CrmOverview>>(this.buildTenantEndpoint('/crm/customers/overview'));
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to fetch CRM overview');
  }

  async getCustomerDetails(userId: string): Promise<{ profile: CustomerProfile; orderHistory: Order[] }> {
    const response = await this.api.get<ApiResponse<{ profile: CustomerProfile; orderHistory: Order[] }>>(
      this.buildTenantEndpoint(`/crm/customers/${userId}`)
    );
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to fetch customer profile');
  }

  async getMyCustomerProfile(): Promise<any> {
    const response = await this.api.get<ApiResponse<any>>(this.buildTenantEndpoint('/crm/me'));
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to fetch loyalty profile');
  }

  async redeemCustomerPoints(userId: string, points: number, reason?: string): Promise<CustomerProfile> {
    const response = await this.api.post<ApiResponse<CustomerProfile>>(
      this.buildTenantEndpoint(`/crm/customers/${userId}/redeem-points`),
      { points, reason }
    );
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to redeem points');
  }

  async updateCustomerNotes(userId: string, notes: string | null): Promise<CustomerProfile> {
    const response = await this.api.patch<ApiResponse<CustomerProfile>>(this.buildTenantEndpoint(`/crm/customers/${userId}/notes`), {
      notes,
    });
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to update customer notes');
  }

  // Analytics methods
  async getDailyAnalytics(date?: string): Promise<AnalyticsSnapshot> {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    const response = await this.api.get<ApiResponse<AnalyticsSnapshot>>(this.buildTenantEndpoint(`/analytics/daily${query}`));
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to fetch daily analytics');
  }

  async getWeeklyAnalytics(date?: string): Promise<AnalyticsSnapshot> {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    const response = await this.api.get<ApiResponse<AnalyticsSnapshot>>(this.buildTenantEndpoint(`/analytics/weekly${query}`));
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to fetch weekly analytics');
  }

  async getAnalyticsHistory(): Promise<AnalyticsSnapshot[]> {
    const response = await this.api.get<ApiResponse<AnalyticsSnapshot[]>>(this.buildTenantEndpoint('/analytics/history'));
    if (response.data.success) {
      return response.data.data || [];
    }
    throw new Error(response.data.error || 'Failed to fetch analytics history');
  }

  async getAnalyticsOverview(params?: { start?: string; end?: string }): Promise<AnalyticsOverview> {
    const search = new URLSearchParams();
    if (params?.start) search.set('start', params.start);
    if (params?.end) search.set('end', params.end);
    const suffix = search.toString() ? `?${search.toString()}` : '';
    const response = await this.api.get<ApiResponse<AnalyticsOverview>>(this.buildTenantEndpoint(`/analytics/overview${suffix}`));
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to fetch analytics overview');
  }

  // POS integration methods
  async syncPosOrder(payload: {
    sourceSystem: string;
    externalOrderId?: string;
    userId: string;
    tableId: string;
    items: Array<{ menuItemId: string; quantity: number; notes?: string }>;
    specialInstructions?: string;
    couponCode?: string;
    paymentProvider?: 'RAZORPAY' | 'PAYTM' | 'PHONEPE' | 'CASH';
  }): Promise<any> {
    const response = await this.api.post<ApiResponse<any>>(this.buildTenantEndpoint('/pos/sync/orders'), payload);
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to sync POS order');
  }

  async getPosSyncLogs(): Promise<PosSyncLog[]> {
    const response = await this.api.get<ApiResponse<PosSyncLog[]>>(this.buildTenantEndpoint('/pos/sync/logs'));
    if (response.data.success) {
      return response.data.data || [];
    }
    throw new Error(response.data.error || 'Failed to fetch POS sync logs');
  }

  async syncMarketplaceOrder(platform: MarketplaceSourceSystem, payload: MarketplaceOrderInput): Promise<any> {
    const response = await this.api.post<ApiResponse<any>>(
      this.buildTenantEndpoint(`/pos/integrations/${platform.toLowerCase()}/orders`),
      payload
    );
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.error || `Failed to sync ${platform} order`);
  }

  async getMarketplaceOrders(params?: { sourceSystem?: MarketplaceSourceSystem; limit?: number }): Promise<MarketplaceOrderSummary[]> {
    const search = new URLSearchParams();
    if (params?.sourceSystem) search.set('sourceSystem', params.sourceSystem);
    if (typeof params?.limit === 'number') search.set('limit', String(params.limit));
    const suffix = search.toString() ? `?${search.toString()}` : '';
    const response = await this.api.get<ApiResponse<MarketplaceOrderSummary[]>>(
      this.buildTenantEndpoint(`/pos/integrations/orders${suffix}`)
    );
    if (response.data.success) {
      return response.data.data || [];
    }
    throw new Error(response.data.error || 'Failed to fetch marketplace orders');
  }

  // Restaurant methods
  async searchRestaurants(query?: string): Promise<RestaurantSummary[]> {
    const params = query ? `?query=${encodeURIComponent(query)}` : '';
    const response = await this.api.get<ApiResponse<{ restaurants: RestaurantSummary[] }>>(`/restaurants/public/search${params}`);
    if (response.data.success) {
      return response.data.data?.restaurants || [];
    }
    throw new Error(response.data.error || 'Failed to search restaurants');
  }

  async getMyRestaurants(): Promise<RestaurantMembership[]> {
    const response = await this.api.get<ApiResponse<{ restaurants: RestaurantMembership[] }>>('/restaurants/mine');
    if (response.data.success) {
      return response.data.data?.restaurants || [];
    }
    throw new Error(response.data.error || 'Failed to fetch your restaurants');
  }

  async createRestaurant(payload: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    cuisineTypes?: string[];
  }): Promise<RestaurantSummary> {
    const response = await this.api.post<ApiResponse<{ restaurant: RestaurantSummary }>>('/restaurants', payload);
    if (response.data.success && response.data.data) {
      return response.data.data.restaurant;
    }
    throw new Error(response.data.error || 'Failed to create restaurant');
  }

  async getRestaurantUsers(): Promise<RestaurantUserEntry[]> {
    const response = await this.api.get<ApiResponse<{ users: RestaurantUserEntry[] }>>(this.buildTenantEndpoint('/restaurants/users'));
    if (response.data.success) {
      return response.data.data?.users || [];
    }
    throw new Error(response.data.error || 'Failed to fetch restaurant users');
  }

  async addRestaurantUser(payload: { email: string; role: 'OWNER' | 'ADMIN' | 'STAFF' }): Promise<void> {
    const response = await this.api.post<ApiResponse>(this.buildTenantEndpoint('/restaurants/users'), payload);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to add restaurant user');
    }
  }

  async getCurrentRestaurant(): Promise<any> {
    const response = await this.api.get<ApiResponse<{ restaurant: any }>>(this.buildTenantEndpoint('/restaurants/current'));
    if (response.data.success) {
      return response.data.data?.restaurant;
    }
    throw new Error(response.data.error || 'Failed to fetch current restaurant');
  }

  async getRestaurantPublicDetails(id: string): Promise<any> {
    const response = await this.api.get<ApiResponse<{ restaurant: any }>>(`/restaurants/public/${id}`);
    if (response.data.success) {
      return response.data.data?.restaurant;
    }
    throw new Error(response.data.error || 'Failed to fetch restaurant details');
  }

  async getRestaurantPaymentPolicy(): Promise<any> {
    const response = await this.api.get<ApiResponse<{ paymentPolicy: any }>>(this.buildTenantEndpoint('/restaurants/settings/payment-policy'));
    if (response.data.success) {
      return response.data.data?.paymentPolicy;
    }
    throw new Error(response.data.error || 'Failed to fetch payment policy');
  }

  async updateRestaurantPaymentPolicy(payload: {
    paymentCollectionTiming: 'BEFORE_MEAL' | 'AFTER_MEAL';
    cashPaymentEnabled: boolean;
  }): Promise<any> {
    const response = await this.api.put<ApiResponse<{ paymentPolicy: any }>>(this.buildTenantEndpoint('/restaurants/settings/payment-policy'), payload);
    if (response.data.success) {
      return response.data.data?.paymentPolicy;
    }
    throw new Error(response.data.error || 'Failed to update payment policy');
  }

  async confirmCashPayment(orderId: string): Promise<any> {
    const response = await this.api.post<ApiResponse<{ order: Order }>>(this.buildTenantEndpoint('/payments/cash/confirm'), { orderId });
    if (response.data.success) {
      return response.data.data?.order;
    }
    throw new Error(response.data.error || 'Failed to confirm cash payment');
  }

  async updatePaymentStatus(payload: {
    orderId: string;
    paymentStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_PAID';
    paidAmountPaise?: number;
  }): Promise<Order> {
    const response = await this.api.put<ApiResponse<{ order: Order }>>(this.buildTenantEndpoint('/payments/status'), payload);
    if (response.data.success) {
      return response.data.data?.order as Order;
    }
    throw new Error(response.data.error || 'Failed to update payment status');
  }

  // Offer methods
  async getOffers(): Promise<Offer[]> {
    const response = await this.api.get<ApiResponse<{ offers: Offer[] }>>(this.buildTenantEndpoint('/offers'));
    if (response.data.success) {
      return response.data.data?.offers || [];
    }
    throw new Error(response.data.error || 'Failed to fetch offers');
  }

  async createOffer(payload: {
    name: string;
    description?: string;
    code?: string;
    discountType: 'PERCENT' | 'FIXED';
    value: number;
    minOrderPaise?: number;
    maxDiscountPaise?: number;
    startsAt?: string;
    endsAt?: string;
    active?: boolean;
  }): Promise<Offer> {
    const response = await this.api.post<ApiResponse<{ offer: Offer }>>(this.buildTenantEndpoint('/offers'), payload);
    if (response.data.success && response.data.data) {
      return response.data.data.offer;
    }
    throw new Error(response.data.error || 'Failed to create offer');
  }

  async updateOffer(id: string, payload: Partial<Offer>): Promise<Offer> {
    const response = await this.api.put<ApiResponse<{ offer: Offer }>>(this.buildTenantEndpoint(`/offers/${id}`), payload);
    if (response.data.success && response.data.data) {
      return response.data.data.offer;
    }
    throw new Error(response.data.error || 'Failed to update offer');
  }

  async deleteOffer(id: string): Promise<void> {
    const response = await this.api.delete<ApiResponse>(this.buildTenantEndpoint(`/offers/${id}`));
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete offer');
    }
  }

  // Platform admin methods
  async getPlatformRestaurants(status?: 'PENDING_APPROVAL' | 'APPROVED' | 'SUSPENDED'): Promise<any[]> {
    const params = status ? `?status=${status}` : '';
    const response = await this.api.get<ApiResponse<{ restaurants: any[] }>>(`/platform/restaurants${params}`);
    if (response.data.success) {
      return response.data.data?.restaurants || [];
    }
    throw new Error(response.data.error || 'Failed to fetch platform restaurants');
  }

  async updatePlatformRestaurantStatus(restaurantId: string, payload: {
    status: 'APPROVED' | 'SUSPENDED';
    suspendedReason?: string;
  }): Promise<any> {
    const response = await this.api.patch<ApiResponse<{ restaurant: any }>>(`/platform/restaurants/${restaurantId}/status`, payload);
    if (response.data.success) {
      return response.data.data?.restaurant;
    }
    throw new Error(response.data.error || 'Failed to update restaurant status');
  }

  async updatePlatformCommission(restaurantId: string, commissionRate: number): Promise<any> {
    const response = await this.api.patch<ApiResponse<{ restaurant: any }>>(`/platform/restaurants/${restaurantId}/commission`, { commissionRate });
    if (response.data.success) {
      return response.data.data?.restaurant;
    }
    throw new Error(response.data.error || 'Failed to update commission');
  }

  // Generic API methods
  async get<T>(endpoint: string): Promise<T> {
    const response = await this.api.get<ApiResponse<T>>(endpoint);
    if (response.data.success) {
      return response.data.data as T;
    }
    throw new Error(response.data.error || 'Request failed');
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    const response = await this.api.post<ApiResponse<T>>(endpoint, data);
    if (response.data.success) {
      return response.data.data as T;
    }
    throw new Error(response.data.error || 'Request failed');
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    const response = await this.api.put<ApiResponse<T>>(endpoint, data);
    if (response.data.success) {
      return response.data.data as T;
    }
    throw new Error(response.data.error || 'Request failed');
  }

  async delete<T>(endpoint: string): Promise<T> {
    const response = await this.api.delete<ApiResponse<T>>(endpoint);
    if (response.data.success) {
      return response.data.data as T;
    }
    throw new Error(response.data.error || 'Request failed');
  }
}

export const apiClient = new ApiClient();
