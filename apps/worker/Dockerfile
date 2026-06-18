FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY apps/worker/package.json apps/worker/
COPY packages/agent-runtime/package.json packages/agent-runtime/

RUN npm ci --workspace=@veyra/worker --include-workspace-root

COPY packages/agent-runtime packages/agent-runtime
COPY apps/worker apps/worker

WORKDIR /app/apps/worker

ENV NODE_ENV=production

CMD ["npx", "tsx", "src/index.ts"]