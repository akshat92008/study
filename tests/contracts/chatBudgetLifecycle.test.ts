import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

describe('chat AI budget lifecycle contract', () => {
  it('keeps /api/ai/chat on the atomic cost guard and off deprecated usage tracking', () => {
    const chatRoute = fs.readFileSync(path.join(repoRoot, 'app/api/ai/chat/route.ts'), 'utf8');
    const finalizer = fs.readFileSync(path.join(repoRoot, 'lib/services/chat-turn-finalizer.ts'), 'utf8');

    expect(chatRoute).toContain('reserveBudgetForModelCall');
    expect(chatRoute).toContain('finalizeChatTurn');
    expect(finalizer).toContain('commitBudgetUsage');
    expect(finalizer).toContain('releaseBudgetReservation');
    expect(chatRoute).toContain('releaseBudgetReservation');
    expect(chatRoute).not.toContain('assertDailyAIUsageBudget');
    expect(chatRoute).not.toContain('trackDailyAIUsage');
    expect(finalizer).not.toContain("from '@/lib/services/ai-usage.service'");
    expect(finalizer).not.toContain('trackDailyAIUsage({');
  });
});
