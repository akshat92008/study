import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

describe('chat AI budget lifecycle contract', () => {
  it('keeps /api/ai/chat and modules on the atomic cost guard and off deprecated usage tracking', () => {
    const chatRoute = fs.readFileSync(path.join(repoRoot, 'app/api/ai/chat/route.ts'), 'utf8');
    const streaming = fs.readFileSync(path.join(repoRoot, 'lib/chat/streaming.ts'), 'utf8');
    const uploads = fs.readFileSync(path.join(repoRoot, 'lib/chat/uploads.ts'), 'utf8');
    const orchestration = fs.readFileSync(path.join(repoRoot, 'lib/ai/chat/orchestration.ts'), 'utf8');
    const finalizer = fs.readFileSync(path.join(repoRoot, 'lib/services/chat-turn-finalizer.ts'), 'utf8');

    const combinedChatDeps = chatRoute + streaming + uploads + orchestration;

    expect(combinedChatDeps).toContain('budgetedGenerateJSON');
    expect(combinedChatDeps).toContain('budgetedStreamGeneration');
    expect(combinedChatDeps).toContain('budgetedVisionCall');
    expect(chatRoute).toContain('finalizeChatTurn');
    expect(finalizer).toContain('commitBudgetUsage');
    expect(finalizer).toContain('releaseBudgetReservation');
    expect(combinedChatDeps).not.toContain('reserveBudgetForModelCall');
    expect(combinedChatDeps).not.toContain('releaseBudgetReservation');
    expect(combinedChatDeps).not.toContain('assertDailyAIUsageBudget');
    expect(combinedChatDeps).not.toContain('trackDailyAIUsage');
    expect(finalizer).not.toContain("from '@/lib/services/ai-usage.service'");
    expect(finalizer).not.toContain('trackDailyAIUsage({');
  });
});
