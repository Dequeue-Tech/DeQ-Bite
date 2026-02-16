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
  role: 'CUSTOMER' | 'OWNER' | 'ADMIN' | 'STAFF';
  restaurantRole?: 'OWNER' | 'ADMIN' | 'STAFF' | null;
  verified: boolean;
  createdAt: string;
}

export interface RestaurantSummary {
  id: string;
  name: string;
  slug: string;
  subdomain: string;
  address?: string | null;
}

export interface RestaurantMembership {
  id: string;
  name: string;
  slug: string;
  subdomain: string;
  role: 'OWNER' | 'ADMIN' | 'STAFF';
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
    role: 'CUSTOMER' | 'OWNER' | 'ADMIN' | 'STAFF';
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
  status: string;
  items: OrderItem[];
  subtotalPaise: number;
  taxPaise: number;
  discountPaise: number;
  totalPaise: number;
  paymentId?: string;
  paymentProvider?: 'RAZORPAY' | 'PAYTM' | 'PHONEPE';
  paymentStatus: string;
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
        const subdomain = this.getRestaurantSubdomain();
        if (subdomain) {
          config.headers['x-restaurant-subdomain'] = subdomain;
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

  setSelectedRestaurantSubdomain(subdomain: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('selected_restaurant_subdomain', subdomain.toLowerCase());
    }
  }

  getSelectedRestaurantSubdomain(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selected_restaurant_subdomain');
    }
    return null;
  }

  private getRestaurantSubdomain(): string | null {
    if (typeof window === 'undefined') return null;

    const selectedSubdomain = this.getSelectedRestaurantSubdomain();
    if (selectedSubdomain) {
      return selectedSubdomain.toLowerCase();
    }

    const host = window.location.hostname.toLowerCase();
    const baseDomain = (process.env.NEXT_PUBLIC_BASE_DOMAIN || '').toLowerCase();

    if (baseDomain && host.endsWith(`.${baseDomain}`)) {
      return host.replace(`.${baseDomain}`, '');
    }

    if (host.includes('.') && !host.endsWith('localhost')) {
      return host.split('.')[0];
    }

    const devSubdomain = process.env.NEXT_PUBLIC_DEV_SUBDOMAIN;
    if (devSubdomain) return devSubdomain.toLowerCase();

    return null;
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
    const response = await this.api.post<ApiResponse>('/payments/create', { orderId, paymentProvider });
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to create payment');
  }

  async getPaymentProviders(): Promise<string[]> {
    const response = await this.api.get<ApiResponse>('/payments/providers');
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
      const response = await this.api.post<ApiResponse>('/payments/verify', paymentData);
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
    const response = await this.api.get<ApiResponse>(`/payments/status/${orderId}`);
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to get payment status');
  }

  // Invoice methods
  async generateInvoice(orderId: string, methods: ('EMAIL' | 'SMS')[]): Promise<any> {
    const response = await this.api.post<ApiResponse>('/invoices/generate', {
      orderId,
      methods,
    });
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to generate invoice');
  }

  async getInvoice(orderId: string): Promise<any> {
    const response = await this.api.get<ApiResponse>(`/invoices/${orderId}`);
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to get invoice');
  }

  async getUserInvoices(): Promise<any[]> {
    const response = await this.api.get<ApiResponse>('/invoices/user/list');
    if (response.data.success) {
      return response.data.data.invoices;
    }
    throw new Error(response.data.error || 'Failed to get invoices');
  }

  async resendInvoice(invoiceId: string, methods: ('EMAIL' | 'SMS')[]): Promise<any> {
    const response = await this.api.post<ApiResponse>(`/invoices/${invoiceId}/resend`, {
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
    const url = `/pdf/invoice/${invoiceId}`;
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
    const response = await this.api.post<ApiResponse>(`/invoices/${invoiceId}/refresh-pdf`);
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to refresh invoice PDF');
  }

  // Menu methods
  async getMenuItems(categoryId?: string): Promise<ApiResponse<MenuItem[]>> {
    const params = categoryId ? `?categoryId=${categoryId}` : '';
    const response = await this.api.get<ApiResponse<MenuItem[]>>(`/menu${params}`);
    return response.data;
  }

  async getMenuItem(id: string): Promise<ApiResponse<MenuItem>> {
    const response = await this.api.get<ApiResponse<MenuItem>>(`/menu/${id}`);
    return response.data;
  }

  async getAdminMenuItems(): Promise<ApiResponse<MenuItem[]>> {
    const response = await this.api.get<ApiResponse<MenuItem[]>>('/menu/admin/all');
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
    const response = await this.api.post<ApiResponse<MenuItem>>('/menu', payload);
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
    const response = await this.api.put<ApiResponse<MenuItem>>(`/menu/${id}`, payload);
    return response.data;
  }

  async updateMenuAvailability(id: string, available: boolean): Promise<ApiResponse<MenuItem>> {
    const response = await this.api.patch<ApiResponse<MenuItem>>(`/menu/${id}/availability`, { available });
    return response.data;
  }

  async deleteMenuItem(id: string): Promise<ApiResponse<any>> {
    const response = await this.api.delete<ApiResponse<any>>(`/menu/${id}`);
    return response.data;
  }

  // Category methods
  async getCategories(): Promise<ApiResponse<Category[]>> {
    const response = await this.api.get<ApiResponse<Category[]>>('/categories');
    return response.data;
  }

  async getCategory(id: string): Promise<ApiResponse<Category>> {
    const response = await this.api.get<ApiResponse<Category>>(`/categories/${id}`);
    return response.data;
  }

  // Table methods
  async getTables(): Promise<ApiResponse<Table[]>> {
    const response = await this.api.get<ApiResponse<Table[]>>('/tables');
    return response.data;
  }

  async getAvailableTables(): Promise<ApiResponse<Table[]>> {
    const response = await this.api.get<ApiResponse<Table[]>>('/tables/available');
    return response.data;
  }

  // Order methods
  async createOrder(orderData: {
    tableId: string;
    items: { menuItemId: string; quantity: number; notes?: string }[];
    specialInstructions?: string;
    couponCode?: string;
    paymentProvider?: 'RAZORPAY' | 'PAYTM' | 'PHONEPE';
  }): Promise<ApiResponse<Order>> {
    console.log('Sending order data to backend:', orderData);
    console.log('API URL:', this.api.defaults.baseURL);
    console.log('Headers:', this.api.defaults.headers);
    
    const response = await this.api.post<ApiResponse<Order>>('/orders', orderData);
    console.log('Order creation response:', response);
    return response.data;
  }

  async getOrders(): Promise<ApiResponse<Order[]>> {
    const response = await this.api.get<ApiResponse<Order[]>>('/orders');
    return response.data;
  }

  async getRestaurantOrders(): Promise<ApiResponse<Order[]>> {
    const response = await this.api.get<ApiResponse<Order[]>>('/orders/restaurant/all');
    return response.data;
  }

  async getOrder(id: string): Promise<ApiResponse<Order>> {
    const response = await this.api.get<ApiResponse<Order>>(`/orders/${id}`);
    return response.data;
  }

  async updateOrderStatus(id: string, status: string): Promise<ApiResponse<Order>> {
    const response = await this.api.put<ApiResponse<Order>>(`/orders/${id}/status`, { status });
    return response.data;
  }

  async cancelOrder(id: string): Promise<ApiResponse<Order>> {
    const response = await this.api.put<ApiResponse<Order>>(`/orders/${id}/cancel`);
    return response.data;
  }

  // Coupon methods
  async validateCoupon(code: string, subtotalPaise: number): Promise<any> {
    const response = await this.api.post<ApiResponse>('/coupons/validate', { code, subtotalPaise });
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to validate coupon');
  }

  async getCoupons(): Promise<any> {
    const response = await this.api.get<ApiResponse>('/coupons');
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to fetch coupons');
  }

  async createCoupon(payload: any): Promise<any> {
    const response = await this.api.post<ApiResponse>('/coupons', payload);
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to create coupon');
  }

  async updateCoupon(id: string, payload: any): Promise<any> {
    const response = await this.api.put<ApiResponse>(`/coupons/${id}`, payload);
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
    slug: string;
    subdomain: string;
    email?: string;
    phone?: string;
    address?: string;
  }): Promise<RestaurantSummary> {
    const response = await this.api.post<ApiResponse<{ restaurant: RestaurantSummary }>>('/restaurants', payload);
    if (response.data.success && response.data.data) {
      return response.data.data.restaurant;
    }
    throw new Error(response.data.error || 'Failed to create restaurant');
  }

  async getRestaurantUsers(): Promise<RestaurantUserEntry[]> {
    const response = await this.api.get<ApiResponse<{ users: RestaurantUserEntry[] }>>('/restaurants/users');
    if (response.data.success) {
      return response.data.data?.users || [];
    }
    throw new Error(response.data.error || 'Failed to fetch restaurant users');
  }

  async addRestaurantUser(payload: { email: string; role: 'OWNER' | 'ADMIN' | 'STAFF' }): Promise<void> {
    const response = await this.api.post<ApiResponse>('/restaurants/users', payload);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to add restaurant user');
    }
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
