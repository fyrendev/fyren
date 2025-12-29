# Fyren

> The open source lighthouse for your services

An open source, self-hosted status page and incident management platform.

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) v1.1+
- [Docker](https://www.docker.com/) and Docker Compose

### Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/fyrendev/fyren.git
   cd fyren
   ```

2. **Start the database and cache**

   ```bash
   docker compose -f docker/docker-compose.yml up -d
   ```

3. **Install dependencies**

   ```bash
   bun install
   ```

4. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

5. **Run database migrations** (no-op initially)

   ```bash
   bun run db:migrate
   ```

6. **Start the development server**

   ```bash
   bun run dev
   ```

7. **Verify it works**

   ```bash
   curl http://localhost:3000/health
   curl http://localhost:3000/health/db
   curl http://localhost:3000/health/redis
   ```

## Project Structure

```
fyren/
├── apps/
│   └── api/                    # Hono API server
├── packages/
│   ├── db/                     # Drizzle schema & migrations
│   └── shared/                 # Shared types & utilities
├── docker/
│   └── docker-compose.yml      # Local dev services
└── turbo.json                  # Turborepo config
```

## Scripts

| Command             | Description                     |
| ------------------- | ------------------------------- |
| `bun run dev`       | Start all apps in dev mode      |
| `bun run build`     | Build all packages              |
| `bun run lint`      | Run TypeScript type checking    |
| `bun run db:generate` | Generate Drizzle migrations   |
| `bun run db:migrate`  | Run database migrations       |
| `bun run db:push`     | Push schema changes to DB     |
| `bun run db:studio`   | Open Drizzle Studio           |

## Tech Stack

- **Runtime:** Bun
- **API Framework:** Hono
- **Database:** PostgreSQL
- **ORM:** Drizzle
- **Cache:** Redis (ioredis)
- **Validation:** Zod
- **Monorepo:** Turborepo

## License

MIT
