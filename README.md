# CoBiTun — Parametric Cloud Outage Insurance Platform

A **parametric cloud outage insurance platform** for Tunisian SMEs, built with Next.js 15, Prisma, and SQLite. CoBiTun provides automated claim processing via IODA outage detection, real-time monitoring, and full lifecycle management for two product lines:

- **Parametric Cloud Outage Insurance** — Automated payouts based on IODA-detected internet outages
- **Cyber Indemnity Insurance** — Traditional indemnity coverage for cyber incidents

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Next.js 15 App                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Customer  │  │  Admin   │  │ Workflow  │  │   Auth   │  │
│  │   API     │  │   API    │  │   API     │  │   API    │  │
│  └────┬──────┘  └────┬─────┘  └────┬──────┘  └────┬─────┘  │
│       │              │              │              │         │
│  ┌────┴──────────────┴──────────────┴──────────────┴─────┐  │
│  │              Middleware Layer                           │  │
│  │  CORS │ Rate Limit │ HTTPS │ Sanitize │ Idempotency   │  │
│  └────────────────────────┬───────────────────────────────┘  │
│                           │                                  │
│  ┌────────────────────────┴───────────────────────────────┐  │
│  │              Service Layer                              │  │
│  │  Auth │ Audit │ Notifications │ PDF │ Email │ Fraud    │  │
│  └────────────────────────┬───────────────────────────────┘  │
│                           │                                  │
│  ┌────────────────────────┴───────────────────────────────┐  │
│  │              Data Layer (Prisma ORM)                    │  │
│  │  Encryption │ Soft Delete │ Audit Trail │ Hash Chain   │  │
│  └────────────────────────┬───────────────────────────────┘  │
│                           │                                  │
└───────────────────────────┼──────────────────────────────────┘
                            │
                    ┌───────┴───────┐
                    │    SQLite     │
                    └───────────────┘
```

## 🚀 Deploy to Render

The project is ready for Docker deployment on Render.

See [`render-deploy-instructions.md`](./render-deploy-instructions.md) for step-by-step setup and the exact environment configuration.

## 🚀 Features

### Core Insurance
- **Parametric Cloud Outage Insurance** — Automated payout based on IODA-detected internet outages
- **Cyber Indemnity Insurance** — Traditional indemnity coverage for cyber incidents
- **Workflow Engine** — Multi-step policy application and claims with role-based task assignment
- **Parametric Policy Management** — Create, renew, endorse, and cancel policies
- **Automated Claim Processing** — Trigger-based claims via IODA outage detection
- **Prorated Refund Calculation** — Fair refund computation on policy cancellation
- **Claim Appeals** — 30-day appeal window with admin review workflow
- **Payout Processing** — Multi-method payouts with status tracking and reversal
- **Coverage Gap Analyzer** — Compare parametric vs cyber coverage to identify uninsured risks

### Security & Compliance
- **Field-Level Encryption** — AES-256-GCM encryption for PII (taxId, registrationNumber, mobile)
- **Audit Trail with Hash Chain** — Tamper-detectable audit logs with SHA-256 chaining
- **Custom Auth** — Session-less authentication via x-user-id / x-user-role headers
- **RBAC Authorization** — Role-based access (CUSTOMER, ADMIN)
- **Account Lockout** — 5 failed login attempts → 30 min lock
- **CSRF Protection** — Double-submit cookie pattern
- **Rate Limiting** — Per-IP rate limits with configurable windows per endpoint type
- **Input Sanitization** — XSS, SQL injection, and path traversal detection
- **Idempotency Keys** — Safe retries for financial operations
- **HTTPS Enforcement** — HSTS headers and HTTP→HTTPS redirect in production

### Monitoring & Operations
- **IODA Integration** — Real-time internet outage detection via Georgia Tech API
- **Fraud Detection** — Multi-signal scoring with velocity checks and pattern analysis
- **Dashboard Analytics** — Aggregated stats for admin and customer dashboards
- **Notification System** — In-app + email notifications for all key events
- **PDF Generation** — Policy contracts, declarations of loss, payout receipts
- **i18n** — English, Arabic, French with RTL support

## 📁 Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/              # Authentication endpoints
│   │   ├── admin/             # Admin-only endpoints
│   │   │   ├── claims/        # Claim management & rejection
│   │   │   ├── dashboard/     # Admin analytics
│   │   │   ├── policies/      # Policy management & cancellation approval
│   │   │   └── ...
│   │   ├── customer/          # Customer endpoints
│   │   │   ├── claims/        # Claim submission & appeal
│   │   │   ├── dashboard/     # Customer analytics
│   │   │   ├── policies/      # Policy view & cancellation
│   │   │   ├── profile/       # Profile management
│   │   │   └── ...
│   │   ├── cron/              # Scheduled tasks
│   │   ├── health/            # Health check
│   │   └── workflow/          # Workflow engine endpoints
│   └── ...
├── lib/
│   ├── db.ts                  # Prisma client singleton
│   ├── encryption.ts          # AES-256-GCM field encryption
│   ├── fraud-detector.ts      # Multi-signal fraud scoring
│   ├── idempotency.ts         # Idempotency key management
│   ├── ioda-client.ts         # IODA API integration
│   ├── parametric-engine.ts   # Parametric trigger & payout engine
│   ├── services/
│   │   ├── audit-service.ts   # Hash-chained audit logging
│   │   ├── auth-helper.ts     # Authentication utilities
│   │   ├── authorization.ts   # RBAC enforcement
│   │   ├── email-service.ts   # Email delivery
│   │   ├── file-storage.ts    # File upload & storage
│   │   ├── notification-service.ts # Multi-channel notifications
│   │   ├── pdf-generator.ts   # PDF document generation
│   │   └── workflow-engine.ts # Claim workflow state machine
│   └── ...
├── middleware/
│   ├── cors.ts                # CORS configuration
│   ├── https-redirect.ts      # HTTPS enforcement
│   ├── idempotency.ts         # Idempotency middleware
│   ├── prisma-encryption.ts   # Auto encrypt/decrypt PII
│   ├── rate-limiter.ts        # Per-IP rate limiting
│   ├── sanitize.ts            # Input sanitization & XSS prevention
│   └── validation.ts          # Zod validation + error standardization
└── middleware.ts               # Root Next.js middleware
```

## 🛠️ Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd cobitun

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Set up the database
npx prisma migrate dev
npx prisma generate

# Start the development server
npm run dev
```

### Environment Variables

See `.env.example` for the complete list. Key variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | SQLite database file path (e.g. `file:./dev.db`) | ✅ |
| `ENCRYPTION_KEY` | PII field encryption key (32 bytes hex) | ✅ |
| `CSRF_SECRET` | CSRF token signing key | ✅ |
| `NEXT_PUBLIC_APP_URL` | Application URL for CORS | ✅ |
| `IODA_API_KEY` | IODA outage detection API key | ❌ |

## 🔐 Security Model

### Authentication Flow
1. **Login** → Custom session-less auth (x-user-id / x-user-role headers)
2. **Account Lockout** → 5 failed attempts → 30 min lock
3. **Logout** → Clear auth headers

### Authorization (RBAC)
- `CUSTOMER` — Own resources only (policies, claims, profile) — owner-scoped
- `ADMIN` — All data, all operations, workflow review & approval

### Data Protection
- **At Rest**: PII fields encrypted with AES-256-GCM (taxId, registrationNumber, mobile)
- **In Transit**: HTTPS enforced with HSTS headers
- **Audit**: Hash-chained audit logs detect tampering (SHA-256)
- **Input**: Sanitization + Zod validation on all endpoints
- **Soft Delete**: isDeleted flag pattern across entities

## 📊 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login (admin or customer) |
| POST | `/api/auth/signup` | Customer registration |
| POST | `/api/auth/logout` | Logout |
| POST | `/api/auth/change-password` | Change password |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password with token |

### Customer
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/customer/dashboard` | Dashboard statistics |
| GET/PATCH | `/api/customer/profile` | Get/update profile |
| GET/POST | `/api/customer/apply-parametric` | Parametric insurance form & apply |
| GET | `/api/customer/parametric-policies` | List own parametric policies |
| GET | `/api/customer/parametric-claims` | List own parametric claims |
| GET | `/api/customer/outage-monitor` | Real-time outage status |
| GET/POST | `/api/customer/cyber/apply` | Cyber insurance application |
| GET | `/api/customer/cyber/policies` | List own cyber policies |
| GET | `/api/customer/cyber/claims` | List own cyber claims |
| GET | `/api/customer/coverage-gap` | Coverage gap analysis |
| GET | `/api/customer/claims/[id]/appeal` | Get appeal status |
| POST | `/api/customer/claims/[id]/appeal` | Submit appeal |
| POST | `/api/customer/policies/[id]/cancel` | Cancel policy |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/dashboard` | Admin KPIs |
| GET | `/api/admin/audit-logs` | Audit log search |
| GET | `/api/admin/customers` | List all customers |
| GET/POST/PATCH | `/api/admin/cloud-providers` | Cloud provider CRUD |
| GET/PATCH | `/api/admin/parametric-claims` | Parametric claim management |
| GET/PATCH | `/api/admin/cyber-applications` | Cyber application review |
| GET/PATCH | `/api/admin/cyber-claims` | Cyber claim management |
| PATCH | `/api/admin/claims/[id]/reject` | Reject a claim |
| PATCH | `/api/admin/claims/[id]/appeal-review` | Review an appeal |
| POST | `/api/admin/claims/[id]/payout` | Initiate payout |
| PATCH | `/api/admin/claims/[id]/payout` | Update payout status |
| PATCH | `/api/admin/policies/[id]/cancel-approve` | Approve/deny cancellation |
| GET/PATCH | `/api/admin/reference/[type]` | Reference data management |

### Workflow
| Method | Endpoint | Actor | Description |
|--------|----------|-------|-------------|
| GET | `/api/workflow/policy-applications` | Both | List policy applications |
| POST | `/api/workflow/policy-applications` | Customer | Create policy application |
| GET/PATCH | `/api/workflow/policy-applications/[id]` | Both | View/interact with application |
| GET | `/api/workflow/claims` | Both | List workflow claims |
| POST | `/api/workflow/claims` | Customer | Create workflow claim |
| GET/PATCH | `/api/workflow/claims/[id]` | Both | View/interact with claim |
| GET | `/api/workflow/tasks` | Admin | List all workflow tasks |

### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cron/ioda-check` | Periodic IODA outage check |
| GET | `/api/health` | Health check |

## 🧪 Development

```bash
# Run development server
npm run dev

# Run linter
npm run lint

# Build for production
npm run build

# Start production server
npm start

# Database management
npx prisma studio        # GUI for database
npx prisma migrate dev   # Run migrations
npx prisma generate      # Regenerate client
```

## 🌍 Internationalization

- **English** (en) — Default
- **Arabic** (ar) — RTL support
- **French** (fr)

Translation files in `/public/locales/{lang}/` with I18nProvider and LanguageSwitcher components.

---

## 📝 License

Private — All rights reserved.
