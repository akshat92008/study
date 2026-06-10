import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(file: string): string {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

describe('no-PULSE product gap contracts', () => {
  it('wires lightweight emotional continuity without creating PULSE runtime paths', () => {
    const chatRoute = read('app/api/ai/chat/route.ts');
    const chatContext = read('lib/chat/context.ts');
    const chatPipeline = read('lib/chat/pipeline.ts');
    const combined = chatRoute + chatContext + chatPipeline;
    const appApiFiles = fs.readdirSync(path.join(root, 'app/api'), { recursive: true }).join('\n').toLowerCase();
    const migration = read('supabase/migrations/20260531000011_no_pulse_product_gates_memory.sql').toLowerCase();

    expect(combined).toContain('inferAndUpdateEmotionalState');
    expect(appApiFiles).not.toContain('pulse');
    expect(migration).not.toMatch(/create\s+table[\s\S]{0,80}pulse/);
    expect(migration).not.toMatch(/alter\s+table[\s\S]{0,80}pulse/);
  });

  it('keeps mentor and tutor memories on the canonical chat_memory path', () => {
    const memoryService = read('lib/services/chatMemoryService.ts');
    const mentorRoute = read('app/api/ai/mentor/route.ts');
    const tutorRoute = read('app/api/ai/tutor/route.ts');

    expect(memoryService).toContain('storeConversationTurnInMemory');
    expect(mentorRoute).toContain("sourceType: 'mentor_chat'");
    expect(tutorRoute).toContain("sourceType: 'tutor_chat'");
    expect(memoryService).toContain(".from('chat_memory')");
  });

  it('prevents root service imports and removes the duplicate root services tree', () => {
    expect(fs.existsSync(path.join(root, 'services'))).toBe(false);
    expect(read('eslint.config.mjs')).toContain('@/services/*');
    expect(read('tsconfig.json')).not.toContain('"@/services/*"');
  });

  it('keeps Hobby cron scheduling on daily synthesis only', () => {
    const vercel = JSON.parse(read('vercel.json')) as { crons?: Array<{ path: string; schedule: string }> };
    expect(vercel.crons).toEqual([
      { path: '/api/cron/daily-synthesis', schedule: '0 6 * * *' },
      { path: '/api/cron/daily-background-review', schedule: '0 3 * * *' },
    ]);
  });

  it('replaces schema-conditional semantic memory RPC with deterministic chat_memory lookup', () => {
    const migration = read('supabase/migrations/20260531000011_no_pulse_product_gates_memory.sql');
    const functionBody = migration.slice(migration.indexOf('create or replace function public.match_chat_memory'));

    expect(functionBody).toContain('from public.chat_memory cm');
    expect(functionBody).not.toContain('information_schema.tables');
    expect(functionBody).not.toContain('chat_memory_embeddings');
  });
});
