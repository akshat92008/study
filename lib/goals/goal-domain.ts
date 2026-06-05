export type GoalDomainType =
  | "school_science"
  | "school_humanities"
  | "school_commerce"
  | "competitive_exam"
  | "programming"
  | "language_learning"
  | "professional_certification"
  | "general_learning"
  | "unknown";

export type GoalDomain = {
  rawGoal: string;
  normalizedGoal: string;
  subject: string | null;
  domain: GoalDomainType;
  exam: string | null;
  grade: string | null;
  board: string | null;
  targetOutcome: string | null;
  confidence: number;
  needsClarification: boolean;
  clarificationQuestion?: string;
};

// Keyword dictionaries
const SCHOOL_SCIENCE_KEYWORDS = ['physics', 'chemistry', 'biology', 'maths', 'mathematics', 'science'];
const HUMANITIES_KEYWORDS = ['history', 'geography', 'civics', 'political science', 'polity', 'economics', 'sociology'];
const COMMERCE_KEYWORDS = ['accountancy', 'business studies', 'commerce', 'finance', 'economics'];
const EXAM_KEYWORDS = ['neet', 'jee', 'upsc', 'sat', 'act', 'mcat', 'cfa', 'ca', 'clat', 'gate'];
const PROGRAMMING_KEYWORDS = ['react', 'javascript', 'python', 'sql', 'dsa', 'web development', 'machine learning', 'coding', 'programming'];
const LANGUAGE_KEYWORDS = ['french', 'spanish', 'german', 'japanese', 'korean', 'english'];
const PROFESSIONAL_KEYWORDS = ['cfa', 'frm', 'pmp', 'ca', 'acca'];

const GRADE_REGEX = /(?:class|grade|standard|std)\s*(\d+)/i;

export function inferGoalDomain(rawGoal: string): GoalDomain {
  const normalizedGoal = rawGoal.toLowerCase().replace(/\s+/g, ' ').trim();
  
  let subject: string | null = null;
  let domain: GoalDomainType = 'unknown';
  let exam: string | null = null;
  let grade: string | null = null;
  let targetOutcome: string | null = null;
  let confidence = 0.0;
  
  // Grade matching
  const gradeMatch = normalizedGoal.match(GRADE_REGEX);
  if (gradeMatch) {
    grade = `class_${gradeMatch[1]}`;
  }

  // Detect Exams
  for (const keyword of EXAM_KEYWORDS) {
    if (normalizedGoal.includes(keyword)) {
      exam = keyword;
      domain = 'competitive_exam';
      confidence += 0.5;
      break;
    }
  }

  // Detect Professional Certifications (override exam if applicable)
  for (const keyword of PROFESSIONAL_KEYWORDS) {
    if (normalizedGoal.includes(keyword)) {
      exam = keyword.includes('cfa') && normalizedGoal.includes('level') 
        ? (normalizedGoal.match(/cfa\s*level\s*\d/)?.[0]?.replace(/\s+/g, '_') || keyword)
        : keyword;
      domain = 'professional_certification';
      confidence += 0.5;
      break;
    }
  }

  // Detect Programming
  for (const keyword of PROGRAMMING_KEYWORDS) {
    if (normalizedGoal.includes(keyword)) {
      subject = keyword;
      domain = 'programming';
      confidence += 0.6;
      break;
    }
  }

  // Detect Languages
  for (const keyword of LANGUAGE_KEYWORDS) {
    if (normalizedGoal.includes(keyword)) {
      subject = keyword;
      domain = 'language_learning';
      confidence += 0.6;
      break;
    }
  }

  // Detect School Science
  for (const keyword of SCHOOL_SCIENCE_KEYWORDS) {
    if (normalizedGoal.includes(keyword)) {
      subject = keyword;
      // Don't override if it's already an exam unless it's just science
      if (domain === 'unknown' || (domain === 'competitive_exam' && confidence < 0.6)) {
        if (domain === 'unknown') domain = 'school_science';
      }
      confidence += 0.5;
      break;
    }
  }

  // Detect Humanities
  for (const keyword of HUMANITIES_KEYWORDS) {
    if (normalizedGoal.includes(keyword)) {
      subject = keyword;
      if (domain === 'unknown') domain = 'school_humanities';
      confidence += 0.5;
      break;
    }
  }

  // Detect Commerce
  for (const keyword of COMMERCE_KEYWORDS) {
    if (normalizedGoal.includes(keyword) && domain === 'unknown') {
      subject = keyword;
      domain = 'school_commerce';
      confidence += 0.5;
      break;
    }
  }

  // Handle specific overrides for subject + exam combinations
  if (exam === 'neet' && !subject) {
    subject = 'mixed';
  }
  
  if (normalizedGoal.includes('upsc polity')) {
    subject = 'polity';
    exam = 'upsc';
    domain = 'competitive_exam';
    confidence = 1.0;
  } else if (normalizedGoal.includes('cfa') && normalizedGoal.includes('quant')) {
    subject = 'quantitative methods';
    confidence = 1.0;
  }

  // Resolve confidence ceiling
  confidence = Math.min(confidence, 1.0);

  // Needs Clarification logic
  let needsClarification = false;
  let clarificationQuestion: string | undefined = undefined;

  if (domain === 'unknown' || confidence < 0.4) {
    if (normalizedGoal === 'i want to study better' || normalizedGoal.includes('study better')) {
       domain = 'general_learning';
    }
    needsClarification = true;
    clarificationQuestion = "What are you trying to study — a school subject, exam, skill, language, or professional course?";
  }

  return {
    rawGoal,
    normalizedGoal,
    subject,
    domain,
    exam,
    grade,
    board: null,
    targetOutcome,
    confidence,
    needsClarification,
    clarificationQuestion,
  };
}
