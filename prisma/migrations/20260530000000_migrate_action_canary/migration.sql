-- ADR-002 (PR-5) canary: prova que o GitHub Action de migrations
-- (.github/workflows/migrate.yml) aplicou migrations em producao.
--
-- Cria e dropa uma tabela isolada na MESMA migration — efeito permanente
-- zero no schema, mas o registro fica gravado em _prisma_migrations.
-- Apos o primeiro deploy bem-sucedido, _prisma_migrations vai conter a
-- linha '20260530000000_migrate_action_canary' como prova auditavel.
--
-- Se o canary aparecer em prod, sabemos que a infra de migration esta
-- funcionando — desbloqueia o PR-6 (SPEC-005 Fase 1).

CREATE TABLE "_meta_migrate_action_canary_v2" (
  id        TEXT NOT NULL PRIMARY KEY,
  appliedAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE "_meta_migrate_action_canary_v2";
