# PDF Invoice Generation

<cite>
**Referenced Files in This Document**
- [pdf.ts](file://restaurant-backend/src/lib/pdf.ts)
- [invoices.ts](file://restaurant-backend/src/routes/invoices.ts)
- [b2-storage.ts](file://restaurant-backend/src/lib/b2-storage.ts)
- [email.ts](file://restaurant-backend/src/lib/email.ts)
- [sms.ts](file://restaurant-backend/src/lib/sms.ts)
- [logger.ts](file://restaurant-backend/src/utils/logger.ts)
- [errorHandler.ts](file://restaurant-backend/src/middleware/errorHandler.ts)
- [schema.prisma](file://restaurant-backend/prisma/schema.prisma)
- [package.json](file://restaurant-backend/package.json)
- [api.ts](file://restaurant-backend/src/types/api.ts)
</cite>

## Update Summary
**Changes Made**
- Enhanced PDF formatting with improved spacing, clearer typography hierarchy, better readability, and enhanced formatting for item listings and totals
- Implemented advanced text wrapping using `splitTextToSize()` for restaurant addresses and long item names
- Optimized vertical spacing between sections for improved visual hierarchy
- Enhanced font sizing and styling for better readability on 80mm POS printers
- Improved item listing formatting with proper line wrapping and spacing calculations

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Enhanced Features](#enhanced-features)
7. [Dependency Analysis](#dependency-analysis)
8. [Performance Considerations](#performance-considerations)
9. [Troubleshooting Guide](#troubleshooting-guide)
10. [Conclusion](#conclusion)

## Introduction
This document explains the enhanced PDF invoice generation system built with jspdf for receipt-style printing optimized for 80mm POS printers. The system now features significantly improved formatting with enhanced text wrapping, better spacing, clearer typography hierarchy, and optimized readability. The system covers the template structure, styling, formatting, the InvoiceData interface, dynamic content rendering, totals computation, PDF buffer generation, cloud storage integration, cleanup of old invoices, error handling, logging integration, and performance considerations for high-volume generation.

## Project Structure
The enhanced invoice generation pipeline spans several modules with improved formatting capabilities:
- Route handler orchestrates invoice creation, validation, and delivery
- PDF generator builds the receipt-style PDF from structured data with advanced text wrapping and spacing optimization
- Enhanced B2 storage integration provides cloud-based PDF management
- Email/SMS integrations deliver invoices via attachments or messages
- Prisma schema persists invoice records with cloud storage metadata
- Logger and error handlers provide robust diagnostics

```mermaid
graph TB
subgraph "Routes"
R["invoices.ts<br/>POST /generate<br/>GET /:orderId<br/>GET /user/list<br/>POST /:invoiceId/resend<br/>POST /:invoiceOrOrderId/refresh-pdf"]
end
subgraph "Libraries"
L1["pdf.ts<br/>generateInvoicePDF()<br/>savePDFToStorage()<br/>cleanupOldInvoices()<br/>Enhanced Text Wrapping & Spacing"]
L2["b2-storage.ts<br/>uploadToB2()<br/>downloadFromB2()<br/>getSignedDownloadUrl()<br/>Private Bucket Support"]
L3["email.ts<br/>sendInvoiceEmail()"]
L4["sms.ts<br/>sendInvoiceSMS()"]
end
subgraph "Persistence"
S["Prisma Schema<br/>Invoice model with cloud metadata"]
end
subgraph "Utilities"
U1["logger.ts<br/>Winston logger"]
U2["errorHandler.ts<br/>AppError + asyncHandler"]
end
R --> L1
R --> L2
R --> L3
R --> L4
R --> S
L1 --> U1
L2 --> U1
L3 --> U1
L4 --> U1
R --> U2
```

**Diagram sources**
- [invoices.ts:21-262](file://restaurant-backend/src/routes/invoices.ts#L21-L262)
- [pdf.ts:53-256](file://restaurant-backend/src/lib/pdf.ts#L53-L256)
- [b2-storage.ts:76-124](file://restaurant-backend/src/lib/b2-storage.ts#L76-L124)
- [email.ts:200-227](file://restaurant-backend/src/lib/email.ts#L200-L227)
- [sms.ts:89-104](file://restaurant-backend/src/lib/sms.ts#L89-L104)
- [schema.prisma:208-222](file://restaurant-backend/prisma/schema.prisma#L208-L222)
- [logger.ts:50-56](file://restaurant-backend/src/utils/logger.ts#L50-L56)
- [errorHandler.ts:9-82](file://restaurant-backend/src/middleware/errorHandler.ts#L9-L82)

**Section sources**
- [invoices.ts:1-674](file://restaurant-backend/src/routes/invoices.ts#L1-L674)
- [pdf.ts:1-362](file://restaurant-backend/src/lib/pdf.ts#L1-L362)
- [b2-storage.ts:1-337](file://restaurant-backend/src/lib/b2-storage.ts#L1-L337)
- [email.ts:1-227](file://restaurant-backend/src/lib/email.ts#L1-L227)
- [sms.ts:1-131](file://restaurant-backend/src/lib/sms.ts#L1-L131)
- [schema.prisma:208-222](file://restaurant-backend/prisma/schema.prisma#L208-L222)
- [logger.ts:1-56](file://restaurant-backend/src/utils/logger.ts#L1-L56)
- [errorHandler.ts:1-82](file://restaurant-backend/src/middleware/errorHandler.ts#L1-L82)

## Core Components
- Enhanced InvoiceData interface defines the contract for building receipts with dynamic restaurant fields
- PDF generator creates a compact 80mm-wide, portrait-format receipt with advanced text wrapping and optimized spacing
- Enhanced B2 storage layer provides cloud-based PDF management with private bucket support
- Cleanup routine removes stale invoices after a configurable retention period
- Delivery pipeline supports email (with PDF attachment) and SMS notifications
- Persistence stores invoice metadata and cloud storage references
- Logging and error handling ensure observability and resilience

**Section sources**
- [pdf.ts:16-45](file://restaurant-backend/src/lib/pdf.ts#L16-L45)
- [pdf.ts:53-217](file://restaurant-backend/src/lib/pdf.ts#L53-L217)
- [pdf.ts:221-256](file://restaurant-backend/src/lib/pdf.ts#L221-L256)
- [pdf.ts:319-362](file://restaurant-backend/src/lib/pdf.ts#L319-L362)
- [invoices.ts:118-149](file://restaurant-backend/src/routes/invoices.ts#L118-L149)
- [b2-storage.ts:76-124](file://restaurant-backend/src/lib/b2-storage.ts#L76-L124)
- [b2-storage.ts:267-302](file://restaurant-backend/src/lib/b2-storage.ts#L267-L302)
- [schema.prisma:208-222](file://restaurant-backend/prisma/schema.prisma#L208-L222)
- [logger.ts:50-56](file://restaurant-backend/src/utils/logger.ts#L50-L56)
- [errorHandler.ts:9-82](file://restaurant-backend/src/middleware/errorHandler.ts#L9-L82)

## Architecture Overview
The enhanced system follows a layered architecture with cloud storage integration and improved formatting:
- Express route validates requests and loads order data with restaurant information
- Business logic constructs InvoiceData with dynamic fields and invokes PDF generation with enhanced formatting
- PDF buffer is persisted to Backblaze B2 cloud storage with enhanced security
- Invoice metadata is stored in the database with cloud storage references
- Private bucket support enables secure PDF access with signed URLs

```mermaid
sequenceDiagram
participant Client as "Client"
participant Route as "invoices.ts"
participant DB as "Prisma"
participant PDF as "pdf.ts"
participant B2 as "b2-storage.ts"
participant Email as "email.ts"
participant SMS as "sms.ts"
Client->>Route : POST /api/invoices/generate
Route->>DB : Load order with restaurant details
DB-->>Route : Order data with restaurant info
Route->>Route : Build InvoiceData with dynamic fields
Route->>PDF : generateInvoicePDF(invoiceData) with enhanced formatting
PDF-->>Route : Buffer (PDF with improved spacing & text wrapping)
Route->>B2 : savePDFToStorage(Buffer, filename)
B2-->>Route : {pdfPath, b2FileId}
alt EMAIL requested
Route->>Email : sendInvoiceEmail(to, invoiceData, Buffer)
Email-->>Route : success/failure
end
alt SMS requested
Route->>SMS : sendInvoiceSMS(phone, invoiceData)
SMS-->>Route : success/failure
end
Route->>DB : Upsert Invoice record with cloud metadata
Route-->>Client : ApiResponse
```

**Diagram sources**
- [invoices.ts:21-262](file://restaurant-backend/src/routes/invoices.ts#L21-L262)
- [pdf.ts:53-217](file://restaurant-backend/src/lib/pdf.ts#L53-L217)
- [pdf.ts:221-256](file://restaurant-backend/src/lib/pdf.ts#L221-L256)
- [b2-storage.ts:76-124](file://restaurant-backend/src/lib/b2-storage.ts#L76-L124)
- [email.ts:200-227](file://restaurant-backend/src/lib/email.ts#L200-L227)
- [sms.ts:89-104](file://restaurant-backend/src/lib/sms.ts#L89-L104)
- [schema.prisma:208-222](file://restaurant-backend/prisma/schema.prisma#L208-L222)

## Detailed Component Analysis

### Enhanced InvoiceData Interface and Required Fields
The enhanced InvoiceData interface now supports dynamic restaurant fields:
- **Restaurant identifiers**: restaurantName, restaurantAddress (multi-line support), restaurantCity, restaurantState, restaurantPhone, restaurantEmail, gstNumber, fssaiNumber
- **Transaction details**: invoiceNumber, orderDate, tableNumber, paymentMethod
- **Customer details**: customerName, customerEmail, customerPhone
- **Line items**: items[] with name, quantity, price, total
- **Financial totals**: subtotal, tax, taxPercent (dynamic tax percentage), total
- **Additional fields**: cashierName, paymentMethod

Rendering logic centers around:
- Receipt width of 80mm and dynamic height based on item count
- Centered headers with multi-line address support using advanced text wrapping
- Conditional GST number display
- Dynamic tax label formatting with taxPercent support
- Enhanced footer with restaurant contact information

**Section sources**
- [pdf.ts:16-45](file://restaurant-backend/src/lib/pdf.ts#L16-L45)
- [pdf.ts:53-217](file://restaurant-backend/src/lib/pdf.ts#L53-L217)

### Enhanced Template Structure and Styling
The receipt template now supports enhanced dynamic content with improved formatting:
- Page format: portrait, 80mm width, adjustable height
- Typography: bold headers, normal body text, small footers with enhanced readability
- Alignment: centered for headers, left-aligned for content, right-aligned for monetary values
- Layout blocks with optimized spacing:
  - Header with restaurant branding and conditional GST number
  - Multi-line restaurant address with advanced text wrapping for better readability
  - City and state information display
  - Restaurant contact details
  - Customer details section with improved spacing
  - Bill details (date, table, cashier, bill number) with enhanced formatting
  - Itemized rows with serial number, wrapped item name, quantity, price, amount
  - Totals summary with dynamic tax label formatting and better visual hierarchy
  - Enhanced footer with restaurant contact and FSSAI license

Advanced text wrapping ensures long restaurant addresses and item names fit within constrained column widths while maintaining readability.

**Section sources**
- [pdf.ts:53-217](file://restaurant-backend/src/lib/pdf.ts#L53-L217)

### Enhanced Dynamic Content Rendering
- **Restaurant details**: multi-line address support with `splitTextToSize()` for wrapping and improved spacing
- **Conditional fields**: GST number display only when available
- **Dynamic tax calculation**: taxPercent field enables customized tax labeling
- **Enhanced formatting**: city/state combination display, phone number formatting
- **Order metadata**: date, table number, cashier name, invoice number
- **Items**: derived from order.items with computed totals per item and advanced text wrapping
- **Totals**: subtotal, tax (dynamic tax percentage), and grand total with improved visual hierarchy
- **Monetary values**: formatted to two decimal places
- **Text alignment and spacing**: optimized for compactness with enhanced readability using strategic spacing increases

**Section sources**
- [invoices.ts:118-149](file://restaurant-backend/src/routes/invoices.ts#L118-L149)
- [pdf.ts:78-100](file://restaurant-backend/src/lib/pdf.ts#L78-L100)
- [pdf.ts:171-174](file://restaurant-backend/src/lib/pdf.ts#L171-L174)

### Enhanced PDF Buffer Generation and Cloud Storage
- **Buffer generation**: jspdf outputs a raw ArrayBuffer converted to Node.js Buffer
- **Cloud storage integration**: uploads to Backblaze B2 with invoices/ prefix for organization
- **Enhanced metadata**: returns structured metadata including B2 file IDs and public URLs
- **Private bucket support**: automatic detection and handling of private vs public buckets
- **Signed URL generation**: secure access to private bucket files with configurable expiration

**Section sources**
- [pdf.ts:199-208](file://restaurant-backend/src/lib/pdf.ts#L199-L208)
- [pdf.ts:221-256](file://restaurant-backend/src/lib/pdf.ts#L221-L256)
- [b2-storage.ts:76-124](file://restaurant-backend/src/lib/b2-storage.ts#L76-L124)
- [b2-storage.ts:267-302](file://restaurant-backend/src/lib/b2-storage.ts#L267-L302)

### Enhanced Cleanup Mechanism for Cloud Storage
- **Cloud-aware cleanup**: scans B2 storage for invoice files with invoices/ prefix
- **Enhanced filtering**: compares file upload timestamps against cutoff date
- **Cloud deletion**: deletes files from B2 storage using file IDs and names
- **Logging**: comprehensive audit trail with deletion counts and retention metrics
- **Error handling**: graceful degradation when B2 is not configured

**Section sources**
- [pdf.ts:319-362](file://restaurant-backend/src/lib/pdf.ts#L319-L362)
- [b2-storage.ts:189-211](file://restaurant-backend/src/lib/b2-storage.ts#L189-L211)
- [b2-storage.ts:218-252](file://restaurant-backend/src/lib/b2-storage.ts#L218-L252)

### Enhanced Delivery Pipeline: Email and SMS
- **Email**: generates HTML template with invoice details and attaches PDF buffer
- **SMS**: sends concise invoice summary via Twilio with enhanced error handling
- **Delivery tracking**: maintains sentVia methods and delivery flags in database
- **Resend capability**: supports invoice regeneration and re-delivery
- **Refresh functionality**: allows PDF regeneration and cloud storage refresh

**Section sources**
- [email.ts:66-195](file://restaurant-backend/src/lib/email.ts#L66-L195)
- [email.ts:200-227](file://restaurant-backend/src/lib/email.ts#L200-L227)
- [sms.ts:71-104](file://restaurant-backend/src/lib/sms.ts#L71-L104)
- [invoices.ts:348-496](file://restaurant-backend/src/routes/invoices.ts#L348-L496)
- [invoices.ts:498-641](file://restaurant-backend/src/routes/invoices.ts#L498-L641)

### Enhanced Persistence and Metadata
- **Enhanced Invoice model**: tracks orderId, invoiceNumber, sentVia methods, delivery flags, and cloud storage metadata
- **Cloud integration**: stores pdfPath, pdfData, pdfName, and b2FileId for cloud-managed invoices
- **Route handlers**: upsert invoice records with cloud storage references and delivery outcomes
- **Supports**: resends, refreshes, and cloud storage management by invoiceId or orderId

**Section sources**
- [schema.prisma:208-222](file://restaurant-backend/prisma/schema.prisma#L208-L222)
- [invoices.ts:195-224](file://restaurant-backend/src/routes/invoices.ts#L195-L224)
- [invoices.ts:348-496](file://restaurant-backend/src/routes/invoices.ts#L348-L496)
- [invoices.ts:498-641](file://restaurant-backend/src/routes/invoices.ts#L498-L641)

### Enhanced Error Handling and Logging
- **Centralized error handling**: wraps async operations and standardizes responses
- **Enhanced logging**: structured logs with timestamps, metadata, and cloud storage context
- **PDF generation**: includes contextual logs for debugging with enhanced error details
- **Cloud storage**: comprehensive logging for upload/download operations and cleanup
- **Delivery failures**: detailed error logging with actionable warnings for troubleshooting

**Section sources**
- [errorHandler.ts:9-82](file://restaurant-backend/src/middleware/errorHandler.ts#L9-L82)
- [logger.ts:50-56](file://restaurant-backend/src/utils/logger.ts#L50-L56)
- [pdf.ts:209-216](file://restaurant-backend/src/lib/pdf.ts#L209-L216)
- [pdf.ts:225-255](file://restaurant-backend/src/lib/pdf.ts#L225-L255)
- [pdf.ts:348-353](file://restaurant-backend/src/lib/pdf.ts#L348-L353)
- [b2-storage.ts:117-123](file://restaurant-backend/src/lib/b2-storage.ts#L117-L123)
- [b2-storage.ts:276-281](file://restaurant-backend/src/lib/b2-storage.ts#L276-L281)
- [email.ts:52-61](file://restaurant-backend/src/lib/email.ts#L52-L61)
- [sms.ts:58-66](file://restaurant-backend/src/lib/sms.ts#L58-L66)

## Enhanced Features

### Advanced Text Wrapping and Spacing Optimization
The system now features significantly improved text handling:
- **Restaurant address wrapping**: Uses `splitTextToSize()` with 65mm width constraint for multi-line addresses
- **Item name wrapping**: Advanced text wrapping for long menu item names with proper line height calculation
- **Enhanced spacing**: Strategic spacing increases between sections (5-9mm increments) for better visual hierarchy
- **Improved readability**: Better font sizing and contrast for 80mm POS printer compatibility

**Section sources**
- [pdf.ts:78-82](file://restaurant-backend/src/lib/pdf.ts#L78-L82)
- [pdf.ts:146](file://restaurant-backend/src/lib/pdf.ts#L146)
- [pdf.ts:153](file://restaurant-backend/src/lib/pdf.ts#L153)

### Enhanced Typography Hierarchy and Visual Design
Improved visual presentation with better typography and spacing:
- **Header hierarchy**: Bold 14pt restaurant name, 8pt GST notice, 8pt address text
- **Section spacing**: Increased margins between header, customer, bill details, items, and totals sections
- **Item formatting**: Enhanced item listing with proper line wrapping and spacing calculations
- **Totals presentation**: Clear separation between subtotal, tax, and grand total with double line separators

**Section sources**
- [pdf.ts:65-74](file://restaurant-backend/src/lib/pdf.ts#L65-L74)
- [pdf.ts:185-195](file://restaurant-backend/src/lib/pdf.ts#L185-L195)

### Improved Item Listing and Totals Formatting
Enhanced formatting for better readability and visual appeal:
- **Item name wrapping**: Proper text wrapping for long menu item names with line height calculation
- **Quantity and pricing**: Clear alignment of quantities, prices, and amounts with right-aligned monetary values
- **Totals calculation**: Enhanced spacing between subtotal, tax, and grand total sections
- **Visual separators**: Double line under grand total for emphasis and clarity

**Section sources**
- [pdf.ts:141-154](file://restaurant-backend/src/lib/pdf.ts#L141-L154)
- [pdf.ts:164-175](file://restaurant-backend/src/lib/pdf.ts#L164-L175)
- [pdf.ts:188-195](file://restaurant-backend/src/lib/pdf.ts#L188-L195)

### Enhanced B2 Storage Integration
Comprehensive cloud storage capabilities:
- **Private bucket support**: automatic detection and handling of private vs public buckets
- **Signed URL generation**: secure access to private files with configurable expiration
- **Enhanced metadata**: file IDs, upload timestamps, and content length tracking
- **Cloud cleanup**: automated removal of stale invoice files from cloud storage
- **Error handling**: graceful degradation when cloud storage is unavailable

**Section sources**
- [b2-storage.ts:257-259](file://restaurant-backend/src/lib/b2-storage.ts#L257-L259)
- [b2-storage.ts:267-302](file://restaurant-backend/src/lib/b2-storage.ts#L267-L302)
- [b2-storage.ts:319-336](file://restaurant-backend/src/lib/b2-storage.ts#L319-L336)
- [pdf.ts:319-362](file://restaurant-backend/src/lib/pdf.ts#L319-L362)

## Dependency Analysis
Enhanced external libraries and internal dependencies:
- **jspdf**: PDF generation engine with enhanced text wrapping and spacing capabilities
- **backblaze-b2**: Cloud storage with private bucket support and signed URL generation
- **nodemailer**: Email transport and templating
- **twilio**: SMS delivery with enhanced error handling
- **winston**: Structured logging with enhanced context
- **zod**: Request validation
- **prisma**: Database ORM and schema with cloud metadata support

```mermaid
graph LR
A["invoices.ts"] --> B["pdf.ts"]
A --> C["b2-storage.ts"]
A --> D["email.ts"]
A --> E["sms.ts"]
B --> F["logger.ts"]
C --> F
D --> F
E --> F
A --> G["schema.prisma"]
H["package.json"] --> B
H --> C
H --> D
H --> E
```

**Diagram sources**
- [invoices.ts:1-13](file://restaurant-backend/src/routes/invoices.ts#L1-L13)
- [pdf.ts:1-11](file://restaurant-backend/src/lib/pdf.ts#L1-L11)
- [b2-storage.ts:1-2](file://restaurant-backend/src/lib/b2-storage.ts#L1-L2)
- [email.ts:1-2](file://restaurant-backend/src/lib/email.ts#L1-L2)
- [sms.ts:1-2](file://restaurant-backend/src/lib/sms.ts#L1-L2)
- [logger.ts:1-56](file://restaurant-backend/src/utils/logger.ts#L1-L56)
- [schema.prisma:208-222](file://restaurant-backend/prisma/schema.prisma#L208-L222)
- [package.json:18-45](file://restaurant-backend/package.json#L18-L45)

**Section sources**
- [package.json:18-45](file://restaurant-backend/package.json#L18-L45)
- [pdf.ts:1-11](file://restaurant-backend/src/lib/pdf.ts#L1-L11)
- [b2-storage.ts:1-2](file://restaurant-backend/src/lib/b2-storage.ts#L1-L2)
- [email.ts:1-2](file://restaurant-backend/src/lib/email.ts#L1-L2)
- [sms.ts:1-2](file://restaurant-backend/src/lib/sms.ts#L1-L2)
- [logger.ts:1-56](file://restaurant-backend/src/utils/logger.ts#L1-L56)
- [schema.prisma:208-222](file://restaurant-backend/prisma/schema.prisma#L208-L222)

## Performance Considerations
Enhanced performance considerations for cloud-integrated systems:
- **Batch generation**: For high-volume scenarios, consider queuing invoice generation and parallelizing I/O-bound tasks
- **Memory footprint**: jspdf buffers are held in memory; ensure adequate heap limits and monitor peak usage
- **Cloud I/O optimization**: Backblaze B2 provides scalable storage; consider CDN integration for public access
- **Caching strategies**: Reuse PDF buffers for resends and refreshes to avoid recomputation
- **Concurrency management**: Use worker threads or microservices to isolate heavy PDF workloads
- **Cloud storage optimization**: Implement proper cloud storage lifecycle policies and cleanup routines
- **Logging overhead**: Reduce log verbosity in production or switch to sampling to minimize I/O impact

## Troubleshooting Guide
Enhanced troubleshooting for cloud-integrated systems:
- **PDF generation fails**: Verify jspdf installation and availability, check InvoiceData completeness
- **Cloud storage failures**: Confirm B2 credentials, bucket configuration, and network connectivity
- **Private bucket issues**: Verify B2_BUCKET_PRIVATE setting and signed URL generation
- **Storage write failures**: Check B2 bucket permissions, file naming conventions, and upload quotas
- **Email delivery issues**: Ensure SMTP credentials and sender domain are configured
- **SMS delivery issues**: Confirm Twilio credentials and sender number
- **Cleanup not removing files**: Verify B2 configuration, file prefixes, and retention thresholds
- **Route errors**: Review validation schemas, Prisma queries, and cloud storage integration

**Section sources**
- [pdf.ts:209-216](file://restaurant-backend/src/lib/pdf.ts#L209-L216)
- [pdf.ts:225-255](file://restaurant-backend/src/lib/pdf.ts#L225-L255)
- [pdf.ts:348-353](file://restaurant-backend/src/lib/pdf.ts#L348-L353)
- [b2-storage.ts:117-123](file://restaurant-backend/src/lib/b2-storage.ts#L117-L123)
- [b2-storage.ts:276-281](file://restaurant-backend/src/lib/b2-storage.ts#L276-L281)
- [email.ts:52-61](file://restaurant-backend/src/lib/email.ts#L52-L61)
- [sms.ts:58-66](file://restaurant-backend/src/lib/sms.ts#L58-L66)
- [errorHandler.ts:22-76](file://restaurant-backend/src/middleware/errorHandler.ts#L22-L76)

## Conclusion
The enhanced PDF invoice generation system integrates a receipt-style jspdf template with significantly improved formatting capabilities, dynamic restaurant field support, and enhanced tax calculation handling. The system now features advanced text wrapping with `splitTextToSize()`, optimized spacing between sections, clearer typography hierarchy, and better readability specifically designed for 80mm POS printers. The system supports multi-line address formatting, conditional GST display, dynamic tax percentages, and secure cloud storage with private bucket support. It provides comprehensive delivery and persistence layers with enhanced operational safeguards including logging, cleanup, error handling, and cloud storage management. For high-volume deployments, consider asynchronous processing, caching strategies, and scalable cloud storage solutions to maintain responsiveness and reliability.