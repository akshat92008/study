import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const routeText = fs.readFileSync(
  path.join(process.cwd(), 'app/api/internal/rag/ingest/route.ts'),
  'utf8'
);

describe('RAG ingest auth boundary', () => {
  it('requires cron auth and does not authenticate with Supabase user cookies', () => {
    expect(routeText).toContain('validateCronRequest');
    expect(routeText).not.toContain('auth.getUser');
    expect(routeText).toContain('createAdminClient');
  });

  it('does not special-case SUPABASE_SERVICE_ROLE_KEY bearer auth', () => {
    expect(routeText).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('verifies material ownership and honors the RAG kill switch', () => {
    expect(routeText).toContain("eq('user_id', userId)");
    expect(routeText).toContain('featureFlags.ragIngestion()');
    expect(routeText).toContain('materialId and userId are required');
  });
});
