# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

NestJS 11 (CommonJS) + TypeORM 0.3 + PostgreSQL backend, Formance Ledger v2 for double-entry accounting, Next.js 14 (App Router) + Tailwind CSS frontend. SQLite (sql.js) for tests. Docker Compose for deployment.

## Users

Operations and finance teams at fintechs and neobanks who reconcile internal ledger records against external blockchain or payment-provider transactions. Three roles: **Admin** (full control, tenant management), **Operator** (run reconciliations, resolve breaks), **Auditor** (read-only view of runs, items, and reports).

## Product Purpose

Automated multi-tenant financial reconciliation engine that compares a double-entry accounting ledger against simulated blockchain sources, detects discrepancies ("breaks"), classifies them into 8 types, allows resolution with full audit trails, and reports metrics. Exists so fintech ops teams can catch and resolve ledger-vs-external mismatches before they become accounting errors.

## Positioning

Purpose-built for fintech ledger-vs-blockchain reconciliation with a 3-pass O(n) algorithm (exact match, fuzzy match, duplicate detection), 8 granular break types (AMOUNT_MISMATCH, MISSING_IN_EXTERNAL, MISSING_IN_LEDGER, DUPLICATE_EXTERNAL, DUPLICATE_LEDGER, ASSET_MISMATCH, TIMING_OFFSET, UNCONFIRMED), real Formance Ledger v2 integration for production-grade double-entry accounting, and tenant isolation that is total at the ledger level (one ledger per tenant, not just column filtering).

## Operating Context

Operators log in via JWT, select a date range, and trigger a reconciliation run. The engine fetches all ledger transactions and external transactions for the period, matches them in three passes, and produces items classified as MATCHED, BREAK (with type), or PENDING. Breaks appear in the dashboard for review; operators resolve them with one of four actions (ACCEPT_LEDGER, ACCEPT_EXTERNAL, ADJUST, IGNORE) and a note. Auditors review the full history. A scheduler can trigger runs automatically via cron.

## Capabilities and Constraints

- Money is always integers in the smallest unit (bigint in code, text in JSON) — never float/number
- Asset format: UNIT/DECIMALS (e.g., USD/2, COP/2, BTC/8)
- Reference idempotency: regex `/^[\w.:-]{1,128}$/` — no slashes
- Tenant never comes from the client; it comes from the signed JWT
- Accessing another tenant's resource returns 404, not 403
- Atomic balanced accounting transactions; only `world` can go negative
- passwordHash is never exposed
- Error messages to users in Spanish; code identifiers in English
- NestJS 11 (CommonJS, not ESM) and TypeScript 5.9 are pinned
- Deterministic PRNG (Mulberry32) for reproducible test scenarios in blockchain simulator
- Advisory locks (pg_try_advisory_lock) for PostgreSQL anti-concurrency; fallback to simple check on SQLite

## Brand Commitments

Name: **Reconciliation Engine**. No logo or visual identity established yet — design is free to propose. The name is retained.

## Evidence on Hand

- Blockchain simulator generates deterministic test scenarios with configurable discrepancy injection (all 8 types)
- 98 automated tests (26 unit + 72 e2e) covering all reconciliation paths
- Working Next.js dashboard with login, runs table, break resolution, and report metrics
- No real customer data, testimonials, or external validation yet — this is a pre-launch MVP

## Product Principles

1. **Accounting integrity first** — every transaction is balanced, every mutation auditable, money is never a float
2. **Tenant isolation is absolute** — separate ledgers, JWT-derived identity, 404 not 403 on cross-tenant access
3. **Deterministic and reproducible** — same seed produces same scenario, enabling reliable testing and debugging
4. **Classify, don't simplify** — 8 break types give operators precise context instead of generic "mismatch" alerts
5. **Ops-ready from day one** — health checks, structured logs, metrics, rate limiting, and advisory locks built in

## Accessibility & Inclusion

No specific accessibility requirements established yet. Standard WCAG 2.1 AA is a reasonable baseline for the dashboard.
