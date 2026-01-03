# Fyren

> The open source lighthouse for your services

[![License](https://img.shields.io/badge/license-ELv2-blue)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/fyrendev/fyren)](https://github.com/fyrendev/fyren)

An open source, self-hosted status page and incident management platform.

## Features

- **Real-time Monitoring** - HTTP, TCP, and SSL checks with configurable intervals
- **Incident Management** - Full lifecycle tracking with timeline updates
- **Maintenance Windows** - Schedule and auto-start planned maintenance
- **Notifications** - Email subscribers, Slack, Discord, and webhooks
- **Customizable** - Custom branding, colors, and CSS per organization
- **Embeddable Widgets** - Status badges and widgets for your sites
- **API First** - Full REST API with OpenAPI documentation
- **Self-hosted** - Docker Compose or run anywhere

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) v1.1+
- [Docker](https://www.docker.com/) and Docker Compose

### Development Setup

```bash
# Clone the repository
git clone https://github.com/fyrendev/fyren.git
cd fyren

# Start database and cache
docker compose -f docker/docker-compose.yml up -d

# Install dependencies
bun install

# Set up environment
cp .env.example .env

# Run database migrations
bun run db:push

# Start development server
bun run dev
```

Open http://localhost:3000 for the web app and http://localhost:3001 for the API.

### Production Deployment

```bash
# Configure environment
cp docker/.env.prod.example docker/.env.prod
# Edit docker/.env.prod with your settings

# Start with Docker Compose
docker compose -f docker-compose.prod.yml --env-file docker/.env.prod up -d

# Run migrations
docker compose -f docker-compose.prod.yml exec api bun run db:migrate
```

See [Self-Hosting Guide](docs/self-hosting.md) for detailed deployment instructions.

## Documentation

- [Self-Hosting Guide](docs/self-hosting.md) - Deploy Fyren on your infrastructure
- [Configuration Reference](docs/configuration.md) - All environment variables
- [Contributing Guide](CONTRIBUTING.md) - Development setup and guidelines

## Project Structure

```
fyren/
├── apps/
│   ├── api/          # Hono API server
│   └── web/          # Next.js frontend
├── packages/
│   ├── db/           # Drizzle schema & migrations
│   └── shared/       # Shared types & utilities
├── docker/           # Docker configurations
└── docs/             # Documentation
```

## Tech Stack

| Layer         | Technology             |
| ------------- | ---------------------- |
| Runtime       | Bun                    |
| API Framework | Hono                   |
| Database      | PostgreSQL             |
| ORM           | Drizzle                |
| Cache/Queue   | Redis + BullMQ         |
| Frontend      | Next.js + Tailwind CSS |
| Auth          | BetterAuth             |

## Scripts

| Command             | Description                   |
| ------------------- | ----------------------------- |
| `bun run dev`       | Start all apps in dev mode    |
| `bun run build`     | Build all packages            |
| `bun run lint`      | Run linting and type checking |
| `bun run test`      | Run API tests                 |
| `bun run test:e2e`  | Run E2E tests                 |
| `bun run db:push`   | Push schema changes to DB     |
| `bun run db:studio` | Open Drizzle Studio           |

## Embeddable Status Badge

Add a status badge to your README:

```markdown
[![Status](https://your-domain.com/api/v1/status/your-org/badge.svg)](https://your-domain.com/your-org)
```

## License

Fyren is licensed under the **Elastic License 2.0 (ELv2)**.

### What You Can Do

- View, read, and audit the source code
- Self-host for personal or commercial use
- Modify and customize for your own needs
- Fork and run internally at your company
- Contribute back to the project

### What's Restricted

- Offering Fyren as a managed service to third parties
- Circumventing license key functionality

### License by Component

| Component                           | License |
| ----------------------------------- | ------- |
| Core platform (API, workers, admin) | ELv2    |
| Public status page frontend         | ELv2    |
| Client SDKs / libraries             | MIT     |
| Documentation                       | MIT     |

See [LICENSE](LICENSE) for the full Elastic License 2.0 text.

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## Support

- [GitHub Issues](https://github.com/fyrendev/fyren/issues) - Bug reports and feature requests
- [GitHub Discussions](https://github.com/fyrendev/fyren/discussions) - Questions and community
