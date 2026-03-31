import crypto from 'crypto';

const CSRF_SECRET = process.env.CSRF_SECRET || 'super-secret-csrf-key-for-dev';

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function signToken(token: string): string {
  return crypto
    .createHmac('sha256', CSRF_SECRET)
    .update(token)
    .digest('hex');
}

export function verifyToken(token: string, signature: string): boolean {
  try {
    const expectedSignature = signToken(token);
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    const signatureBuffer = Buffer.from(signature, 'hex');
    if (expectedBuffer.length !== signatureBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
  } catch {
    return false;
  }
}

