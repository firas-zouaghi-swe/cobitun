# CoBiTun

> Parametric cloud outage insurance and cyber indemnity platform for Tunisian SMEs.

CoBiTun is a POC full-stack SaaS application built with Next.js 16 and Prisma. It combines parametric cloud outage insurance, cyber indemnity, claims workflows, fraud detection, audit-safe data controls, multilingual UIs, and deployment-ready Docker configuration.

---

## Project Overview

CoBiTun is designed for three core use cases:

1. **Small and medium Tunisian businesses** can apply for parametric outage insurance and cyber indemnity insurance, monitor SLA violations, and submit claims.
2. **Insurance operations teams** can review applications, manage underwriting workflows, approve policies, handle claims, keep reserves, and run reinsurance/accounting tasks.
3. **Compliance/security teams** can monitor fraud, session activity, audit trails, and secure data handling through encryption, CSRF protection, rate limiting, and idempotency.

This repo is a complete application that includes:

- Customer signup, authentication, password recovery, and profile management
- Role-based dashboards for customers, admins, and super admins
- Parametric outage policy creation linked to IODA outage signals
- Cyber indemnity application and cyber claim management
- Workflow engine enforcing state transitions and terminal states
- Reinsurance, claim reserves, endorsements, renewals, refunds, and notifications
- Fraud scoring using rule-based heuristics and LLM analysis
- Raw PDF generation for policies and declarations of loss
- Multi-language interface with English, French, Arabic, and RTL support

---

## Detailed Capabilities

### Insurance Products

- **Parametric Cloud Outage Insurance**
  - Application forms for parametric policies
  - Integration with IODA outage detection for ASN-based cloud provider monitoring
  - Outage event and time-series signal visualization
  - Automated policy triggers when outages cross SLA thresholds
  - Parametric claim submission and payout workflows

- **Cyber Indemnity Insurance**
  - Application flow for cyber coverage
  - Cyber claim submission and review
  - Comprehensive cyber policy management for customers and admins
  - Coverage gap analysis page for cyber risk exposure

### Workflow & Approval Engine

- Policy application workflow states:
  - `ProviderContractUploaded`
  - `AdminReviewing`
  - `PolicyContractGenerated`
  - `AwaitingSignatureAndPayment`
  - `ReadyForFinalApproval`
  - `UnderwritingCompleted`
  - `Rejected`
- Claim workflow states:
  - `Open`
  - `Submitted`
  - `Completed`
- Strict validation of allowed state transitions and terminal-state immutability
- Role-based action restrictions for admin and customer actions
- Custom workflow errors returned with machine-readable error codes
- Workflow tests ensure valid and invalid transition coverage

### Administration & Underwriting

- Admin pages for:
  - Customers, users, and customer lists
  - Policies, claims, and policy holders
  - Cloud provider configuration and SLA tiers
  - Parametric policy requests and parametric claims
  - Cyber applications and cyber claims
  - Reinsurance, claim reserves, endorsements, renewals, refunds
  - Notification management, sessions, fraud detection, audit monitoring
  - IODA configuration and outage dashboards

### Customer Experience

- Customer pages for:
  - Dashboard and application history
  - Policy applications and policy details
  - Parametric outage monitoring and claims
  - Cyber policy claims and coverage gap analysis
  - Draft claim management and claim lifecycle tracking
  - Account settings, notification preferences, and security sessions

### Data & Security

- **Authentication / Sessions**
  - JWT-based authentication with `JWT_SECRET`
  - Session storage in database with idle and absolute expiration
  - Auth token refresh support and session renewal
  - Dev-mode fallback headers for easier local testing

- **Authorization & RBAC**
  - `SUPER_ADMIN`, `ADMIN`, and `CUSTOMER` roles
  - Server-side `requireAuth` and `requireRole` guards
  - Owner checks for customer-specific resources
  - Admin routes automatically allow super-admin access

- **API Security**
  - CSRF protection for authenticated state-changing requests
  - Rate limiting: 5 requests/min for auth endpoints, 100 requests/min for general API
  - Idempotency middleware for repeat-safe API operations
  - Input sanitization to remove HTML, control characters, path traversal, SQL/XSS patterns
  - Zod validation schemas for login, signup, password reset, profile updates

- **Data Encryption**
  - AES-256-GCM field-level encryption utilities for PII
  - Backup encryption and decryption support
  - Key rotation helpers and rotation policy awareness

- **Audit & Logging**
  - Audit log model capturing entity changes, action category, actor, IP, user agent, correlation IDs
  - System settings versioning and change history
  - Session and notification tracking for security operations

### Fraud Detection & AI

- **Fraud detector** combines rule-based analytics with local LLM analysis
- Built-in rule checks include:
  - username entropy and pattern analysis
  - disposable email detection
  - IP reputation and recent registration velocity
  - shared device fingerprint detection
  - suspicious user agent detection
  - account lock / failed login history
- **AI integration** uses `ollama` with models like `llama3.2:3b` and `qwen2.5:7b`
- Fraud detector prompts the LLM to rate fake/sybil risk and parse JSON output
- Fallback parsing is provided when the model output is not JSON
- Fraud verdicts are stored with rule scores, LLM scores, final score, reasoning, and model name

### Notifications & Communications

- In-app notification engine for customer and admin alerts
- Notification records are linked to policies, claims, and workflow entities
- Email service support via SMTP configuration for password resets and alerts

### PDF Generation

- Policy contract PDF generation from structured policy details
- Declaration of loss PDF generation for claim submissions
- Uses a custom minimal PDF writer for compatibility in server environments

### Multilingual Experience

- Locale support for `en`, `fr`, and `ar`
- RTL-aware UI styles and language switching
- JSON locale bundles under `public/locales/*`
- Multi-language page templates for admin and customer workflows

### Deployment & Docker

- Dockerfile and `.dockerignore` ready for containerized deployment
- Render-specific deployment instructions and environment variable entries
- Production build uses `npm run build` then `node ./scripts/copy-static.js`
- Designed for deployment on Render and other Docker platforms

---

## Architecture

### Frontend

- **Next.js app router** with `src/app` for page composition and role-based routing
- Client-side state managed with `zustand` and custom `useAuth` hook
- UI built with Tailwind CSS, Radix UI primitives, Lucide icons, and advanced React patterns
- Key UI modules:
  - `components/pages/` — page-level components for each admin/customer screen
  - `components/shared/` — reusable cards, charts, tables, layout pieces
  - `components/ui/` — core UI primitives and design system
  - `hooks/` — `use-auth`, `use-mobile`, `use-place-autocomplete`, `use-toast`

### Backend

- **Prisma ORM** with `schema.prisma` and SQLite local datasource
- `src/lib/db.ts` initializes Prisma client and database helpers
- `src/lib/services/*` contains domain services for:
  - workflow engine
  - authorization
  - fraud detection
  - PDF generation
  - notifications
  - email sending
  - file storage
  - MFA/authorization checks
- `src/lib/*` contains support services for auth, JWT, encryption, validation, i18n, and environment helpers

### Middleware

- `src/middleware/cors.ts` for CORS header management
- `src/middleware/https-redirect.ts` for HTTP-to-HTTPS enforcement
- `src/middleware/rate-limiter.ts` for throttling API endpoints
- `src/middleware/idempotency.ts` for safe repeatable write operations
- `src/middleware/sanitize.ts` for input cleansing
- `src/middleware/validation.ts` for standardized API error handling and auth enforcement

### Data Model Highlights

- Users, customers, user sessions, and roles
- Parametric policies, parametric claims, and cloud provider SLA metadata
- Cyber applications, cyber claims, and cyber policy lifecycle
- Workflow claims, workflow tasks, and task actor/status enums
- Fraud detection results, IP reputation, device fingerprints
- Notification records, audit log entries, system settings, sequence registry

---

## Setup & Run

### Prerequisites

- Node.js 18 or later
- npm 10 or later
- Git
- Optional: Bun for seed scripts

### Install dependencies

```bash
npm ci
```

### Configure environment

Copy `.env.example` to `.env` and populate values:

- `DATABASE_URL` — SQLite or other Prisma connection string
- `NEXT_PUBLIC_APP_URL` — app URL for auth and redirects
- `JWT_SECRET` — secure JWT signing secret
- `ENCRYPTION_KEY` — AES encryption key for PII
- `CSRF_SECRET` — CSRF signing secret
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` — email settings
- `IODA_API_KEY` — IODA outage API key if required by custom routes
- `OLLAMA_API_KEY` or local Ollama runtime settings if using AI fraud detection

### Run development server

```bash
npm run dev
```

### Build and start production

```bash
npm run build
npm start
```

### Database operations

```bash
npm run db:migrate
npm run db:generate
npm run db:reset
npm run db:seed
```

### Test suite

- Run all tests:
  ```bash
  npm test
  ```
- Run workflow state tests:
  ```bash
  npm run test:workflow
  ```

---

## Environment Variables

The full `.env.example` contains all required variables. Core entries include:

- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `JWT_SECRET`
- `ENCRYPTION_KEY`
- `CSRF_SECRET`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`
- `IODA_API_KEY`
- `NODE_ENV`

---

## Deployment Notes

- Use the provided `Dockerfile` for container builds
- Use `render-deploy-instructions.md` and `render-env-entries.txt` for Render
- Ensure secrets are injected in host/container environment, not committed
- In production, enable HTTPS and strong security headers via `middleware.ts`

---

## Repository Contents

- `src/app/` — Next.js application routes and page composition
- `src/components/` — UI page components, shared elements, and design system
- `src/hooks/` — reusable client hooks for auth, mobile responsiveness, autocompletion, toast messaging
- `src/lib/` — core logic, database initialization, auth helpers, encryption, validation, services
- `src/middleware/` — request-level security, throttling, idempotency, sanitization
- `prisma/` — schema definition, migration files, seed scripts
- `public/locales/` — localized UI strings for `en`, `fr`, and `ar`
- `.github/` — CI workflows, issue templates, PR templates, GitHub metadata
- `scripts/` — helper scripts for seeding, admin creation, JWT testing, and verification

---

## Security and Governance

- Sensitive values must stay out of source control
- Use `.env.example` as a safe template
- Remain mindful of role-based access control and session expiry
- Protect state-changing API requests with CSRF when MFA is required
- Use database audit logs and notification records for post-event review

---

## GitHub Best Practices

This repo includes curated GitHub metadata and governance files:

- `LICENSE` — MIT license
- `CONTRIBUTING.md` — contribution rules and local development workflow
- `CODE_OF_CONDUCT.md` — behavior expectations
- `SECURITY.md` — responsible disclosure guidelines
- `.github/workflows/ci.yml` — lint/test/build CI pipeline
- Issue and PR templates for consistent collaboration

---

## Disclaimer

This repository is a reference implementation and includes advanced insurance and AI concepts. It is intended for development, testing, and demonstration. Production deployments must validate business logic, insurance compliance, and security requirements for the target market.
