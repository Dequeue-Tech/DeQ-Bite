import axios, { AxiosInstance, AxiosResponse } from 'axios';

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: any[];
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

class ApiClient {
  private api: AxiosInstance;

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
      (config) => {
        const token = this.getAuthToken();
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

  private getAuthToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token');
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
    }
  }

  getSelectedRestaurantSlug(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selected_restaurant_slug');
    }
    return null;
  }

  private getRestaurantSlugFromPath(): string | null {
    if (typeof window === 'undefined') return null;
    const match = /^\/r\/([^\/?#]+)/i.exec(window.location.pathname);
    if (!match || !match[1]) return null;
    return match[1].toLowerCase();
  }

  private getRestaurantSlug(): string | null {
    if (typeof window === 'undefined') return null;

    const pathSlug = this.getRestaurantSlugFromPath();
    if (pathSlug) return pathSlug;

    const selectedSlug = this.getSelectedRestaurantSlug();
    if (selectedSlug) return selectedSlug.toLowerCase();

    const devSlug = process.env.NEXT_PUBLIC_DEV_RESTAURANT_SLUG || process.env.NEXT_PUBLIC_DEV_SUBDOMAIN;
    if (devSlug) return devSlug.toLowerCase();

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

  // Authentication methods
  async login(data: LoginData): Promise<AuthResponse> {
    const response = await this.api.post<ApiResponse<AuthResponse>>('/auth/login', data);
    if (response.data.success && response.data.data) {
      this.setAuthToken(response.data.data.token);
      return response.data.data;
    }
    throw new Error(response.data.error || 'Login failed');
  }

  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await this.api.post<ApiResponse<AuthResponse>>('/auth/register', data);
    if (response.data.success && response.data.data) {
      this.setAuthToken(response.data.data.token);
      return response.data.data;
    }
    throw new Error(response.data.error || 'Registration failed');
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
    const response = await this.api.put<ApiResponse>('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to change password');
    }
  }

  async logout(): Promise<void> {
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

  async getRestaurantOrders(): Promise<ApiResponse<Order[]>> {
    const response = await this.api.get<ApiResponse<Order[]>>(this.buildTenantEndpoint('/orders/restaurant/all'));
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
