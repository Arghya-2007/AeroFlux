-- AlterEnum
-- CreateEnum
CREATE TYPE "AuthEventType" AS ENUM (
  'REGISTER_SUCCESS',
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'LOGIN_BLOCKED_CAPTCHA',
  'LOGIN_BLOCKED_IP',
  'LOGOUT',
  'TOKEN_REFRESHED',
  'TOKEN_REPLAY_DETECTED',
  'TOKEN_REUSE_DETECTED',
  'PASSWORD_CHANGED',
  'PASSWORD_RESET_REQUESTED',
  'EMAIL_CHANGE_REQUESTED',
  'EMAIL_CHANGE_CONFIRMED',
  'EMAIL_VERIFIED',
  'MFA_ENABLED',
  'MFA_DISABLED',
  'MFA_SUCCESS',
  'MFA_FAILED',
  'MFA_FAILURE',
  'MFA_LOCKOUT',
  'IMPOSSIBLE_TRAVEL_FLAGGED',
  'IMPOSSIBLE_TRAVEL_DETECTED',
  'CAPTCHA_REQUIRED',
  'SESSION_REVOKED_ALL',
  'ACCOUNT_UNLOCKED',
  'UNKNOWN_ACTION'
);

-- CreateTable
CREATE TABLE "AuthEvent" (
    "id" TEXT NOT NULL,
    "agentId" TEXT,
    "type" "AuthEventType" NOT NULL,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "country" TEXT,
    "city" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuthEvent_agentId_idx" ON "AuthEvent"("agentId");

-- CreateIndex
CREATE INDEX "AuthEvent_agentId_type_idx" ON "AuthEvent"("agentId", "type");

-- CreateIndex
CREATE INDEX "AuthEvent_type_createdAt_idx" ON "AuthEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "AuthEvent_createdAt_idx" ON "AuthEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "AuthEvent" ADD CONSTRAINT "AuthEvent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: add mfaRecoveryCodes to Agency
ALTER TABLE "Agency" ADD COLUMN "mfaRecoveryCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable: add mfaRecoveryCodes to AgencyAgent
ALTER TABLE "AgencyAgent" ADD COLUMN "mfaRecoveryCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable: add mfaRecoveryCodes to Agent
ALTER TABLE "Agent" ADD COLUMN "mfaRecoveryCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];


