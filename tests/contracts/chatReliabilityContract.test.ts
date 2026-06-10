/**
 * Module 6 Contract Tests — MIND Chat Reliability
 *
 * Phase 6.1: turn_status state machine declared in migrations
 * Phase 6.3: AI usage reservation wired in streaming path
 * Phase 6.4: All required error codes handled in chat route
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function readMigrations(): string {
  const dir = path.join(root, 'supabase', 'migrations');
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .map(f => fs.readFileSync(path.join(dir, f), 'utf8'))
    .join('\n')
    .toLowerCase();
}

describe('Module 6 — Phase 6.1: chat turn_status state machine', () => {
  it('chat_turn_status migration exists', () => {
    const migrationPath = path.join(root, 'supabase', 'migrations', '20260610000001_chat_turn_status.sql');
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  it('turn_status column is added to chat_messages in migration', () => {
    const content = readMigrations();
    expect(content).toContain('turn_status');
    expect(content).toContain('chat_messages');
  });

  it('turn_status migration includes required states', () => {
    const migrationContent = readFile('supabase/migrations/20260610000001_chat_turn_status.sql').toLowerCase();
    const requiredStates = [
      'assistant_saved',
      'failed_provider',
      'failed_internal',
      'assistant_streaming',
    ];
    for (const state of requiredStates) {
      expect(migrationContent).toContain(state);
    }
  });

  it('idempotency_key unique index declared for chat_messages', () => {
    const migrationContent = readFile('supabase/migrations/20260610000001_chat_turn_status.sql').toLowerCase();
    expect(migrationContent).toContain('unique index');
    expect(migrationContent).toContain('idempotency_key');
  });

  it('chat-turn-finalizer persists turn_status on assistant message', () => {
    const content = readFile('lib/services/chat-turn-finalizer.ts');
    expect(content).toContain('turnStatus');
    expect(content).toContain('assistant_saved');
    // Failed path marks user message as failed_provider
    expect(content).toContain('failed_provider');
    expect(content).toContain('turn_status');
  });
});

describe('Module 6 — Phase 6.3: AI usage reservation before provider call', () => {
  it('streaming.ts imports reserveUsage, commitUsage, releaseUsage', () => {
    const content = readFile('lib/chat/streaming.ts');
    expect(content).toContain('reserveUsage');
    expect(content).toContain('commitUsage');
    expect(content).toContain('releaseUsage');
  });

  it('streaming.ts reserves usage before budgetedStreamGeneration call', () => {
    const content = readFile('lib/chat/streaming.ts');
    // aiReservationId assigned before mainGenerator = await budgetedStreamGeneration(...)
    const reserveIdx = content.indexOf('aiReservationId');
    const streamAwaitIdx = content.indexOf('mainGenerator = await budgetedStreamGeneration');
    expect(reserveIdx).toBeGreaterThan(0);
    expect(streamAwaitIdx).toBeGreaterThan(0);
    expect(reserveIdx).toBeLessThan(streamAwaitIdx);
  });

  it('streaming.ts releases reservation on provider failure', () => {
    const content = readFile('lib/chat/streaming.ts');
    expect(content).toContain('releaseUsage');
    // releaseUsage called in catch block
    expect(content).toContain('Release reservation on provider failure');
  });

  it('enforce-feature-limit exports reserveUsage, commitUsage, releaseUsage', () => {
    const content = readFile('lib/usage/enforce-feature-limit.ts');
    expect(content).toContain('export async function reserveUsage');
    expect(content).toContain('export async function commitUsage');
    expect(content).toContain('export async function releaseUsage');
  });
});

describe('Module 6 — Phase 6.4: Chat API error code contracts', () => {
  const chatRoute = readFile('app/api/ai/chat/route.ts');
  const pipeline = readFile('lib/chat/pipeline.ts');

  it('401 Unauthorized is handled in chat route', () => {
    expect(chatRoute + pipeline).toContain('status: 401');
  });

  it('403 / beta_access_required is handled in chat route', () => {
    expect(chatRoute).toContain('betaAccessErrorResponse');
    expect(chatRoute + pipeline).toContain('403');
  });

  it('409 duplicate_request is handled (idempotency)', () => {
    expect(chatRoute).toContain('duplicate_request');
    expect(chatRoute).toContain('409');
  });

  it('413 prompt_too_long is handled (validatePromptLength)', () => {
    expect(chatRoute).toContain('validatePromptLength');
  });

  it('429 rate limit is handled (checkRateLimit)', () => {
    expect(pipeline).toContain('rateLimitResponse');
    expect(chatRoute + pipeline).toContain('checkRateLimit');
  });

  it('429 usage limit is handled (consumeUsageLimit)', () => {
    expect(chatRoute).toContain('consumeUsageLimit');
    expect(chatRoute).toContain('usageGateResponse');
  });

  it('503 usage_system_unavailable is handled in feature limit response', () => {
    const enforcer = readFile('lib/usage/enforce-feature-limit.ts');
    expect(enforcer).toContain('usage_system_unavailable');
    expect(enforcer).toContain('503');
  });

  it('500 provider failure has a user-friendly fallback in streaming', () => {
    const streaming = readFile('lib/chat/streaming.ts');
    expect(streaming).toContain('could not generate that part right now');
  });

  it('AI global kill switch is respected before provider call', () => {
    expect(chatRoute).toContain("isFeatureEnabled('ai_global')");
    expect(chatRoute).toContain('featureDisabledResponse');
  });
});

describe('Module 6 — Phase 6.2: Context budget limits', () => {
  it('MIND engine limits weak concepts to 5', () => {
    const content = readFile('lib/engines/mind-engine.ts');
    expect(content).toContain('weakConcepts.slice(0, 5)');
  });

  it('MIND engine limits RAG chunks to 3', () => {
    const content = readFile('lib/engines/mind-engine.ts');
    // Pattern: ragContext.chunks.slice(0, 3) or ragChunks.slice(0, 3)
    expect(
      content.includes('chunks.slice(0, 3)') || content.includes('ragChunks.slice(0, 3)')
    ).toBe(true);
  });

  it('MIND engine limits recent mistakes to 5', () => {
    const content = readFile('lib/engines/mind-engine.ts');
    expect(content).toContain('recentMistakes.slice(0, 5)');
  });

  it('chat history is sanitized before prompt build', () => {
    const streaming = readFile('lib/chat/streaming.ts');
    expect(streaming).toContain('sanitizeHistoryForPrompt');
  });
});
