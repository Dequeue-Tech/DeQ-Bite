import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'CUSTOMER' | 'OWNER' | 'ADMIN' | 'STAFF';
    name: string;
  };
  restaurant?: {
    id: string;
    slug: string;
    subdomain: string;
    name: string;
    paymentCollectionTiming: 'BEFORE_MEAL' | 'AFTER_MEAL';
    cashPaymentEnabled: boolean;
  };
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: 'CUSTOMER' | 'OWNER' | 'ADMIN' | 'STAFF';
  createdAt: Date;
  updatedAt: Date;
}

export interface MenuItem {
  id: string;
  name: string;
  pricePaise: number;
  description?: string;
  image?: string;
  categoryId: string;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  image?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Order {
  id: string;
  userId: string;
  tableId: string;
  status: 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'SERVED' | 'COMPLETED' | 'CANCELLED';
  paymentStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  subtotalPaise: number;
  taxPaise: number;
  discountPaise: number;
  totalPaise: number;
  specialInstructions?: string;
  paymentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  quantity: number;
  pricePaise: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Table {
  id: string;
  number: number;
  capacity: number;
  location?: string;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Invoice {
  id: string;
  orderId: string;
  invoiceNumber: string;
  sentVia: ('EMAIL' | 'SMS')[];
  emailSent: boolean;
  smsSent: boolean;
  pdfPath?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentData {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: any[];
}
