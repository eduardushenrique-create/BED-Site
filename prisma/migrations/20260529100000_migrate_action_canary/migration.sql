-- ADR-002 canary: prova que o GitHub Action de migrations
-- (.github/workflows/migrate.yml) aplicou migrations em producao.
--
-- Cria e dropa uma tabela isolada na MESMA migration — efeito permanente
-- zero no schema, mas o registro fica gravado em _prisma_migrations.
-- Apos o primeiro deploy bem-sucedido, _prisma_migrations vai conter a
-- linha '20260529100000_migrate_action_canary' como prova auditavel.

CREATE TABLE "_meta_migrate_action_canary" (
  id        TEXT NOT NULL PRIMARY KEY,
  appliedAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE "_meta_migrate_action_canary";
