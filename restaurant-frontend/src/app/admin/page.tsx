'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { 
  BarChart3, 
  Users, 
  ShoppingBag, 
  DollarSign, 
  Clock, 
  ChefHat,
  Settings,
  LogOut,
  Bell,
  TrendingUp
} from 'lucide-react';

// Sample dashboard data
const dashboardStats = {
  totalOrders: 156,
  totalRevenue: 4250.75,
  activeUsers: 89,
  pendingOrders: 8,
  todayOrders: 24,
  todayRevenue: 580.50,
};

const recentOrders = [
  {
    id: '1',
    orderNumber: 'ORD-2024-156',
    customer: 'John Doe',
    table: 3,
    total: 45.99,
    status: 'PREPARING',
    time: '10 mins ago',
  },
  {
    id: '2',
    orderNumber: 'ORD-2024-155',
    customer: 'Jane Smith',
    table: 7,
    total: 32.50,
    status: 'READY',
    time: '15 mins ago',
  },
  {
    id: '3',
    orderNumber: 'ORD-2024-154',
    customer: 'Mike Johnson',
    table: 2,
    total: 28.75,
    status: 'CONFIRMED',
    time: '22 mins ago',
  },
];

const statusColors = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  PREPARING: 'bg-orange-100 text-orange-800',
  READY: 'bg-green-100 text-green-800',
  SERVED: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export default function AdminDashboard() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [selectedTab, setSelectedTab] = useState('overview');

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') {
      router.push('/auth/signin');
    }
  }, [user, router]);

  const handleLogout = () => {
    logout();
    router.push('/auth/signin');
  };

  const updateOrderStatus = (orderId: string, newStatus: string) => {
    // In a real app, this would make an API call
    console.log(`Updating order ${orderId} to ${newStatus}`);
  };

  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ChefHat className="h-12 w-12 text-orange-600 mx-auto mb-4" />
          <p className="text-gray-600">Access denied. Admin privileges required.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-lg">
        <div className="flex items-center justify-center h-16 bg-orange-600">
          <ChefHat className="h-8 w-8 text-white mr-2" />
          <span className="text-white text-xl font-bold">Restaurant Admin</span>
        </div>
        
        <nav className="mt-8">
          <div className="px-4 space-y-2">
            <button
              onClick={() => setSelectedTab('overview')}
              className={`w-full flex items-center px-4 py-2 text-left rounded-lg transition-colors ${
                selectedTab === 'overview'
                  ? 'bg-orange-100 text-orange-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <BarChart3 className="h-5 w-5 mr-3" />
              Overview
            </button>
            
            <button
              onClick={() => setSelectedTab('orders')}
              className={`w-full flex items-center px-4 py-2 text-left rounded-lg transition-colors ${
                selectedTab === 'orders'
                  ? 'bg-orange-100 text-orange-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <ShoppingBag className="h-5 w-5 mr-3" />
              Orders
              <span className="ml-auto bg-orange-600 text-white text-xs px-2 py-1 rounded-full">
                {dashboardStats.pendingOrders}
              </span>
            </button>
            
            <button
              onClick={() => setSelectedTab('menu')}
              className={`w-full flex items-center px-4 py-2 text-left rounded-lg transition-colors ${
                selectedTab === 'menu'
                  ? 'bg-orange-100 text-orange-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <ChefHat className="h-5 w-5 mr-3" />
              Menu Management
            </button>
            
            <button
              onClick={() => setSelectedTab('users')}
              className={`w-full flex items-center px-4 py-2 text-left rounded-lg transition-colors ${
                selectedTab === 'users'
                  ? 'bg-orange-100 text-orange-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Users className="h-5 w-5 mr-3" />
              Users
            </button>
            
            <button
              onClick={() => setSelectedTab('settings')}
              className={`w-full flex items-center px-4 py-2 text-left rounded-lg transition-colors ${
                selectedTab === 'settings'
                  ? 'bg-orange-100 text-orange-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Settings className="h-5 w-5 mr-3" />
              Settings
            </button>
          </div>
          
          <div className="absolute bottom-4 left-4 right-4">
            <button
              onClick={handleLogout}
              className="w-full flex items-center px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="h-5 w-5 mr-3" />
              Logout
            </button>
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <div className="ml-64">
        {/* Top Bar */}
        <div className="bg-white shadow-sm h-16 flex items-center justify-between px-6">
          <h1 className="text-2xl font-semibold text-gray-800">
            {selectedTab.charAt(0).toUpperCase() + selectedTab.slice(1)}
          </h1>
          
          <div className="flex items-center space-x-4">
            <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
              <Bell className="h-5 w-5" />
            </button>
            <div className="flex items-center">
              <span className="text-sm text-gray-600 mr-2">Welcome, {user.name}</span>
              <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-semibold">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6">
          {selectedTab === 'overview' && (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Orders</p>
                      <p className="text-2xl font-bold text-gray-800">{dashboardStats.totalOrders}</p>
                    </div>
                    <ShoppingBag className="h-8 w-8 text-orange-600" />
                  </div>
                  <div className="mt-2 flex items-center">
                    <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                    <span className="text-sm text-green-600">+12% from yesterday</span>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Revenue</p>
                      <p className="text-2xl font-bold text-gray-800">${dashboardStats.totalRevenue}</p>
                    </div>
                    <DollarSign className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="mt-2 flex items-center">
                    <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                    <span className="text-sm text-green-600">+8% from yesterday</span>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Active Users</p>
                      <p className="text-2xl font-bold text-gray-800">{dashboardStats.activeUsers}</p>
                    </div>
                    <Users className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="mt-2 flex items-center">
                    <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                    <span className="text-sm text-green-600">+5% from yesterday</span>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Pending Orders</p>
                      <p className="text-2xl font-bold text-gray-800">{dashboardStats.pendingOrders}</p>
                    </div>
                    <Clock className="h-8 w-8 text-yellow-600" />
                  </div>
                  <div className="mt-2">
                    <span className="text-sm text-gray-600">Needs attention</span>
                  </div>
                </div>
              </div>

              {/* Recent Orders */}
              <div className="bg-white rounded-lg shadow-md">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-800">Recent Orders</h2>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {recentOrders.map(order => (
                      <div key={order.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div>
                            <p className="font-semibold text-gray-800">{order.orderNumber}</p>
                            <p className="text-sm text-gray-600">{order.customer} • Table {order.table}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          <span className="font-semibold text-gray-800">${order.total}</span>
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            statusColors[order.status as keyof typeof statusColors]
                          }`}>
                            {order.status}
                          </span>
                          <span className="text-sm text-gray-500">{order.time}</span>
                          
                          {order.status === 'PREPARING' && (
                            <button
                              onClick={() => updateOrderStatus(order.id, 'READY')}
                              className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                            >
                              Mark Ready
                            </button>
                          )}
                          
                          {order.status === 'READY' && (
                            <button
                              onClick={() => updateOrderStatus(order.id, 'SERVED')}
                              className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                            >
                              Mark Served
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedTab === 'orders' && (
            <div className="bg-white rounded-lg shadow-md">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800">Order Management</h2>
              </div>
              <div className="p-6">
                <p className="text-gray-600">Full order management interface would be implemented here.</p>
                <div className="mt-4 space-y-2">
                  <p>• View all orders with filtering and search</p>
                  <p>• Update order status (Pending → Confirmed → Preparing → Ready → Served)</p>
                  <p>• View order details and customer information</p>
                  <p>• Process refunds and cancellations</p>
                  <p>• Real-time notifications for new orders</p>
                </div>
              </div>
            </div>
          )}

          {selectedTab === 'menu' && (
            <div className="bg-white rounded-lg shadow-md">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800">Menu Management</h2>
              </div>
              <div className="p-6">
                <p className="text-gray-600">Menu management interface would be implemented here.</p>
                <div className="mt-4 space-y-2">
                  <p>• Add, edit, and delete menu items</p>
                  <p>• Manage categories and pricing</p>
                  <p>• Upload and manage item images</p>
                  <p>• Set availability and dietary information</p>
                  <p>• Bulk import/export functionality</p>
                </div>
              </div>
            </div>
          )}

          {selectedTab === 'users' && (
            <div className="bg-white rounded-lg shadow-md">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800">User Management</h2>
              </div>
              <div className="p-6">
                <p className="text-gray-600">User management interface would be implemented here.</p>
                <div className="mt-4 space-y-2">
                  <p>• View all registered users</p>
                  <p>• Manage user roles and permissions</p>
                  <p>• View order history for each user</p>
                  <p>• Send notifications to users</p>
                  <p>• Handle user account issues</p>
                </div>
              </div>
            </div>
          )}

          {selectedTab === 'settings' && (
            <div className="bg-white rounded-lg shadow-md">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800">Settings</h2>
              </div>
              <div className="p-6">
                <p className="text-gray-600">Application settings would be configured here.</p>
                <div className="mt-4 space-y-2">
                  <p>• Restaurant information and hours</p>
                  <p>• Payment gateway configuration</p>
                  <p>• Email and SMS settings</p>
                  <p>• Tax rates and service charges</p>
                  <p>• Table configuration</p>
                  <p>• System maintenance mode</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}