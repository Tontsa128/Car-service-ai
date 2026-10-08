# Car Service AI

Car Service AI is a professional, multi-tenant SaaS **Workshop OS** for automotive repair businesses.

## Product vision

The core operational chain is:

**Customer → Vehicle → Booking → Work Order → Diagnosis / DVI → Estimate → Approval → Repair → QA → Invoice → Payment → Service History**

The first implementation is deliberately built from a clean foundation. Security, multi-tenancy and auditable business data are architectural requirements from day one.

## Foundation

- Next.js App Router + React + TypeScript
- Supabase PostgreSQL + Auth
- Cookie-based SSR authentication
- Organization-level multi-tenancy
- PostgreSQL Row Level Security (RLS)
- Role model for owner, admin, manager, service advisor, technician, accounting and viewer
- Audit log foundation
- FI/EN-ready application shell
- Supabase migrations kept in source control
- AI designed around verified data and explicit guardrails

## Initial domain model

The first migration establishes:

- organizations
- profiles
- customers
- vehicles
- appointments
- work orders
- work order items
- inspections / quality checks
- audit logs

The model will grow incrementally into parts and inventory, suppliers, CRM/messaging, reporting, multi-site operations, customer communication, approvals and AI-assisted workflows.

## AI safety principle

AI must not invent vehicle data, prices, parts, availability, repair history or safety-critical instructions. AI features will be grounded in verified application data and approved sources, with clear provenance and human review where required.

## Local development

Requirements:

- Node.js 20.9+
- npm
- Supabase project

Install and run:

    npm install
    npm run dev

Quality checks:

    npm run lint
    npm run typecheck
    npm run build

Create .env.local from .env.example and add:

    NEXT_PUBLIC_SUPABASE_URL=
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

Never commit secrets or .env.local.

## Database

Apply migrations from supabase/migrations/ using the Supabase SQL editor or Supabase CLI.

Before production use, RLS policies, role permissions, authentication flows, audit logging and database constraints must be reviewed as a complete security model.

## Roadmap

1. Foundation and security architecture
2. Authentication, organization onboarding and roles
3. Customer and vehicle management
4. Calendar and booking
5. Work orders and DVI
6. Estimates, customer approval and repair workflow
7. Parts, inventory and suppliers
8. Invoicing and payments
9. Service history and customer portal
10. Reporting and multi-site management
11. Verified-data AI assistant and AI workflow automation
12. Production hardening, observability, backups and compliance review
