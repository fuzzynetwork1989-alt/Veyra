# Veyra

Developer-first AI platform for planning, building, testing, deploying, and operating software systems.

## Monorepo layout

- `apps/web` — Next.js product UI
- `apps/api` — FastAPI backend
- `apps/worker` — Redis queue worker with `@veyra/agent-runtime`
- `packages/*` — shared SDK, UI, agent runtime, retrieval, memory

## Local development

### Prerequisites

- Node.js 18+
- Python 3.11+
- Docker Desktop
- LM Studio (OpenAI-compatible server on `http://127.0.0.1:1234`)

### Start infrastructure

```bash
docker-compose up -d postgres redis
```

### API

```bash
cd apps/api
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload
```

### Worker

```bash
cd apps/worker
npm install
npm run dev
```

### Web

```bash
cd apps/web
cp .env.local.example .env.local
npm run dev
```

Open http://localhost:3000

## Health check

`GET http://localhost:8000/health` reports Postgres, Redis, and LM Studio status.

## Tests

```bash
cd apps/api
python -m unittest tests.test_auth -v
set RUN_INTEGRATION_TESTS=1
python -m unittest tests.test_auth_integration tests.test_chat_integration -v
```

## Current capabilities

- Postgres auth (register/login/me)
- Projects and persisted chat session metadata
- Chat with LM Studio + Redis message memory
- Optional project document upload and RAG
- Async agent tasks via worker + agent runtime
- Rate limiting, request logging, usage events