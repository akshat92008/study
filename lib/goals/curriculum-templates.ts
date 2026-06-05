import { GoalDomain, GoalDomainType } from "./goal-domain";

export type CurriculumNode = {
  title: string;
  description?: string;
  subject?: string | null;
  chapter?: string | null;
  unit?: string | null;
  orderIndex: number;
  estimatedMinutes?: number;
  source: "template" | "ai_generated" | "fallback";
};

export type CurriculumTemplate = {
  id: string;
  match: {
    subject?: string | null;
    exam?: string | null;
    grade?: string | null;
    domain?: GoalDomainType;
  };
  title: string;
  nodes: CurriculumNode[];
};

export const STARTER_TEMPLATES: CurriculumTemplate[] = [
  {
    id: "template_class_12_physics",
    title: "Class 12 Physics Starter",
    match: {
      subject: "physics",
      grade: "class_12",
      domain: "school_science",
    },
    nodes: [
      { orderIndex: 1, title: "Electric Charges and Fields", chapter: "Electric Charges and Fields", source: "template", estimatedMinutes: 60, subject: "physics" },
      { orderIndex: 2, title: "Electrostatic Potential and Capacitance", chapter: "Electrostatic Potential and Capacitance", source: "template", estimatedMinutes: 60, subject: "physics" },
      { orderIndex: 3, title: "Current Electricity", chapter: "Current Electricity", source: "template", estimatedMinutes: 90, subject: "physics" },
      { orderIndex: 4, title: "Moving Charges and Magnetism", chapter: "Moving Charges and Magnetism", source: "template", estimatedMinutes: 90, subject: "physics" },
      { orderIndex: 5, title: "Magnetism and Matter", chapter: "Magnetism and Matter", source: "template", estimatedMinutes: 45, subject: "physics" }
    ]
  },
  {
    id: "template_class_10_history",
    title: "Class 10 History Starter",
    match: {
      subject: "history",
      grade: "class_10",
      domain: "school_humanities",
    },
    nodes: [
      { orderIndex: 1, title: "The Rise of Nationalism in Europe", chapter: "The Rise of Nationalism in Europe", source: "template", estimatedMinutes: 60, subject: "history" },
      { orderIndex: 2, title: "Nationalism in India", chapter: "Nationalism in India", source: "template", estimatedMinutes: 90, subject: "history" },
      { orderIndex: 3, title: "The Making of a Global World", chapter: "The Making of a Global World", source: "template", estimatedMinutes: 60, subject: "history" },
      { orderIndex: 4, title: "The Age of Industrialisation", chapter: "The Age of Industrialisation", source: "template", estimatedMinutes: 60, subject: "history" },
      { orderIndex: 5, title: "Print Culture and the Modern World", chapter: "Print Culture and the Modern World", source: "template", estimatedMinutes: 60, subject: "history" }
    ]
  },
  {
    id: "template_neet_mixed",
    title: "NEET Starter Curriculum",
    match: {
      exam: "neet",
      domain: "competitive_exam",
      subject: "mixed"
    },
    nodes: [
      { orderIndex: 1, title: "Biology: Diversity in Living World", chapter: "The Living World", source: "template", estimatedMinutes: 45, subject: "biology" },
      { orderIndex: 2, title: "Physics: Physical World and Measurement", chapter: "Physical World", source: "template", estimatedMinutes: 45, subject: "physics" },
      { orderIndex: 3, title: "Chemistry: Some Basic Concepts", chapter: "Basic Concepts of Chemistry", source: "template", estimatedMinutes: 60, subject: "chemistry" },
      { orderIndex: 4, title: "Biology: Structural Organisation", chapter: "Structural Organisation in Animals and Plants", source: "template", estimatedMinutes: 60, subject: "biology" },
      { orderIndex: 5, title: "Physics: Kinematics", chapter: "Kinematics", source: "template", estimatedMinutes: 90, subject: "physics" }
    ]
  },
  {
    id: "template_react_beginner",
    title: "React JS Beginner",
    match: {
      subject: "react",
      domain: "programming"
    },
    nodes: [
      { orderIndex: 1, title: "React Fundamentals: Components & JSX", chapter: "Fundamentals", source: "template", estimatedMinutes: 60, subject: "react" },
      { orderIndex: 2, title: "State & Props", chapter: "State Management", source: "template", estimatedMinutes: 60, subject: "react" },
      { orderIndex: 3, title: "React Hooks: useState & useEffect", chapter: "Hooks", source: "template", estimatedMinutes: 90, subject: "react" },
      { orderIndex: 4, title: "Handling Events & Forms", chapter: "Interactivity", source: "template", estimatedMinutes: 60, subject: "react" },
      { orderIndex: 5, title: "Component Lifecycle & Context API", chapter: "Advanced Fundamentals", source: "template", estimatedMinutes: 90, subject: "react" }
    ]
  },
  {
    id: "template_upsc_polity",
    title: "UPSC Polity",
    match: {
      subject: "polity",
      exam: "upsc",
      domain: "competitive_exam"
    },
    nodes: [
      { orderIndex: 1, title: "Historical Background", chapter: "Constitutional Framework", source: "template", estimatedMinutes: 60, subject: "polity" },
      { orderIndex: 2, title: "Making of the Constitution", chapter: "Constitutional Framework", source: "template", estimatedMinutes: 45, subject: "polity" },
      { orderIndex: 3, title: "Salient Features of the Constitution", chapter: "Constitutional Framework", source: "template", estimatedMinutes: 60, subject: "polity" },
      { orderIndex: 4, title: "Preamble of the Constitution", chapter: "Constitutional Framework", source: "template", estimatedMinutes: 45, subject: "polity" },
      { orderIndex: 5, title: "Union and its Territory", chapter: "Constitutional Framework", source: "template", estimatedMinutes: 45, subject: "polity" }
    ]
  },
  {
    id: "template_programming_beginner",
    title: "Programming Beginner",
    match: {
      domain: "programming"
    },
    nodes: [
      { orderIndex: 1, title: "Variables and Data Types", chapter: "Basics", source: "template", estimatedMinutes: 45 },
      { orderIndex: 2, title: "Control Flow (If/Else, Loops)", chapter: "Control Flow", source: "template", estimatedMinutes: 60 },
      { orderIndex: 3, title: "Functions and Scope", chapter: "Functions", source: "template", estimatedMinutes: 60 },
      { orderIndex: 4, title: "Data Structures (Arrays/Lists, Objects/Dictionaries)", chapter: "Data Structures", source: "template", estimatedMinutes: 90 },
      { orderIndex: 5, title: "Error Handling and Debugging", chapter: "Debugging", source: "template", estimatedMinutes: 45 }
    ]
  },
  {
    id: "template_language_beginner",
    title: "Language Learning Beginner",
    match: {
      domain: "language_learning"
    },
    nodes: [
      { orderIndex: 1, title: "Greetings and Basic Introductions", chapter: "Basics", source: "template", estimatedMinutes: 30 },
      { orderIndex: 2, title: "Alphabet and Pronunciation", chapter: "Phonetics", source: "template", estimatedMinutes: 45 },
      { orderIndex: 3, title: "Numbers, Days, and Months", chapter: "Vocabulary", source: "template", estimatedMinutes: 45 },
      { orderIndex: 4, title: "Basic Sentence Structure (Subject-Verb-Object)", chapter: "Grammar", source: "template", estimatedMinutes: 60 },
      { orderIndex: 5, title: "Common Verbs and Simple Present Tense", chapter: "Grammar", source: "template", estimatedMinutes: 60 }
    ]
  }
];

export function findCurriculumTemplate(domain: GoalDomain): CurriculumTemplate | null {
  if (domain.needsClarification) {
    return null; // Never return subject-specific templates for vague goals
  }

  let bestMatch: CurriculumTemplate | null = null;
  let bestScore = -1;

  for (const template of STARTER_TEMPLATES) {
    let score = 0;
    const match = template.match;

    // Reject mismatching domains
    if (match.domain && match.domain !== domain.domain) continue;
    
    // Exact subject match is a huge boost, but mismatching subject is a hard reject
    if (match.subject) {
        if (domain.subject === match.subject) score += 100;
        else continue; // Never return Chemistry for Physics goal, etc.
    } else if (domain.subject && match.domain !== "programming" && match.domain !== "language_learning") {
        // If template doesn't specify a subject but user has one, prefer not to use it unless it's a generic template type
        score -= 50; 
    }

    if (match.exam) {
        if (domain.exam === match.exam) score += 50;
        else continue; 
    }

    if (match.grade) {
        if (domain.grade === match.grade) score += 50;
        else continue;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = template;
    }
  }

  return bestScore >= 0 ? bestMatch : null;
}
