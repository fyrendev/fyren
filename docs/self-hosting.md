# Self-Hosting Guide

Deploy Fyren on your own infrastructure.

## Requirements

- Docker and Docker Compose v2+
- 1GB RAM minimum (2GB recommended)
- A domain with DNS access
- (Optional) Email service (AWS SES, SendGrid, or SMTP)

## Docker Images

Official images are published to GitHub Container Registry:

| Image  | Registry                        |
| ------ | ------------------------------- |
| API    | `ghcr.io/fyrendev/fyren-api`    |
| Worker | `ghcr.io/fyrendev/fyren-worker` |
| Web    | `ghcr.io/fyrendev/fyren-web`    |

### Available Tags

- `latest` - Latest stable release from main branch
- `1.0.0`, `1.0`, `1` - Semantic version tags
- `sha-abc123` - Specific commit SHA

## Architecture

The production deployment includes:

| Service      | Description                                        |
| ------------ | -------------------------------------------------- |
| **traefik**  | Reverse proxy with automatic HTTPS                 |
| **postgres** | PostgreSQL database                                |
| **redis**    | Cache and job queue (BullMQ)                       |
| **api**      | Fyren API server (runs migrations on startup)      |
| **worker**   | Background job processor (monitors, notifications) |
| **web**      | Next.js frontend                                   |

## Quick Start with Pre-built Images (Recommended)

The fastest way to deploy Fyren using official pre-built images.

### 1. Download Compose File

```bash
# Download the compose file for pre-built images
curl -O https://raw.githubusercontent.com/fyrendev/fyren/main/docker-compose.images.yml
```

### 2. Configure Environment

Create your environment file:

```bash
cat > .env << 'EOF'
# Required - Your domain configuration
APP_URL=https://status.example.com
APP_DOMAIN=status.example.com
ACME_EMAIL=admin@example.com

# Required - Database credentials
POSTGRES_PASSWORD=your-secure-password-here
REDIS_PASSWORD=your-redis-password-here

# Required - Auth secret (generate with: openssl rand -base64 32)
BETTER_AUTH_SECRET=your-32-char-minimum-secret-here

# Optional - Pin to specific version (default: latest)
# FYREN_VERSION=1.0.0

# Optional - Email provider (ses, sendgrid, smtp, or console)
EMAIL_PROVIDER=console
EMAIL_FROM=noreply@example.com
EOF
```

### 3. Start Services

```bash
docker compose -f docker-compose.images.yml up -d
```

### 4. Create Your First Organization

Open `https://your-domain.com/admin/register` to create an account and your first organization.

---

## Alternative: Build from Source

If you prefer to build images locally (useful for development or custom modifications).

### 1. Clone the Repository

```bash
git clone https://github.com/fyrendev/fyren.git
cd fyren
```

### 2. Configure Environment

Create your production environment file:

```bash
cp docker/.env.prod.example docker/.env.prod
```

Edit `docker/.env.prod` with your settings:

```bash
# Required - Your domain configuration
APP_URL=https://status.example.com
APP_DOMAIN=status.example.com
ACME_EMAIL=admin@example.com

# Required - Database credentials
POSTGRES_PASSWORD=your-secure-password-here
REDIS_PASSWORD=your-redis-password-here

# Required - Auth secret (generate with: openssl rand -base64 32)
BETTER_AUTH_SECRET=your-32-char-minimum-secret-here

# Optional - Email provider (ses, sendgrid, smtp, or console)
EMAIL_PROVIDER=console
EMAIL_FROM=noreply@example.com
```

### 3. Build and Start Services

```bash
docker compose -f docker-compose.prod.yml --env-file docker/.env.prod up -d --build
```

This will:

1. Build all images from source
2. Start PostgreSQL and Redis
3. Run database migrations automatically
4. Start the API server, worker, and web frontend
5. Configure Traefik with automatic HTTPS

### 4. Create Your First Organization

Open `https://your-domain.com/admin/register` to create an account and your first organization.

## Configuration

See [Configuration Reference](./configuration.md) for all environment variables.

## Custom Domain Setup

### DNS Configuration

Point your domain to your server:

```
Type: A
Name: status (or your subdomain)
Value: YOUR_SERVER_IP
```

### SSL Certificates

Traefik automatically obtains SSL certificates from Let's Encrypt. Ensure:

- Port 80 and 443 are accessible from the internet
- `ACME_EMAIL` is set to a valid email address

## Email Configuration

### Console (Development/Testing)

```bash
EMAIL_PROVIDER=console
```

Emails are logged to console instead of being sent.

### AWS SES

```bash
EMAIL_PROVIDER=ses
EMAIL_FROM=noreply@example.com
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
```

### SendGrid

```bash
EMAIL_PROVIDER=sendgrid
EMAIL_FROM=noreply@example.com
SENDGRID_API_KEY=your-api-key
```

### SMTP

```bash
EMAIL_PROVIDER=smtp
EMAIL_FROM=noreply@example.com
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-user
SMTP_PASS=your-password
```

## Backup and Restore

### Backup Database

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U fyren fyren > backup-$(date +%Y%m%d).sql
```

### Restore Database

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U fyren fyren < backup.sql
```

### Backup Redis

```bash
docker compose -f docker-compose.prod.yml exec redis \
  redis-cli -a $REDIS_PASSWORD BGSAVE
docker cp fyren-redis:/data/dump.rdb ./redis-backup.rdb
```

## Updating

### Using Pre-built Images

```bash
# Pull latest images
docker compose -f docker-compose.images.yml pull

# Restart with new images
docker compose -f docker-compose.images.yml up -d
```

Or pin to a specific version in your `.env`:

```bash
FYREN_VERSION=1.2.0
```

### Building from Source

```bash
cd fyren
git pull
docker compose -f docker-compose.prod.yml --env-file docker/.env.prod build
docker compose -f docker-compose.prod.yml --env-file docker/.env.prod up -d
```

Database migrations run automatically on container startup.

## Monitoring

### View Service Status

```bash
docker compose -f docker-compose.prod.yml ps
```

### Health Checks

```bash
# API health
curl https://your-domain.com/health

# Check if worker is processing jobs
docker compose -f docker-compose.prod.yml logs worker --tail 50
```

### View Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f worker
docker compose -f docker-compose.prod.yml logs -f web
```

## Troubleshooting

### Migration Failed

Migrations run automatically when the API starts. Check the API logs:

```bash
# Check API logs for migration output
docker compose -f docker-compose.prod.yml logs api | grep -i migrat

# Restart API to re-run migrations
docker compose -f docker-compose.prod.yml restart api
```

### Database Connection Failed

```bash
# Check PostgreSQL logs
docker compose -f docker-compose.prod.yml logs postgres

# Test connection
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U fyren -d fyren -c "SELECT 1"
```

### Redis Connection Failed

```bash
# Check Redis logs
docker compose -f docker-compose.prod.yml logs redis

# Test connection
docker compose -f docker-compose.prod.yml exec redis \
  redis-cli -a $REDIS_PASSWORD ping
```

### Monitors Not Running

The worker service processes monitor checks. Verify it's running:

```bash
# Check worker status
docker compose -f docker-compose.prod.yml ps worker

# Check worker logs
docker compose -f docker-compose.prod.yml logs worker --tail 100
```

### SSL Certificate Issues

```bash
# Check Traefik logs
docker compose -f docker-compose.prod.yml logs traefik

# Verify ACME storage
docker compose -f docker-compose.prod.yml exec traefik \
  cat /letsencrypt/acme.json
```

## Security Recommendations

1. **Use strong passwords** for database and Redis (min 32 characters)
2. **Configure `TRUSTED_PROXIES`** — required for accurate rate limiting behind Traefik. Set to `172.16.0.0/12` for standard Docker setups. See [Configuration Reference](./configuration.md#trusted_proxies).
3. **Enable firewall** to allow only ports 80 and 443
4. **Regular backups** — schedule automated database backups
5. **Keep updated** — regularly pull latest images and rebuild
6. **Monitor logs** — set up log aggregation for production

## Resource Usage

Approximate resource requirements:

| Service    | Memory | CPU |
| ---------- | ------ | --- |
| PostgreSQL | 256MB  | 0.5 |
| Redis      | 64MB   | 0.1 |
| API        | 128MB  | 0.5 |
| Worker     | 128MB  | 0.5 |
| Web        | 128MB  | 0.5 |
| Traefik    | 64MB   | 0.1 |

**Total:** ~800MB RAM, 2 CPU cores recommended

## Support

- [GitHub Issues](https://github.com/fyrendev/fyren/issues)
- [Documentation](https://fyren.dev/docs)
