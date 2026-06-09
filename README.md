# CoBiTun

> Parametric cloud outage insurance and cyber indemnity platform for Tunisian SMEs.

CoBiTun is a full-stack Next.js application that adds parametric outage insurance, cyber indemnity, claims workflows, and secure data handling to a modern SaaS-ready codebase.

## Key Capabilities

- Parametric outage insurance linked to IODA outage detection
- Cyber indemnity insurance application, approval, and claims management
- Customer and admin portals with role-based access control
- Automated claims workflows, payouts, appeals, and audit trails
- Field-level PII encryption, CSRF protection, rate limiting, and input sanitization
- PDF generation for policies, claims, and receipts
- Multi-language support: English, French, Arabic (RTL support)
- Docker-ready deployment with Render deployment guidance

## Tech Stack

- Next.js 16.1.1
- React 19
- TypeScript
- Tailwind CSS
- Prisma ORM
- SQLite for local development
- Jest for tests
- Docker-ready containerization

## Repository Structure

```text
src/
├── app/                   # Next.js pages and API routes
├── components/            # UI components and page views
├── hooks/                 # Custom React hooks
├── lib/                   # Business logic, services, and utilities
├── middleware/            # Request middleware and security guards
├── types/                 # TypeScript declarations
```

Additional important files:

- `Dockerfile` — production container build
- `.env.example` — environment variable template
- `prisma/` — database schema and seed scripts
- `render-deploy-instructions.md` — Render deployment guide
- `render-env-entries.txt` — example environment entries for Render

## Getting Started

### Prerequisites

- Node.js 18+
- npm 10+
- Git
- Optional: Bun for `npm run db:seed`

### Install

```bash
git clone https://github.com/firas-zouaghi-swe/cobitun.git
cd cobitun
npm ci
```

### Configure environment

```bash
cp .env.example .env
```

Then update `.env` with your own values. Do not commit `.env`.

### Run locally

```bash
npm run dev
```

Open `http://localhost:3000`.

### Build for production

```bash
npm run build
npm start
```

### Database commands

```bash
npm run db:migrate
npm run db:generate
npm run db:reset
npm run db:seed
```

> Note: `npm run db:seed` currently uses Bun as configured in `package.json`.

## Environment Variables

The complete template is available in `.env.example`.

Important variables:

- `DATABASE_URL` — Prisma database connection string
- `NEXT_PUBLIC_APP_URL` — application URL for CORS and redirects
- `JWT_SECRET` — JWT signing secret
- `ENCRYPTION_KEY` — field-level encryption key for PII
- `CSRF_SECRET` — CSRF signing secret
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` — email delivery
- `IODA_API_KEY` — outage detection key

## Scripts

- `npm run dev` — run development server
- `npm run build` — build production assets
- `npm start` — start production app
- `npm run lint` — run ESLint
- `npm test` — execute Jest tests
- `npm run db:migrate` — apply Prisma migrations
- `npm run db:generate` — generate Prisma client
- `npm run db:reset` — reset database
- `npm run db:seed` — seed sample data

## Security Practices

- Do not commit secrets or credentials
- Keep `.env` local and use `.env.example` as a template
- Use HTTPS in production
- Rotate keys and secrets regularly

## Deployment

This codebase is prepared for Docker deployment. Use `render-deploy-instructions.md` and `render-env-entries.txt` for Render setup.

## GitHub Best Practices

This repository includes:

- `LICENSE` — open source license
- `CONTRIBUTING.md` — contribution guidelines
- `CODE_OF_CONDUCT.md` — community standards
- `SECURITY.md` — responsible disclosure policy
- `.github/workflows/ci.yml` — continuous integration
- `.github/ISSUE_TEMPLATE/bug_report.md` — bug report template
- `.github/ISSUE_TEMPLATE/feature_request.md` — feature request template
- `.github/PULL_REQUEST_TEMPLATE.md` — PR template

## License

This project is released under the MIT License. See `LICENSE`.
