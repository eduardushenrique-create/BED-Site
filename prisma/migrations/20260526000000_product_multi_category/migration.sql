-- Migration: product-multi-category
-- Replaces the 1:N (categoryId FK on Product) with Prisma implicit M:N
-- which uses a join table _CategoryToProduct.

-- 1. Drop FK constraint and column from Product
ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_categoryId_fkey";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "categoryId";

-- 2. Create the implicit M:N join table (Prisma convention: _AToB sorted alphabetically)
CREATE TABLE "_CategoryToProduct" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_CategoryToProduct_A_fkey" FOREIGN KEY ("A") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_CategoryToProduct_B_fkey" FOREIGN KEY ("B") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "_CategoryToProduct_AB_unique" ON "_CategoryToProduct"("A", "B");
CREATE INDEX "_CategoryToProduct_B_index" ON "_CategoryToProduct"("B");
