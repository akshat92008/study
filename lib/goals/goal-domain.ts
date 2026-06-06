export type GoalDomain = {
  rawGoal: string;
  normalizedGoal: string;
  subject: string | null;
  domain: string | null;
  exam: string | null;
  grade: string | null;
  board: string | null;
  confidence: number;
  needsClarification: boolean;
  clarificationQuestion: string | null;
};

type GoalDomainInput = {
  subject?: string | null;
  domain?: string | null;
  exam?: string | null;
  grade?: string | null;
  board?: string | null;
};

function normalize(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCase(value: string | null): string | null {
  if (!value) return value;
  return value
    .split(/[ _\-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function inferGoalDomain(rawGoal: string, explicit: GoalDomainInput = {}): GoalDomain {
  const normalizedGoal = normalize(rawGoal);
  const tokens = new Set(normalizedGoal.split(' ').filter(Boolean));
  const explicitSubject = normalize(explicit.subject);
  const explicitDomain = normalize(explicit.domain);
  const explicitExam = normalize(explicit.exam);
  const explicitGrade = normalize(explicit.grade);
  const explicitBoard = normalize(explicit.board);

  let subject: string | null = explicitSubject || null;
  let domain: string | null = explicitDomain || null;
  let exam: string | null = explicitExam || null;
  let grade: string | null = explicitGrade || null;
  let board: string | null = explicitBoard || null;
  let confidence = explicitSubject || explicitDomain || explicitExam ? 0.82 : 0.2;

  // Generic rejection list
  const genericTerms = [
    'study', 'learn', 'prepare', 'revise', 'practice', 'exam', 'test', 'chapter',
    'subject', 'create goal', 'create a goal', 'goal', 'something', 'improve'
  ];
  const isGeneric = genericTerms.some(term => normalizedGoal === term || normalizedGoal === `learn ${term}` || normalizedGoal === `study ${term}`);

  if (!exam && /\bneet\b/.test(normalizedGoal)) {
    exam = 'neet';
    domain = domain ?? 'medical_exam';
    confidence += 0.22;
  }

  if (!exam && /\bjee\b/.test(normalizedGoal)) {
    exam = 'jee';
    domain = domain ?? 'engineering_exam';
    confidence += 0.22;
  }

  const gradeMatch = normalizedGoal.match(/\b(?:class|grade|std|standard)\s*(\d{1,2})\b/);
  if (!grade && gradeMatch) {
    grade = `class_${gradeMatch[1]}`;
    confidence += 0.18;
  }

  if (!board) {
    if (tokens.has('cbse')) board = 'cbse';
    else if (tokens.has('icse')) board = 'icse';
    else if (tokens.has('state')) board = 'state_board';
  }
  if (board) confidence += 0.05;

  const scienceSubjects = ['physics', 'chemistry', 'biology', 'math', 'mathematics'];
  const humanitiesSubjects = ['history', 'geography', 'civics', 'economics', 'political science'];
  const programmingSubjects = [
    ['react', /\breact(?:\.js|js)?\b/],
    ['javascript', /\b(java ?script|js)\b/],
    ['python', /\bpython\b/],
    ['programming', /\b(coding|programming|software|web development)\b/],
  ] as const;

  // Specific Science Topic Mapping
  const physicsTopics = /\b(kinematics|thermodynamics|optics|electrostatics|magnetism|fluids?|mechanics|ray optics|wave optics|units|measurement|motion|gravitation|solids?|waves|current|induction|atoms|nuclei|semiconductors)\b/i;
  const chemistryTopics = /\b(solutions?|electrochemistry|bonding|periodicity|equilibrium|kinetics|thermodynamics|organic|inorganic|hydrocarbons|biomolecules|polymers|atoms|moles|redox|block|coordination)\b/i;
  const biologyTopics = /\b(cells?|genetics|evolution|reproduction|physiology|diversity|biotechnology|ecology|human health|microbes|plants|animals)\b/i;

  if (!subject) {
    if (physicsTopics.test(normalizedGoal)) subject = 'physics';
    else if (chemistryTopics.test(normalizedGoal)) subject = 'chemistry';
    else if (biologyTopics.test(normalizedGoal)) subject = 'biology';
    
    if (subject) {
      domain = domain ?? (exam === 'neet' ? 'medical_exam' : 'school_science');
      confidence += 0.45;
    }
  }

  if (!subject) {
    const scienceMatch = scienceSubjects.find((candidate) => tokens.has(candidate));
    if (scienceMatch) {
      subject = scienceMatch === 'mathematics' ? 'math' : scienceMatch;
      domain = domain ?? (exam === 'neet' ? 'medical_exam' : 'school_science');
      confidence += 0.3;
    }
  }

  if (!subject) {
    const humanitiesMatch = humanitiesSubjects.find((candidate) => normalizedGoal.includes(candidate));
    if (humanitiesMatch) {
      subject = humanitiesMatch;
      domain = domain ?? 'school_humanities';
      confidence += 0.35;
    }
  }

  if (!subject) {
    const programmingMatch = programmingSubjects.find(([, pattern]) => pattern.test(normalizedGoal));
    if (programmingMatch) {
      subject = programmingMatch[0];
      domain = domain ?? 'programming';
      confidence += 0.36;
    }
  }

  if (!domain && subject) {
    domain = scienceSubjects.includes(subject) ? 'school_science' : null;
  }

  // A goal is vague if it's too short, is in the generic list, or has no subject/domain/exam identified
  const vague = isGeneric 
    || normalizedGoal.length < 3
    || (!subject && !domain && !exam && normalizedGoal.split(' ').length < 2);

  const needsClarification = vague || confidence < 0.4;

  return {
    rawGoal,
    normalizedGoal,
    subject,
    domain,
    exam,
    grade,
    board,
    confidence: Math.min(0.99, Number(confidence.toFixed(2))),
    needsClarification,
    clarificationQuestion: needsClarification ? 'What subject, exam, or class should this goal focus on? (e.g. Physics, NEET Biology, or Class 10 Math)' : null,
  };
}

export function formatGoalDomainLabel(domain: GoalDomain): string {
  return [
    titleCase(domain.subject),
    domain.grade?.replace('_', ' '),
    domain.exam?.toUpperCase(),
  ].filter(Boolean).join(' · ');
}
