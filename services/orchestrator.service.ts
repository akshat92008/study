// services/orchestrator.service.ts
import { GoogleGenAI } from '@google/genai';
import { getMINDContext } from '@/lib/engines/mind-engine';
import { getMINDSystemPrompt } from '@/lib/ai/prompts/mind-prompt';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { ChatMemoryService } from './chat-memory.service';

type MessageHistory = Array<{ role: 'user' | 'assistant' | 'model'; content: string }>;

export class OrchestratorService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  }

  async *processUserMessage(
    userId: string,
    message: string,
    history: MessageHistory,
    activeGoalId?: string,
    intent?: string
  ): AsyncGenerator<string> {
    // Build full context
    const mindContext = await getMINDContext(userId, message);
    const systemPrompt = getMINDSystemPrompt(mindContext);

    // Retrieve semantic memory — past conversations about similar topics
    const semanticMemory = await this.retrieveSemanticMemory(userId, message);
    const fullSystemPrompt = semanticMemory
      ? `${systemPrompt}\n\n═══ RELEVANT MEMORY FROM PAST SESSIONS ═══\n${semanticMemory}\n═══════════════════════════════════════`
      : systemPrompt;

    // Build properly formatted conversation history for Gemini
    // Gemini requires: alternating user/model turns, starting with user
    const formattedHistory = this.formatHistory(history);

    try {
      const chat = this.ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction: fullSystemPrompt,
          temperature: intent === 'TUTOR_SESSION' ? 0.7 : 0.5,
          maxOutputTokens: 4096,
        },
        history: formattedHistory
      });

      const stream = await chat.sendMessageStream({ message });

      for await (const chunk of stream) {
        const text = chunk.text;
        if (text) yield text;
      }

      // Save semantic memory snapshot after session
      this.saveSemanticMemory(userId, message, mindContext).catch(err =>
        logger.error('Memory save failed', err)
      );

    } catch (err: any) {
      logger.error('OrchestratorService streaming error', err);
      // Graceful fallback — try non-streaming
      try {
        const response = await this.ai.models.generateContent({
          model: 'gemini-2.5-flash',
          config: { systemInstruction: fullSystemPrompt, temperature: 0.5 },
          contents: [
            ...formattedHistory.map(h => ({ role: h.role, parts: [{ text: h.parts[0].text }] })),
            { role: 'user' as const, parts: [{ text: message }] }
          ]
        });
        yield response.text || 'I encountered an issue. Please try again.';
      } catch {
        yield 'I hit a temporary issue. Please send your message again.';
      }
    }
  }

  private formatHistory(history: MessageHistory): Array<{ role: 'user' | 'model'; parts: [{ text: string }] }> {
    const filtered: Array<{ role: 'user' | 'model'; parts: [{ text: string }] }> = [];

    // Only last 20 messages, properly alternating
    const recent = history.slice(-20);
    let lastRole: string | null = null;

    for (const msg of recent) {
      const role: 'user' | 'model' = msg.role === 'user' ? 'user' : 'model';
      // Skip consecutive same-role messages — Gemini requires alternating
      if (role === lastRole) continue;
      // Truncate very long messages to avoid token waste
      const content = msg.content.length > 3000 ? msg.content.slice(0, 3000) + '...' : msg.content;
      filtered.push({ role, parts: [{ text: content }] });
      lastRole = role;
    }

    // Must start with 'user' turn
    if (filtered.length > 0 && filtered[0].role !== 'user') {
      filtered.shift();
    }

    return filtered;
  }

  private async retrieveSemanticMemory(userId: string, message: string): Promise<string | null> {
    try {
      const memoryService = new ChatMemoryService();
      const memories = await memoryService.searchMemory(userId, message, 3);
      if (memories && memories.length > 0) {
        return memories.map((m: string) => `• ${m}`).join('\n');
      }
      return null;
    } catch {
      return null;
    }
  }

  private async saveSemanticMemory(userId: string, message: string, context: any): Promise<void> {
    try {
      const memoryService = new ChatMemoryService();
      const summary = `Student asked about: ${message.slice(0, 150)}. Exam: ${context.profile.examType}. Weak areas at time: ${context.weakConcepts.slice(0, 2).map((c: any) => c.name).join(', ')}`;
      await memoryService.storeMessageInMemory(userId, summary);
    } catch (e) {
      logger.error('Failed storing semantic memory', e);
    }
  }
}
