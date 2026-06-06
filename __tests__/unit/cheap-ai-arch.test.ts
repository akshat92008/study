import { getAiCostMode, isPaidAiEnabled, isGoogleAiEnabled, getMaxRecentMessages, getMaxOutputTokens } from '@/lib/ai/cost-mode';
import { getTokenBudget, enforceTokenBudget } from '@/lib/ai/token-budget';
import { rateLimitResponse } from '@/lib/middleware/rateLimit';
import { usageGateResponse } from '@/lib/utils/billing';
import { sanitizeHistoryForPrompt } from '@/lib/ai/chat-history-sanitizer';
import { willExceedProviderCap } from '@/lib/ai/provider-token-caps';
import { getPrioritizedProviders } from '@/lib/ai/router';
import { detectTaskComplexity } from '@/lib/ai/task-complexity';
import { buildAiCacheKey, normalizePromptForCache } from '@/lib/ai/response-cache';
import { selectRagContext } from '@/lib/rag/token-aware-context';
import { checkOutputLimit } from '@/lib/ai/output-limits';
import { tryRuleFirstResponse } from '@/lib/ai/rule-first-responder';

describe('Cheap-First AI Architecture', () => {
  beforeEach(() => {
    process.env.AI_COST_MODE = 'ultra_cheap';
    process.env.ENABLE_PAID_AI_FALLBACK = 'false';
    process.env.ENABLE_GOOGLE_AI = 'false';
    process.env.ENABLE_ANTHROPIC_AI = 'false';
  });

  describe('Cost Mode', () => {
    it('defaults to ultra_cheap when unset', () => {
      delete process.env.AI_COST_MODE;
      expect(getAiCostMode()).toBe('ultra_cheap');
    });

    it('returns false for paid AI when unset', () => {
      delete process.env.ENABLE_PAID_AI_FALLBACK;
      expect(isPaidAiEnabled()).toBe(false);
    });

    it('returns false for paid AI in ultra_cheap even if enabled in env', () => {
      process.env.AI_COST_MODE = 'ultra_cheap';
      process.env.ENABLE_PAID_AI_FALLBACK = 'true';
      expect(isPaidAiEnabled()).toBe(false);
    });

    it('passes output token caps according to mode', () => {
      process.env.AI_COST_MODE = 'ultra_cheap';
      expect(getMaxOutputTokens()).toBe(600);
      
      process.env.AI_COST_MODE = 'balanced';
      expect(getMaxOutputTokens()).toBe(1000);
    });
  });

  describe('Token Budget & History Sanitizer', () => {
    it('strips base64 blobs and compresses long messages', () => {
      const messages = [
        { role: 'user' as const, content: 'Here is an image: data:image/png;base64,' + 'A'.repeat(500) + '==' },
        { role: 'assistant' as const, content: 'Lorem ipsum dolor sit amet, '.repeat(200) },
        { role: 'user' as const, content: 'Current message' }
      ];
      
      const sanitized = sanitizeHistoryForPrompt(messages, 5, 'Current message');
      
      expect(sanitized[0].content).toContain('[base64-removed]');
      expect(sanitized[0].content.length).toBeLessThan(100);
      
      expect(sanitized[1].content).toContain('[compact mode]');
      expect(sanitized[1].content.length).toBeLessThanOrEqual(520);
      
      expect(sanitized[2].content).toBe('Current message');
    });

    it('replaces huge generated documents with references', () => {
      const messages = [
        { 
          role: 'assistant' as const, 
          content: 'Here are your questions.',
          metadata: { generatedDocument: { kind: 'mcq', count: 90, title: 'Mock Test' } }
        },
        { role: 'user' as const, content: 'Next' }
      ];
      
      const sanitized = sanitizeHistoryForPrompt(messages, 5, 'Next');
      expect(sanitized[0].content).toContain('[Generated document: mcq, title: "Mock Test", 90 items');
    });
  });

  describe('Provider Routing', () => {
    it('skips providers that exceed the token cap', () => {
      const budget = getTokenBudget('chat', 'ultra_cheap');
      const cap = willExceedProviderCap('cerebras', 'chat', 10000);
      expect(cap).toBe(true);
    });

    it('removes openai when paid fallback is disabled', async () => {
      const priority = await getPrioritizedProviders('chat');
      expect(priority).not.toContain('openai');
    });

    it('removes anthropic when anthropic ai is disabled', async () => {
      const priority = await getPrioritizedProviders('chat');
      expect(priority).not.toContain('anthropic');
    });

    it('removes google when google ai is disabled', async () => {
      const priority = await getPrioritizedProviders('embedding');
      expect(priority).not.toContain('google');
    });
  });

  describe('Response Cache', () => {
    it('normalizes prompts by removing timestamps and UUIDs', () => {
      const prompt = "What is physics? 1717329481234 123e4567-e89b-12d3-a456-426614174000";
      const normalized = normalizePromptForCache(prompt);
      expect(normalized).not.toContain("1717329481234");
      expect(normalized).not.toContain("123e4567-e89b-12d3-a456-426614174000");
    });
  });

  describe('RAG Context', () => {
    it('returns exactly 1 chunk trimmed to 900 chars in ultra_cheap', () => {
      const chunks = [
        { id: '1', materialId: 'm1', text: 'A'.repeat(2000), score: 0.9, materialTitle: 't1', sourceType: 'pdf', subject: 's1', chapter: 'c1', heading: 'h1', pageStart: 1, pageEnd: 1 },
        { id: '2', materialId: 'm2', text: 'B'.repeat(2000), score: 0.8, materialTitle: 't2', sourceType: 'pdf', subject: 's2', chapter: 'c2', heading: 'h2', pageStart: 1, pageEnd: 1 }
      ];
      
      const budget = getTokenBudget('chat', 'ultra_cheap');
      const selected = selectRagContext(chunks, budget, 'ultra_cheap');
      
      expect(selected.length).toBe(1);
      expect(selected[0].text.length).toBeLessThanOrEqual(920);
    });

    it('removes near-duplicate chunks', () => {
      const chunks = [
        { id: '1', materialId: 'm1', text: 'This is a very specific test string that should overlap heavily with the next one. '.repeat(10), score: 0.9, materialTitle: 't1', sourceType: 'pdf', subject: 's1', chapter: 'c1', heading: 'h1', pageStart: 1, pageEnd: 1 },
        { id: '2', materialId: 'm2', text: 'This is a very specific test string that should overlap heavily with the next one. '.repeat(10) + 'extra', score: 0.8, materialTitle: 't2', sourceType: 'pdf', subject: 's2', chapter: 'c2', heading: 'h2', pageStart: 1, pageEnd: 1 }
      ];
      
      const budget = getTokenBudget('chat', 'balanced');
      const selected = selectRagContext(chunks, budget, 'balanced');
      
      expect(selected.length).toBe(1);
    });
  });

  describe('Output Limits', () => {
    it('queues a 90-question mock test', () => {
      const check = checkOutputLimit('document_generation', 90, 'ultra_cheap');
      expect(check.shouldQueue).toBe(true);
    });

    it('allows 5 MCQs', () => {
      const check = checkOutputLimit('flashcards', 5, 'ultra_cheap');
      expect(check.allowed).toBe(true);
      expect(check.shouldQueue).toBe(false);
    });
  });

  describe('Rule-First', () => {
    it('handles weak chapters request', async () => {
      const mindContext = { weakConcepts: [{ name: 'Newton Laws', subject: 'Physics' }] };
      const res = await tryRuleFirstResponse('user1', 'show weak chapters', mindContext);
      
      expect(res.handled).toBe(true);
      expect(res.response).toContain('Newton Laws');
    });

    it('signals to queue large MCQ requests', async () => {
      const mindContext = {};
      const res = await tryRuleFirstResponse('user1', 'give me 50 mcqs', mindContext);
      
      expect(res.handled).toBe(true);
      expect(res.shouldQueue).toBe(true);
    });
  });

  describe('Error Responses', () => {
    it('returns useful error for rate limit', async () => {
      const res = rateLimitResponse(0, Date.now());
      expect(res.status).toBe(429);
      const json = await res.json();
      expect(json).toHaveProperty('error', 'rate_limited');
      expect(json).toHaveProperty('message');
    });

    it('returns useful error for budget exceeded', async () => {
      const result = { allowed: false, remaining: 0, required: 10, code: 'limit_reached' as const, reason: 'Out of credits' };
      const res = usageGateResponse(result);
      expect(res.status).toBe(429);
      const json = await res.json();
      expect(json).toHaveProperty('error', 'limit_reached');
      expect(json).toHaveProperty('message', 'Out of credits');
    });
  });
});
