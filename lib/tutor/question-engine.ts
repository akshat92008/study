import { logger } from '@/lib/utils/logger';

export interface DeterministicQuestion {
  question: string;
  expectedConcepts: string[];
}

// In a real production system, this would be backed by the database or a JSON curriculum registry.
// For now, we extract the hardcoded map and expand it to be structured.
const CHAPTER_MAPS: Record<string, DeterministicQuestion[]> = {
  'Biotechnology': [
    { question: "Why are plasmids useful as cloning vectors?", expectedConcepts: ["origin of replication", "independent replication"] },
    { question: "What is the role of ori?", expectedConcepts: ["origin of replication", "copy number control"] },
    { question: "Why is selectable marker needed?", expectedConcepts: ["identify transformants", "eliminate non-transformants"] },
    { question: "Difference between exonuclease and endonuclease?", expectedConcepts: ["ends of DNA", "specific positions within DNA"] },
    { question: "Why does restriction enzyme cut palindromic DNA?", expectedConcepts: ["recognition sequence", "overhanging sticky ends"] },
    { question: "What is insertional inactivation?", expectedConcepts: ["recombinant selection", "beta-galactosidase"] },
    { question: "Why is Taq polymerase used in PCR?", expectedConcepts: ["thermostable", "high temperature extension"] },
    { question: "Why does DNA move towards anode in gel electrophoresis?", expectedConcepts: ["negatively charged", "phosphate backbone"] },
    { question: "What is downstream processing?", expectedConcepts: ["separation", "purification", "clinical trials"] },
    { question: "Why is Bt toxin inactive inside Bacillus?", expectedConcepts: ["protoxin", "alkaline pH of insect gut"] }
  ]
};

export class QuestionEngine {
  /**
   * Returns a deterministic question for the given chapter/topic and turn number.
   * If the session is deeper than the mapped questions, returns null (allowing LLM fallback).
   */
  static getDeterministicQuestion(topic: string, currentTurn: number): DeterministicQuestion | null {
    // Normalize topic check
    let matchedChapter: string | null = null;
    if (topic.toLowerCase().includes('biotechnology')) {
      matchedChapter = 'Biotechnology';
    }

    if (!matchedChapter) {
      return null;
    }

    const chapterQuestions = CHAPTER_MAPS[matchedChapter] || [];
    if (currentTurn < chapterQuestions.length) {
      return chapterQuestions[currentTurn];
    }

    return null;
  }
}
