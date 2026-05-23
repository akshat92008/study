// ============================================
// EXAM CURRICULUM REGISTRY
// Supports multiple exam types. Add new exams here.
// ============================================

export type ExamKey = string;

export interface ExamConfig {
  name: string;
  totalMarks: number;
  totalQuestions: number;
  correctMarks: number;
  negativeMarks: number;
  durationMinutes: number;
  subjects: string[];
  chapters: Record<string, string[]>;
}

// --- NEET ---
const NEET_CONFIG: ExamConfig = {
  name: 'NEET',
  totalMarks: 720,
  totalQuestions: 200,
  correctMarks: 4,
  negativeMarks: -1,
  durationMinutes: 200,
  subjects: ['Physics', 'Chemistry', 'Biology'],
  chapters: {
    Physics: [
      'Physical World and Measurement', 'Kinematics', 'Laws of Motion',
      'Work, Energy and Power', 'Motion of System of Particles and Rigid Body',
      'Gravitation', 'Properties of Bulk Matter', 'Thermodynamics',
      'Behaviour of Perfect Gas and Kinetic Theory', 'Oscillations and Waves',
      'Electrostatics', 'Current Electricity',
      'Magnetic Effects of Current and Magnetism',
      'Electromagnetic Induction and Alternating Currents',
      'Electromagnetic Waves', 'Optics', 'Dual Nature of Matter and Radiation',
      'Atoms and Nuclei', 'Electronic Devices',
    ],
    Chemistry: [
      'Some Basic Concepts of Chemistry', 'Structure of Atom',
      'Classification of Elements and Periodicity',
      'Chemical Bonding and Molecular Structure', 'States of Matter',
      'Thermodynamics', 'Equilibrium', 'Redox Reactions', 'Hydrogen',
      'The s-Block Elements', 'The p-Block Elements',
      'Organic Chemistry Basic Principles', 'Hydrocarbons',
      'Environmental Chemistry', 'The Solid State', 'Solutions',
      'Electrochemistry', 'Chemical Kinetics', 'Surface Chemistry',
      'Coordination Compounds', 'Haloalkanes and Haloarenes',
      'Alcohols, Phenols and Ethers',
      'Aldehydes, Ketones and Carboxylic Acids', 'Amines',
      'Biomolecules', 'Polymers', 'Chemistry in Everyday Life',
    ],
    Biology: [
      'The Living World', 'Biological Classification', 'Plant Kingdom',
      'Animal Kingdom', 'Morphology of Flowering Plants',
      'Anatomy of Flowering Plants', 'Structural Organisation in Animals',
      'Cell: The Unit of Life', 'Biomolecules', 'Cell Cycle and Cell Division',
      'Transport in Plants', 'Mineral Nutrition',
      'Photosynthesis in Higher Plants', 'Respiration in Plants',
      'Plant Growth and Development', 'Digestion and Absorption',
      'Breathing and Exchange of Gases', 'Body Fluids and Circulation',
      'Excretory Products and Their Elimination', 'Locomotion and Movement',
      'Neural Control and Coordination',
      'Chemical Coordination and Integration', 'Reproduction in Organisms',
      'Sexual Reproduction in Flowering Plants', 'Human Reproduction',
      'Reproductive Health', 'Principles of Inheritance and Variation',
      'Molecular Basis of Inheritance', 'Evolution',
      'Human Health and Disease',
      'Strategies for Enhancement in Food Production',
      'Microbes in Human Welfare', 'Biotechnology Principles and Processes',
      'Biotechnology and its Applications', 'Organisms and Populations',
      'Ecosystem', 'Biodiversity and Conservation', 'Environmental Issues',
    ],
  },
};

// --- JEE ---
const JEE_CONFIG: ExamConfig = {
  name: 'JEE',
  totalMarks: 300,
  totalQuestions: 90,
  correctMarks: 4,
  negativeMarks: -1,
  durationMinutes: 180,
  subjects: ['Physics', 'Chemistry', 'Mathematics'],
  chapters: {
    Physics: [
      'Mechanics', 'Thermodynamics', 'Electrostatics', 'Current Electricity',
      'Magnetism', 'Optics', 'Modern Physics', 'Waves', 'Fluid Mechanics',
      'Electromagnetic Induction',
    ],
    Chemistry: [
      'Atomic Structure', 'Chemical Bonding', 'Thermodynamics', 'Equilibrium',
      'Organic Chemistry', 'Coordination Chemistry', 'Electrochemistry',
      'Chemical Kinetics', 'Solutions', 'Periodic Table',
    ],
    Mathematics: [
      'Algebra', 'Calculus', 'Coordinate Geometry', 'Trigonometry',
      'Vectors and 3D Geometry', 'Probability and Statistics',
      'Matrices and Determinants', 'Differential Equations',
      'Sequences and Series', 'Complex Numbers',
    ],
  },
};

// --- SAT ---
const SAT_CONFIG: ExamConfig = {
  name: 'SAT',
  totalMarks: 1600,
  totalQuestions: 154,
  correctMarks: 1,
  negativeMarks: 0,
  durationMinutes: 134,
  subjects: ['Reading & Writing', 'Mathematics'],
  chapters: {
    'Reading & Writing': [
      'Craft and Structure', 'Information and Ideas',
      'Standard English Conventions', 'Expression of Ideas',
    ],
    Mathematics: [
      'Algebra', 'Advanced Math', 'Problem Solving and Data Analysis',
      'Geometry and Trigonometry',
    ],
  },
};

// --- UPSC ---
const UPSC_CONFIG: ExamConfig = {
  name: 'UPSC',
  totalMarks: 200,
  totalQuestions: 100,
  correctMarks: 2,
  negativeMarks: -0.66,
  durationMinutes: 120,
  subjects: ['General Studies', 'CSAT'],
  chapters: {
    'General Studies': [
      'Indian Polity', 'Indian History', 'Geography', 'Economy',
      'Environment', 'Science and Technology', 'Current Affairs',
      'International Relations', 'Art and Culture',
    ],
    CSAT: [
      'Comprehension', 'Logical Reasoning', 'Analytical Ability',
      'Decision Making', 'Basic Numeracy', 'Data Interpretation',
    ],
  },
};

// --- CUSTOM (Generic Learner) ---
const CUSTOM_CONFIG: ExamConfig = {
  name: 'General Learning',
  totalMarks: 100,
  totalQuestions: 50,
  correctMarks: 2,
  negativeMarks: 0,
  durationMinutes: 60,
  subjects: ['My Subject'],
  chapters: {
    'My Subject': ['Chapter 1', 'Chapter 2', 'Chapter 3'],
  },
};

// ============================================
// REGISTRY — single source of truth
// ============================================
export const EXAM_REGISTRY: Record<string, ExamConfig> = {
  NEET: NEET_CONFIG,
  JEE: JEE_CONFIG,
  SAT: SAT_CONFIG,
  UPSC: UPSC_CONFIG,
  CUSTOM: CUSTOM_CONFIG,
};

// Helper to get config for any exam (falls back to CUSTOM)
export function getExamConfig(examType: string): ExamConfig {
  if (!examType) return CUSTOM_CONFIG;
  const normalized = examType.toUpperCase().trim();
  if (normalized === 'RENEET' || normalized === 'RE-NEET' || normalized.includes('NEET')) {
    return EXAM_REGISTRY.NEET;
  }
  if (normalized.includes('JEE')) {
    return EXAM_REGISTRY.JEE;
  }
  if (normalized.includes('SAT')) {
    return EXAM_REGISTRY.SAT;
  }
  if (normalized.includes('UPSC')) {
    return EXAM_REGISTRY.UPSC;
  }
  return EXAM_REGISTRY[normalized] || CUSTOM_CONFIG;
}

// Helper to get subjects for an exam
export function getSubjects(examType: string): string[] {
  return getExamConfig(examType).subjects;
}

// Helper to get chapters for an exam
export function getChapters(examType: string): Record<string, string[]> {
  return getExamConfig(examType).chapters;
}

// ============================================
// BACKWARD COMPAT — keep old names as aliases
// ============================================
export const NEET_SUBJECTS = NEET_CONFIG.subjects;
export const NEET_CHAPTERS = NEET_CONFIG.chapters;
export const NEET_TOTAL_QUESTIONS = NEET_CONFIG.totalQuestions;
export const NEET_TOTAL_MARKS = NEET_CONFIG.totalMarks;
export const NEET_CORRECT_MARKS = NEET_CONFIG.correctMarks;
export const NEET_NEGATIVE_MARKS = NEET_CONFIG.negativeMarks;
export const NEET_EXAM_DURATION_MINUTES = NEET_CONFIG.durationMinutes;

// Mastery thresholds
export const MASTERY_THRESHOLDS = {
  not_started: 0,
  exposed: 15,
  developing: 40,
  proficient: 70,
  mastered: 90,
  automated: 98,
} as const;

// Study session defaults
export const FOCUS_BLOCK_MINUTES = 45;
export const BREAK_MINUTES = 10;
export const DAILY_STUDY_TARGET_HOURS = 8;

// App theme colors (matching CSS variables)
export const THEME = {
  primary: 'hsl(220, 90%, 56%)',
  success: 'hsl(142, 71%, 45%)',
  warning: 'hsl(38, 92%, 50%)',
  danger: 'hsl(0, 84%, 60%)',
  info: 'hsl(199, 89%, 48%)',
} as const;
