import { generateJSON, MODELS } from '@/lib/ai/provider-client';
import { AutopsyEvidence, AutopsyEvidenceStatus, MistakeType, EvidenceSource } from './types';
import { areMcqAnswersEquivalent } from '@/lib/practice/answer-normalization';

export interface ClassifyParams {
  questionText?: string;
  studentAnswer?: string;
  correctAnswer?: string;
  explanation?: string;
  subject?: string;
  chapter?: string;
  topic?: string;
  confidence?: number;
  evidenceSource?: EvidenceSource;
}

export interface ClassifierResult {
  isCorrect: boolean;
  evidenceStatus: AutopsyEvidenceStatus;
  mistakeType?: MistakeType;
  confidence: number;
  conceptName?: string;
  shortReason?: string;
  needsReviewReason?: string;
}

function cleanAnswer(ans: string | undefined): string {
  if (!ans) return '';
  return ans.trim().toLowerCase();
}

export async function classifyMistake(params: ClassifyParams): Promise<ClassifierResult> {
  const { studentAnswer, correctAnswer, confidence = 1, evidenceSource = 'autopsy' } = params;
  const cleanStudent = cleanAnswer(studentAnswer);
  const cleanCorrect = cleanAnswer(correctAnswer);

  // 1. Deterministic Rule: Unattempted
  if (!cleanStudent || cleanStudent === 'unattempted' || cleanStudent === 'blank') {
    return {
      isCorrect: false,
      evidenceStatus: 'verified_mistake',
      mistakeType: 'unattempted',
      confidence: 1.0,
      shortReason: 'Student did not attempt the question.',
    };
  }

  // 2. Deterministic Rule: Correct
  if (cleanCorrect && areMcqAnswersEquivalent(studentAnswer, correctAnswer)) {
    return {
      isCorrect: true,
      evidenceStatus: 'verified_correct',
      confidence: 1.0,
      shortReason: 'Exact match with correct answer.',
    };
  }

  // 3. Deterministic Rule: Low confidence extraction
  if (confidence < 0.8) {
    return {
      isCorrect: false,
      evidenceStatus: 'needs_review',
      mistakeType: 'unknown',
      confidence,
      needsReviewReason: 'Low extraction confidence, human review needed.',
    };
  }

  // 4. LLM Classification fallback for verified mistake details
  const prompt = `
You are an expert exam analyzer (NEET/JEE).
Evaluate this question, student answer, and correct answer to determine the specific mistake type and core concept.

Question text: ${params.questionText || 'N/A'}
Student answer: ${params.studentAnswer || 'N/A'}
Correct answer: ${params.correctAnswer || 'N/A'}
Explanation: ${params.explanation || 'N/A'}
Context: Subject: ${params.subject || 'N/A'}, Chapter: ${params.chapter || 'N/A'}, Topic: ${params.topic || 'N/A'}

Respond with JSON format:
{
  "mistakeType": "conceptual_gap" | "formula_recall" | "calculation_error" | "misread_question" | "option_trap" | "silly_mistake" | "time_pressure" | "forgot_fact" | "application_failure" | "unknown",
  "conceptName": "Specific name of the core concept (e.g., 'Coulomb\\'s Law', 'Stoichiometry')",
  "shortReason": "1 sentence explanation of why they made this mistake",
  "isHighConfidence": boolean // true if the mistake type and concept are very clear from the text
}
`;

  try {
    const aiResult = await generateJSON<{
      mistakeType: MistakeType;
      conceptName: string;
      shortReason: string;
      isHighConfidence: boolean;
    }>(
      'flash',
      'You are a precise, analytical educational AI.',
      prompt
    );

    const isConfident = aiResult.isHighConfidence !== false;

    return {
      isCorrect: false,
      evidenceStatus: isConfident ? 'verified_mistake' : 'needs_review',
      mistakeType: aiResult.mistakeType || 'unknown',
      confidence: isConfident ? 0.9 : 0.6,
      conceptName: aiResult.conceptName,
      shortReason: aiResult.shortReason,
      needsReviewReason: isConfident ? undefined : 'AI was not confident in classification.',
    };
  } catch (error) {
    console.error('LLM classification failed:', error);
    return {
      isCorrect: false,
      evidenceStatus: 'needs_review',
      mistakeType: 'unknown',
      confidence: 0.5,
      needsReviewReason: 'LLM classification error.',
    };
  }
}
