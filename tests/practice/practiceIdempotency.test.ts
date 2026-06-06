import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const route = fs.readFileSync(path.join(root, 'app/api/practice/attempts/route.ts'), 'utf8');
const renderer = fs.readFileSync(path.join(root, 'components/chat/RichMessageRenderer.tsx'), 'utf8');
const streamHook = fs.readFileSync(path.join(root, 'hooks/useStream.ts'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260602000400_practice_attempts_idempotency.sql'), 'utf8');

describe('practice attempt DB idempotency', () => {
  it('stores per-answer idempotency keys and returns persisted attempts', () => {
    expect(route).toContain('idempotency_key: attemptKey');
    expect(route).toContain("onConflict: 'user_id,idempotency_key'");
    expect(route).toContain('persistedAttempts');
  });

  it('submits a stable logical attempt key from the quiz UI', () => {
    expect(renderer).toContain("'Idempotency-Key': idempotencyKey");
    expect(renderer).toContain('idempotencyKey,');
    expect(renderer).toContain('submissionKeyRef');
    expect(route).toContain("req.headers.get('Idempotency-Key') || bodyIdempotencyKey");
  });

  it('does not regenerate stream idempotency keys during retry', () => {
    expect(streamHook).toContain("{ 'Idempotency-Key': opts.headers['Idempotency-Key'] }");
    expect(streamHook).not.toContain('attempt === 0 ? opts.headers');
  });

  it('self-heals practice artifact indexing before recording attempts', () => {
    expect(route).toContain('messageContent');
    expect(route).toContain('materializePracticeSetFromChat');
    expect(route).toContain('PracticeService.extractAndStorePracticeArtifacts');
    expect(route).toContain('quiz_still_indexing');
  });

  it('has a DB unique index as the source of truth', () => {
    expect(migration).toContain('practice_attempts_user_id_idempotency_key_idx');
    expect(migration).toContain('on public.practice_attempts(user_id, idempotency_key)');
  });
});
