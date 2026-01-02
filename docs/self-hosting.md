# Self-Hosting Guide

Deploy Fyren on your own infrastructure.

## Requirements

- Docker and Docker Compose v2+
- 1GB RAM minimum (2GB recommended)
- A domain with DNS access
- (Optional) Email service (AWS SES, SendGrid, or SMTP)

## Quick Start with Docker Compose

### 1. Clone the Repository

```bash
git clone https://github.com/fyrendev/fyren.git
cd fyren
```

### 2. Configure Environment

```bash
cp docker/.env.prod.example docker/.env.prod
```

Edit `docker/.env.prod` with your settings:

```bash
# Required
APP_URL=https://status.example.com
APP_DOMAIN=status.example.com
ACME_EMAIL=admin@example.com

POSTGRES_PASSWORD=your-secure-password
REDIS_PASSWORD=your-redis-password
BETTER_AUTH_SECRET=your-32-char-min-secret
```

### 3. Start Services

```bash
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod up -d
```

### 4. Run Database Migrations

```bash
docker compose -f docker/docker-compose.prod.yml exec api bun run db:migrate
```

### 5. Access Your Status Page

Open `https://your-domain.com` in your browser.

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

- Port 80 and 443 are accessible
- `ACME_EMAIL` is set to a valid email

## Email Configuration

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
docker compose -f docker/docker-compose.prod.yml exec postgres \
  pg_dump -U fyren fyren > backup-$(date +%Y%m%d).sql
```

### Restore Database

```bash
docker compose -f docker/docker-compose.prod.yml exec -T postgres \
  psql -U fyren fyren < backup.sql
```

### Backup Redis

```bash
docker compose -f docker/docker-compose.prod.yml exec redis \
  redis-cli -a $REDIS_PASSWORD BGSAVE
docker cp fyren-redis:/data/dump.rdb ./redis-backup.rdb
```

## Updating

### Pull Latest Images

```bash
cd fyren
git pull
docker compose -f docker/docker-compose.prod.yml build
docker compose -f docker/docker-compose.prod.yml up -d
```

### Run Migrations

```bash
docker compose -f docker/docker-compose.prod.yml exec api bun run db:migrate
```

## Monitoring

### Health Checks

```bash
# Basic liveness
curl https://your-domain.com/health

# Readiness (includes DB and Redis)
curl https://your-domain.com/health/ready
```

### View Logs

```bash
# All services
docker compose -f docker/docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker/docker-compose.prod.yml logs -f api
```

## Troubleshooting

### Database Connection Failed

```bash
# Check PostgreSQL logs
docker compose -f docker/docker-compose.prod.yml logs postgres

# Verify connection
docker compose -f docker/docker-compose.prod.yml exec api \
  bun run db:check
```

### Redis Connection Failed

```bash
# Check Redis logs
docker compose -f docker/docker-compose.prod.yml logs redis

# Test connection
docker compose -f docker/docker-compose.prod.yml exec redis \
  redis-cli -a $REDIS_PASSWORD ping
```

### SSL Certificate Issues

```bash
# Check Traefik logs
docker compose -f docker/docker-compose.prod.yml logs traefik

# Verify ACME storage
docker compose -f docker/docker-compose.prod.yml exec traefik \
  cat /letsencrypt/acme.json
```

## Security Recommendations

1. **Use strong passwords** for database and Redis
2. **Enable firewall** to allow only ports 80 and 443
3. **Regular backups** - schedule automated backups
4. **Keep updated** - regularly pull latest images
5. **Monitor logs** - set up log aggregation

## Support

- [GitHub Issues](https://github.com/fyrendev/fyren/issues)
- [Documentation](https://fyren.dev/docs)
