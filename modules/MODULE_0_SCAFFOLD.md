# MODULE 0: Project Scaffold

## AI BUILDER PROMPT

```
You are a senior full-stack engineer. Initialize the Cognition OS project exactly as specified below.
Do NOT deviate from the tech stack or file structure. Follow every step in order.
After each step, confirm completion before moving to the next.
```

---

## STEP 1: Initialize Next.js Project

Run this exact command in the `/Users/ashishsingh/Desktop/neetapp` directory:

```bash
npx -y create-next-app@latest ./ --typescript --eslint --app --src-dir=false --import-alias="@/*" --turbopack --no-tailwind
```

When prompted, accept all defaults. This creates a Next.js 15 project with:
- TypeScript
- App Router
- No Tailwind (we use vanilla CSS)
- `@/*` import alias

---

## STEP 2: Install All Dependencies

Run this single command:

```bash
npm install @supabase/supabase-js @supabase/ssr @google/genai ts-fsrs drizzle-orm zustand recharts react-markdown remark-math rehype-katex lucide-react framer-motion

npm install -D drizzle-kit @types/node dotenv
```

### Package Purposes:
| Package | Purpose |
|---------|---------|
| `@supabase/supabase-js` | Supabase client |
| `@supabase/ssr` | Server-side Supabase auth |
| `@google/genai` | Google Gemini AI SDK |
| `ts-fsrs` | FSRS-5 spaced repetition algorithm |
| `drizzle-orm` | Type-safe ORM |
| `zustand` | Client state management |
| `recharts` | Chart components |
| `react-markdown` | Markdown rendering for AI responses |
| `remark-math` + `rehype-katex` | LaTeX math rendering |
| `lucide-react` | Icon library |
| `framer-motion` | Animations |
| `drizzle-kit` | Migration tooling |
| `dotenv` | Environment variables |

---

## STEP 3: Create Environment File

Create `.env.local` at project root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Google Gemini
GEMINI_API_KEY=your_gemini_api_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=Cognition OS
```

---

## STEP 4: Configure TypeScript (tsconfig.json)

Replace the contents of `tsconfig.json` with:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

---

## STEP 5: Configure Next.js (next.config.ts)

Replace `next.config.ts`:

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
};

export default nextConfig;
```

---

## STEP 6: Configure Drizzle (drizzle.config.ts)

Create `drizzle.config.ts` at project root:

```typescript
import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(
      'https://',
      'postgresql://postgres:postgres@'
    ).replace('.supabase.co', '.supabase.co:5432/postgres'),
  },
});
```

---

## STEP 7: Create Supabase Client Files

### File: `lib/supabase/client.ts`

```typescript
'use client';

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### File: `lib/supabase/server.ts`

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}
```

### File: `lib/supabase/middleware.ts`

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protected routes — redirect to login if not authenticated
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/signup') &&
    request.nextUrl.pathname !== '/'
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

### File: `middleware.ts` (project root)

```typescript
import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

---

## STEP 8: Create Gemini AI Client

### File: `lib/ai/gemini.ts`

```typescript
import { GoogleGenAI } from '@google/genai';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

export const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Model references
export const MODELS = {
  // Use Flash for fast, cheap operations (classification, extraction, simple Q&A)
  flash: 'gemini-2.0-flash',
  // Use Pro for complex reasoning (analysis, strategy, mentoring)
  pro: 'gemini-2.5-pro-preview-06-05',
} as const;

// Helper to generate text with a specific model
export async function generateText(
  model: keyof typeof MODELS,
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.7
): Promise<string> {
  const response = await genai.models.generateContent({
    model: MODELS[model],
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      temperature,
      maxOutputTokens: 8192,
    },
  });

  return response.text ?? '';
}

// Helper to generate JSON with a specific model
export async function generateJSON<T>(
  model: keyof typeof MODELS,
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.3
): Promise<T> {
  const response = await genai.models.generateContent({
    model: MODELS[model],
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt + '\n\nRespond ONLY with valid JSON. No markdown, no code fences, no explanation.',
      temperature,
      responseMimeType: 'application/json',
    },
  });

  const text = response.text ?? '{}';
  return JSON.parse(text) as T;
}

// Helper for streaming responses (used in chat interfaces)
export async function* streamText(
  model: keyof typeof MODELS,
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.7
): AsyncGenerator<string> {
  const response = await genai.models.generateContentStream({
    model: MODELS[model],
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      temperature,
      maxOutputTokens: 8192,
    },
  });

  for await (const chunk of response) {
    if (chunk.text) {
      yield chunk.text;
    }
  }
}
```

---

## STEP 9: Create Shared Types

### File: `lib/utils/types.ts`

```typescript
// ============================================
// CORE DOMAIN TYPES
// ============================================

// Exam types the system supports
export type ExamType = 'NEET' | 'JEE' | 'SAT' | 'UPSC' | 'CFA' | 'CUSTOM';

// Subject for NEET (initial beachhead)
export type NEETSubject = 'Physics' | 'Chemistry' | 'Biology';

// Mastery levels for concepts
export type MasteryLevel = 
  | 'not_started'    // Never encountered
  | 'exposed'        // Seen but not understood
  | 'developing'     // Partial understanding
  | 'proficient'     // Can solve standard problems
  | 'mastered'       // Can solve complex problems
  | 'automated';     // Instant recall, no effort

// Confidence levels
export type ConfidenceLevel = 'very_low' | 'low' | 'medium' | 'high' | 'very_high';

// Mistake categories
export type MistakeCategory =
  | 'conceptual'          // Fundamental misunderstanding
  | 'calculation'         // Math/arithmetic error
  | 'silly'              // Careless mistake
  | 'time_pressure'      // Ran out of time
  | 'misread'            // Misread question
  | 'incomplete_knowledge' // Didn't know enough
  | 'overconfidence'     // Thought they knew, didn't
  | 'anxiety'            // Stress-induced error
  | 'recall_failure';    // Knew it but couldn't recall

// Emotional states
export type EmotionalState = 
  | 'focused'
  | 'motivated'
  | 'stressed'
  | 'burnt_out'
  | 'anxious'
  | 'frustrated'
  | 'confident'
  | 'overwhelmed'
  | 'bored'
  | 'neutral';

// ============================================
// COGNITION GRAPH TYPES
// ============================================

export interface ConceptNode {
  id: string;
  name: string;
  subject: string;
  chapter: string;
  topic: string;
  mastery: MasteryLevel;
  confidence: ConfidenceLevel;
  lastReviewed: Date | null;
  timesReviewed: number;
  timesCorrect: number;
  timesIncorrect: number;
  forgettingProbability: number; // 0-1
  retentionStrength: number;    // 0-1
  connections: string[];        // IDs of related concepts
}

export interface CognitionSnapshot {
  userId: string;
  timestamp: Date;
  knowledgeState: {
    totalConcepts: number;
    mastered: number;
    developing: number;
    weak: number;
    notStarted: number;
    overallMastery: number; // 0-100
  };
  behavioralState: {
    consistency: number;       // 0-100
    focusQuality: number;      // 0-100
    procrastinationIndex: number; // 0-100
    burnoutRisk: number;       // 0-100
  };
  memoryState: {
    averageRetention: number;  // 0-100
    conceptsDueForReview: number;
    forgettingRate: number;    // concepts/day
  };
  performanceState: {
    averageScore: number;
    scoreTrajectory: 'improving' | 'declining' | 'plateau';
    predictedScore: number;
    weakSubjects: string[];
  };
  emotionalState: EmotionalState;
}

// ============================================
// MISTAKE INTELLIGENCE TYPES
// ============================================

export interface MistakeRecord {
  id: string;
  userId: string;
  conceptId: string;
  questionId: string | null;
  category: MistakeCategory;
  subject: string;
  chapter: string;
  topic: string;
  description: string;
  marksLost: number;
  totalMarks: number;
  timeSpent: number;        // seconds
  timeAllotted: number;     // seconds
  isRecurring: boolean;
  occurrenceCount: number;
  aiAnalysis: string;       // AI-generated analysis
  improvementSuggestion: string;
  createdAt: Date;
}

export interface MistakePattern {
  category: MistakeCategory;
  frequency: number;
  totalMarksLost: number;
  affectedConcepts: string[];
  trend: 'increasing' | 'decreasing' | 'stable';
  rootCause: string;        // AI-generated
  actionPlan: string;       // AI-generated
}

// ============================================
// REVISION ENGINE TYPES
// ============================================

export interface RevisionCard {
  id: string;
  userId: string;
  conceptId: string;
  front: string;            // Question/prompt
  back: string;             // Answer/explanation
  // FSRS fields
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: number;            // FSRS state (New, Learning, Review, Relearning)
  lastReview: Date | null;
}

export type RevisionRating = 'again' | 'hard' | 'good' | 'easy';

// ============================================
// PLANNER TYPES
// ============================================

export interface StudyTask {
  id: string;
  userId: string;
  title: string;
  description: string;
  type: 'study' | 'revision' | 'practice' | 'mock_test' | 'break' | 'review';
  subject: string;
  chapter: string | null;
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedMinutes: number;
  scheduledDate: Date;
  scheduledStartTime: string; // HH:mm
  isCompleted: boolean;
  completedAt: Date | null;
  focusScore: number | null;  // 0-100
  notes: string | null;
}

export interface DailyPlan {
  date: Date;
  tasks: StudyTask[];
  totalStudyMinutes: number;
  totalBreakMinutes: number;
  focusBlocks: number;
  overallPriority: string;
  aiInsight: string;         // AI-generated daily insight
}

// ============================================
// ANALYTICS TYPES
// ============================================

export interface PerformanceMetrics {
  userId: string;
  period: 'daily' | 'weekly' | 'monthly';
  date: Date;
  studyHours: number;
  conceptsLearned: number;
  conceptsRevised: number;
  questionsAttempted: number;
  questionsCorrect: number;
  accuracy: number;
  averageScore: number;
  streakDays: number;
  focusScore: number;
  productivityScore: number;
  learningVelocity: number;  // concepts per hour
  retentionRate: number;
}

export interface MockTestResult {
  id: string;
  userId: string;
  testName: string;
  totalQuestions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  totalMarks: number;
  marksObtained: number;
  negativeMarks: number;
  timeTaken: number;       // minutes
  totalTime: number;       // minutes
  subjectWise: {
    subject: string;
    correct: number;
    incorrect: number;
    unattempted: number;
    marks: number;
    timeSpent: number;
  }[];
  createdAt: Date;
}

// ============================================
// AI AGENT TYPES
// ============================================

export interface MentorMessage {
  id: string;
  role: 'user' | 'mentor';
  content: string;
  timestamp: Date;
  metadata?: {
    emotionalState?: EmotionalState;
    actionItems?: string[];
    relatedConcepts?: string[];
  };
}

export interface TutorSession {
  id: string;
  userId: string;
  conceptId: string;
  messages: TutorMessage[];
  startedAt: Date;
  endedAt: Date | null;
  cognitiveLevel: 'beginner' | 'intermediate' | 'advanced';
  understandingGained: number; // 0-100
}

export interface TutorMessage {
  id: string;
  role: 'user' | 'tutor';
  content: string;
  timestamp: Date;
  hasLatex: boolean;
  hasImage: boolean;
}
```

---

## STEP 10: Create Constants File

### File: `lib/utils/constants.ts`

```typescript
// NEET-specific constants (initial domain)
export const NEET_SUBJECTS = ['Physics', 'Chemistry', 'Biology'] as const;

export const NEET_CHAPTERS: Record<string, string[]> = {
  Physics: [
    'Physical World and Measurement',
    'Kinematics',
    'Laws of Motion',
    'Work, Energy and Power',
    'Motion of System of Particles and Rigid Body',
    'Gravitation',
    'Properties of Bulk Matter',
    'Thermodynamics',
    'Behaviour of Perfect Gas and Kinetic Theory',
    'Oscillations and Waves',
    'Electrostatics',
    'Current Electricity',
    'Magnetic Effects of Current and Magnetism',
    'Electromagnetic Induction and Alternating Currents',
    'Electromagnetic Waves',
    'Optics',
    'Dual Nature of Matter and Radiation',
    'Atoms and Nuclei',
    'Electronic Devices',
  ],
  Chemistry: [
    'Some Basic Concepts of Chemistry',
    'Structure of Atom',
    'Classification of Elements and Periodicity',
    'Chemical Bonding and Molecular Structure',
    'States of Matter',
    'Thermodynamics',
    'Equilibrium',
    'Redox Reactions',
    'Hydrogen',
    'The s-Block Elements',
    'The p-Block Elements',
    'Organic Chemistry Basic Principles',
    'Hydrocarbons',
    'Environmental Chemistry',
    'The Solid State',
    'Solutions',
    'Electrochemistry',
    'Chemical Kinetics',
    'Surface Chemistry',
    'Coordination Compounds',
    'Haloalkanes and Haloarenes',
    'Alcohols, Phenols and Ethers',
    'Aldehydes, Ketones and Carboxylic Acids',
    'Amines',
    'Biomolecules',
    'Polymers',
    'Chemistry in Everyday Life',
  ],
  Biology: [
    'The Living World',
    'Biological Classification',
    'Plant Kingdom',
    'Animal Kingdom',
    'Morphology of Flowering Plants',
    'Anatomy of Flowering Plants',
    'Structural Organisation in Animals',
    'Cell: The Unit of Life',
    'Biomolecules',
    'Cell Cycle and Cell Division',
    'Transport in Plants',
    'Mineral Nutrition',
    'Photosynthesis in Higher Plants',
    'Respiration in Plants',
    'Plant Growth and Development',
    'Digestion and Absorption',
    'Breathing and Exchange of Gases',
    'Body Fluids and Circulation',
    'Excretory Products and Their Elimination',
    'Locomotion and Movement',
    'Neural Control and Coordination',
    'Chemical Coordination and Integration',
    'Reproduction in Organisms',
    'Sexual Reproduction in Flowering Plants',
    'Human Reproduction',
    'Reproductive Health',
    'Principles of Inheritance and Variation',
    'Molecular Basis of Inheritance',
    'Evolution',
    'Human Health and Disease',
    'Strategies for Enhancement in Food Production',
    'Microbes in Human Welfare',
    'Biotechnology Principles and Processes',
    'Biotechnology and its Applications',
    'Organisms and Populations',
    'Ecosystem',
    'Biodiversity and Conservation',
    'Environmental Issues',
  ],
};

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

// NEET exam constants
export const NEET_TOTAL_QUESTIONS = 200;
export const NEET_TOTAL_MARKS = 720;
export const NEET_CORRECT_MARKS = 4;
export const NEET_NEGATIVE_MARKS = -1;
export const NEET_EXAM_DURATION_MINUTES = 200;

// App theme colors (matching CSS variables)
export const THEME = {
  primary: 'hsl(220, 90%, 56%)',
  success: 'hsl(142, 71%, 45%)',
  warning: 'hsl(38, 92%, 50%)',
  danger: 'hsl(0, 84%, 60%)',
  info: 'hsl(199, 89%, 48%)',
} as const;
```

---

## STEP 11: Clean Up Default Files

Delete or replace these default Next.js files:

1. Delete `app/page.module.css`
2. Replace `app/page.tsx` with a placeholder:

```typescript
export default function Home() {
  return (
    <main>
      <h1>Cognition OS</h1>
      <p>Building...</p>
    </main>
  );
}
```

3. Replace `app/layout.tsx` with:

```typescript
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cognition OS — AI Academic Operating System',
  description: 'An AI-native system that continuously models student cognition, memory, behavior, and performance to autonomously optimize learning outcomes.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
```

---

## VERIFICATION CHECKLIST

Run these commands and confirm they succeed:

```bash
# 1. Check that the dev server starts
npm run dev
# Should start on localhost:3000 without errors

# 2. Check TypeScript compilation
npx tsc --noEmit
# Should complete with no errors

# 3. Verify file structure exists
ls lib/supabase/client.ts
ls lib/supabase/server.ts
ls lib/supabase/middleware.ts
ls lib/ai/gemini.ts
ls lib/utils/types.ts
ls lib/utils/constants.ts
ls middleware.ts
```

All checks must pass before proceeding to MODULE 1.

---

## WHAT THIS MODULE CREATED

- [x] Next.js 15 project with App Router
- [x] All npm dependencies installed
- [x] Supabase client (browser + server + middleware)
- [x] Gemini AI client with helpers (text, JSON, streaming)
- [x] Complete TypeScript type definitions
- [x] NEET domain constants
- [x] Auth middleware for protected routes
- [x] Google Fonts (Inter + JetBrains Mono)
- [x] Clean layout with dark theme

**→ NEXT: MODULE 1 (Design System)**
