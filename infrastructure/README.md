# Veyra Infrastructure

This directory contains infrastructure configuration files for the Veyra platform.

## Redis

Redis is used for:
- Session storage
- Cache layer
- Task queues
- Memory storage (packages/memory)
- Retrieval storage (packages/retrieval)
- Metrics storage (packages/observability)
- Log storage (packages/observability)
- Tracing storage (packages/observability)

### Key Prefixes

- `veyra:memory:` - Session and project memory
- `veyra:retrieval:` - Document storage and retrieval
- `veyra:metrics:` - Metrics data
- `veyra:logs:` - Log entries
- `veyra:traces:` - Distributed tracing spans
- `veyra:alerts:` - Alert data
- `veyra:tasks:queue:` - Task queue
- `veyra:tasks:processing:` - Currently processing tasks
- `veyra:tasks:completed:` - Completed tasks
- `veyra:tasks:failed:` - Failed tasks

### Running Redis

#### Using Docker
```bash
docker run -d -p 6379:6379 -v $(pwd)/infrastructure/redis.conf:/usr/local/etc/redis/redis.conf redis:7-alpine redis-server /usr/local/etc/redis/redis.conf
```

#### Using Docker Compose
```bash
docker-compose up -d redis
```

## PostgreSQL

PostgreSQL is used for:
- User accounts
- Sessions
- Projects
- Tasks
- Documents
- Audit logs

### Running PostgreSQL

#### Using Docker
```bash
docker run -d -p 5432:5432 -e POSTGRES_USER=veyra -e POSTGRES_PASSWORD=veyra_password_change_this -e POSTGRES_DB=veyra -v veyra-postgres-data:/var/lib/postgresql/data postgres:15-alpine
```

#### Using Docker Compose
```bash
docker-compose up -d postgres
```

### Running Migrations

After starting PostgreSQL, run the migrations:

```bash
docker-compose exec postgres psql -U veyra -d veyra -f /migrations/001_initial_schema.sql
```
