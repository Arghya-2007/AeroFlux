/**
 * One-time migration script to encrypt existing plaintext TOTP secrets at rest.
 *
 * Usage:
 *   TOTP_ENCRYPTION_KEY=<64-hex-char-key> DATABASE_URL=<url> npx ts-node scripts/encrypt-existing-totp-secrets.ts
 *
 * This script:
 *   1. Reads all Agency, AgencyAgent, and Agent rows that have a non-null mfaSecret.
 *   2. Skips rows that are already encrypted (contain ':' delimiters from AES-GCM format).
 *   3. Encrypts plaintext base32 secrets with AES-256-GCM using the provided key.
 *   4. Updates each row in place.
 *
 * Run this ONCE after deploying the TOTP encryption feature. It is idempotent.
 */

import { PrismaClient } from '@prisma/client';
import { createCipheriv, randomBytes } from 'crypto';

const TOTP_ENCRYPTION_KEY = process.env.TOTP_ENCRYPTION_KEY;
if (!TOTP_ENCRYPTION_KEY || TOTP_ENCRYPTION_KEY.length !== 64) {
  console.error('TOTP_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).');
  process.exit(1);
}

const prisma = new PrismaClient();

function encryptTotp(secret: string): string {
  const key = Buffer.from(TOTP_ENCRYPTION_KEY!, 'hex');
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + enc.toString('hex');
}

function isAlreadyEncrypted(value: string): boolean {
  // Encrypted format: <32-hex-iv>:<32-hex-tag>:<hex-ciphertext> (two colons)
  const parts = value.split(':');
  return parts.length === 3 && /^[0-9a-f]{32}$/.test(parts[0]) && /^[0-9a-f]{32}$/.test(parts[1]);
}

async function migrateTable(
  tableName: string,
  findMany: () => Promise<{ id: string; mfaSecret: string | null }[]>,
  update: (id: string, encrypted: string) => Promise<void>,
) {
  const rows = await findMany();
  let migrated = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!row.mfaSecret) continue;

    if (isAlreadyEncrypted(row.mfaSecret)) {
      skipped++;
      continue;
    }

    const encrypted = encryptTotp(row.mfaSecret);
    await update(row.id, encrypted);
    migrated++;
  }

  console.log(`[${tableName}] migrated: ${migrated}, skipped (already encrypted): ${skipped}`);
}

async function main() {
  console.log('Starting TOTP secret encryption migration...\n');

  await migrateTable(
    'Agency',
    () => prisma.agency.findMany({ where: { mfaSecret: { not: null } }, select: { id: true, mfaSecret: true } }),
    (id, encrypted) => prisma.agency.update({ where: { id }, data: { mfaSecret: encrypted } }).then(() => {}),
  );

  await migrateTable(
    'AgencyAgent',
    () => prisma.agencyAgent.findMany({ where: { mfaSecret: { not: null } }, select: { id: true, mfaSecret: true } }),
    (id, encrypted) => prisma.agencyAgent.update({ where: { id }, data: { mfaSecret: encrypted } }).then(() => {}),
  );

  await migrateTable(
    'Agent',
    () => prisma.agent.findMany({ where: { mfaSecret: { not: null } }, select: { id: true, mfaSecret: true } }),
    (id, encrypted) => prisma.agent.update({ where: { id }, data: { mfaSecret: encrypted } }).then(() => {}),
  );

  console.log('\nMigration complete.');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

