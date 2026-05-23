// lib/utils/env.ts

/**
 * Minimal environment variable helper.
 * Usage: env('VAR_NAME', 'default')
 * Returns the variable as a string, falling back to `default` if provided.
 * Throws if the variable is undefined and no default is supplied.
 */
export function env(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (val === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val;
}
