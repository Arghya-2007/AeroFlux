const CSRF_SECRET = process.env.CSRF_SECRET || 'super-secret-csrf-key-for-dev';

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(Math.ceil(hex.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function generateToken(): Promise<string> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return bytesToHex(array);
}

export async function signToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(CSRF_SECRET);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(token)
  );
  
  return bytesToHex(new Uint8Array(signature));
}

export async function verifyToken(token: string, signature: string): Promise<boolean> {
  try {
    if (!token || !signature || typeof token !== 'string' || typeof signature !== 'string') return false;
    
    // Quick length check
    if (signature.length !== 64) return false;
    
    // Ensure signature only contains hex characters
    if (!/^[0-9a-fA-F]+$/.test(signature)) return false;

    const encoder = new TextEncoder();
    const keyData = encoder.encode(CSRF_SECRET);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    const signatureBytes = hexToBytes(signature);
    
    return await crypto.subtle.verify(
      'HMAC',
      cryptoKey,
      signatureBytes as BufferSource,
      encoder.encode(token)
    );
  } catch {
    return false;
  }
}
