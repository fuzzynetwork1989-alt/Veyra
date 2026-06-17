# Veyra Database Migrations

This directory contains SQL migration files for the Veyra platform database.

## Running Migrations

### Using psql

```bash
psql -U veyra -d veyra -f migrations/001_initial_schema.sql
```

### Using Docker Compose

```bash
docker-compose exec postgres psql -U veyra -d veyra -f /migrations/001_initial_schema.sql
```

## Migration Files

- `001_initial_schema.sql` - Creates the core database tables and indexes

## Schema Overview

### Tables

- `users` - User accounts and authentication
- `sessions` - User sessions for authentication
- `projects` - User projects
- `tasks` - Agent tasks and their status
- `documents` - Documents for retrieval system
- `audit_logs` - Audit trail for security and compliance

### Indexes

All frequently queried columns have indexes for performance optimization.
