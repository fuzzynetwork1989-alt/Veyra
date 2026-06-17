# Veyra Architecture

## Overview

Veyra is a developer-first AI platform built as a multi-app monorepo using Turborepo. The platform consists of shared packages and multiple applications working together to provide agentic software development capabilities.

## System Architecture

### Core Layers

1. **Model Layer** - LLM inference and model routing
2. **Agent Runtime Layer** - Planning, execution, verification orchestration
3. **Retrieval Layer** - Hybrid source search with chunking
4. **Memory Layer** - Session, project, and long-term memory
5. **Product Layer** - Web, API, Admin, and Worker applications
6. **Observability Layer** - Metrics, logging, tracing, and alerting
7. **Security Layer** - Authentication, authorization, and governance
8. **Evaluation Layer** - Task completion, groundedness, and retrieval quality

### Data Flow

1. User request enters the system via web or API
2. Planner decomposes the task into actionable steps
3. Tool broker routes actions to appropriate tools
4. Retrieval and memory enrich context
5. Executor performs the work
6. Verifier checks grounding and completeness
7. Observability records the result

## Package Structure

### Shared Packages

- `@veyra/ui` - Shared React components and themes
- `@veyra/auth` - Identity and permissions (JWT, RBAC)
- `@veyra/memory` - Session and project memory (Redis-backed)
- `@veyra/retrieval` - Hybrid source search (Redis-backed)
- `@veyra/agent-runtime` - Orchestration (planner, executor, verifier)
- `@veyra/observability` - Telemetry (metrics, logging, tracing)
- `@veyra/sdk` - Client SDK for integrations

### Applications

- `apps/web` - Next.js main product (port 3000)
- `apps/api` - FastAPI backend services (port 8000)
- `apps/admin` - Internal operations dashboard (port 3002)
- `apps/worker` - Async task processor

## Infrastructure

### Databases

- **PostgreSQL** - Primary data store for users, sessions, projects, tasks, documents, audit logs
- **Redis** - Cache, queues, sessions, memory, retrieval, metrics, logs, traces

### Monitoring

- **Prometheus** - Metrics collection and alerting
- **Grafana** - Visualization and dashboards

### Deployment

- **Docker** - Containerization
- **Docker Compose** - Local development
- **GitHub Actions** - CI/CD pipeline
- **AWS ECR** - Container registry
- **Railway/Vercel** - Production deployment

## Security

- JWT-based authentication
- Role-based access control (RBAC)
- Audit logging
- Rate limiting
- Secret management
- Data encryption at rest and in transit

## Observability

- Structured logging with levels
- Distributed tracing with spans
- Metrics collection (counters, timings)
- Alerting based on conditions
- Dashboard visualization
