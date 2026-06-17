# Veyra

Developer-first AI platform built to help engineers plan, build, test, deploy, and operate software systems with strong control and clear operational boundaries.

## Overview

Veyra is not a generic chatbot; it is a production-oriented platform for agentic software work, retrieval, memory, observability, and deployment.

## Architecture

### Multi-App Structure

- **apps/web** - Main product web application (Next.js)
- **apps/api** - Backend services (FastAPI)
- **apps/admin** - Internal operations dashboard
- **apps/worker** - Async task processing
- **apps/desktop** - Future power-user workflows
- **apps/mobile** - Future companion access

### Shared Packages

- **packages/ui** - Shared components and themes
- **packages/auth** - Identity and permissions
- **packages/memory** - Session and project memory
- **packages/retrieval** - Hybrid source search
- **packages/agent-runtime** - Orchestration engine
- **packages/observability** - Telemetry and monitoring
- **packages/sdk** - Client integrations

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Docker (for local development with PostgreSQL and Redis)

### Installation

```bash
# Install dependencies
npm install

# Start infrastructure services
docker-compose up -d postgres redis

# Run development servers
npm run dev
```

### Development

```bash
# Build all packages and apps
npm run build

# Run tests
npm run test

# Lint code
npm run lint

# Type check
npm run typecheck
```

## Core Features

### Bootstrap Track (Current Focus)
- Web app for daily use
- Core chat and agentic tasks
- File upload and retrieval
- Basic session and project memory
- Auth, roles, and usage limits
- Logging, tracing, and cost visibility
- Deployment-ready architecture

### Frontier Track (Future)
- Advanced model routing
- Long-horizon memory systems
- Rich tool orchestration
- Multimodal workflows
- Eval-driven release pipelines
- Research-grade model and retrieval improvements

## Platform Principles

1. Think in systems, not isolated features
2. Prefer production-ready implementation over theory
3. Separate architecture, product, safety, and ops concerns
4. Make every feature testable and observable
5. Use strong defaults when details are missing
6. Never pretend a feature works without code, wiring, and validation

## Tech Stack

- **Web**: Next.js 14, React, Tailwind CSS, shadcn/ui
- **API**: FastAPI, Python 3.11+
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **Orchestration**: Custom agent runtime
- **Observability**: Prometheus, Grafana, structured logging
- **Deployment**: Docker, GitHub Actions, Railway/Vercel

## Documentation

- [Architecture](./docs/architecture/)
- [Product](./docs/product/)
- [Runbooks](./docs/runbooks/)
- [Architecture Decision Records](./docs/adr/)

## License

MIT License - See LICENSE file for details.
