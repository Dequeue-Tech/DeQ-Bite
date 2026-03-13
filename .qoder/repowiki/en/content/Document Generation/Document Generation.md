# Document Generation

<cite>
**Referenced Files in This Document**
- [invoices.ts](file://restaurant-backend/src/routes/invoices.ts)
- [pdf.ts](file://restaurant-backend/src/routes/pdf.ts)
- [pdf.ts](file://restaurant-backend/src/lib/pdf.ts)
- [email.ts](file://restaurant-backend/src/lib/email.ts)
- [sms.ts](file://restaurant-backend/src/lib/sms.ts)
- [payments.ts](file://restaurant-backend/src/routes/payments.ts)
- [schema.prisma](file://restaurant-backend/prisma/schema.prisma)
- [auth.ts](file://restaurant-backend/src/middleware/auth.ts)
- [restaurant.ts](file://restaurant-backend/src/middleware/restaurant.ts)
- [logger.ts](file://restaurant-backend/src/utils/logger.ts)
- [server.ts](file://restaurant-backend/src/server.ts)
- [package.json](file://restaurant-backend/package.json)
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
This document explains the end-to-end document generation system for DeQ-Bite’s invoice and notification workflows. It covers:
- PDF invoice generation, including template creation, data formatting, and secure storage
- Multi-channel delivery via email and SMS, plus direct download
- The invoice generation workflow triggered upon successful payment verification
- Email service integration using Nodemailer and SMS service integration using Twilio
- Document security measures, including user-specific access control and file storage strategies
- Delivery confirmation tracking and warnings for failed deliveries
- Template customization, branding support, and batch processing considerations
- File storage strategies, cleanup policies, and archive management

## Project Structure
The document generation system spans routing, libraries, middleware, and persistence:
- Routes orchestrate invoice generation, retrieval, resends, and refreshes
- Libraries encapsulate PDF generation, email/SMS delivery, and payment provider integrations
- Middleware enforces authentication, restaurant context, and authorization
- Prisma models define the invoice entity and relationships
- Logging utilities track operations and failures

```mermaid
graph TB
subgraph "Routes"
INV["invoices.ts"]
PDFR["pdf.ts (download)"]
PAY["payments.ts"]
end
subgraph "Libraries"
PDF["pdf.ts (generation/storage)"]
EMAIL["email.ts (Nodemailer)"]
SMS["sms.ts (Twilio)"]
RP["razorpay.ts"]
end
subgraph "Middleware"
AUTH["auth.ts"]
REST["restaurant.ts"]
end
subgraph "Persistence"
PRISMA["schema.prisma (Invoice model)"]
end
subgraph "Utilities"
LOG["logger.ts"]
end
INV --> PDF
INV --> EMAIL
INV --> SMS
INV --> PRISMA
PDFR --> PDF
PDFR --> PRISMA
PAY --> PDF
PAY --> PRISMA
PAY --> RP
INV --> AUTH
INV --> REST
PDFR --> AUTH
PDFR --> REST
EMAIL --> LOG
SMS --> LOG
PDF --> LOG
```

**Diagram sources**
- [invoices.ts](file://restaurant-backend/src/routes/invoices.ts#L1-L599)
- [pdf.ts](file://restaurant-backend/src/routes/pdf.ts#L1-L181)
- [pdf.ts](file://restaurant-backend/src/lib/pdf.ts#L1-L259)
- [email.ts](file://restaurant-backend/src/lib/email.ts#L1-L227)
- [sms.ts](file://restaurant-backend/src/lib/sms.ts#L1-L131)
- [payments.ts](file://restaurant-backend/src/routes/payments.ts#L1-L731)
- [schema.prisma](file://restaurant-backend/prisma/schema.prisma#L190-L204)
- [auth.ts](file://restaurant-backend/src/middleware/auth.ts#L1-L137)
- [restaurant.ts](file://restaurant-backend/src/middleware/restaurant.ts#L1-L246)
- [logger.ts](file://restaurant-backend/src/utils/logger.ts#L1-L56)

**Section sources**
- [invoices.ts](file://restaurant-backend/src/routes/invoices.ts#L1-L599)
- [pdf.ts](file://restaurant-backend/src/routes/pdf.ts#L1-L181)
- [pdf.ts](file://restaurant-backend/src/lib/pdf.ts#L1-L259)
- [email.ts](file://restaurant-backend/src/lib/email.ts#L1-L227)
- [sms.ts](file://restaurant-backend/src/lib/sms.ts#L1-L131)
- [payments.ts](file://restaurant-backend/src/routes/payments.ts#L1-L731)
- [schema.prisma](file://restaurant-backend/prisma/schema.prisma#L190-L204)
- [auth.ts](file://restaurant-backend/src/middleware/auth.ts#L1-L137)
- [restaurant.ts](file://restaurant-backend/src/middleware/restaurant.ts#L1-L246)
- [logger.ts](file://restaurant-backend/src/utils/logger.ts#L1-L56)

## Core Components
- Invoice generation route: Validates inputs, loads order data, prepares invoice data, generates PDF, stores it, sends notifications, and persists invoice metadata
- PDF generation library: Creates PDFs with a compact receipt-style layout and supports cleanup of old files
- Email delivery: Uses Nodemailer to send HTML emails with PDF attachments
- SMS delivery: Uses Twilio to send invoice notifications
- Payment-triggered invoice creation: Automatically creates invoices when orders reach a fully paid state
- PDF download route: Serves PDFs with token-based access control and fallback to static storage
- Middleware: Enforces JWT-based authentication and restaurant context
- Persistence: Invoice model tracks sentVia channels, delivery flags, and PDF metadata

**Section sources**
- [invoices.ts](file://restaurant-backend/src/routes/invoices.ts#L21-L241)
- [pdf.ts](file://restaurant-backend/src/lib/pdf.ts#L37-L187)
- [email.ts](file://restaurant-backend/src/lib/email.ts#L31-L61)
- [sms.ts](file://restaurant-backend/src/lib/sms.ts#L31-L66)
- [payments.ts](file://restaurant-backend/src/routes/payments.ts#L61-L166)
- [pdf.ts](file://restaurant-backend/src/routes/pdf.ts#L12-L178)
- [auth.ts](file://restaurant-backend/src/middleware/auth.ts#L7-L75)
- [restaurant.ts](file://restaurant-backend/src/middleware/restaurant.ts#L202-L211)
- [schema.prisma](file://restaurant-backend/prisma/schema.prisma#L190-L204)

## Architecture Overview
The system integrates payment completion with automatic invoice generation and multi-channel delivery. It ensures secure access to generated PDFs and maintains auditability through logging and database records.

```mermaid
sequenceDiagram
participant Client as "Client"
participant Payments as "payments.ts"
participant InvoiceRoute as "invoices.ts"
participant PDFLib as "pdf.ts (lib)"
participant Storage as "pdf.ts (storage)"
participant Email as "email.ts"
participant SMSService as "sms.ts"
participant DB as "Prisma (Invoice)"
Client->>Payments : "Verify payment"
Payments->>Payments : "Compute status and totals"
Payments->>Payments : "ensureInvoiceAndEarningForFullyPaidOrder()"
Payments->>PDFLib : "generateInvoicePDF(invoiceData)"
PDFLib-->>Payments : "Buffer"
Payments->>Storage : "savePDFToStorage(buffer, filename)"
Storage-->>Payments : "{pdfPath, pdfData, pdfName}"
Payments->>DB : "create Invoice"
DB-->>Payments : "Invoice persisted"
Note over Payments,DB : "Optional : Manual invoice generation"
Client->>InvoiceRoute : "POST /api/invoices/generate"
InvoiceRoute->>PDFLib : "generateInvoicePDF(invoiceData)"
InvoiceRoute->>Storage : "savePDFToStorage(buffer, filename)"
InvoiceRoute->>Email : "sendInvoiceEmail(..., buffer)"
InvoiceRoute->>SMSService : "sendInvoiceSMS(...)"
InvoiceRoute->>DB : "upsert Invoice with sentVia flags"
DB-->>InvoiceRoute : "Invoice updated"
InvoiceRoute-->>Client : "Delivery results and warnings"
```

**Diagram sources**
- [payments.ts](file://restaurant-backend/src/routes/payments.ts#L61-L166)
- [invoices.ts](file://restaurant-backend/src/routes/invoices.ts#L21-L241)
- [pdf.ts](file://restaurant-backend/src/lib/pdf.ts#L37-L187)
- [pdf.ts](file://restaurant-backend/src/lib/pdf.ts#L191-L224)
- [email.ts](file://restaurant-backend/src/lib/email.ts#L200-L227)
- [sms.ts](file://restaurant-backend/src/lib/sms.ts#L89-L104)
- [schema.prisma](file://restaurant-backend/prisma/schema.prisma#L190-L204)

## Detailed Component Analysis

### Invoice Generation Workflow
- Endpoint: POST /api/invoices/generate
- Validation: Requires orderId and optional methods array (EMAIL, SMS)
- Access control: Requires JWT authentication and restaurant context
- Data preparation: Loads order with user, table, and items; computes totals and formats invoice data
- PDF generation: Calls generateInvoicePDF with structured invoice data
- Storage: Saves PDF to public/invoices and returns path/name/data
- Delivery: Conditionally sends email and/or SMS based on requested methods and presence of contact info
- Persistence: Upserts invoice record with sentVia, delivery flags, and PDF metadata
- Warnings: Returns warnings for skipped or failed deliveries

```mermaid
flowchart TD
Start(["POST /api/invoices/generate"]) --> Validate["Validate request schema"]
Validate --> LoadOrder["Load order with user/table/items"]
LoadOrder --> Exists{"Invoice exists<br/>and was auto-sent?"}
Exists --> |Yes| ReturnExisting["Return existing invoice"]
Exists --> |No| Prep["Prepare invoice data"]
Prep --> GenPDF["Generate PDF buffer"]
GenPDF --> Store["Save to storage (public/invoices)"]
Store --> Methods{"Methods requested?"}
Methods --> |EMAIL| Email["Send invoice email"]
Methods --> |SMS| Sms["Send invoice SMS"]
Methods --> |None| Persist["Persist/upsert invoice"]
Email --> Persist
Sms --> Persist
Persist --> Done(["Return results and warnings"])
```

**Diagram sources**
- [invoices.ts](file://restaurant-backend/src/routes/invoices.ts#L21-L241)

**Section sources**
- [invoices.ts](file://restaurant-backend/src/routes/invoices.ts#L21-L241)

### PDF Invoice Generation and Storage
- Template: Compact portrait layout optimized for 80mm roll receipts; includes restaurant branding, customer details, items list, taxes, and totals
- Data formatting: Converts paise to rupees, wraps long item names, computes totals and quantities
- Storage: Writes to public/invoices with a deterministic filename; returns path, buffer, and name for persistence
- Cleanup: Optional maintenance function to remove old files older than N days

```mermaid
flowchart TD
A["generateInvoicePDF(data)"] --> B["Create jsPDF portrait 80x250 mm"]
B --> C["Render header, GST, address"]
C --> D["Render customer details and bill info"]
D --> E["Render items with wrapping and totals"]
E --> F["Render subtotal, tax, grand total"]
F --> G["Output Buffer"]
G --> H["savePDFToStorage(buffer, filename)"]
H --> I["Write to public/invoices/<filename>"]
I --> J["Return {pdfPath, pdfData, pdfName}"]
```

**Diagram sources**
- [pdf.ts](file://restaurant-backend/src/lib/pdf.ts#L37-L187)
- [pdf.ts](file://restaurant-backend/src/lib/pdf.ts#L191-L224)

**Section sources**
- [pdf.ts](file://restaurant-backend/src/lib/pdf.ts#L37-L187)
- [pdf.ts](file://restaurant-backend/src/lib/pdf.ts#L191-L224)

### Email Delivery with Nodemailer
- Transport: Configured via SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, APP_NAME
- Template: Generates HTML email with styled sections for invoice details and total amount
- Attachment: Attaches the generated PDF buffer
- Delivery: Returns boolean success/failure and logs outcomes

```mermaid
sequenceDiagram
participant Inv as "invoices.ts"
participant EmailLib as "email.ts"
participant SMTP as "SMTP Provider"
Inv->>EmailLib : "sendInvoiceEmail(to, data, pdfBuffer)"
EmailLib->>EmailLib : "generateInvoiceEmailTemplate(data)"
EmailLib->>SMTP : "sendMail({to, subject, html, attachments})"
SMTP-->>EmailLib : "result"
EmailLib-->>Inv : "boolean success"
```

**Diagram sources**
- [email.ts](file://restaurant-backend/src/lib/email.ts#L200-L227)
- [email.ts](file://restaurant-backend/src/lib/email.ts#L31-L61)

**Section sources**
- [email.ts](file://restaurant-backend/src/lib/email.ts#L31-L61)
- [email.ts](file://restaurant-backend/src/lib/email.ts#L200-L227)

### SMS Delivery with Twilio
- Client: Lazily initialized with TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
- Message: Generates plain-text invoice summary
- Delivery: Sends via TWILIO_PHONE_NUMBER; returns boolean success/failure and logs outcomes

```mermaid
sequenceDiagram
participant Inv as "invoices.ts"
participant SmsLib as "sms.ts"
participant Twilio as "Twilio API"
Inv->>SmsLib : "sendInvoiceSMS(phone, data)"
SmsLib->>Twilio : "messages.create({body, from, to})"
Twilio-->>SmsLib : "result"
SmsLib-->>Inv : "boolean success"
```

**Diagram sources**
- [sms.ts](file://restaurant-backend/src/lib/sms.ts#L89-L104)
- [sms.ts](file://restaurant-backend/src/lib/sms.ts#L31-L66)

**Section sources**
- [sms.ts](file://restaurant-backend/src/lib/sms.ts#L31-L66)
- [sms.ts](file://restaurant-backend/src/lib/sms.ts#L89-L104)

### Payment-Triggered Invoice Creation
- Endpoint: POST /api/payments/verify updates order payment status
- After verification, ensureInvoiceAndEarningForFullyPaidOrder runs:
  - Builds invoice data from order, user, and restaurant details
  - Generates PDF and saves to storage
  - Persists invoice record with PDF metadata

```mermaid
sequenceDiagram
participant Client as "Client"
participant Pay as "payments.ts"
participant PDFLib as "pdf.ts (lib)"
participant Storage as "pdf.ts (storage)"
participant DB as "Prisma (Invoice)"
Client->>Pay : "POST /api/payments/verify"
Pay->>Pay : "Compute status and totals"
Pay->>Pay : "ensureInvoiceAndEarningForFullyPaidOrder(orderId)"
Pay->>PDFLib : "generateInvoicePDF(invoiceData)"
PDFLib-->>Pay : "Buffer"
Pay->>Storage : "savePDFToStorage(buffer, filename)"
Storage-->>Pay : "{pdfPath, pdfData, pdfName}"
Pay->>DB : "create Invoice"
DB-->>Pay : "Invoice persisted"
```

**Diagram sources**
- [payments.ts](file://restaurant-backend/src/routes/payments.ts#L61-L166)
- [pdf.ts](file://restaurant-backend/src/lib/pdf.ts#L37-L187)
- [pdf.ts](file://restaurant-backend/src/lib/pdf.ts#L191-L224)
- [schema.prisma](file://restaurant-backend/prisma/schema.prisma#L190-L204)

**Section sources**
- [payments.ts](file://restaurant-backend/src/routes/payments.ts#L61-L166)

### PDF Download and Access Control
- Endpoint: GET /api/pdf/invoice/:invoiceId
- Access control:
  - Without token: Allows public download only if pdfData exists in DB or pdfPath is publicly served
  - With token: Verifies JWT, checks ownership against invoice.order.userId, serves PDF from DB or storage
- On-demand generation: If PDF not available, regenerates from order data and stores it

```mermaid
flowchart TD
Start(["GET /api/pdf/invoice/:invoiceId"]) --> HasToken{"Authorization header?"}
HasToken --> |No| PublicCheck{"pdfData exists or pdfPath starts with /invoices/?"}
PublicCheck --> |Yes| ServePublic["Serve PDF (DB or redirect)"]
PublicCheck --> |No| Deny["401 Access denied"]
HasToken --> |Yes| Verify["jwt.verify(JWT_SECRET)"]
Verify --> Owner{"invoice.order.userId == user.id?"}
Owner --> |No| Forbidden["403 Access denied"]
Owner --> |Yes| FromDB{"pdfData exists?"}
FromDB --> |Yes| ServeDB["Serve PDF buffer"]
FromDB --> |No| FromPath{"pdfPath starts with /invoices/?"}
FromPath --> |Yes| Redirect["Redirect to public URL"]
FromPath --> |No| Regenerate["Regenerate PDF from order data"]
Regenerate --> Store["Persist pdfPath/pdfData/pdfName"]
Store --> ServeNew["Serve newly generated PDF"]
```

**Diagram sources**
- [pdf.ts](file://restaurant-backend/src/routes/pdf.ts#L12-L178)
- [auth.ts](file://restaurant-backend/src/middleware/auth.ts#L7-L75)

**Section sources**
- [pdf.ts](file://restaurant-backend/src/routes/pdf.ts#L12-L178)
- [auth.ts](file://restaurant-backend/src/middleware/auth.ts#L7-L75)

### Invoice Resend and Refresh PDF
- Resend endpoint: POST /api/invoices/:invoiceId/resend
  - Validates invoice ownership
  - Rebuilds invoice data and regenerates PDF if needed
  - Sends email/SMS per requested methods
  - Updates sentVia flags
- Refresh PDF endpoint: POST /api/invoices/:invoiceOrOrderId/refresh-pdf
  - Resolves invoice by id or order id
  - Rebuilds invoice data from order
  - Regenerates and re-stores PDF
  - Updates invoice record

**Section sources**
- [invoices.ts](file://restaurant-backend/src/routes/invoices.ts#L327-L454)
- [invoices.ts](file://restaurant-backend/src/routes/invoices.ts#L456-L566)

### Data Model: Invoice
- Fields: orderId (unique), invoiceNumber (unique), issuedAt, sentVia (array), emailSent, smsSent, pdfPath, pdfData, pdfName
- Relationships: Belongs to Order via orderId

```mermaid
erDiagram
INVOICE {
string id PK
string orderId UK
string invoiceNumber UK
datetime issuedAt
enum_array sentVia
boolean emailSent
boolean smsSent
string pdfPath
bytes pdfData
string pdfName
}
ORDER {
string id PK
string userId
string restaurantId
enum paymentStatus
int subtotalPaise
int taxPaise
int totalPaise
}
INVOICE }o--|| ORDER : "belongsTo"
```

**Diagram sources**
- [schema.prisma](file://restaurant-backend/prisma/schema.prisma#L190-L204)

**Section sources**
- [schema.prisma](file://restaurant-backend/prisma/schema.prisma#L190-L204)

## Dependency Analysis
- Routing depends on middleware for auth and restaurant context
- Invoice route depends on PDF generation, storage, email, and SMS libraries
- Payment route triggers invoice creation and earning creation
- Libraries depend on external services (Nodemailer, Twilio, jsPDF)
- Persistence relies on Prisma client and database connectivity

```mermaid
graph LR
AUTH["auth.ts"] --> INV["invoices.ts"]
REST["restaurant.ts"] --> INV
INV --> PDFLIB["pdf.ts (lib)"]
INV --> EMAIL["email.ts"]
INV --> SMS["sms.ts"]
PAY["payments.ts"] --> PDFLIB
PAY --> DB["Prisma Client"]
PDFLIB --> FS["fs (disk)"]
EMAIL --> NODMAIL["Nodemailer"]
SMS --> TWIL["Twilio"]
```

**Diagram sources**
- [invoices.ts](file://restaurant-backend/src/routes/invoices.ts#L1-L12)
- [auth.ts](file://restaurant-backend/src/middleware/auth.ts#L1-L10)
- [restaurant.ts](file://restaurant-backend/src/middleware/restaurant.ts#L1-L10)
- [pdf.ts](file://restaurant-backend/src/lib/pdf.ts#L1-L4)
- [email.ts](file://restaurant-backend/src/lib/email.ts#L1-L2)
- [sms.ts](file://restaurant-backend/src/lib/sms.ts#L1-L2)
- [payments.ts](file://restaurant-backend/src/routes/payments.ts#L1-L12)

**Section sources**
- [invoices.ts](file://restaurant-backend/src/routes/invoices.ts#L1-L12)
- [pdf.ts](file://restaurant-backend/src/lib/pdf.ts#L1-L4)
- [email.ts](file://restaurant-backend/src/lib/email.ts#L1-L2)
- [sms.ts](file://restaurant-backend/src/lib/sms.ts#L1-L2)
- [payments.ts](file://restaurant-backend/src/routes/payments.ts#L1-L12)

## Performance Considerations
- PDF generation: Keep invoice data minimal; avoid excessive item lists to reduce rendering time
- Storage: Writing to disk is synchronous; consider asynchronous writes or CDN-backed storage for scale
- Email/SMS: Batch sending is not implemented; consider queueing for high-volume scenarios
- Cleanup: Use cleanupOldInvoices periodically to manage disk usage
- Logging: Ensure log rotation and avoid logging sensitive data

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and diagnostics:
- Missing tokens or invalid JWT: Access denied errors when downloading PDFs or generating invoices
- Missing email/SMS configuration: Delivery flags remain false; warnings indicate misconfiguration
- Missing contact info: Delivery skipped with warnings for email or SMS
- Storage failures: Errors during PDF write or cleanup; check disk permissions and free space
- Twilio not configured: SMS service disabled; initializeTwilio logs a warning
- Database connectivity: Prisma client connection errors; verify DATABASE_URL/DIRECT_DATABASE_URL

**Section sources**
- [pdf.ts](file://restaurant-backend/src/routes/pdf.ts#L54-L86)
- [auth.ts](file://restaurant-backend/src/middleware/auth.ts#L40-L44)
- [email.ts](file://restaurant-backend/src/lib/email.ts#L52-L60)
- [sms.ts](file://restaurant-backend/src/lib/sms.ts#L35-L43)
- [pdf.ts](file://restaurant-backend/src/lib/pdf.ts#L216-L223)
- [logger.ts](file://restaurant-backend/src/utils/logger.ts#L1-L56)

## Conclusion
DeQ-Bite’s document generation system provides a secure, multi-channel invoice workflow integrated with payment verification. It leverages Nodemailer and Twilio for notifications, stores PDFs locally with access controls, and exposes endpoints for on-demand generation, resends, and refreshes. The system is extensible for branding customization and can be enhanced with queuing, CDN storage, and batch processing for higher throughput.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Environment Variables
- SMTP configuration for email: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, APP_NAME
- Twilio configuration for SMS: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
- Database: DATABASE_URL, DIRECT_DATABASE_URL
- Logging: LOG_LEVEL
- JWT: JWT_SECRET

**Section sources**
- [email.ts](file://restaurant-backend/src/lib/email.ts#L5-L15)
- [sms.ts](file://restaurant-backend/src/lib/sms.ts#L7-L21)
- [config database](file://restaurant-backend/src/config/database.ts#L1-L66)
- [logger.ts](file://restaurant-backend/src/utils/logger.ts#L50-L55)

### Template Customization and Branding
- PDF template: Modify header, footer, and layout in generateInvoicePDF
- Email template: Customize HTML/CSS in generateInvoiceEmailTemplate
- Branding fields: restaurantName, restaurantAddress, restaurantPhone, GST/FSSAI numbers

**Section sources**
- [pdf.ts](file://restaurant-backend/src/lib/pdf.ts#L37-L187)
- [email.ts](file://restaurant-backend/src/lib/email.ts#L66-L195)

### Batch Processing and Archive Management
- Batch generation: Use refresh-pdf endpoint to regenerate PDFs for multiple invoices
- Cleanup policy: Use cleanupOldInvoices to remove old files; schedule via cron or job scheduler
- Archive management: Store historical invoices in cloud storage and maintain metadata in DB

**Section sources**
- [invoices.ts](file://restaurant-backend/src/routes/invoices.ts#L456-L566)
- [pdf.ts](file://restaurant-backend/src/lib/pdf.ts#L229-L259)