import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { requireApiAdmin } from '@/lib/api-auth'
import prisma from '@/lib/prisma'
import { recordAuditEntry } from '@/lib/audit-log'

export const dynamic = 'force-dynamic'

/**
 * Endpoint operacional para aplicar migrations PENDENTES em runtime quando
 * o startup wrapper (scripts/start.mjs) nao conseguiu rodar. Eh um plano B
 * controlado: nao substitui `prisma migrate deploy`, mas destrava casos
 * em que o ciclo CLI -> banco esta quebrado por questoes de container.
 *
 * Usa SQL direto via `prisma.$executeRawUnsafe`, sem dependencia do CLI
 * do Prisma. Cada migration eh idempotente — checa o estado do banco
 * antes de aplicar e atualiza a tabela `_prisma_migrations` para que
 * futuras execucoes do CLI a tratem como ja aplicada.
 *
 * Migrations cobertas (em ordem de aplicacao):
 *   1. 20260507180000_pipeline_redesign — adiciona Order.deliveryMethod,
 *      migra fulfillmentStatus em_revisao -> pending e
 *      aguardando_producao -> na_fila.
 *   2. 20260508030000_order_type_persisted — adiciona Order.orderType
 *      e faz backfill para 'pronta_entrega' onde nenhum item eh produzivel.
 *
 * Acessivel apenas por usuario admin (requireApiAdmin).
 */

type StepResult = {
  name: string
  status: 'applied' | 'already_applied' | 'skipped' | 'failed'
  detail?: string
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await prisma!.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT EXISTS(
       SELECT 1 FROM information_schema.columns
       WHERE table_name = $1 AND column_name = $2
     ) as exists`,
    table,
    column,
  )
  return Boolean(rows[0]?.exists)
}

async function migrationRecorded(name: string): Promise<boolean> {
  try {
    const rows = await prisma!.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM _prisma_migrations
       WHERE migration_name = $1 AND finished_at IS NOT NULL`,
      name,
    )
    return Number(rows[0]?.count || 0) > 0
  } catch {
    // Tabela _prisma_migrations nao existe (inicializacao crua) — assume pendente.
    return false
  }
}

async function recordMigration(name: string): Promise<void> {
  // Insere registro na _prisma_migrations seguindo o schema do Prisma.
  // started_at e finished_at iguais para indicar aplicacao manual;
  // checksum vazio (Prisma valida apenas se checksum esta diferente, nao se
  // esta presente).
  const id = crypto.randomUUID()
  await prisma!.$executeRawUnsafe(
    `INSERT INTO _prisma_migrations
       (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
     VALUES ($1, $2, NOW(), $3, NULL, NULL, NOW(), 1)
     ON CONFLICT (id) DO NOTHING`,
    id,
    '',
    name,
  )
}

async function step1_pipelineRedesign(): Promise<StepResult> {
  const name = '20260507180000_pipeline_redesign'

  // Idempotencia em duas frentes:
  //   1. Coluna deliveryMethod ja existir = SQL ja aplicado (ainda que a
  //      _prisma_migrations possa estar inconsistente).
  //   2. Linha em _prisma_migrations = totalmente aplicado.
  const hasColumn = await columnExists('Order', 'deliveryMethod')
  const recorded = await migrationRecorded(name)

  if (hasColumn && recorded) {
    return { name, status: 'already_applied', detail: 'coluna existe e migration registrada' }
  }

  try {
    if (!hasColumn) {
      await prisma!.$executeRawUnsafe(
        `ALTER TABLE "Order" ADD COLUMN "deliveryMethod" TEXT NOT NULL DEFAULT 'shipping'`,
      )
    }
    // UPDATEs de status sao idempotentes (so afetam linhas com status legado).
    await prisma!.$executeRawUnsafe(
      `UPDATE "Order" SET "fulfillmentStatus" = 'pending' WHERE "fulfillmentStatus" = 'em_revisao'`,
    )
    await prisma!.$executeRawUnsafe(
      `UPDATE "Order" SET "fulfillmentStatus" = 'na_fila' WHERE "fulfillmentStatus" = 'aguardando_producao'`,
    )
    if (!recorded) {
      await recordMigration(name)
    }
    return {
      name,
      status: 'applied',
      detail: hasColumn ? 'coluna ja existia, registro adicionado' : 'coluna criada e dados migrados',
    }
  } catch (err) {
    return { name, status: 'failed', detail: err instanceof Error ? err.message : String(err) }
  }
}

async function step2_orderTypePersisted(): Promise<StepResult> {
  const name = '20260508030000_order_type_persisted'

  const hasColumn = await columnExists('Order', 'orderType')
  const recorded = await migrationRecorded(name)

  if (hasColumn && recorded) {
    return { name, status: 'already_applied', detail: 'coluna existe e migration registrada' }
  }

  try {
    if (!hasColumn) {
      await prisma!.$executeRawUnsafe(
        `ALTER TABLE "Order" ADD COLUMN "orderType" TEXT NOT NULL DEFAULT 'sob_encomenda'`,
      )
    }
    // Backfill: pedidos cujos items NAO tem nenhum produto produzivel viram
    // 'pronta_entrega'. So pertinente em primeira aplicacao (idempotente —
    // re-aplicar nao muda nada porque a regra eh deterministica).
    await prisma!.$executeRawUnsafe(
      `UPDATE "Order" o
         SET "orderType" = 'pronta_entrega'
         WHERE NOT EXISTS (
           SELECT 1 FROM "OrderItem" oi
           JOIN "Product" p ON p.id = oi."productId"
           WHERE oi."orderId" = o.id
             AND (p."underOrder" = true OR p."isPersonalizable" = true)
         )`,
    )
    if (!recorded) {
      await recordMigration(name)
    }
    return {
      name,
      status: 'applied',
      detail: hasColumn ? 'coluna ja existia, registro adicionado' : 'coluna criada e backfill aplicado',
    }
  } catch (err) {
    return { name, status: 'failed', detail: err instanceof Error ? err.message : String(err) }
  }
}

export async function POST() {
  const auth = await requireApiAdmin()
  if (auth.response) return auth.response

  if (!prisma?.$executeRawUnsafe) {
    return NextResponse.json(
      { error: 'Prisma indisponivel — sistema rodando em fallback localDb.' },
      { status: 503 },
    )
  }

  const steps: StepResult[] = []
  steps.push(await step1_pipelineRedesign())
  steps.push(await step2_orderTypePersisted())

  const ok = steps.every(s => s.status !== 'failed')

  // Auditoria — operacao destrutiva merece registro.
  recordAuditEntry({
    actorEmail: auth.user!.email,
    actorRole: auth.user!.role || null,
    action: 'admin.apply_pending_migrations',
    targetType: 'System',
    targetId: null,
    summary: `Aplicacao manual de migrations (${steps.map(s => `${s.name}=${s.status}`).join(', ')})`,
    metadata: { steps },
    ip: null,
  }).catch(() => {})

  return NextResponse.json(
    { ok, steps, message: ok ? 'Migrations processadas. Crie um pedido novo para validar.' : 'Algumas migrations falharam. Veja os detalhes.' },
    { status: ok ? 200 : 500 },
  )
}
