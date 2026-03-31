/*
  Warnings:

  - A unique constraint covering the columns `[emailVerificationToken]` on the table `Agency` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[emailVerificationToken]` on the table `AgencyAgent` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[emailVerificationToken]` on the table `Agent` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Agency" ADD COLUMN     "emailVerificationToken" TEXT,
ADD COLUMN     "isEmailVerified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "AgencyAgent" ADD COLUMN     "emailVerificationToken" TEXT,
ADD COLUMN     "isEmailVerified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "emailVerificationToken" TEXT,
ADD COLUMN     "isEmailVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Agency_emailVerificationToken_key" ON "Agency"("emailVerificationToken");

-- CreateIndex
CREATE UNIQUE INDEX "AgencyAgent_emailVerificationToken_key" ON "AgencyAgent"("emailVerificationToken");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_emailVerificationToken_key" ON "Agent"("emailVerificationToken");
