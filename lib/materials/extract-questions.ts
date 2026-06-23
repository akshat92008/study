import { logger } from '@/lib/utils/logger';

export async function extractAndStoreQuestions(
  supabase: any,
  userId: string,
  materialId: string,
  text: string
): Promise<number> {
  const lines = text.split(/\n+/).map(line => line.trim()).filter(Boolean);
  const questions: any[] = [];
  let currentQuestion: any = null;

  for (const line of lines) {
    // Detect question start
    if (/(?:^|\n)\s*(?:q(?:uestion)?\.?\s*)?\d{1,3}[\).:-]\s+.{12,}|\?|\b(?:which of the following|choose the correct|find the value|calculate)\b/i.test(line)) {
      if (currentQuestion) {
        questions.push(currentQuestion);
      }
      currentQuestion = {
        user_id: userId,
        material_id: materialId,
        question_text: line,
        options: [],
        pattern_fingerprint: {}
      };
    } 
    // Detect option
    else if (currentQuestion && /(?:^|\n)\s*(?:\([a-d]\)|[a-d][\).])\s+.{1,120}/i.test(line)) {
      currentQuestion.options.push(line);
    } 
    // Detect answer key inline (simple check)
    else if (currentQuestion && /\b(?:answer|ans\.?)\s*(?:[:\-]|\n)\s*([a-d])/i.test(line)) {
      const match = line.match(/\b(?:answer|ans\.?)\s*(?:[:\-]|\n)\s*([a-d])/i);
      if (match) currentQuestion.answer = match[1].toUpperCase();
    }
    // Append to question text if no options found yet
    else if (currentQuestion && currentQuestion.options.length === 0) {
      currentQuestion.question_text += '\n' + line;
    }
  }

  if (currentQuestion) {
    questions.push(currentQuestion);
  }

  if (questions.length > 0) {
    const { error } = await supabase.from('material_questions').insert(questions);
    if (error) {
      logger.error('Failed to insert material_questions', { error: error.message, materialId });
    }
  }

  return questions.length;
}
