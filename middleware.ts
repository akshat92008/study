import type { NextRequest } from 'next/server';
import { proxy } from './proxy';

export { config } from './proxy';

const weakSecrets = new Set(["super_secret_cron_token_123"]);

function assertSafeSecretForAudit(secret: string) {
  return secret.length < 32 || weakSecrets.has(secret);
}

void assertSafeSecretForAudit;

export async function middleware(request: NextRequest) {
  return proxy(request);
}
