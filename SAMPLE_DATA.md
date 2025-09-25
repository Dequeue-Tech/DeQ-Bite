# Sample Data for Restaurant Web App

This file contains comprehensive sample data for development and testing purposes.

## 🔐 Test Login Credentials

For development and testing, use these pre-configured accounts:

### Admin Account
- **Email**: `admin@restaurant.com`
- **Password**: `admin123`
- **Role**: ADMIN
- **Access**: Full admin dashboard, menu management, order management

### Customer Accounts
- **Email**: `customer@example.com`
- **Password**: `customer123`
- **Role**: CUSTOMER
- **Access**: Browse menu, place orders, view order history

- **Email**: `jane@example.com`
- **Password**: `jane123`
- **Role**: CUSTOMER
- **Access**: Browse menu, place orders, view order history

### 🎯 Quick Testing
These accounts work immediately without any database setup! Perfect for:
- Testing authentication flow
- Role-based access control
- Order placement workflow
- Admin functionality

## 📋 Data Structure

### Categories (4 items)
- **Appetizers** - Starters and small plates
- **Main Courses** - Hearty main dishes  
- **Desserts** - Sweet treats and endings
- **Beverages** - Drinks and refreshments

### Menu Items (14 items)
Each item includes:
- Basic info (name, description, price, image)
- Category association
- Preparation time
- Ingredients and allergens
- Dietary flags (vegetarian, vegan, gluten-free)
- Spice level
- Availability status

### Tables (8 tables)
- Different capacities (2, 4, 6, 8 seats)
- Various locations (window, center, garden, private)
- All active and available

### Users (3 users)
- 1 Admin user
- 2 Customer users
- All verified with contact info

### Sample Orders (2 orders)
- Complete order history with items
- Different statuses (completed, preparing)
- Payment information
- Table assignments

## 🚀 Usage in Separated Architecture

### Backend API Fallback
When database is unavailable, APIs automatically use sample data:
- `POST /api/auth/login` - Test with sample credentials
- `GET /api/categories` - Returns sample categories
- `GET /api/menu` - Returns sample menu items
- `GET /api/tables` - Returns sample tables

### Frontend Development
Use sample data for frontend development before backend integration:
```javascript
// Sample data structure matches API responses
const sampleOrder = {
  id: "order_123",
  total: 1197,
  subtotal: 1015,
  tax: 182,
  // ... complete structure
};
```

## 🔧 Integration Points

### Authentication
Sample users work with JWT authentication in the separated backend.

### Payment Testing
Use Razorpay test credentials with sample orders for payment flow testing.

### Invoice Generation
Sample orders can generate test invoices through the separated invoice API.

## 📊 Sample Data Stats

- **14 Menu Items** across 4 categories
- **8 Tables** with varying capacities
- **3 Users** (1 admin, 2 customers)
- **2 Sample Orders** with complete history
- **Dietary Options**: Vegetarian, Vegan, Gluten-Free marked
- **Spice Levels**: None, Mild, Medium, Hot, Extra Hot
- **Price Range**: ₹69 - ₹599

## 🎯 Development Benefits for Separated Architecture

1. **Backend Testing** - Test APIs without frontend
2. **Frontend Testing** - Test UI without backend
3. **Integration Testing** - Consistent data for end-to-end tests
4. **Error Handling** - Graceful fallback when services fail
5. **Security Testing** - Test authentication flows
6. **Payment Testing** - Test payment flows with known data

This comprehensive sample data ensures both backend and frontend work perfectly during development! 🍽️