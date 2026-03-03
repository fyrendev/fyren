# Configuration Reference

All Fyren configuration is done through environment variables.

## Required Variables

| Variable             | Description                          | Example                             |
| -------------------- | ------------------------------------ | ----------------------------------- |
| `DATABASE_URL`       | PostgreSQL connection string         | `postgres://user:pass@host:5432/db` |
| `REDIS_URL`          | Redis connection string              | `redis://:password@host:6379`       |
| `BETTER_AUTH_SECRET` | Authentication secret (min 32 chars) | Random string                       |
| `APP_URL`            | Public URL of the application        | `https://status.example.com`        |

## Server

| Variable   | Description      | Default       |
| ---------- | ---------------- | ------------- |
| `PORT`     | API server port  | `3001`        |
| `NODE_ENV` | Environment mode | `development` |

## Database

| Variable            | Description                | Default  |
| ------------------- | -------------------------- | -------- |
| `DATABASE_URL`      | PostgreSQL connection URL  | Required |
| `POSTGRES_DB`       | Database name (Docker)     | `fyren`  |
| `POSTGRES_USER`     | Database user (Docker)     | `fyren`  |
| `POSTGRES_PASSWORD` | Database password (Docker) | Required |

## Redis

| Variable         | Description             | Default  |
| ---------------- | ----------------------- | -------- |
| `REDIS_URL`      | Redis connection URL    | Required |
| `REDIS_PASSWORD` | Redis password (Docker) | Required |

## Authentication

| Variable             | Description            | Default           |
| -------------------- | ---------------------- | ----------------- |
| `BETTER_AUTH_SECRET` | Session signing secret | Required          |
| `BETTER_AUTH_URL`    | Auth callback URL      | Same as `APP_URL` |

## Email

| Variable         | Description                                    | Default             |
| ---------------- | ---------------------------------------------- | ------------------- |
| `EMAIL_PROVIDER` | Provider: `console`, `ses`, `sendgrid`, `smtp` | `console`           |
| `EMAIL_FROM`     | Sender email address                           | `noreply@fyren.dev` |

### AWS SES

| Variable                | Description                    |
| ----------------------- | ------------------------------ |
| `AWS_REGION`            | AWS region (e.g., `us-east-1`) |
| `AWS_ACCESS_KEY_ID`     | AWS access key                 |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key                 |

### SendGrid

| Variable           | Description      |
| ------------------ | ---------------- |
| `SENDGRID_API_KEY` | SendGrid API key |

### SMTP

| Variable      | Description          | Default |
| ------------- | -------------------- | ------- |
| `SMTP_HOST`   | SMTP server hostname | -       |
| `SMTP_PORT`   | SMTP port            | `587`   |
| `SMTP_SECURE` | Use TLS              | `false` |
| `SMTP_USER`   | SMTP username        | -       |
| `SMTP_PASS`   | SMTP password        | -       |

## Docker Production

| Variable     | Description                | Default  |
| ------------ | -------------------------- | -------- |
| `APP_DOMAIN` | Domain for Traefik routing | Required |
| `ACME_EMAIL` | Email for Let's Encrypt    | Required |

## Rate Limiting

Rate limits are configured in the API middleware:

| Endpoint Type  | Limit         | Window   |
| -------------- | ------------- | -------- |
| Public API     | 100 requests  | 1 minute |
| Auth endpoints | 10 requests   | 1 minute |
| Admin API      | 200 requests  | 1 minute |
| Badge/Widget   | 1000 requests | 1 minute |
| Subscription   | 5 requests    | 1 hour   |

## Monitoring

| Variable                    | Description                      | Default |
| --------------------------- | -------------------------------- | ------- |
| `MONITOR_CHECK_INTERVAL`    | Default check interval (seconds) | `60`    |
| `MONITOR_TIMEOUT`           | Request timeout (seconds)        | `30`    |
| `MONITOR_FAILURE_THRESHOLD` | Failures before status change    | `3`     |

## Branding

Organization branding is configured per-organization in the admin dashboard:

| Field            | Description               | Max Length |
| ---------------- | ------------------------- | ---------- |
| Logo URL         | Primary logo              | 500 chars  |
| Logo Light URL   | Logo for dark backgrounds | 500 chars  |
| Favicon URL      | Custom favicon            | 500 chars  |
| Brand Color      | Primary color (hex)       | 7 chars    |
| Accent Color     | Secondary color (hex)     | 7 chars    |
| Custom CSS       | Custom styles             | 50KB       |
| Meta Title       | SEO title                 | 100 chars  |
| Meta Description | SEO description           | 255 chars  |
| Twitter Handle   | Social link               | 50 chars   |
| Support URL      | Support page URL          | 500 chars  |

## Example .env File

```bash
# Server
PORT=3001
NODE_ENV=production

# Database
DATABASE_URL=postgres://fyren:password@localhost:5432/fyren

# Redis
REDIS_URL=redis://:password@localhost:6379

# Authentication
BETTER_AUTH_SECRET=your-super-secret-key-min-32-chars
BETTER_AUTH_URL=https://status.example.com
APP_URL=https://status.example.com

# Email
EMAIL_PROVIDER=ses
EMAIL_FROM=noreply@example.com
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
```
