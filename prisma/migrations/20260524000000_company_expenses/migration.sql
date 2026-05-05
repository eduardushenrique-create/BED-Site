-- SPEC-003: Controle de despesas empresariais.
-- Cria 3 tabelas novas (ExpenseCategory, CompanyExpense, ExpenseBudget) com
-- relacionamentos opcionais para Filament/Component/Printer (onDelete: SetNull
-- preserva o histórico financeiro mesmo quando o item interno é removido).

-- ExpenseCategory ----------------------------------------------------------
CREATE TABLE "ExpenseCategory" (
  "id"          TEXT        NOT NULL,
  "name"        TEXT        NOT NULL,
  "slug"        TEXT        NOT NULL,
  "description" TEXT,
  "defaultType" TEXT,
  "costCenter"  TEXT,
  "color"       TEXT,
  "isActive"    BOOLEAN     NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExpenseCategory_slug_key" ON "ExpenseCategory"("slug");
CREATE INDEX "ExpenseCategory_isActive_idx" ON "ExpenseCategory"("isActive");

-- CompanyExpense -----------------------------------------------------------
CREATE TABLE "CompanyExpense" (
  "id"                 TEXT          NOT NULL,
  "title"              TEXT          NOT NULL,
  "description"        TEXT,
  "amount"             DECIMAL(10,2) NOT NULL,
  "categoryId"         TEXT          NOT NULL,
  "type"               TEXT          NOT NULL,
  "status"             TEXT          NOT NULL DEFAULT 'pending',
  "paymentMethod"      TEXT,
  "costCenter"         TEXT          NOT NULL DEFAULT 'other',
  "competenceDate"     TIMESTAMP(3)  NOT NULL,
  "dueDate"            TIMESTAMP(3),
  "paidAt"             TIMESTAMP(3),
  "receiptUrl"         TEXT,
  "invoiceNumber"      TEXT,
  "supplierName"       TEXT,
  "relatedFilamentId"  TEXT,
  "relatedComponentId" TEXT,
  "relatedPrinterId"   TEXT,
  "notes"              TEXT,
  "createdByEmail"     TEXT,
  "updatedByEmail"     TEXT,
  "archivedAt"         TIMESTAMP(3),
  "createdAt"          TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3)  NOT NULL,
  "isRecurring"        BOOLEAN       NOT NULL DEFAULT false,
  "recurrenceRule"     TEXT,
  "recurrenceParentId" TEXT,

  CONSTRAINT "CompanyExpense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompanyExpense_status_competenceDate_idx" ON "CompanyExpense"("status", "competenceDate");
CREATE INDEX "CompanyExpense_categoryId_idx"            ON "CompanyExpense"("categoryId");
CREATE INDEX "CompanyExpense_dueDate_idx"               ON "CompanyExpense"("dueDate");
CREATE INDEX "CompanyExpense_archivedAt_idx"            ON "CompanyExpense"("archivedAt");
CREATE INDEX "CompanyExpense_costCenter_idx"            ON "CompanyExpense"("costCenter");

ALTER TABLE "CompanyExpense"
  ADD CONSTRAINT "CompanyExpense_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CompanyExpense"
  ADD CONSTRAINT "CompanyExpense_relatedFilamentId_fkey"
  FOREIGN KEY ("relatedFilamentId") REFERENCES "Filament"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CompanyExpense"
  ADD CONSTRAINT "CompanyExpense_relatedComponentId_fkey"
  FOREIGN KEY ("relatedComponentId") REFERENCES "Component"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CompanyExpense"
  ADD CONSTRAINT "CompanyExpense_relatedPrinterId_fkey"
  FOREIGN KEY ("relatedPrinterId") REFERENCES "Printer"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CompanyExpense"
  ADD CONSTRAINT "CompanyExpense_recurrenceParentId_fkey"
  FOREIGN KEY ("recurrenceParentId") REFERENCES "CompanyExpense"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ExpenseBudget ------------------------------------------------------------
CREATE TABLE "ExpenseBudget" (
  "id"            TEXT          NOT NULL,
  "categoryId"    TEXT          NOT NULL,
  "month"         INTEGER       NOT NULL,
  "year"          INTEGER       NOT NULL,
  "plannedAmount" DECIMAL(10,2) NOT NULL,
  "notes"         TEXT,
  "createdAt"     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3)  NOT NULL,

  CONSTRAINT "ExpenseBudget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExpenseBudget_categoryId_month_year_key" ON "ExpenseBudget"("categoryId", "month", "year");
CREATE INDEX "ExpenseBudget_year_month_idx" ON "ExpenseBudget"("year", "month");

ALTER TABLE "ExpenseBudget"
  ADD CONSTRAINT "ExpenseBudget_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
