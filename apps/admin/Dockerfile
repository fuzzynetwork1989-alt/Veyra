FROM node:18-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY apps/admin/package.json apps/admin/
COPY packages/sdk/package.json packages/sdk/
COPY packages/ui/package.json packages/ui/

RUN npm ci --workspace=@veyra/admin --include-workspace-root

COPY packages/sdk packages/sdk
COPY packages/ui packages/ui
COPY apps/admin apps/admin

WORKDIR /app/apps/admin
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/admin/.next/standalone ./
COPY --from=builder /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=builder /app/apps/admin/public ./apps/admin/public

EXPOSE 3000
CMD ["node", "apps/admin/server.js"]