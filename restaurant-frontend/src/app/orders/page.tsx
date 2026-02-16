'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, MapPin, CreditCard, FileText, RefreshCw, Download, Mail } from 'lucide-react';
import { apiClient, Order } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth';
import toast from 'react-hot-toast';
import { formatInr } from '@/lib/currency';

const statusColors = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  PREPARING: 'bg-orange-100 text-orange-800',
  READY: 'bg-green-100 text-green-800',
  SERVED: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

const statusLabels = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  PREPARING: 'Preparing',
  READY: 'Ready',
  SERVED: 'Served',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export default function OrdersPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [downloadingInvoice, setDownloadingInvoice] = useState<string | null>(null);
  const [sendingInvoice, setsendingInvoice] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchOrders();
    }
  }, [isAuthenticated, user]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getOrders();
      if (response.success) {
        setOrders(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const refreshOrders = async () => {
    await fetchOrders();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getTimeElapsed = (createdAt: string) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffInMinutes = Math.floor((now.getTime() - created.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes} minutes ago`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }
  };

  const handleDownloadInvoice = async (orderId: string) => {
    try {
      setDownloadingInvoice(orderId);
      // Generate and download invoice - only for completed payments
      const order = orders.find(o => o.id === orderId);
      if (order && order.paymentStatus === 'COMPLETED') {
        // Try to get existing invoice
        const invoiceResponse = await apiClient.getInvoice(orderId);
        let invoiceId = invoiceResponse?.invoice?.id as string | undefined;

        // If not found, generate it
        if (!invoiceId) {
          const gen = await apiClient.generateInvoice(orderId, []);
          invoiceId = gen?.invoice?.id;
        }

        if (!invoiceId) {
          toast.error('Failed to get or generate invoice.');
          return;
        }

        // Download via authenticated blob request; if fails, refresh and retry
        let blob: Blob; let filename: string;
        try {
          const res = await apiClient.downloadInvoicePdf(invoiceId);
          blob = res.blob; filename = res.filename;
        } catch (err) {
          await apiClient.refreshInvoicePdf(invoiceId);
          const res2 = await apiClient.downloadInvoicePdf(invoiceId);
          blob = res2.blob; filename = res2.filename;
        }

        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename || 'invoice.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(blobUrl);
        toast.success('Invoice download started');

        await fetchOrders();
      } else {
        toast.error('Invoice can only be generated for completed payments');
      }
    } catch (error: any) {
      console.error('Error generating invoice:', error);
      toast.error(error.message || 'Failed to generate invoice');
    } finally {
      setDownloadingInvoice(null);
    }
  };

  const handleSendInvoice = async (orderId: string) => {
    try {
      setsendingInvoice(orderId);
      // Check if invoice already exists for this order
      const order = orders.find(o => o.id === orderId);
      if (order && order.paymentStatus === 'COMPLETED') {
        // First try to get existing invoice
        try {
          const invoiceResponse = await apiClient.getInvoice(orderId);
          if (invoiceResponse && invoiceResponse.invoice) {
            // Resend existing invoice
            const response = await apiClient.resendInvoice(invoiceResponse.invoice.id, ['EMAIL']);
            if (response) {
              // Check if there were any warnings
              if (response.warnings && response.warnings.length > 0) {
                toast.success(`Invoice sent with warnings: ${response.warnings.join(', ')}`);
              } else {
                toast.success('Invoice sent to your email!');
              }
            } else {
              toast.error('Failed to send invoice. Please try again.');
            }
          } else {
            // Generate new invoice if none exists
            const response = await apiClient.generateInvoice(orderId, ['EMAIL']);
            if (response && response.invoice) {
              // Check if there were any warnings
              if (response.warnings && response.warnings.length > 0) {
                toast.success(`Invoice generated and sent with warnings: ${response.warnings.join(', ')}`);
              } else {
                toast.success('Invoice generated and sent to your email!');
              }
            } else {
              toast.error('Failed to generate invoice. Please try again.');
            }
          }
        } catch (error) {
          // If getting invoice fails, generate a new one
          try {
            const response = await apiClient.generateInvoice(orderId, ['EMAIL']);
            if (response && response.invoice) {
              // Check if there were any warnings
              if (response.warnings && response.warnings.length > 0) {
                toast.success(`Invoice generated and sent with warnings: ${response.warnings.join(', ')}`);
              } else {
                toast.success('Invoice generated and sent to your email!');
              }
            } else {
              toast.error('Failed to generate invoice. Please try again.');
            }
          } catch (generateError) {
            console.error('Error generating invoice:', generateError);
            toast.error('Failed to generate invoice. Please try again.');
          }
        }
      } else {
        toast.error('Invoice can only be sent for completed payments');
      }
    } catch (error: any) {
      console.error('Error sending invoice:', error);
      toast.error(error.message || 'Failed to send invoice');
    } finally {
      setsendingInvoice(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Enhanced Refresh Button */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Your Orders</h1>
          <button
            onClick={refreshOrders}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl shadow-md hover:from-orange-600 hover:to-orange-700 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            <RefreshCw className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
            <span className="font-medium">Refresh Orders</span>
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-orange-600" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-4">No Orders Yet</h2>
            <p className="text-gray-600 mb-8">Start by placing your first order!</p>
            <button
              onClick={() => router.push('/menu')}
              className="bg-orange-600 text-white px-8 py-3 rounded-lg hover:bg-orange-700 transition-colors"
            >
              Browse Menu
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map(order => (
              <div key={order.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">
                        Order #{order.id.substring(0, 8).toUpperCase()}
                      </h3>
                      <p className="text-gray-600">{formatDate(order.createdAt)}</p>
                      <p className="text-sm text-gray-500">{getTimeElapsed(order.createdAt)}</p>
                    </div>
                    
                    <div className="flex items-center space-x-4 mt-4 md:mt-0">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        statusColors[order.status as keyof typeof statusColors]
                      }`}>
                        {statusLabels[order.status as keyof typeof statusLabels]}
                      </span>
                      <span className="text-xl font-bold text-orange-600">
                        {formatInr(order.totalPaise)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-600">
                        Table {order.table?.number || order.tableId} - {order.table?.location || 'Not specified'}
                      </span>
                    </div>
                    
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-600">
                        Est. {order.estimatedTime || 30} minutes
                      </span>
                    </div>
                    
                    <div className="flex items-center">
                      <CreditCard className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-600">
                        Payment: {order.paymentStatus.toLowerCase()}
                      </span>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium text-gray-800">Items Ordered</h4>
                      <button
                        onClick={() => setSelectedOrder(selectedOrder === order.id ? null : order.id)}
                        className="text-orange-600 hover:text-orange-700 text-sm"
                      >
                        {selectedOrder === order.id ? 'Hide Details' : 'View Details'}
                      </button>
                    </div>
                    
                    {selectedOrder === order.id && (
                      <div className="space-y-2 mb-4">
                        {order.items.map((item, index) => (
                          <div key={index} className="flex justify-between items-center py-2">
                            <div>
                              <span className="font-medium">{item.menuItem?.name || 'Item'}</span>
                              <span className="text-gray-600 ml-2">x{item.quantity}</span>
                            </div>
                            <span className="font-semibold">
                              {formatInr(item.pricePaise * item.quantity)}
                            </span>
                          </div>
                        ))}
                        
                        <div className="border-t border-gray-200 pt-2 space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Subtotal</span>
                            <span>{formatInr(order.subtotalPaise)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Discount</span>
                            <span className="text-green-600">- {formatInr(order.discountPaise || 0)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Tax</span>
                            <span>{formatInr(order.taxPaise)}</span>
                          </div>
                          <div className="flex justify-between font-semibold">
                            <span>Total</span>
                            <span className="text-orange-600">{formatInr(order.totalPaise)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 mt-4">
                    {order.status === 'PENDING' && (
                      <button className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                        Cancel Order
                      </button>
                    )}
                    
                    {(order.status === 'COMPLETED' || order.status === 'CANCELLED') && (
                      <>
                        <button className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors">
                          Reorder
                        </button>
                        {order.paymentStatus === 'COMPLETED' ? (
                          <>
                            <button 
                              onClick={() => handleDownloadInvoice(order.id)}
                              disabled={downloadingInvoice === order.id}
                              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center"
                            >
                              <Download className="h-4 w-4 mr-2" />
                              {downloadingInvoice === order.id ? 'Generating...' : 'Download Invoice'}
                            </button>
                            <button 
                              onClick={() => handleSendInvoice(order.id)}
                              disabled={sendingInvoice === order.id}
                              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center"
                            >
                              <Mail className="h-4 w-4 mr-2" />
                              {sendingInvoice === order.id ? 'Sending...' : 'Send Invoice'}
                            </button>
                          </>
                        ) : (
                          <button 
                            disabled
                            className="px-4 py-2 border border-gray-300 text-gray-400 rounded-lg cursor-not-allowed flex items-center"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Pay to Download Invoice
                          </button>
                        )}
                      </>
                    )}
                    
                    {order.status === 'READY' && (
                      <div className="px-4 py-2 bg-green-100 text-green-800 rounded-lg">
                        Your order is ready for pickup!
                      </div>
                    )}
                    
                    {/* Show invoice buttons for any order with completed payment, not just completed/cancelled orders */}
                    {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && order.paymentStatus === 'COMPLETED' && (
                      <>
                        <button 
                          onClick={() => handleDownloadInvoice(order.id)}
                          disabled={downloadingInvoice === order.id}
                          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          {downloadingInvoice === order.id ? 'Generating...' : 'Download Invoice'}
                        </button>
                        <button 
                          onClick={() => handleSendInvoice(order.id)}
                          disabled={sendingInvoice === order.id}
                          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center"
                        >
                          <Mail className="h-4 w-4 mr-2" />
                          {sendingInvoice === order.id ? 'Sending...' : 'Send Invoice'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
