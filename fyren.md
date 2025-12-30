# Fyren — Project Plan

> _The open source lighthouse for your services_

An open source, self-hosted status page and incident management platform.

**Brand:** Fyren (Swedish for "the lighthouse")  
**Domain:** fyren.dev  
**GitHub:** github.com/fyrendev  
**npm:** @fyrendev/\*

---

## Overview

Fyren combines status pages, uptime monitoring, incident management, maintenance scheduling, and subscriber notifications into a single self-hosted platform. It fills the gap between simple monitoring tools (Uptime Kuma) and expensive enterprise incident management platforms (PagerDuty, incident.io).

### Target Users

- Small to mid-size engineering teams (6-50 people)
- Startups needing professional status pages without enterprise pricing
- Self-hosters who want full control over their incident communication
- Companies with compliance requirements for self-hosted tooling

### Business Model

- **Open source core** — Full functionality, self-hosted, free forever
- **Managed hosting** — Paid tiers for teams who don't want to self-host (future)

---

## Tech Stack

| Layer            | Technology                        |
| ---------------- | --------------------------------- |
| Runtime          | Bun                               |
| API Framework    | Hono                              |
| Database         | PostgreSQL                        |
| ORM              | Drizzle                           |
| Cache/Realtime   | Redis                             |
| Queue            | BullMQ                            |
| Validation       | Zod                               |
| Auth             | BetterAuth                        |
| Frontend         | React + Vite + Tailwind CSS       |
| Email            | SES / SendGrid / SMTP (pluggable) |
| Containerization | Docker                            |

---

## Data Models

### Core Entities

```
Organization
├── id
├── name
├── slug (subdomain/url slug)
├── logo_url
├── brand_color
├── custom_domain
├── timezone
├── created_at
├── updated_at

Component (services being monitored)
├── id
├── organization_id
├── name
├── description
├── status (operational | degraded | partial_outage | major_outage | maintenance)
├── display_order
├── is_public
├── created_at
├── updated_at

Monitor
├── id
├── component_id
├── type (http | tcp | ssl_expiry)
├── url
├── interval_seconds
├── timeout_ms
├── expected_status_code
├── headers (json)
├── failure_threshold (failures before status change)
├── is_active
├── last_checked_at
├── created_at
├── updated_at

MonitorResult
├── id
├── monitor_id
├── status (up | down)
├── response_time_ms
├── status_code
├── error_message
├── checked_at

Incident
├── id
├── organization_id
├── title
├── status (investigating | identified | monitoring | resolved)
├── severity (minor | major | critical)
├── started_at
├── resolved_at
├── created_at
├── updated_at

IncidentUpdate
├── id
├── incident_id
├── status
├── message
├── created_at

IncidentComponent (junction)
├── incident_id
├── component_id

Maintenance
├── id
├── organization_id
├── title
├── description
├── status (scheduled | in_progress | completed)
├── scheduled_start
├── scheduled_end
├── actual_start
├── actual_end
├── created_at
├── updated_at

MaintenanceComponent (junction)
├── maintenance_id
├── component_id

Subscriber
├── id
├── organization_id
├── email
├── is_verified
├── verification_token
├── subscribed_at
├── unsubscribed_at

NotificationLog
├── id
├── organization_id
├── type (incident | maintenance | status_change)
├── reference_id
├── channel (email | slack | discord | webhook)
├── recipient
├── status (pending | sent | failed)
├── sent_at
├── error_message

WebhookEndpoint
├── id
├── organization_id
├── name
├── url
├── type (slack | discord | teams | generic)
├── is_active
├── created_at

ApiKey (for admin access & external integrations)
├── id
├── organization_id
├── name
├── key_hash
├── key_prefix
├── last_used_at
├── expires_at
├── created_at

User (managed by BetterAuth)
├── id
├── email
├── email_verified
├── name
├── image
├── created_at
├── updated_at

Session (managed by BetterAuth)
├── id
├── user_id
├── token
├── expires_at
├── created_at
├── updated_at

UserOrganization (junction for multi-org support)
├── user_id
├── organization_id
├── role (owner | admin | member)
├── created_at
```

---

## Build Phases

### Phase 0: Project Setup ✅ (Day 1)

**Goal:** Runnable skeleton with all tooling configured.

- [ ] Initialize Bun monorepo with Turborepo
- [ ] Configure TypeScript (strict mode, path aliases)
- [ ] Set up Hono with basic health endpoints
- [ ] Set up Drizzle with PostgreSQL connection
- [ ] Set up Redis connection (ioredis)
- [ ] Docker Compose for local dev (Postgres + Redis)
- [ ] Basic project structure
- [ ] ESLint + Prettier config
- [ ] Environment variable handling with Zod

**Deliverable:** `bun run dev` starts server, connects to DB and Redis.

---

### Phase 1: Database & Core API (Week 1)

**Goal:** Schema in place, basic CRUD for all entities.

#### 1.1 Database Schema

- [ ] Create Drizzle schema for all models
- [ ] Write initial migration
- [ ] Seed script for dev data

#### 1.2 Organization API

- [ ] GET /api/v1/org/:slug — public org info
- [ ] POST /api/v1/admin/org — create org
- [ ] PUT /api/v1/admin/org/:id — update org

#### 1.3 Component API

- [ ] GET /api/v1/org/:slug/components — list public components
- [ ] POST /api/v1/admin/components — create component
- [ ] PUT /api/v1/admin/components/:id — update component
- [ ] DELETE /api/v1/admin/components/:id — delete component
- [ ] PATCH /api/v1/admin/components/:id/status — manual status update

#### 1.4 Basic Auth

- [ ] API key middleware for admin routes
- [ ] API key generation endpoint

**Deliverable:** Can create org, components via API. Data persists.

---

### Phase 2: Monitoring Workers (Week 2)

**Goal:** Automated health checks running on schedule.

#### 2.1 Monitor CRUD

- [ ] POST /api/v1/admin/monitors — create monitor
- [ ] PUT /api/v1/admin/monitors/:id — update monitor
- [ ] DELETE /api/v1/admin/monitors/:id — delete monitor
- [ ] GET /api/v1/admin/monitors — list monitors with last status

#### 2.2 Worker Infrastructure

- [ ] BullMQ setup with Redis
- [ ] Monitor check job processor
- [ ] Repeatable job scheduling (per-monitor intervals)

#### 2.3 Health Check Logic

- [ ] HTTP/HTTPS checker (status code, response time)
- [ ] TCP port checker
- [ ] SSL expiry checker
- [ ] Store results in MonitorResult table
- [ ] Cache current status in Redis for fast reads

#### 2.4 Auto Status Updates

- [ ] Failure threshold logic
- [ ] Auto-update component status when threshold breached
- [ ] Auto-recover when checks pass again

**Deliverable:** Monitors run on schedule, component status updates automatically.

---

### Phase 3: Authentication (Week 3)

**Goal:** User authentication with BetterAuth for admin dashboard access.

#### 3.1 BetterAuth Setup

- [ ] Install BetterAuth and dependencies
- [ ] Configure BetterAuth with Hono adapter
- [ ] Set up Drizzle adapter for auth tables (user, session, account, verification)
- [ ] Add auth tables to schema and run migration
- [ ] Environment variables for auth secrets

#### 3.2 Auth Configuration

- [ ] Email/password authentication
- [ ] Email verification flow
- [ ] Password reset flow
- [ ] Session management with secure cookies
- [ ] CSRF protection

#### 3.3 User-Organization Relationship

- [ ] UserOrganization junction table (user can belong to multiple orgs)
- [ ] Roles: owner, admin, member
- [ ] First user to create org becomes owner
- [ ] Invite flow (email-based, creates pending membership)

#### 3.4 Auth Middleware

- [ ] Session middleware for admin routes
- [ ] Require authenticated user
- [ ] Require org membership
- [ ] Require specific role (owner/admin for destructive actions)
- [ ] Support both session auth (browser) and API key auth (programmatic)

#### 3.5 Auth API Endpoints

- [ ] POST /api/v1/auth/signup — create account
- [ ] POST /api/v1/auth/signin — login
- [ ] POST /api/v1/auth/signout — logout
- [ ] POST /api/v1/auth/forgot-password — request reset
- [ ] POST /api/v1/auth/reset-password — complete reset
- [ ] GET /api/v1/auth/session — get current session/user
- [ ] POST /api/v1/auth/verify-email — verify email address

#### 3.6 Organization Membership

- [ ] POST /api/v1/admin/invites — invite user to org
- [ ] GET /api/v1/admin/invites — list pending invites
- [ ] DELETE /api/v1/admin/invites/:id — revoke invite
- [ ] POST /api/v1/invites/:token/accept — accept invite
- [ ] GET /api/v1/admin/members — list org members
- [ ] PUT /api/v1/admin/members/:id — update member role
- [ ] DELETE /api/v1/admin/members/:id — remove member

**Deliverable:** Users can sign up, log in, create orgs, and invite team members. Admin routes protected by session auth.

---

### Phase 4: Public Status Page (Week 4)

**Goal:** Beautiful, fast, public-facing status page.

#### 4.1 Public API Endpoints

- [ ] GET /api/v1/status/:slug — full status summary (cached)
- [ ] GET /api/v1/status/:slug/components — components with current status
- [ ] GET /api/v1/status/:slug/uptime — uptime percentages (24h, 7d, 30d, 90d)
- [ ] GET /api/v1/status/:slug/incidents — recent incidents
- [ ] GET /api/v1/status/:slug/maintenance — upcoming maintenance

#### 4.2 Frontend — Status Page

- [ ] Project setup (React + Vite + Tailwind)
- [ ] Overall status banner
- [ ] Component list with status indicators
- [ ] Uptime bars (90-day history visualization)
- [ ] Response time graph (optional, toggle)
- [ ] Active incidents section
- [ ] Incident history (collapsible timeline)
- [ ] Scheduled maintenance section
- [ ] Subscribe form (email)
- [ ] Footer with branding

#### 4.3 Caching Strategy

- [ ] Redis cache for status page data
- [ ] Cache invalidation on status change
- [ ] TTL-based refresh

**Deliverable:** Public status page renders, shows live component status and uptime.

---

### Phase 5: Incidents (Week 5)

**Goal:** Full incident lifecycle management.

#### 5.1 Incident API

- [ ] POST /api/v1/admin/incidents — create incident
- [ ] PUT /api/v1/admin/incidents/:id — update incident
- [ ] POST /api/v1/admin/incidents/:id/updates — add update to incident
- [ ] PATCH /api/v1/admin/incidents/:id/resolve — resolve incident
- [ ] GET /api/v1/admin/incidents — list incidents (with filters)
- [ ] GET /api/v1/admin/incidents/:id — incident detail with updates

#### 5.2 Incident Templates

- [ ] Template model (optional, store common incident types)
- [ ] Quick-create from template

#### 5.3 Auto-Incident Creation

- [ ] Config flag: create incident on monitor failure
- [ ] Auto-resolve when monitor recovers
- [ ] Link auto-incidents to affected component

#### 5.4 Status Page Updates

- [ ] Show active incidents prominently
- [ ] Incident detail page with timeline
- [ ] Past incidents list with filters

**Deliverable:** Can create/manage incidents, they show on status page.

---

### Phase 6: Maintenance Windows (Week 6)

**Goal:** Schedule and communicate planned maintenance.

#### 6.1 Maintenance API

- [ ] POST /api/v1/admin/maintenance — create maintenance
- [ ] PUT /api/v1/admin/maintenance/:id — update maintenance
- [ ] DELETE /api/v1/admin/maintenance/:id — cancel maintenance
- [ ] PATCH /api/v1/admin/maintenance/:id/start — start maintenance early
- [ ] PATCH /api/v1/admin/maintenance/:id/complete — mark complete

#### 6.2 Scheduled Jobs

- [ ] Job to auto-start maintenance at scheduled time
- [ ] Job to auto-complete maintenance at scheduled end
- [ ] Update component status during maintenance window

#### 6.3 Status Page Updates

- [ ] Upcoming maintenance section
- [ ] Active maintenance banner
- [ ] Maintenance history

**Deliverable:** Can schedule maintenance, status page reflects maintenance windows.

---

### Phase 7: Notifications (Week 7)

**Goal:** Notify subscribers and integrations on status changes.

#### 7.1 Subscriber Management

- [ ] POST /api/v1/subscribe — subscribe email
- [ ] GET /api/v1/subscribe/verify/:token — verify email
- [ ] POST /api/v1/unsubscribe — unsubscribe
- [ ] GET /api/v1/admin/subscribers — list subscribers
- [ ] DELETE /api/v1/admin/subscribers/:id — remove subscriber

#### 7.2 Email Notifications

- [ ] Email provider abstraction (SES, SendGrid, SMTP)
- [ ] Email templates (incident created, updated, resolved, maintenance scheduled)
- [ ] Notification queue (BullMQ)
- [ ] Rate limiting / batching

#### 7.3 Webhook Integrations

- [ ] Webhook endpoint CRUD
- [ ] Slack incoming webhook formatter
- [ ] Discord webhook formatter
- [ ] Generic webhook (JSON payload)
- [ ] Retry logic for failed webhooks

#### 7.4 Notification Triggers

- [ ] On incident create → notify
- [ ] On incident update → notify
- [ ] On incident resolve → notify
- [ ] On maintenance scheduled → notify (configurable lead time)
- [ ] On maintenance started → notify
- [ ] On component status change → notify

#### 7.5 RSS Feed

- [ ] GET /api/v1/status/:slug/rss — RSS feed of incidents

**Deliverable:** Subscribers receive emails, Slack/Discord get webhook posts.

---

### Phase 8: Admin Dashboard (Week 8-9)

**Goal:** Web UI for managing everything.

#### 8.1 Dashboard Pages

- [ ] Overview (current status, recent incidents, upcoming maintenance)
- [ ] Components (list, create, edit, reorder)
- [ ] Monitors (list, create, edit, view history)
- [ ] Incidents (list, create, update, timeline management)
- [ ] Maintenance (list, schedule, manage)
- [ ] Subscribers (list, export, remove)
- [ ] Integrations (webhooks, email config)
- [ ] Settings (org details, branding, custom domain)
- [ ] API keys management
- [ ] Team members (invite, manage roles)

#### 8.2 UI Components (Tailwind)

- [ ] Status badges
- [ ] Uptime charts
- [ ] Timeline component
- [ ] Forms with validation
- [ ] Tables with sorting/filtering
- [ ] Modals for quick actions

**Deliverable:** Full admin UI, no need for direct API calls.

---

### Phase 9: Polish & Launch Prep (Week 10)

**Goal:** Production-ready, documented, deployable.

#### 9.1 Customization

- [ ] Custom branding (logo, colors)
- [ ] Custom CSS injection option
- [ ] Embeddable status badge/widget
- [ ] Custom domain instructions

#### 9.2 DevOps

- [ ] Production Docker Compose
- [ ] Helm chart (optional)
- [ ] Health check endpoints for orchestration
- [ ] Graceful shutdown handling
- [ ] Database migrations in CI

#### 9.3 Documentation

- [ ] README with quick start
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Self-hosting guide
- [ ] Configuration reference
- [ ] Contributing guide

#### 9.4 Testing

- [ ] Unit tests for core logic
- [ ] Integration tests for API
- [ ] E2E tests for critical flows

#### 9.5 Security

- [ ] Rate limiting
- [ ] Input sanitization audit
- [ ] CORS configuration
- [ ] Security headers
- [ ] Dependency audit

**Deliverable:** Ready for public release and self-hosting.

---

## Project Structure

```
fyren/
├── apps/
│   ├── api/                    # Hono API server
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── admin/
│   │   │   │   │   ├── components.ts
│   │   │   │   │   ├── incidents.ts
│   │   │   │   │   ├── maintenance.ts
│   │   │   │   │   ├── monitors.ts
│   │   │   │   │   ├── subscribers.ts
│   │   │   │   │   └── webhooks.ts
│   │   │   │   ├── public/
│   │   │   │   │   ├── status.ts
│   │   │   │   │   └── subscribe.ts
│   │   │   │   └── index.ts
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── rateLimit.ts
│   │   │   │   └── cache.ts
│   │   │   ├── services/
│   │   │   │   ├── monitor.service.ts
│   │   │   │   ├── incident.service.ts
│   │   │   │   ├── notification.service.ts
│   │   │   │   └── cache.service.ts
│   │   │   ├── workers/
│   │   │   │   ├── monitor.worker.ts
│   │   │   │   ├── notification.worker.ts
│   │   │   │   └── maintenance.worker.ts
│   │   │   ├── lib/
│   │   │   │   ├── redis.ts
│   │   │   │   ├── email/
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── ses.ts
│   │   │   │   │   ├── sendgrid.ts
│   │   │   │   │   └── smtp.ts
│   │   │   │   └── checkers/
│   │   │   │       ├── http.ts
│   │   │   │       ├── tcp.ts
│   │   │   │       └── ssl.ts
│   │   │   ├── index.ts
│   │   │   └── env.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── web/                    # Public status page (React)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── hooks/
│   │   │   └── lib/
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   └── admin/                  # Admin dashboard (React)
│       ├── src/
│       │   ├── components/
│       │   ├── pages/
│       │   ├── hooks/
│       │   └── lib/
│       ├── package.json
│       └── vite.config.ts
│
├── packages/
│   ├── db/                     # Drizzle schema & migrations
│   │   ├── src/
│   │   │   ├── schema/
│   │   │   │   ├── organization.ts
│   │   │   │   ├── component.ts
│   │   │   │   ├── monitor.ts
│   │   │   │   ├── incident.ts
│   │   │   │   ├── maintenance.ts
│   │   │   │   ├── subscriber.ts
│   │   │   │   └── index.ts
│   │   │   ├── migrations/
│   │   │   └── index.ts
│   │   ├── drizzle.config.ts
│   │   └── package.json
│   │
│   ├── shared/                 # Shared types, utils, validation
│   │   ├── src/
│   │   │   ├── types/
│   │   │   ├── validation/
│   │   │   └── utils/
│   │   └── package.json
│   │
│   └── email-templates/        # Email templates
│       ├── src/
│       │   ├── incident-created.tsx
│       │   ├── incident-updated.tsx
│       │   └── ...
│       └── package.json
│
├── docker/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── docker-compose.prod.yml
│
├── docs/
│   ├── self-hosting.md
│   ├── api.md
│   └── configuration.md
│
├── .env.example
├── package.json                # Workspace root
├── turbo.json                  # Turborepo config
└── README.md
```

---

## API Overview

### Public Endpoints (no auth)

| Method | Path                               | Description                 |
| ------ | ---------------------------------- | --------------------------- |
| GET    | /api/v1/status/:slug               | Full status summary         |
| GET    | /api/v1/status/:slug/components    | Component list with status  |
| GET    | /api/v1/status/:slug/uptime        | Uptime percentages          |
| GET    | /api/v1/status/:slug/incidents     | Recent incidents            |
| GET    | /api/v1/status/:slug/incidents/:id | Incident detail             |
| GET    | /api/v1/status/:slug/maintenance   | Upcoming/active maintenance |
| GET    | /api/v1/status/:slug/rss           | RSS feed                    |
| POST   | /api/v1/subscribe                  | Subscribe email             |
| GET    | /api/v1/subscribe/verify/:token    | Verify subscription         |
| POST   | /api/v1/unsubscribe                | Unsubscribe                 |

### Admin Endpoints (API key required)

| Method | Path                                | Description         |
| ------ | ----------------------------------- | ------------------- |
| POST   | /api/v1/admin/org                   | Create organization |
| PUT    | /api/v1/admin/org/:id               | Update organization |
| GET    | /api/v1/admin/components            | List components     |
| POST   | /api/v1/admin/components            | Create component    |
| PUT    | /api/v1/admin/components/:id        | Update component    |
| DELETE | /api/v1/admin/components/:id        | Delete component    |
| GET    | /api/v1/admin/monitors              | List monitors       |
| POST   | /api/v1/admin/monitors              | Create monitor      |
| PUT    | /api/v1/admin/monitors/:id          | Update monitor      |
| DELETE | /api/v1/admin/monitors/:id          | Delete monitor      |
| GET    | /api/v1/admin/incidents             | List incidents      |
| POST   | /api/v1/admin/incidents             | Create incident     |
| PUT    | /api/v1/admin/incidents/:id         | Update incident     |
| POST   | /api/v1/admin/incidents/:id/updates | Add incident update |
| PATCH  | /api/v1/admin/incidents/:id/resolve | Resolve incident    |
| GET    | /api/v1/admin/maintenance           | List maintenance    |
| POST   | /api/v1/admin/maintenance           | Create maintenance  |
| PUT    | /api/v1/admin/maintenance/:id       | Update maintenance  |
| DELETE | /api/v1/admin/maintenance/:id       | Cancel maintenance  |
| GET    | /api/v1/admin/subscribers           | List subscribers    |
| DELETE | /api/v1/admin/subscribers/:id       | Remove subscriber   |
| GET    | /api/v1/admin/webhooks              | List webhooks       |
| POST   | /api/v1/admin/webhooks              | Create webhook      |
| PUT    | /api/v1/admin/webhooks/:id          | Update webhook      |
| DELETE | /api/v1/admin/webhooks/:id          | Delete webhook      |

### Webhook Ingress (for external alerting tools)

| Method | Path                     | Description                 |
| ------ | ------------------------ | --------------------------- |
| POST   | /api/v1/webhook/incident | Create incident via webhook |

---

## Future Phases (Post v1)

- **On-call scheduling** — rotations, escalation policies
- **Multi-region monitoring** — run checkers from multiple locations
- **Team management** — multiple users, roles, permissions
- **Postmortems** — incident retrospective templates
- **SLA tracking** — uptime commitments and reporting
- **Mobile app** — push notifications for on-call

---

## Brand Identity

### The Lighthouse Metaphor

Fyren means "the lighthouse" in Swedish. The metaphor works at every level:

- **Signals status** — A lighthouse tells ships where safety is
- **Guides through storms** — Helps users navigate incidents
- **Always watching** — Continuous uptime monitoring
- **Reliable** — Standing strong through any weather

### Visual Language

- **Logo:** Minimal lighthouse silhouette or beacon light
- **Colors:** Deep navy, warm amber/yellow, clean white, red for critical
- **Iconography:** Light beam states for operational/degraded/outage

### Taglines

- "Your services, always in sight"
- "Guiding you through downtime"
- "The open source lighthouse for your services"
