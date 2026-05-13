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
# engine etc.). O CLI (node_modules/prisma) NAO e mais copiado: ele
# exigia effect/c12/deepmerge-ts/empathic que nao estao no runner, e seu
# unico uso era `prisma migrate deploy` no startup — agora movido pro
# GitHub Action.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

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
