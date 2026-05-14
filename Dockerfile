# Stage 1: install dependencies
FROM node:20-slim AS deps
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline --no-audit

# Stage 2: build
FROM node:20-slim AS builder
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Dummy URL só para o build não falhar sem banco real
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npx prisma generate
RUN npm run build

# Stage 3: runner (apenas o standalone + static)
FROM node:20-slim AS runner
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Schema + migrations: o startup wrapper (start.mjs) le `prisma/migrations/`
# para conferir se o banco esta sincronizado. Migrations sao APLICADAS por
# .github/workflows/migrate.yml (ADR-002), nao mais no startup do container.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# @prisma/* fica disponivel pro Prisma client em runtime (adapter-pg,
# engine etc.). O CLI (node_modules/prisma) NAO eh mais copiado — ele
# exigia effect/c12/deepmerge-ts/empathic ausentes no runner, e seu
# unico uso era `prisma migrate deploy` no startup, agora movido pro
# GitHub Action.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# `pg` + transitivas usado pelo start.mjs para validar _prisma_migrations
# sem depender do PrismaClient. Lista derivada de package-lock.json
# (fechamento transitivo de `pg` em 2026-05-13: 13 pacotes). Cirurgico
# — copiar node_modules inteiro derruba o Railway (vide PR #136 e
# memoria project_railway_dockerfile_limits.md).
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pg ./node_modules/pg
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pg-connection-string ./node_modules/pg-connection-string
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pg-int8 ./node_modules/pg-int8
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pg-pool ./node_modules/pg-pool
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pg-protocol ./node_modules/pg-protocol
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pg-types ./node_modules/pg-types
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pgpass ./node_modules/pgpass
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/postgres-array ./node_modules/postgres-array
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/postgres-bytea ./node_modules/postgres-bytea
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/postgres-date ./node_modules/postgres-date
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/postgres-interval ./node_modules/postgres-interval
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/split2 ./node_modules/split2
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/xtend ./node_modules/xtend

# Wrapper de startup: valida schema (sem aplicar) e sobe o Next.
COPY --from=builder --chown=nextjs:nodejs /app/scripts/start.mjs ./scripts/start.mjs

# Diretório para o fallback JSON (quando DATABASE_URL não está configurado)
RUN mkdir -p data && chown nextjs:nodejs data

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# Startup: valida que todas as migrations locais estao no banco; aborta
# (fail-fast) em producao se houver atraso. Migrations aplicadas pelo
# .github/workflows/migrate.yml antes do deploy.
CMD ["node", "scripts/start.mjs"]
