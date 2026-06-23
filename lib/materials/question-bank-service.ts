import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';

export class QuestionBankService {
  static async getMaterialQuestions(
    supabase: SupabaseClient,
    materialId: string,
    topic?: string,
    limit: number = 10
  ) {
    let query = supabase
      .from('material_questions')
      .select('*')
      .eq('material_id', materialId);
      
    if (topic && topic !== 'General') {
      // Basic ilike match for topic if it's not strictly "General"
      query = query.ilike('topic', `%${topic}%`);
    }
    
    const { data, error } = await query.limit(limit);
    if (error) {
      logger.error('Failed to fetch material questions', error);
      return [];
    }
    return data || [];
  }

  static getQuestionBankFingerprint(questions: any[]) {
    if (!questions || questions.length === 0) return null;
    
    // Create a fingerprint of the question style to guide the LLM
    const sample = questions.slice(0, 3).map((q, i) => {
      let qText = `Sample ${i + 1}:\nQuestion: ${q.question_text}`;
      if (q.options) {
        qText += `\nOptions: ${JSON.stringify(q.options)}`;
      }
      if (q.answer) {
        qText += `\nAnswer: ${q.answer}`;
      }
      if (q.solution) {
        qText += `\nSolution: ${q.solution}`;
      }
      return qText;
    }).join('\n\n');
    
    return sample;
  }
}
