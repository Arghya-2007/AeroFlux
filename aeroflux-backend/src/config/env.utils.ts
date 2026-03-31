export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`FATAL: Environment variable ${key} is missing or empty.`);
  }
  return value;
}

