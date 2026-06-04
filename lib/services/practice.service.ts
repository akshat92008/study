import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';

export interface PracticeSetData {
  userId: string;
  chatSessionId?: string;
  messageId?: string;
  fullResponse: string;
  source?: 'mind' | 'rag';
  sourceMaterialIds?: string[];
  sourceChunkIds?: string[];
}

export class PracticeService {
  static async extractAndStorePracticeArtifacts(supabase: SupabaseClient, data: PracticeSetData) {
    const { userId, chatSessionId, messageId, fullResponse } = data;
    
    // Regex for finding artifacts
    const artifactRegex = /<artifact([^>]*)>([\s\S]*?)<\/artifact>/g;
    let match;
    
    while ((match = artifactRegex.exec(fullResponse)) !== null) {
      const attrString = match[1];
      const content = match[2].trim();
      
      const attrs: Record<string, string> = {};
      const attrRegex = /(\w+)="([^"]*?)"/g;
      let attrMatch;
      while ((attrMatch = attrRegex.exec(attrString)) !== null) {
        attrs[attrMatch[1]] = attrMatch[2];
      }
      
      const type = attrs.type;
      const topic = attrs.topic || 'Concept';
      const subject = attrs.subject;
      
      if (type === 'practice-test' || type === 'mcq-set') {
        await this.storePracticeTest(supabase, userId, chatSessionId, messageId, topic, subject, content, data);
      } else if (type === 'flashcard-set') {
        await this.storeFlashcardSet(supabase, userId, chatSessionId, messageId, topic, subject, content, data);
      }
    }
  }

  private static async storePracticeTest(
    supabase: SupabaseClient, 
    userId: string, 
    chatSessionId: string | undefined, 
    messageId: string | undefined, 
    topic: string, 
    subject: string | undefined, 
    content: string,
    artifactContext: PracticeSetData
  ) {
    // Check if it already exists for this messageId to prevent duplicates on retries
    if (messageId) {
      const { data: existing } = await supabase
        .from('practice_sets')
        .select('id')
        .eq('message_id', messageId)
        .eq('set_type', 'mcq')
        .maybeSingle();
      if (existing) return;
    }

    const questions = this.parseQuestions(content);
    if (questions.length === 0) return;

    // Create practice set
    const { data: practiceSet, error: setError } = await supabase
      .from('practice_sets')
      .insert({
        user_id: userId,
        chat_session_id: chatSessionId,
        message_id: messageId,
        topic,
        subject,
        set_type: 'mcq',
        source: artifactContext.source || 'mind'
      })
      .select('id')
      .single();

    if (setError || !practiceSet) {
      logger.error('Failed to create practice set', setError);
      return;
    }

    // Prepare items
    const items = questions.map((q, idx) => ({
      practice_set_id: practiceSet.id,
      user_id: userId,
      question: q.text,
      options: q.options,
      correct_answer: q.answer,
      explanation: q.explanation,
      subject,
      chapter: topic,
      topic,
      concept_name: topic,
      source_material_id: artifactContext.sourceMaterialIds?.[0] ?? null,
      source_chunk_ids: artifactContext.sourceChunkIds ?? null,
      position: idx + 1
    }));

    const { error: itemsError } = await supabase.from('practice_items').insert(items);
    if (itemsError) {
      logger.error('Failed to create practice items (mcq)', itemsError);
    }
  }

  private static async storeFlashcardSet(
    supabase: SupabaseClient, 
    userId: string, 
    chatSessionId: string | undefined, 
    messageId: string | undefined, 
    topic: string, 
    subject: string | undefined, 
    content: string,
    artifactContext: PracticeSetData
  ) {
    if (messageId) {
      const { data: existing } = await supabase
        .from('practice_sets')
        .select('id')
        .eq('message_id', messageId)
        .eq('set_type', 'flashcard')
        .maybeSingle();
      if (existing) return;
    }

    const cards = this.parseFlashcards(content);
    if (cards.length === 0) return;

    const { data: practiceSet, error: setError } = await supabase
      .from('practice_sets')
      .insert({
        user_id: userId,
        chat_session_id: chatSessionId,
        message_id: messageId,
        topic,
        subject,
        set_type: 'flashcard',
        source: artifactContext.source || 'mind'
      })
      .select('id')
      .single();

    if (setError || !practiceSet) {
      logger.error('Failed to create flashcard set', setError);
      return;
    }

    const items = cards.map((c, idx) => ({
      practice_set_id: practiceSet.id,
      user_id: userId,
      question: c.front,
      correct_answer: c.back,
      subject,
      chapter: topic,
      topic,
      concept_name: topic,
      source_material_id: artifactContext.sourceMaterialIds?.[0] ?? null,
      source_chunk_ids: artifactContext.sourceChunkIds ?? null,
      position: idx + 1
    }));

    const { error: itemsError } = await supabase.from('practice_items').insert(items);
    if (itemsError) {
      logger.error('Failed to create practice items (flashcard)', itemsError);
    }
  }

  private static parseQuestions(content: string) {
    const questions: Array<{ text: string; options: string[]; answer: string; explanation: string }> = [];
    const blocks = content.split(/\n\s*---\s*(?:\n|$)/);

    blocks.forEach((block) => {
      if (!block.trim()) return;
      const lines = block.trim().split('\n');
      let text = '', answer = '', explanation = '';
      const options: string[] = [];

      lines.forEach(line => {
        const l = line.trim();
        if (l.match(/^Q\d+\./)) text = l.replace(/^Q\d+\.\s*/, '');
        else if (l.match(/^\(A\)/)) options[0] = l.slice(3).trim();
        else if (l.match(/^\(B\)/)) options[1] = l.slice(3).trim();
        else if (l.match(/^\(C\)/)) options[2] = l.slice(3).trim();
        else if (l.match(/^\(D\)/)) options[3] = l.slice(3).trim();
        else if (l.startsWith('ANSWER:')) {
          const rawAnswer = l.replace('ANSWER:', '').trim();
          const match = rawAnswer.match(/^(?:\*\*|__)?\(?([A-D])\)?(?:\*\*|__)?\s*(?:\.|-|\)|\s|$)/i) || rawAnswer.match(/\b(?:Option\s+)?([A-D])\b/i);
          if (match) {
            answer = match[1].toUpperCase();
          } else {
            const optIdx = options.findIndex(o => o.trim() === rawAnswer || rawAnswer.includes(o.trim()));
            if (optIdx !== -1) {
              answer = String.fromCharCode(65 + optIdx);
            } else {
              answer = rawAnswer;
            }
          }
        }
        else if (l.startsWith('EXPLANATION:')) explanation = l.replace('EXPLANATION:', '').trim();
      });

      if (text || options.length > 0) {
        questions.push({ text, options, answer, explanation });
      }
    });
    return questions;
  }

  private static parseFlashcards(content: string) {
    const cards: Array<{ front: string; back: string }> = [];
    const blocks = content.split(/\n\s*---\s*(?:\n|$)/);
    
    blocks.forEach((block) => {
      if (!block.trim()) return;
      const lines = block.trim().split('\n');
      let front = '', back = '';
      lines.forEach(line => {
        if (line.startsWith('FRONT:')) front = line.replace('FRONT:', '').trim();
        if (line.startsWith('BACK:')) back = line.replace('BACK:', '').trim();
      });
      if (front) cards.push({ front, back });
    });
    return cards;
  }
}
