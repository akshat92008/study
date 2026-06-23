export type MaterialSourceType =
  | 'notes'
  | 'textbook'
  | 'question_bank'
  | 'slides'
  | 'transcript'
  | 'assignment'
  | 'mixed'
  | 'unknown';

export type QuestionBankStyleFingerprint = {
  averageQuestionLength: number;
  conceptualVsNumerical: 'mostly_conceptual' | 'mostly_numerical' | 'mixed' | 'unknown';
  directVsMultiStep: 'direct' | 'multi_step' | 'mixed' | 'unknown';
  formulaHeavy: boolean;
  difficultyLevel: 'introductory' | 'medium' | 'hard' | 'mixed' | 'unknown';
  commonTraps: string[];
  answerPattern: 'mcq' | 'short_answer' | 'mixed' | 'unknown';
};

export type MaterialStudyAnalysis = {
  sourceType: MaterialSourceType;
  topics: string[];
  counts: {
    topics: number;
    questions: number;
    examples: number;
    solvedExamples: number;
    formulas: number;
    definitions: number;
    answerKeys: number;
    mcqOptions: number;
  };
  textExtraction: 'none' | 'partial' | 'usable';
  difficultyEstimate: QuestionBankStyleFingerprint['difficultyLevel'];
  questionBankStyle: QuestionBankStyleFingerprint | null;
  warnings: string[];
};

const FORMULA_RE = /(?:=|∝|√|Δ|theta|sin|cos|tan|log|ln|[A-Za-z]\s*\^\s*\d|\b(?:equation|formula)\b)/i;
const QUESTION_RE = /(?:^|\n)\s*(?:q(?:uestion)?\.?\s*)?\d{1,3}[\).:-]\s+.{12,}|\?|\b(?:find|calculate|determine|which of the following|choose the correct|prove that|show that)\b/i;
const OPTION_RE = /(?:^|\n)\s*(?:\([a-d]\)|[a-d][\).])\s+.{1,120}/i;
const ANSWER_KEY_RE = /\b(?:answer key|answers?|solutions?|ans\.?)\s*(?:[:\-]|\n)/i;
const EXAMPLE_RE = /\b(?:example|illustration|worked example)\b/i;
const SOLVED_EXAMPLE_RE = /\b(?:solved example|solution|worked solution)\b/i;
const DEFINITION_RE = /\b(?:definition|defined as|is called|refers to)\b/i;
const NUMERICAL_RE = /\b\d+(?:\.\d+)?\s*(?:m\/s|m|s|kg|n|j|v|a|mol|cm|mm|hz|pa|kwh|%|degree|°)\b/i;
const MULTI_STEP_RE = /\b(?:hence|therefore|first|then|after that|using|substitute|derive|two-step|multi-step)\b/i;
const HARD_RE = /\b(?:advanced|hard|difficult|challenge|olympiad|multi-step|assertion|reason|case based)\b/i;

function lines(text: string): string[] {
  return text.split(/\n+/).map(line => line.trim()).filter(Boolean);
}

function countMatching(items: string[], regex: RegExp): number {
  return items.filter(item => regex.test(item)).length;
}

function uniqueTopics(items: string[]): string[] {
  const topics = new Set<string>();
  for (const item of items) {
    const heading = item
      .replace(/^#+\s*/, '')
      .replace(/^\d+(?:\.\d+)*[\).:-]\s*/, '')
      .trim();
    if (
      heading.length >= 4 &&
      heading.length <= 80 &&
      /^[A-Z][A-Za-z0-9\s,()/-]+$/.test(heading) &&
      !QUESTION_RE.test(heading)
    ) {
      topics.add(heading);
    }
  }
  return Array.from(topics).slice(0, 24);
}

function inferQuestionStyle(questionLines: string[], allText: string, counts: MaterialStudyAnalysis['counts']): QuestionBankStyleFingerprint | null {
  if (counts.questions === 0) return null;

  const averageQuestionLength = Math.round(
    questionLines.reduce((sum, item) => sum + item.length, 0) / Math.max(1, questionLines.length)
  );
  const numerical = countMatching(questionLines, NUMERICAL_RE);
  const multiStep = countMatching(questionLines, MULTI_STEP_RE);
  const conceptual = Math.max(0, questionLines.length - numerical);

  const conceptualVsNumerical =
    numerical === 0 ? 'mostly_conceptual'
      : conceptual === 0 ? 'mostly_numerical'
        : Math.abs(conceptual - numerical) <= Math.max(2, questionLines.length * 0.2) ? 'mixed'
          : conceptual > numerical ? 'mostly_conceptual' : 'mostly_numerical';

  const directVsMultiStep =
    multiStep === 0 ? 'direct'
      : multiStep >= questionLines.length * 0.45 ? 'multi_step'
        : 'mixed';

  const difficultyLevel =
    HARD_RE.test(allText) || multiStep >= 5 ? 'hard'
      : counts.questions >= 20 || numerical >= 5 ? 'medium'
        : 'introductory';

  const commonTraps = [
    /sign|direction|negative|positive/i.test(allText) ? 'sign or direction convention' : null,
    /unit|dimension/i.test(allText) ? 'unit or dimension mismatch' : null,
    /component|resolve|horizontal|vertical/i.test(allText) ? 'component separation' : null,
    /graph|slope|area/i.test(allText) ? 'graph interpretation' : null,
  ].filter(Boolean) as string[];

  return {
    averageQuestionLength,
    conceptualVsNumerical,
    directVsMultiStep,
    formulaHeavy: counts.formulas >= Math.max(3, counts.questions * 0.25),
    difficultyLevel,
    commonTraps,
    answerPattern: counts.mcqOptions >= Math.max(4, counts.questions) ? 'mcq' : counts.mcqOptions > 0 ? 'mixed' : 'short_answer',
  };
}

export function analyzeMaterialText(text: string): MaterialStudyAnalysis {
  const trimmed = text.trim();
  const textLines = lines(trimmed);
  const questionLines = textLines.filter(line => QUESTION_RE.test(line));
  const topics = uniqueTopics(textLines);

  const counts = {
    topics: topics.length,
    questions: questionLines.length,
    examples: countMatching(textLines, EXAMPLE_RE),
    solvedExamples: countMatching(textLines, SOLVED_EXAMPLE_RE),
    formulas: countMatching(textLines, FORMULA_RE),
    definitions: countMatching(textLines, DEFINITION_RE),
    answerKeys: ANSWER_KEY_RE.test(trimmed) ? 1 : 0,
    mcqOptions: countMatching(textLines, OPTION_RE),
  };

  const questionBankStyle = inferQuestionStyle(questionLines, trimmed, counts);
  const sourceType: MaterialSourceType =
    counts.questions >= 12 || counts.mcqOptions >= 12 || counts.answerKeys > 0 ? 'question_bank'
      : counts.questions >= 4 && (counts.examples > 0 || counts.formulas > 0) ? 'mixed'
        : /slide|ppt|deck/i.test(trimmed) ? 'slides'
          : /transcript|speaker|lecture recording/i.test(trimmed) ? 'transcript'
            : counts.definitions >= 4 || counts.formulas >= 4 ? 'notes'
              : trimmed.length > 0 ? 'textbook'
                : 'unknown';

  const warnings: string[] = [];
  if (trimmed.length === 0) warnings.push('No readable text extracted.');
  if (trimmed.length > 0 && trimmed.length < 800) warnings.push('Text extraction looks partial.');
  if (sourceType === 'question_bank' && counts.answerKeys === 0) warnings.push('Question bank detected, but no answer key was found.');

  return {
    sourceType,
    topics,
    counts,
    textExtraction: trimmed.length === 0 ? 'none' : trimmed.length < 800 ? 'partial' : 'usable',
    difficultyEstimate: questionBankStyle?.difficultyLevel ?? 'unknown',
    questionBankStyle,
    warnings,
  };
}

export function materialStudyStats(material: any): MaterialStudyAnalysis {
  const analysis = material?.material_analysis ?? material?.source_guide?.studyAnalysis;
  if (analysis?.counts) return analysis as MaterialStudyAnalysis;

  const chunkCount = Number(material?.chunk_count ?? material?.study_material_chunks?.[0]?.count ?? 0);
  const topicSeeds = [material?.topic, material?.chapter, material?.detected_chapter, material?.subject, material?.detected_subject]
    .filter(Boolean)
    .map(String);

  return {
    sourceType: normalizeSourceType(material?.source_type, chunkCount),
    topics: Array.from(new Set(topicSeeds)).slice(0, 8),
    counts: {
      topics: topicSeeds.length,
      questions: 0,
      examples: 0,
      solvedExamples: 0,
      formulas: 0,
      definitions: 0,
      answerKeys: 0,
      mcqOptions: 0,
    },
    textExtraction: chunkCount > 0 ? 'usable' : material?.status === 'ready' ? 'partial' : 'none',
    difficultyEstimate: 'unknown',
    questionBankStyle: null,
    warnings: chunkCount > 0 ? [] : ['Extraction details are still being prepared.'],
  };
}

function normalizeSourceType(sourceType: string | null | undefined, chunkCount: number): MaterialSourceType {
  if (sourceType === 'pyq' || sourceType === 'question_bank') return 'question_bank';
  if (sourceType === 'notes') return 'notes';
  if (sourceType === 'textbook' || sourceType === 'ncert') return 'textbook';
  if (sourceType === 'assignment') return 'assignment';
  return chunkCount > 0 ? 'mixed' : 'unknown';
}
