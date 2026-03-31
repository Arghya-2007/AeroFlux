/*
  Warnings:

  - You are about to drop the column `extractedData` on the `TourPackage` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "BookingType" AS ENUM ('FLIGHT', 'HOTEL', 'TRAIN', 'BUS', 'TAXI', 'FERRY', 'ACTIVITY', 'OTHER');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'PENDING', 'WAITLISTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ItineraryDayStatus" AS ENUM ('UPCOMING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'ANNUAL');

-- AlterEnum
ALTER TYPE "AgencyPlan" ADD VALUE 'ENTERPRISE';

-- AlterTable
ALTER TABLE "TourPackage" DROP COLUMN "extractedData",
ADD COLUMN     "miscData" JSONB,
ADD COLUMN     "totalDays" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "trialEndsAt" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "activePackagesCount" INTEGER NOT NULL DEFAULT 0,
    "docsProcessedCount" INTEGER NOT NULL DEFAULT 0,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TourItinerary" (
    "id" TEXT NOT NULL,
    "tourPackageId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "date" TIMESTAMP(3),
    "title" TEXT NOT NULL,
    "description" TEXT,
    "activities" JSONB NOT NULL DEFAULT '[]',
    "accommodation" TEXT,
    "meals" TEXT,
    "status" "ItineraryDayStatus" NOT NULL DEFAULT 'UPCOMING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TourItinerary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingDetail" (
    "id" TEXT NOT NULL,
    "tourPackageId" TEXT NOT NULL,
    "travelerId" TEXT,
    "documentId" TEXT,
    "type" "BookingType" NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "providerName" TEXT NOT NULL,
    "confirmationNo" TEXT,
    "pnr" TEXT,
    "startDateTime" TIMESTAMP(3),
    "fromLocation" TEXT,
    "endDateTime" TIMESTAMP(3),
    "toLocation" TEXT,
    "seatCoachRoom" TEXT,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_agencyId_key" ON "Subscription"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_agencyId_idx" ON "Subscription"("agencyId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_stripeCustomerId_idx" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "Subscription_stripeSubscriptionId_idx" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_currentPeriodEnd_idx" ON "Subscription"("currentPeriodEnd");

-- CreateIndex
CREATE INDEX "TourItinerary_tourPackageId_idx" ON "TourItinerary"("tourPackageId");

-- CreateIndex
CREATE INDEX "TourItinerary_tourPackageId_status_idx" ON "TourItinerary"("tourPackageId", "status");

-- CreateIndex
CREATE INDEX "TourItinerary_date_idx" ON "TourItinerary"("date");

-- CreateIndex
CREATE UNIQUE INDEX "TourItinerary_tourPackageId_dayNumber_key" ON "TourItinerary"("tourPackageId", "dayNumber");

-- CreateIndex
CREATE INDEX "BookingDetail_tourPackageId_idx" ON "BookingDetail"("tourPackageId");

-- CreateIndex
CREATE INDEX "BookingDetail_travelerId_idx" ON "BookingDetail"("travelerId");

-- CreateIndex
CREATE INDEX "BookingDetail_tourPackageId_type_idx" ON "BookingDetail"("tourPackageId", "type");

-- CreateIndex
CREATE INDEX "BookingDetail_tourPackageId_status_idx" ON "BookingDetail"("tourPackageId", "status");

-- CreateIndex
CREATE INDEX "BookingDetail_pnr_idx" ON "BookingDetail"("pnr");

-- CreateIndex
CREATE INDEX "BookingDetail_startDateTime_idx" ON "BookingDetail"("startDateTime");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TourItinerary" ADD CONSTRAINT "TourItinerary_tourPackageId_fkey" FOREIGN KEY ("tourPackageId") REFERENCES "TourPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingDetail" ADD CONSTRAINT "BookingDetail_tourPackageId_fkey" FOREIGN KEY ("tourPackageId") REFERENCES "TourPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingDetail" ADD CONSTRAINT "BookingDetail_travelerId_fkey" FOREIGN KEY ("travelerId") REFERENCES "Traveler"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingDetail" ADD CONSTRAINT "BookingDetail_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
