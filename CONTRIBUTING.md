# Contributing to Fyren

Thank you for your interest in contributing to Fyren! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (v1.1+)
- [Docker](https://docker.com/) and Docker Compose
- [Node.js](https://nodejs.org/) (v20+, for some tooling)

### Development Setup

1. **Fork and clone the repository**

   ```bash
   git clone https://github.com/YOUR_USERNAME/fyren.git
   cd fyren
   ```

2. **Install dependencies**

   ```bash
   bun install
   ```

3. **Start development services**

   ```bash
   docker compose -f docker/docker-compose.yml up -d
   ```

4. **Set up environment**

   ```bash
   cp .env.example .env
   ```

5. **Run database migrations**

   ```bash
   bun run db:push
   ```

6. **Seed development data** (optional)

   ```bash
   bun run db:seed
   ```

7. **Start development server**

   ```bash
   bun run dev
   ```

   This starts:
   - API server at http://localhost:3001
   - Web app at http://localhost:3000

## Project Structure

```
fyren/
├── apps/
│   ├── api/          # Hono API server
│   │   ├── src/
│   │   │   ├── routes/       # API endpoints
│   │   │   ├── middleware/   # Express middleware
│   │   │   ├── services/     # Business logic
│   │   │   ├── workers/      # Background jobs
│   │   │   └── lib/          # Utilities
│   │   └── tests/            # API tests
│   │
│   └── web/          # Next.js frontend
│       ├── src/
│       │   ├── app/          # App router pages
│       │   ├── components/   # React components
│       │   └── lib/          # Client utilities
│       └── e2e/              # Playwright tests
│
├── packages/
│   ├── db/           # Drizzle schema & migrations
│   └── shared/       # Shared types & utilities
│
├── docker/           # Docker configurations
└── docs/             # Documentation
```

## Development Workflow

### Branching

- Create feature branches from `main`
- Use descriptive branch names: `feature/add-slack-integration`, `fix/login-error`

### Commits

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add Slack webhook integration
fix: resolve login redirect issue
docs: update API documentation
chore: upgrade dependencies
refactor: simplify monitor service
test: add component tests
```

### Code Style

- **TypeScript**: Strict mode enabled
- **Formatting**: Prettier (auto-formatted on save)
- **Linting**: ESLint with TypeScript rules

Run checks:

```bash
# Format code
bun run format

# Lint code
bun run lint

# Type check
bun run typecheck
```

### Testing

#### Unit/Integration Tests (API)

```bash
# Run all tests
bun test

# Run specific test file
bun test apps/api/src/routes/health.test.ts

# Watch mode
bun test --watch
```

#### E2E Tests (Playwright)

```bash
# Run E2E tests
bun run test:e2e

# Interactive mode
bun run test:e2e:ui

# Headed browser
bun run test:e2e:headed
```

### Database Changes

When modifying the database schema:

1. Edit schema in `packages/db/src/schema/`
2. Generate migration: `bun run db:generate`
3. Apply changes: `bun run db:push`
4. Commit the migration files

## Pull Request Process

1. **Create a PR** against the `main` branch
2. **Fill out the PR template** with:
   - Description of changes
   - Related issues
   - Screenshots (for UI changes)
3. **Ensure CI passes**:
   - Linting
   - Type checking
   - Tests
4. **Request review** from maintainers
5. **Address feedback** and update as needed
6. **Merge** once approved

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] Tests added for new functionality
- [ ] Documentation updated if needed
- [ ] Commit messages follow conventional commits
- [ ] All CI checks pass

## Issue Guidelines

### Bug Reports

Include:

- Steps to reproduce
- Expected vs actual behavior
- Environment (OS, browser, versions)
- Error messages or logs

### Feature Requests

Include:

- Problem statement
- Proposed solution
- Alternatives considered
- Use cases

## Development Tips

### Hot Reloading

Both API and web apps support hot reloading. Changes to source files will automatically restart the server.

### Database Studio

View and edit database directly:

```bash
bun run db:studio
```

### API Documentation

OpenAPI docs available at: http://localhost:3001/api/docs

### Debugging

Add `DEBUG=*` to enable verbose logging:

```bash
DEBUG=* bun run dev
```

## License

By contributing, you agree that your contributions will be licensed under the Elastic License 2.0 (ELv2) for the core platform.

## Questions?

- Open a [GitHub Discussion](https://github.com/fyrendev/fyren/discussions)
- Check existing [Issues](https://github.com/fyrendev/fyren/issues)

Thank you for contributing!
