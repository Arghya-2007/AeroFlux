/*
  Warnings:

  - You are about to drop the column `email` on the `Agency` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Agency` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `Agency` table. All the data in the column will be lost.
  - You are about to drop the column `slug` on the `Agency` table. All the data in the column will be lost.
  - You are about to drop the column `agencyId` on the `Agent` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `Agent` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[agencySlug]` on the table `Agency` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[supportEmail]` on the table `Agency` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[agencyAdminEmail]` on the table `Agency` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `agencyAdminEmail` to the `Agency` table without a default value. This is not possible if the table is not empty.
  - Added the required column `agencyAdminName` to the `Agency` table without a default value. This is not possible if the table is not empty.
  - Added the required column `agencyAdminPasswordHash` to the `Agency` table without a default value. This is not possible if the table is not empty.
  - Added the required column `agencyName` to the `Agency` table without a default value. This is not possible if the table is not empty.
  - Added the required column `agencySlug` to the `Agency` table without a default value. This is not possible if the table is not empty.
  - Added the required column `supportEmail` to the `Agency` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Agent" DROP CONSTRAINT "Agent_agencyId_fkey";

-- DropIndex
DROP INDEX "Agency_email_key";

-- DropIndex
DROP INDEX "Agency_slug_idx";

-- DropIndex
DROP INDEX "Agency_slug_key";

-- DropIndex
DROP INDEX "Agent_agencyId_idx";

-- DropIndex
DROP INDEX "Agent_agencyId_isActive_idx";

-- DropIndex
DROP INDEX "Agent_agencyId_role_idx";

-- AlterTable
ALTER TABLE "Agency" DROP COLUMN "email",
DROP COLUMN "name",
DROP COLUMN "phone",
DROP COLUMN "slug",
ADD COLUMN     "agencyAdminEmail" TEXT NOT NULL,
ADD COLUMN     "agencyAdminName" TEXT NOT NULL,
ADD COLUMN     "agencyAdminPasswordHash" TEXT NOT NULL,
ADD COLUMN     "agencyName" TEXT NOT NULL,
ADD COLUMN     "agencySlug" TEXT NOT NULL,
ADD COLUMN     "supportEmail" TEXT NOT NULL,
ADD COLUMN     "supportPhone" TEXT;

-- AlterTable
ALTER TABLE "Agent" DROP COLUMN "agencyId",
DROP COLUMN "role",
ADD COLUMN     "address" TEXT,
ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "AgencyAgent" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "profileImgUrl" TEXT,
    "role" "AgentRole" NOT NULL DEFAULT 'AGENT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyAgent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgencyAgent_email_key" ON "AgencyAgent"("email");

-- CreateIndex
CREATE INDEX "AgencyAgent_agencyId_idx" ON "AgencyAgent"("agencyId");

-- CreateIndex
CREATE INDEX "AgencyAgent_email_idx" ON "AgencyAgent"("email");

-- CreateIndex
CREATE INDEX "AgencyAgent_agencyId_isActive_idx" ON "AgencyAgent"("agencyId", "isActive");

-- CreateIndex
CREATE INDEX "AgencyAgent_agencyId_role_idx" ON "AgencyAgent"("agencyId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Agency_agencySlug_key" ON "Agency"("agencySlug");

-- CreateIndex
CREATE UNIQUE INDEX "Agency_supportEmail_key" ON "Agency"("supportEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Agency_agencyAdminEmail_key" ON "Agency"("agencyAdminEmail");

-- CreateIndex
CREATE INDEX "Agency_agencySlug_idx" ON "Agency"("agencySlug");

-- AddForeignKey
ALTER TABLE "AgencyAgent" ADD CONSTRAINT "AgencyAgent_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
