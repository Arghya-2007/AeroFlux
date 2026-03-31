/*
  Warnings:

  - A unique constraint covering the columns `[agencyPublicId]` on the table `Agency` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[agencySecretHash]` on the table `Agency` will be added. If there are existing duplicate values, this will fail.
  - The required column `agencyPublicId` was added to the `Agency` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `agencySecretHash` to the `Agency` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Agency" ADD COLUMN     "agencyAddress" TEXT,
ADD COLUMN     "agencyPublicId" TEXT NOT NULL,
ADD COLUMN     "agencySecretHash" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "profileImgUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Agency_agencyPublicId_key" ON "Agency"("agencyPublicId");

-- CreateIndex
CREATE UNIQUE INDEX "Agency_agencySecretHash_key" ON "Agency"("agencySecretHash");
