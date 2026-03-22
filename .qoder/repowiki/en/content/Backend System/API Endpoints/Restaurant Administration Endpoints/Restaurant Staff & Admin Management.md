# Restaurant Staff & Admin Management

<cite>
**Referenced Files in This Document**
- [package.json](file://restaurant-backend/package.json)
- [app.ts](file://restaurant-backend/src/app.ts)
- [server.ts](file://restaurant-backend/src/server.ts)
- [auth.ts](file://restaurant-backend/src/middleware/auth.ts)
- [restaurant.ts](file://restaurant-backend/src/middleware/restaurant.ts)
- [auth.ts](file://restaurant-backend/src/routes/auth.ts)
- [restaurants.ts](file://restaurant-backend/src/routes/restaurants.ts)
- [schema.prisma](file://restaurant-backend/prisma/schema.prisma)
- [package.json](file://restaurant-frontend/package.json)
- [layout.tsx](file://restaurant-frontend/src/app/layout.tsx)
- [RestaurantStaffGuard.tsx](file://restaurant-frontend/src/components/RestaurantStaffGuard.tsx)
- [page.tsx](file://restaurant-frontend/src/app/admin/page.tsx)
- [api-client.ts](file://restaurant-frontend/src/lib/api-client.ts)
- [auth.ts](file://restaurant-frontend/src/store/auth.ts)
- [README.md](file://README.md)
- [IMPLEMENTATION_STATUS.md](file://IMPLEMENTATION_STATUS.md)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [System Architecture](#system-architecture)
3. [Authentication & Authorization System](#authentication--authorization-system)
4. [Restaurant Context Management](#restaurant-context-management)
5. [Staff & Admin Roles](#staff--admin-roles)
6. [Admin Dashboard Implementation](#admin-dashboard-implementation)
7. [Staff Access Control](#staff-access-control)
8. [Data Models & Relationships](#data-models--relationships)
9. [API Endpoints & Routes](#api-endpoints--routes)
10. [Security Implementation](#security-implementation)
11. [Frontend Integration](#frontend-integration)
12. [Deployment & Configuration](#deployment--configuration)
13. [Troubleshooting Guide](#troubleshooting-guide)
14. [Conclusion](#conclusion)

## Introduction

The Restaurant Staff & Admin Management system is a comprehensive solution designed for managing restaurant operations with secure staff and administrative access control. This system separates backend and frontend components for enhanced security, scalability, and maintainability. It provides robust authentication mechanisms, role-based access control, real-time order management, and comprehensive administrative dashboards.

The system supports multiple user roles including customers, staff members, administrators, and owners, each with specific permissions and access levels. It features real-time order processing, automated invoice generation, payment integration with security verification, and comprehensive analytics for business insights.

## System Architecture

The restaurant management system follows a microservices-like architecture with clear separation between frontend and backend components:

```mermaid
graph TB
subgraph "Frontend Layer"
FE[Next.js Frontend]
AuthStore[Auth Store]
StaffGuard[Staff Guard]
AdminUI[Admin Dashboard]
end
subgraph "Backend Layer"
API[Express.js API]
AuthMW[Authentication Middleware]
RestaurantMW[Restaurant Middleware]
Routes[Route Handlers]
DB[(PostgreSQL Database)]
end
subgraph "External Services"
Razorpay[Razorpay Payment]
Email[Email Service]
SMS[SMS Service]
PDF[PDF Generator]
end
FE --> API
AuthStore --> FE
StaffGuard --> FE
AdminUI --> FE
FE --> AuthStore
FE --> StaffGuard
FE --> AdminUI
API --> AuthMW
API --> RestaurantMW
API --> Routes
Routes --> DB
Routes --> Razorpay
Routes --> Email
Routes --> SMS
Routes --> PDF
AuthMW --> DB
RestaurantMW --> DB
```

**Diagram sources**
- [app.ts:35-147](file://restaurant-backend/src/app.ts#L35-L147)
- [layout.tsx:23-60](file://restaurant-frontend/src/app/layout.tsx#L23-L60)

The architecture ensures that:
- **Security**: All payment processing and sensitive operations occur server-side
- **Scalability**: Frontend and backend can scale independently
- **Maintainability**: Clear separation of concerns with modular components
- **Real-time**: WebSocket connections enable live order updates

## Authentication & Authorization System

The authentication system implements JWT-based security with comprehensive role-based access control:

```mermaid
sequenceDiagram
participant Client as Client Application
participant AuthRoute as Auth Route
participant JWT as JWT Middleware
participant DB as Database
participant RestaurantMW as Restaurant Middleware
Client->>AuthRoute : POST /api/auth/login
AuthRoute->>DB : Verify user credentials
DB-->>AuthRoute : User data
AuthRoute->>JWT : Generate JWT token
JWT-->>AuthRoute : Signed token
AuthRoute-->>Client : Authentication response
Client->>RestaurantMW : Request with Authorization header
RestaurantMW->>JWT : Verify token
JWT->>DB : Validate user
DB-->>JWT : User details
JWT-->>RestaurantMW : Decoded user info
RestaurantMW-->>Client : Authorized request
```

**Diagram sources**
- [auth.ts:7-75](file://restaurant-backend/src/middleware/auth.ts#L7-L75)
- [auth.ts:110-164](file://restaurant-backend/src/routes/auth.ts#L110-L164)

### Authentication Flow

The system implements a multi-layered authentication approach:

1. **Token Extraction**: Supports multiple token locations (Authorization header, body, query)
2. **JWT Verification**: Validates tokens using environment-configured secrets
3. **User Validation**: Confirms user existence and active status
4. **Restaurant Context**: Attaches restaurant-specific context when available

### Authorization Roles

The system defines hierarchical roles with specific permissions:

| Role | Permissions | Access Level |
|------|-------------|--------------|
| **CUSTOMER** | View menu, place orders, track orders | Basic User |
| **STAFF** | Access kitchen dashboard, update order status | Restaurant Employee |
| **KITCHEN_STAFF** | Access kitchen-specific features | Kitchen Operations |
| **ADMIN** | Full restaurant management, user management | Restaurant Manager |
| **OWNER** | Complete system access, financial controls | System Administrator |

**Section sources**
- [auth.ts:77-89](file://restaurant-backend/src/middleware/auth.ts#L77-L89)
- [schema.prisma:340-347](file://restaurant-backend/prisma/schema.prisma#L340-L347)

## Restaurant Context Management

The restaurant context system enables multi-tenancy with dynamic restaurant identification:

```mermaid
flowchart TD
Request[Incoming Request] --> ExtractHeader[Extract Headers]
ExtractHeader --> CheckSlug{Check x-restaurant-slug}
CheckSlug --> |Found| UseSlug[Use Provided Slug]
CheckSlug --> |Not Found| CheckSubdomain{Check Subdomain}
CheckSubdomain --> |Found| UseSubdomain[Use Subdomain]
CheckSubdomain --> |Not Found| CheckPath{Check Path Parameters}
CheckPath --> |Found| UsePath[Use Path Identifier]
CheckPath --> |Not Found| NoContext[No Restaurant Context]
UseSlug --> ValidateRestaurant[Validate Restaurant Exists]
UseSubdomain --> ValidateRestaurant
UsePath --> ValidateRestaurant
ValidateRestaurant --> AttachContext[Attach Restaurant Context]
NoContext --> Continue[Continue Without Context]
AttachContext --> NextMiddleware[Proceed to Next Middleware]
Continue --> NextMiddleware
```

**Diagram sources**
- [restaurant.ts:85-211](file://restaurant-backend/src/middleware/restaurant.ts#L85-L211)

### Restaurant Identification Methods

The system supports multiple restaurant identification approaches:

1. **Header-based**: `x-restaurant-slug` or `x-restaurant-subdomain`
2. **Subdomain-based**: Domain subdomain routing
3. **Path-based**: URL path parameters
4. **Automatic Detection**: Host header analysis

### Context Validation

Restaurant context validation includes:
- Active restaurant status checks
- Approval status verification
- Field compatibility validation
- Graceful fallback for schema mismatches

**Section sources**
- [restaurant.ts:213-277](file://restaurant-backend/src/middleware/restaurant.ts#L213-L277)

## Staff & Admin Roles

The staff and admin management system provides comprehensive role-based access control:

```mermaid
classDiagram
class User {
+String id
+String email
+String name
+String role
+Boolean verified
+String phone
+DateTime createdAt
}
class Restaurant {
+String id
+String name
+String slug
+String subdomain
+Boolean active
+String status
+Boolean cashPaymentEnabled
+String paymentCollectionTiming
}
class RestaurantUser {
+String id
+String restaurantId
+String userId
+String role
+Boolean active
+DateTime createdAt
}
class UserRole {
<<enumeration>>
CUSTOMER
ADMIN
STAFF
CENTRAL_ADMIN
OWNER
KITCHEN_STAFF
}
class RestaurantRole {
<<enumeration>>
OWNER
ADMIN
STAFF
}
User "1" --* "many" RestaurantUser : belongs_to
Restaurant "1" --* "many" RestaurantUser : manages
RestaurantUser --> UserRole : has_role
RestaurantUser --> RestaurantRole : has_restaurant_role
```

**Diagram sources**
- [schema.prisma:11-89](file://restaurant-backend/prisma/schema.prisma#L11-L89)

### Role Hierarchies

The system implements a clear role hierarchy:

**Primary Roles**:
- **CUSTOMER**: Basic user with ordering privileges
- **STAFF**: Restaurant employees with operational access
- **ADMIN**: Restaurant managers with administrative privileges
- **OWNER**: System administrators with complete access

**Restaurant Roles**:
- **OWNER**: Highest restaurant authority
- **ADMIN**: Day-to-day restaurant management
- **STAFF**: Operational staff members

### Permission Matrix

| Action | CUSTOMER | STAFF | ADMIN | OWNER |
|--------|----------|-------|-------|-------|
| View Menu | ✓ | ✓ | ✓ | ✓ |
| Place Orders | ✓ | ✗ | ✗ | ✗ |
| Update Order Status | ✗ | ✓ | ✓ | ✓ |
| Manage Menu | ✗ | ✗ | ✓ | ✓ |
| Manage Staff | ✗ | ✗ | ✓ | ✓ |
| Financial Reports | ✗ | ✗ | ✓ | ✓ |
| System Configuration | ✗ | ✗ | ✗ | ✓ |

**Section sources**
- [restaurants.ts:46-55](file://restaurant-backend/src/routes/restaurants.ts#L46-L55)
- [restaurants.ts:548-646](file://restaurant-backend/src/routes/restaurants.ts#L548-L646)

## Admin Dashboard Implementation

The admin dashboard provides comprehensive restaurant management capabilities:

```mermaid
graph LR
subgraph "Admin Dashboard"
Dashboard[Dashboard Overview]
Orders[Live Orders]
Menu[Menu Management]
Users[Team Management]
Payments[Settings]
end
subgraph "Real-time Features"
LiveUpdates[Live Order Updates]
Notifications[Push Notifications]
Analytics[Sales Analytics]
end
subgraph "Management Functions"
OrderStatus[Update Order Status]
PaymentProcessing[Process Payments]
MenuOperations[Menu CRUD]
UserManagement[User Management]
Settings[Payment Policy]
end
Dashboard --> Analytics
Orders --> LiveUpdates
Orders --> Notifications
Menu --> MenuOperations
Users --> UserManagement
Payments --> Settings
LiveUpdates --> OrderStatus
OrderStatus --> PaymentProcessing
```

**Diagram sources**
- [page.tsx:40-512](file://restaurant-frontend/src/app/admin/page.tsx#L40-L512)

### Dashboard Components

The admin dashboard consists of several key components:

**1. Dashboard Overview**
- Revenue tracking and KPI metrics
- Order pipeline visualization
- Top-selling dishes analysis
- Real-time order notifications

**2. Live Orders Management**
- Real-time order status updates
- Unified order modification interface
- Payment status management
- Instant notification system

**3. Menu Management**
- Complete menu administration
- Category organization
- Dish availability control
- Pricing management

**4. Team Management**
- Staff member addition and removal
- Role assignment and management
- Active status control
- Restaurant membership management

**5. Settings & Configuration**
- Payment policy configuration
- Collection timing settings
- Cash payment enablement
- Restaurant preferences

### Real-time Functionality

The system implements comprehensive real-time features:

```mermaid
sequenceDiagram
participant Admin as Admin Interface
participant Socket as WebSocket Server
participant Backend as Backend API
participant Database as Database
Admin->>Socket : Subscribe to order events
Socket->>Backend : Establish connection
Backend->>Database : Listen for order changes
Database-->>Backend : Order update event
Backend->>Socket : Broadcast order update
Socket-->>Admin : Real-time order status
Admin->>Backend : Update order status
Backend->>Database : Persist changes
Backend->>Socket : Notify subscribers
```

**Diagram sources**
- [page.tsx:99-113](file://restaurant-frontend/src/app/admin/page.tsx#L99-L113)

**Section sources**
- [page.tsx:120-143](file://restaurant-frontend/src/app/admin/page.tsx#L120-L143)
- [page.tsx:345-412](file://restaurant-frontend/src/app/admin/page.tsx#L345-L412)

## Staff Access Control

The staff access control system ensures appropriate access levels for restaurant employees:

```mermaid
flowchart TD
UserLogin[Staff Member Login] --> CheckRole{Check Role}
CheckRole --> |STAFF| StaffAccess[Grant Staff Access]
CheckRole --> |KITCHEN_STAFF| KitchenAccess[Grant Kitchen Access]
CheckRole --> |ADMIN| AdminAccess[Grant Admin Access]
CheckRole --> |OWNER| OwnerAccess[Grant Full Access]
StaffAccess --> KitchenRedirect[Kitchen Redirect]
KitchenAccess --> KitchenRedirect
AdminAccess --> AdminRedirect[Admin Dashboard Redirect]
OwnerAccess --> AdminRedirect
KitchenRedirect --> KitchenFeatures[Kitchen Features Only]
AdminRedirect --> FullAdmin[Full Admin Features]
KitchenFeatures --> OrderStatus[Order Status Updates]
KitchenFeatures --> Preparation[Preparation Tracking]
FullAdmin --> MenuManagement[Menu Management]
FullAdmin --> UserManagement[User Management]
FullAdmin --> Analytics[Analytics Dashboard]
```

**Diagram sources**
- [RestaurantStaffGuard.tsx:70-150](file://restaurant-frontend/src/components/RestaurantStaffGuard.tsx#L70-L150)

### Access Control Mechanisms

The system implements multiple layers of access control:

**1. Frontend Guard System**
- Automatic redirection based on user roles
- Restaurant membership validation
- Preferred restaurant selection
- Route protection enforcement

**2. Backend Authorization**
- Restaurant context validation
- Role-based endpoint access
- Membership status verification
- Permission matrix enforcement

**3. Context-aware Routing**
- Staff members redirected to kitchen view
- Admins directed to restaurant-specific admin
- Ownership validation for sensitive operations
- Multi-restaurant membership handling

### Staff Member Management

The system provides comprehensive staff management capabilities:

**Adding New Staff Members**:
- Email-based user invitation
- Role assignment (STAFF, ADMIN, OWNER)
- Automatic restaurant membership creation
- Audit trail logging

**Role Management**:
- Dynamic role updates
- Active status control
- Restaurant-specific permissions
- Ownership restrictions

**Access Validation**:
- Restaurant membership verification
- Active status checks
- Role hierarchy enforcement
- Context-aware permission validation

**Section sources**
- [RestaurantStaffGuard.tsx:80-150](file://restaurant-frontend/src/components/RestaurantStaffGuard.tsx#L80-L150)
- [restaurants.ts:548-646](file://restaurant-backend/src/routes/restaurants.ts#L548-L646)

## Data Models & Relationships

The system implements a comprehensive data model supporting restaurant operations:

```mermaid
erDiagram
USER {
String id PK
String email UK
String phone UK
String name
String password
String role
Boolean verified
DateTime createdAt
DateTime updatedAt
}
RESTAURANT {
String id PK
String name
String slug UK
String subdomain UK
String status
String email
String phone
String address
String city
String state
String country
String[] cuisineTypes
Boolean active
Boolean cashPaymentEnabled
String paymentCollectionTiming
DateTime approvedAt
String approvedByUserId
}
RESTAURANT_USER {
String id PK
String restaurantId FK
String userId FK
String role
Boolean active
DateTime createdAt
DateTime updatedAt
}
CATEGORY {
String id PK
String name
String description
String image
Boolean active
Number sortOrder
String restaurantId FK
DateTime createdAt
DateTime updatedAt
}
MENU_ITEM {
String id PK
String name
String description
String image
String categoryId FK
Boolean available
Number preparationTime
String[] ingredients
String[] allergens
Boolean isVeg
Boolean isVegan
Boolean isGlutenFree
String spiceLevel
Number pricePaise
String restaurantId FK
DateTime createdAt
DateTime updatedAt
}
TABLE {
String id PK
Number number
Number capacity
String location
Boolean active
String restaurantId FK
DateTime createdAt
DateTime updatedAt
}
ORDER {
String id PK
String userId FK
String tableId FK
String status
String paymentId
String paymentStatus
String specialInstructions
Number estimatedTime
Number subtotalPaise
Number taxPaise
Number discountPaise
Number totalPaise
Number paidAmountPaise
Number dueAmountPaise
String couponId FK
String restaurantId FK
DateTime createdAt
DateTime updatedAt
}
ORDER_ITEM {
String id PK
String orderId FK
String menuItemId FK
Number quantity
String notes
Number pricePaise
DateTime createdAt
DateTime updatedAt
}
INVOICE {
String id PK
String orderId UK
String invoiceNumber UK
String pdfPath
String pdfName
Boolean emailSent
Boolean smsSent
DateTime issuedAt
}
USER ||--o{ RESTAURANT_USER : belongs_to
RESTAURANT ||--o{ RESTAURANT_USER : manages
RESTAURANT ||--o{ CATEGORY : contains
CATEGORY ||--o{ MENU_ITEM : contains
RESTAURANT ||--o{ TABLE : contains
RESTAURANT ||--o{ ORDER : processes
MENU_ITEM ||--o{ ORDER_ITEM : ordered_in
ORDER ||--|| INVOICE : generates
TABLE ||--o{ ORDER : seats
```

**Diagram sources**
- [schema.prisma:11-416](file://restaurant-backend/prisma/schema.prisma#L11-L416)

### Core Entity Relationships

The data model establishes clear relationships between entities:

**User Management**:
- Users can belong to multiple restaurants
- Role hierarchy supports restaurant-specific permissions
- Verification system ensures account validity

**Restaurant Operations**:
- Restaurants contain menus, tables, and staff
- Menu categories organize food offerings
- Table management supports seating arrangements

**Order Processing**:
- Orders link users, tables, and menu items
- Order items track individual menu selections
- Invoice generation ties orders to billing documents

**Section sources**
- [schema.prisma:11-73](file://restaurant-backend/prisma/schema.prisma#L11-L73)

## API Endpoints & Routes

The system provides comprehensive API endpoints for restaurant management:

### Authentication Endpoints

| Endpoint | Method | Description | Authentication |
|----------|--------|-------------|----------------|
| `/api/auth/register` | POST | User registration | None |
| `/api/auth/login` | POST | User authentication | None |
| `/api/auth/me` | GET | Get user profile | JWT Required |
| `/api/auth/profile` | GET | Enhanced user profile | JWT Required |
| `/api/auth/change-password` | PUT | Change password | JWT Required |
| `/api/auth/refresh` | POST | Refresh authentication token | JWT Required |

### Restaurant Management Endpoints

| Endpoint | Method | Description | Authentication |
|----------|--------|-------------|----------------|
| `/api/restaurants` | POST | Create new restaurant | JWT Required |
| `/api/restaurants/mine` | GET | Get user's restaurants | JWT Required |
| `/api/restaurants/current` | GET | Get current restaurant context | JWT Required |
| `/api/restaurants/users` | GET | List restaurant users | JWT Required |
| `/api/restaurants/users` | POST | Add restaurant user | JWT Required |
| `/api/restaurants/settings/payment-policy` | GET | Get payment policy | JWT Required |
| `/api/restaurants/settings/payment-policy` | PUT | Update payment policy | JWT Required |

### Menu & Order Endpoints

| Endpoint | Method | Description | Authentication |
|----------|--------|-------------|----------------|
| `/api/menu` | GET | Get menu items | JWT Optional |
| `/api/menu/admin/all` | GET | Get all menu items (admin) | JWT Required |
| `/api/menu` | POST | Create menu item | JWT Required |
| `/api/menu/:id` | PUT | Update menu item | JWT Required |
| `/api/menu/:id/availability` | PATCH | Toggle availability | JWT Required |
| `/api/orders` | GET | Get orders | JWT Required |
| `/api/orders/restaurant/all` | GET | Get restaurant orders | JWT Required |
| `/api/orders/:id/status` | PUT | Update order status | JWT Required |

### Real-time & Event Endpoints

| Endpoint | Method | Description | Authentication |
|----------|--------|-------------|----------------|
| `/api/events` | GET | Subscribe to real-time events | JWT Required |
| `/api/payments/create` | POST | Create payment order | JWT Required |
| `/api/payments/verify` | POST | Verify payment signature | JWT Required |
| `/api/invoices/generate` | POST | Generate invoice | JWT Required |

**Section sources**
- [auth.ts:53-396](file://restaurant-backend/src/routes/auth.ts#L53-L396)
- [restaurants.ts:358-649](file://restaurant-backend/src/routes/restaurants.ts#L358-L649)

## Security Implementation

The system implements comprehensive security measures across all layers:

### Authentication Security

**JWT Token Management**:
- Configurable expiration periods
- Secure token signing with environment keys
- Automatic token refresh mechanisms
- Multi-location token extraction

**Password Security**:
- bcrypt-based password hashing
- Configurable salt rounds (12 rounds)
- Secure password validation
- Account lockout prevention

### Authorization Security

**Role-based Access Control**:
- Hierarchical role permissions
- Restaurant-specific context validation
- Membership status verification
- Dynamic permission enforcement

**Request Security**:
- Input validation with Zod schemas
- CORS protection with allowed origins
- Rate limiting (200 requests/15 minutes)
- Security headers with Helmet.js

### Payment Security

**Razorpay Integration**:
- Server-side payment signature verification
- HMAC-SHA256 signature validation
- Payment status tracking
- Transaction audit logging

**Invoice Security**:
- Post-payment invoice generation
- Secure PDF creation and storage
- User-specific access control
- Multi-channel delivery tracking

### Data Protection

**Database Security**:
- Prisma ORM with query validation
- Connection pooling and management
- Schema validation and migrations
- Audit logging for all operations

**Frontend Security**:
- Local storage encryption for tokens
- CSRF protection
- XSS prevention
- Input sanitization

**Section sources**
- [auth.ts:37-75](file://restaurant-backend/src/middleware/auth.ts#L37-L75)
- [app.ts:38-86](file://restaurant-backend/src/app.ts#L38-L86)
- [restaurants.ts:548-646](file://restaurant-backend/src/routes/restaurants.ts#L548-L646)

## Frontend Integration

The frontend integrates seamlessly with the backend API and provides intuitive user interfaces:

### Component Architecture

```mermaid
graph TB
subgraph "Layout Components"
RootLayout[Root Layout]
Navbar[Navigation Bar]
StaffGuard[Staff Access Guard]
ContextSync[Restaurant Context Sync]
end
subgraph "Feature Components"
AdminPage[Admin Dashboard]
KitchenView[Kitchen Interface]
StaffPortal[Staff Portal]
CustomerPortal[Customer Portal]
end
subgraph "Utility Components"
ApiClient[API Client]
AuthStore[Authentication Store]
RealtimeClient[Real-time Client]
end
RootLayout --> Navbar
RootLayout --> StaffGuard
RootLayout --> ContextSync
StaffGuard --> AdminPage
StaffGuard --> KitchenView
StaffGuard --> StaffPortal
AdminPage --> ApiClient
KitchenView --> ApiClient
StaffPortal --> ApiClient
ApiClient --> AuthStore
ApiClient --> RealtimeClient
```

**Diagram sources**
- [layout.tsx:23-60](file://restaurant-frontend/src/app/layout.tsx#L23-L60)
- [RestaurantStaffGuard.tsx:70-150](file://restaurant-frontend/src/components/RestaurantStaffGuard.tsx#L70-L150)

### State Management

The frontend uses Zustand for efficient state management:

**Authentication State**:
- User session management
- Token persistence
- Loading states
- Error handling

**Restaurant Context**:
- Active restaurant selection
- Multi-restaurant support
- Context synchronization
- Route protection

**Real-time Updates**:
- WebSocket connection management
- Live order updates
- Notification handling
- Event subscription

### Real-time Communication

The system implements WebSocket-based real-time communication:

```mermaid
sequenceDiagram
participant Frontend as Frontend Client
participant Socket as WebSocket Server
participant Backend as Backend API
participant Database as Database
Frontend->>Socket : Connect with authentication token
Socket->>Backend : Validate token and establish connection
Backend->>Database : Subscribe to restaurant events
Database-->>Backend : Event data
Backend->>Socket : Forward event data
Socket-->>Frontend : Real-time updates
Frontend->>Backend : Send order update
Backend->>Database : Update order status
Backend->>Socket : Broadcast status change
Socket-->>Frontend : Confirm update
```

**Diagram sources**
- [page.tsx:99-113](file://restaurant-frontend/src/app/admin/page.tsx#L99-L113)

**Section sources**
- [auth.ts:24-177](file://restaurant-frontend/src/store/auth.ts#L24-L177)
- [api-client.ts:200-263](file://restaurant-frontend/src/lib/api-client.ts#L200-L263)

## Deployment & Configuration

The system supports flexible deployment configurations for various environments:

### Environment Configuration

**Backend Environment Variables**:

| Variable | Purpose | Example Value |
|----------|---------|---------------|
| `DATABASE_URL` | Database connection string | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | JWT token signing key | `your-secure-jwt-secret` |
| `RAZORPAY_KEY_ID` | Payment gateway key | `rzp_live_xxxxxxxxxxxxxx` |
| `RAZORPAY_KEY_SECRET` | Payment gateway secret | `your_live_secret` |
| `FRONTEND_URL` | Allowed frontend origin | `https://your-frontend.com` |

**Frontend Environment Variables**:

| Variable | Purpose | Example Value |
|----------|---------|---------------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `https://your-backend.com/api` |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Payment gateway key | `rzp_live_xxxxxxxxxxxxxx` |

### Deployment Options

**Development Setup**:
- Local development servers
- Hot reloading capabilities
- Debugging tools integration
- Database seeding for testing

**Production Deployment**:
- Containerized deployment support
- Load balancing configuration
- SSL/TLS certificate management
- Database migration automation

**Section sources**
- [README.md:187-205](file://README.md#L187-L205)
- [IMPLEMENTATION_STATUS.md:203-220](file://IMPLEMENTATION_STATUS.md#L203-L220)

## Troubleshooting Guide

### Common Issues and Solutions

**Authentication Problems**:
- **Issue**: JWT token validation fails
- **Solution**: Verify `JWT_SECRET` environment variable is set correctly
- **Debug**: Check backend logs for token verification errors

**Restaurant Context Issues**:
- **Issue**: Restaurant not found or context not applied
- **Solution**: Verify restaurant slug/subdomain matches database records
- **Debug**: Check `x-restaurant-slug` header in API requests

**Permission Denied Errors**:
- **Issue**: Access forbidden for authenticated users
- **Solution**: Verify user role and restaurant membership status
- **Debug**: Check `restaurantUser` table for active memberships

**Real-time Updates Not Working**:
- **Issue**: Live order updates not received
- **Solution**: Verify WebSocket connection and authentication token
- **Debug**: Check browser console for connection errors

**Payment Processing Issues**:
- **Issue**: Payment verification failures
- **Solution**: Verify Razorpay credentials and webhook configuration
- **Debug**: Check payment logs and signature verification results

### Performance Optimization

**Database Queries**:
- Implement proper indexing on frequently queried fields
- Use pagination for large datasets
- Optimize JOIN operations in complex queries

**Frontend Performance**:
- Implement lazy loading for heavy components
- Use React.memo for expensive renders
- Optimize WebSocket connection management

**Caching Strategies**:
- Implement Redis caching for frequently accessed data
- Use HTTP caching headers appropriately
- Cache restaurant metadata and user preferences

**Section sources**
- [README.md:236-243](file://README.md#L236-L243)
- [IMPLEMENTATION_STATUS.md:221-227](file://IMPLEMENTATION_STATUS.md#L221-L227)

## Conclusion

The Restaurant Staff & Admin Management system provides a comprehensive, secure, and scalable solution for restaurant operations management. The system successfully implements multi-layered security, role-based access control, real-time functionality, and comprehensive administrative capabilities.

Key achievements include:

**Security Excellence**: JWT-based authentication, server-side payment processing, comprehensive input validation, and robust authorization mechanisms.

**Operational Efficiency**: Real-time order management, automated invoice generation, comprehensive analytics, and streamlined staff workflows.

**Technical Architecture**: Clean separation of frontend and backend, scalable microservices design, comprehensive error handling, and extensive logging capabilities.

**User Experience**: Intuitive interfaces for different user roles, responsive design, real-time updates, and seamless multi-restaurant support.

The system is production-ready with comprehensive documentation, testing capabilities, and deployment flexibility. It provides a solid foundation for restaurant management operations while maintaining security, scalability, and maintainability standards.