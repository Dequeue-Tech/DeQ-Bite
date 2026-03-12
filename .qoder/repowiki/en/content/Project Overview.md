# Project Overview

<cite>
**Referenced Files in This Document**
- [README.md](file://README.md)
- [IMPLEMENTATION_STATUS.md](file://IMPLEMENTATION_STATUS.md)
- [SEPARATION_GUIDE.md](file://SEPARATION_GUIDE.md)
- [PRISMA_DATA_FETCHING.md](file://PRISMA_DATA_FETCHING.md)
- [restaurant-backend/package.json](file://restaurant-backend/package.json)
- [restaurant-frontend/package.json](file://restaurant-frontend/package.json)
- [restaurant-backend/src/server.ts](file://restaurant-backend/src/server.ts)
- [restaurant-backend/prisma/schema.prisma](file://restaurant-backend/prisma/schema.prisma)
- [restaurant-backend/src/middleware/auth.ts](file://restaurant-backend/src/middleware/auth.ts)
- [restaurant-backend/src/middleware/errorHandler.ts](file://restaurant-backend/src/middleware/errorHandler.ts)
- [restaurant-frontend/src/app/layout.tsx](file://restaurant-frontend/src/app/layout.tsx)
- [restaurant-frontend/src/components/SecurePaymentProcessor.tsx](file://restaurant-frontend/src/components/SecurePaymentProcessor.tsx)
- [restaurant-frontend/src/lib/api-client.ts](file://restaurant-frontend/src/lib/api-client.ts)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction
DeQ-Bite is a modern, scalable restaurant web application featuring a fully separated backend and frontend architecture. The system delivers a seamless online ordering experience with strong emphasis on security, performance, and maintainability. It supports real-time order management, table reservations, and automated invoice generation, while integrating securely with the Razorpay payment gateway. The backend is built with Express.js and TypeScript, and the frontend leverages Next.js App Router with React and TypeScript. The database is powered by PostgreSQL through Prisma ORM, enabling type-safe, efficient data operations.

Key benefits for users:
- Beginners: Clear setup instructions, sample data, and guided testing steps enable quick onboarding.
- Experienced developers: Modular architecture, comprehensive security middleware, and scalable patterns support rapid feature development and deployment.
- Restaurant operators: Admin dashboards, order tracking, and analytics streamline daily operations.

**Section sources**
- [README.md](file://README.md#L1-L248)
- [IMPLEMENTATION_STATUS.md](file://IMPLEMENTATION_STATUS.md#L1-L248)

## Project Structure
The repository is organized into two primary directories:
- restaurant-backend: Express.js API server with TypeScript, Prisma ORM, and security middleware.
- restaurant-frontend: Next.js frontend application with React, TypeScript, and state management.

```mermaid
graph TB
subgraph "Backend API Server"
BE_Server["restaurant-backend/src/server.ts"]
BE_Pkg["restaurant-backend/package.json"]
BE_Schema["restaurant-backend/prisma/schema.prisma"]
BE_MW_Auth["restaurant-backend/src/middleware/auth.ts"]
BE_MW_Error["restaurant-backend/src/middleware/errorHandler.ts"]
end
subgraph "Frontend Application"
FE_Layer["restaurant-frontend/src/app/layout.tsx"]
FE_Client["restaurant-frontend/src/lib/api-client.ts"]
FE_Payment["restaurant-frontend/src/components/SecurePaymentProcessor.tsx"]
FE_Pkg["restaurant-frontend/package.json"]
end
FE_Client --> BE_Server
FE_Payment --> BE_Server
BE_Server --> BE_Schema
BE_MW_Auth --> BE_Server
BE_MW_Error --> BE_Server
```

**Diagram sources**
- [restaurant-backend/src/server.ts](file://restaurant-backend/src/server.ts#L1-L33)
- [restaurant-backend/package.json](file://restaurant-backend/package.json#L1-L80)
- [restaurant-backend/prisma/schema.prisma](file://restaurant-backend/prisma/schema.prisma#L1-L384)
- [restaurant-backend/src/middleware/auth.ts](file://restaurant-backend/src/middleware/auth.ts#L1-L137)
- [restaurant-backend/src/middleware/errorHandler.ts](file://restaurant-backend/src/middleware/errorHandler.ts#L1-L82)
- [restaurant-frontend/src/app/layout.tsx](file://restaurant-frontend/src/app/layout.tsx#L1-L50)
- [restaurant-frontend/src/lib/api-client.ts](file://restaurant-frontend/src/lib/api-client.ts#L1-L800)
- [restaurant-frontend/src/components/SecurePaymentProcessor.tsx](file://restaurant-frontend/src/components/SecurePaymentProcessor.tsx#L1-L347)
- [restaurant-frontend/package.json](file://restaurant-frontend/package.json#L1-L54)

**Section sources**
- [README.md](file://README.md#L65-L99)
- [SEPARATION_GUIDE.md](file://SEPARATION_GUIDE.md#L27-L66)

## Core Components
- Backend API server: Manages authentication, payment processing, order lifecycle, invoice generation, and database interactions via Prisma.
- Frontend application: Provides responsive UI for customer and admin workflows, integrates with the backend through a typed API client, and handles secure payment flows.
- Database: PostgreSQL schema managed by Prisma with comprehensive models for users, restaurants, menus, orders, payments, and invoices.
- Security middleware: Implements JWT authentication, rate limiting, CORS protection, input validation, and centralized error handling.

Technology stack highlights:
- Backend: Express.js, TypeScript, Prisma, PostgreSQL, Helmet.js, CORS, express-rate-limit, Zod, Winston logging, Nodemailer, Twilio, Razorpay SDK.
- Frontend: Next.js 15 App Router, React, TypeScript, Axios, Zustand, Tailwind CSS, React Hook Form + Zod validation, Lucide React icons.

**Section sources**
- [IMPLEMENTATION_STATUS.md](file://IMPLEMENTATION_STATUS.md#L115-L135)
- [restaurant-backend/package.json](file://restaurant-backend/package.json#L18-L44)
- [restaurant-frontend/package.json](file://restaurant-frontend/package.json#L12-L31)

## Architecture Overview
The system follows a separated architecture with independent scaling for backend and frontend. The frontend communicates with the backend via RESTful endpoints, while the backend enforces security policies and performs server-side payment verification.

```mermaid
graph TB
Client["Browser / Mobile App"]
FE["Next.js Frontend<br/>restaurant-frontend/"]
API["Express.js Backend API<br/>restaurant-backend/"]
DB["PostgreSQL Database"]
PG["Prisma ORM"]
PAY["Razorpay Payment Gateway"]
Client --> FE
FE --> API
API --> PG
PG --> DB
API --> PAY
```

**Diagram sources**
- [SEPARATION_GUIDE.md](file://SEPARATION_GUIDE.md#L262-L276)
- [restaurant-backend/src/server.ts](file://restaurant-backend/src/server.ts#L1-L33)
- [restaurant-backend/prisma/schema.prisma](file://restaurant-backend/prisma/schema.prisma#L1-L384)
- [restaurant-frontend/src/app/layout.tsx](file://restaurant-frontend/src/app/layout.tsx#L28-L28)

## Detailed Component Analysis

### Backend API Server
The backend initializes the server, connects to the database, and exposes REST endpoints for authentication, payments, orders, invoices, and administrative functions. It includes robust middleware for authentication, error handling, and security.

```mermaid
sequenceDiagram
participant Client as "Frontend Client"
participant API as "Express API"
participant AuthMW as "JWT Auth Middleware"
participant DB as "Prisma/PostgreSQL"
Client->>API : "POST /api/auth/login"
API->>AuthMW : "Authenticate request"
AuthMW->>DB : "Find user by email"
DB-->>AuthMW : "User record"
AuthMW-->>API : "Decoded user info"
API-->>Client : "JWT token + user profile"
```

**Diagram sources**
- [restaurant-backend/src/middleware/auth.ts](file://restaurant-backend/src/middleware/auth.ts#L7-L75)
- [restaurant-backend/src/middleware/errorHandler.ts](file://restaurant-backend/src/middleware/errorHandler.ts#L22-L76)
- [restaurant-backend/src/server.ts](file://restaurant-backend/src/server.ts#L17-L30)

Key implementation characteristics:
- JWT authentication with role-based authorization.
- Centralized error handling with structured responses and logging.
- Database connectivity and graceful shutdown handling.

**Section sources**
- [restaurant-backend/src/server.ts](file://restaurant-backend/src/server.ts#L1-L33)
- [restaurant-backend/src/middleware/auth.ts](file://restaurant-backend/src/middleware/auth.ts#L1-L137)
- [restaurant-backend/src/middleware/errorHandler.ts](file://restaurant-backend/src/middleware/errorHandler.ts#L1-L82)

### Frontend Application
The frontend provides a responsive user interface with integrated payment processing and secure communication with the backend. It uses a typed API client and state management for efficient data handling.

```mermaid
sequenceDiagram
participant User as "Customer"
participant UI as "Next.js UI"
participant API as "API Client"
participant Backend as "Backend API"
participant PG as "Prisma/DB"
participant Razorpay as "Razorpay"
User->>UI : "Place order"
UI->>API : "POST /api/orders"
API->>Backend : "Create order"
Backend->>PG : "Persist order"
Backend-->>API : "Order created"
API-->>UI : "Order details"
UI->>API : "POST /api/payments/create"
API->>Backend : "Create payment order"
Backend->>Razorpay : "Initiate payment"
Backend-->>API : "Payment data"
API-->>UI : "Razorpay options"
UI->>Razorpay : "Collect payment"
UI->>API : "POST /api/payments/verify"
API->>Backend : "Verify signature"
Backend->>PG : "Update order/payment"
Backend-->>API : "Verification result"
API-->>UI : "Payment success"
```

**Diagram sources**
- [restaurant-frontend/src/components/SecurePaymentProcessor.tsx](file://restaurant-frontend/src/components/SecurePaymentProcessor.tsx#L83-L152)
- [restaurant-frontend/src/lib/api-client.ts](file://restaurant-frontend/src/lib/api-client.ts#L380-L440)
- [restaurant-backend/src/middleware/auth.ts](file://restaurant-backend/src/middleware/auth.ts#L1-L137)

Frontend highlights:
- Secure payment processor component with real-time verification feedback.
- API client with request/response interceptors, tenant-aware routing, and authentication token injection.
- Layout integration with Razorpay script loading and global notifications.

**Section sources**
- [restaurant-frontend/src/components/SecurePaymentProcessor.tsx](file://restaurant-frontend/src/components/SecurePaymentProcessor.tsx#L1-L347)
- [restaurant-frontend/src/lib/api-client.ts](file://restaurant-frontend/src/lib/api-client.ts#L194-L240)
- [restaurant-frontend/src/app/layout.tsx](file://restaurant-frontend/src/app/layout.tsx#L28-L48)

### Database Schema and Data Fetching
The PostgreSQL schema defines core entities for users, restaurants, menu items, orders, payments, and invoices. Enhanced Prisma data fetching strategies optimize performance and type safety.

```mermaid
erDiagram
USER {
string id PK
string email UK
string phone UK
string name
string password
enum role
boolean verified
datetime createdAt
datetime updatedAt
}
RESTAURANT {
string id PK
string name
string slug UK
string subdomain UK
enum status
boolean active
int commissionRate
string[] cuisineTypes
datetime createdAt
datetime updatedAt
}
CATEGORY {
string id PK
string name
string description
string image
boolean active
int sortOrder
string restaurantId FK
datetime createdAt
datetime updatedAt
}
MENU_ITEM {
string id PK
string name
string description
string image
string categoryId FK
boolean available
int preparationTime
string[] ingredients
string[] allergens
boolean isVeg
boolean isVegan
boolean isGlutenFree
enum spiceLevel
int pricePaise
string restaurantId FK
datetime createdAt
datetime updatedAt
}
TABLE {
string id PK
int number
int capacity
string location
boolean active
string restaurantId FK
}
ORDER {
string id PK
string userId FK
string tableId FK
enum status
enum paymentStatus
string paymentId
int subtotalPaise
int taxPaise
int totalPaise
int discountPaise
enum paymentProvider
string paymentTransactionId
int paidAmountPaise
int dueAmountPaise
string restaurantId FK
datetime createdAt
datetime updatedAt
}
ORDER_ITEM {
string id PK
string orderId FK
string menuItemId FK
int quantity
string notes
int pricePaise
}
INVOICE {
string id PK
string orderId UK
string invoiceNumber UK
datetime issuedAt
boolean emailSent
boolean smsSent
string pdfPath
bytes pdfData
string pdfName
}
PAYMENT {
string id PK
string orderId FK
string userId FK
string restaurantId FK
string method
string provider
int amountPaise
enum status
string providerOrderId
string providerPaymentId
string providerSignature
json notes
datetime createdAt
datetime updatedAt
}
USER ||--o{ ORDER : "places"
TABLE ||--o{ ORDER : "hosts"
RESTAURANT ||--o{ CATEGORY : "owns"
CATEGORY ||--o{ MENU_ITEM : "contains"
MENU_ITEM ||--o{ ORDER_ITEM : "included_in"
ORDER ||--|| INVOICE : "generates"
ORDER ||--o{ PAYMENT : "has"
ORDER ||--o{ ORDER_ITEM : "includes"
```

**Diagram sources**
- [restaurant-backend/prisma/schema.prisma](file://restaurant-backend/prisma/schema.prisma#L11-L384)

Enhanced data fetching strategies:
- Selective field retrieval to minimize payload size.
- Include related entities to reduce round trips.
- Aggregation-based statistics for performance and insights.

**Section sources**
- [PRISMA_DATA_FETCHING.md](file://PRISMA_DATA_FETCHING.md#L132-L183)
- [PRISMA_DATA_FETCHING.md](file://PRISMA_DATA_FETCHING.md#L217-L238)

### Security Implementation
The system implements layered security across authentication, payment processing, and data access controls.

```mermaid
flowchart TD
Start(["Incoming Request"]) --> ExtractToken["Extract JWT from Authorization header"]
ExtractToken --> ValidateSecret{"JWT_SECRET configured?"}
ValidateSecret --> |No| ServerErr["Return 500 Server Error"]
ValidateSecret --> |Yes| VerifyToken["Verify JWT signature"]
VerifyToken --> DecodeUser["Decode user payload"]
DecodeUser --> FetchUser["Fetch user from DB"]
FetchUser --> Found{"User exists?"}
Found --> |No| InvalidToken["Return 401 Invalid Token"]
Found --> |Yes| AttachUser["Attach user to request"]
AttachUser --> Next["Proceed to route handler"]
```

**Diagram sources**
- [restaurant-backend/src/middleware/auth.ts](file://restaurant-backend/src/middleware/auth.ts#L13-L75)

Security features summary:
- JWT-based authentication with role-based authorization.
- Server-side payment signature verification via Razorpay.
- Rate limiting, CORS protection, input validation, and comprehensive error handling.
- Audit logging and secure file storage for invoices.

**Section sources**
- [SEPARATION_GUIDE.md](file://SEPARATION_GUIDE.md#L164-L202)
- [README.md](file://README.md#L126-L144)

## Dependency Analysis
The backend and frontend packages define their respective runtime and development dependencies, reflecting the chosen technologies and integrations.

```mermaid
graph TB
subgraph "Backend Dependencies"
BE_Express["express"]
BE_TS["typescript"]
BE_Prisma["@prisma/client"]
BE_Helmet["helmet"]
BE_CORS["cors"]
BE_RateLimit["express-rate-limit"]
BE_Zod["zod"]
BE_Winston["winston"]
BE_Razorpay["razorpay"]
BE_Nodemailer["nodemailer"]
BE_Twilio["twilio"]
BE_Bcrypt["bcryptjs"]
BE_JWT["jsonwebtoken"]
end
subgraph "Frontend Dependencies"
FE_Next["next"]
FE_TS["typescript"]
FE_Axios["axios"]
FE_Zustand["zustand"]
FE_Tailwind["tailwindcss"]
FE_Lucide["lucide-react"]
FE_Form["react-hook-form + zod"]
end
```

**Diagram sources**
- [restaurant-backend/package.json](file://restaurant-backend/package.json#L18-L44)
- [restaurant-frontend/package.json](file://restaurant-frontend/package.json#L12-L31)

**Section sources**
- [restaurant-backend/package.json](file://restaurant-backend/package.json#L1-L80)
- [restaurant-frontend/package.json](file://restaurant-frontend/package.json#L1-L54)

## Performance Considerations
- Backend scalability: Horizontal scaling behind a load balancer, database connection pooling via Prisma, and readiness for caching and microservices.
- Frontend optimization: Code splitting, lazy loading, CDN-ready assets, and efficient state management with Zustand.
- Data fetching: Selective field retrieval, include relationships, and aggregation-based statistics to minimize payload sizes and database load.
- Payment flow: Asynchronous verification and reduced timeout windows to improve responsiveness.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Authentication failures: Verify JWT_SECRET configuration and ensure tokens are included in Authorization headers.
- Payment verification errors: Confirm backend verification logic and network connectivity to external services.
- Database connectivity: Check Prisma client generation and migration status.
- Frontend API errors: Validate NEXT_PUBLIC_API_URL and tenant slug propagation.

**Section sources**
- [restaurant-backend/src/middleware/errorHandler.ts](file://restaurant-backend/src/middleware/errorHandler.ts#L22-L76)
- [restaurant-frontend/src/lib/api-client.ts](file://restaurant-frontend/src/lib/api-client.ts#L206-L239)

## Conclusion
DeQ-Bite delivers a production-ready, secure, and scalable restaurant ordering platform with a clear separation between frontend and backend. Its architecture, combined with robust security measures and optimized data fetching, enables smooth operations for both customers and restaurant staff. The modular design and comprehensive documentation make it accessible to developers of all levels while supporting future enhancements and deployments.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices
- Test credentials and sample data are provided for immediate development and testing.
- API endpoints and interactive documentation are available via the backend health checks.

**Section sources**
- [SAMPLE_DATA.md](file://SAMPLE_DATA.md#L1-L119)
- [README.md](file://README.md#L109-L125)