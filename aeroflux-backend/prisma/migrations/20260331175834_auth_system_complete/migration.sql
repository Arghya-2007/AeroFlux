-- AlterTable
ALTER TABLE "Agency" ALTER COLUMN "mfaRecoveryCodes" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AgencyAgent" ALTER COLUMN "mfaRecoveryCodes" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Agent" ALTER COLUMN "mfaRecoveryCodes" DROP DEFAULT;
