import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Mock environment variable to bypass import-time validation in gemini.ts
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'mock-gemini-key';

import { CommandPlanner, CandidateTask } from '../lib/engines/command-engine';

// Mock list of candidate tasks representing a student with a cluttered backlog and heavy workload
const mockCandidates: CandidateTask[] = [
  // 1. Backlog tasks (Total: 200m)
  {
    id: 'backlog-1',
    title: '[BACKLOG] Study Kinematics formulas',
    description: 'Overdue task',
    type: 'study',
    subject: 'Physics',
    chapter: 'Kinematics',
    estimatedMinutes: 60,
    priority: 'critical',
    score: 130,
    rationale: 'Overdue study task from 2 days ago.'
  },
  {
    id: 'backlog-2',
    title: '[BACKLOG] Practice Laws of Motion',
    description: 'Overdue task',
    type: 'practice',
    subject: 'Physics',
    chapter: 'Laws of Motion',
    estimatedMinutes: 90,
    priority: 'critical',
    score: 115,
    rationale: 'Overdue practice task from 1 day ago.'
  },
  {
    id: 'backlog-3',
    title: '[BACKLOG] Review Cell Organelles',
    description: 'Overdue task',
    type: 'study',
    subject: 'Biology',
    chapter: 'Cell Organelles',
    estimatedMinutes: 50,
    priority: 'critical',
    score: 110,
    rationale: 'Overdue revision task.'
  },

  // 2. Spaced Repetition/Decay tasks (Total: 180m)
  {
    id: 'revision-physics-electro',
    title: 'Revise: Electrostatics',
    description: 'Active FSRS decay review',
    type: 'revision',
    subject: 'Physics',
    chapter: 'Electrostatics',
    estimatedMinutes: 45,
    priority: 'critical',
    score: 125,
    rationale: 'FSRS probability of forgetting is 0.95'
  },
  {
    id: 'revision-chem-organic',
    title: 'Revise: Organic Chemistry',
    description: 'Active FSRS decay review',
    type: 'revision',
    subject: 'Chemistry',
    chapter: 'Organic Chemistry',
    estimatedMinutes: 60,
    priority: 'high',
    score: 95,
    rationale: 'FSRS probability of forgetting is 0.80'
  },
  {
    id: 'revision-bio-human',
    title: 'Revise: Human Reproduction',
    description: 'Active FSRS decay review',
    type: 'revision',
    subject: 'Biology',
    chapter: 'Human Reproduction',
    estimatedMinutes: 75,
    priority: 'high',
    score: 92,
    rationale: 'FSRS probability of forgetting is 0.78'
  },

  // 3. Autopsy Recovery tasks (Total: 210m)
  {
    id: 'autopsy-phys-thermo',
    title: 'Practice: Thermodynamics Recovery',
    description: 'Calculated/conceptual mistakes recovery',
    type: 'practice',
    subject: 'Physics',
    chapter: 'Thermodynamics',
    estimatedMinutes: 60,
    priority: 'high',
    score: 120,
    rationale: 'Lost 40 marks in mock test'
  },
  {
    id: 'autopsy-chem-molec',
    title: 'Practice: Chemical Bonding Recovery',
    description: 'Calculated/conceptual mistakes recovery',
    type: 'practice',
    subject: 'Chemistry',
    chapter: 'Chemical Bonding',
    estimatedMinutes: 90,
    priority: 'high',
    score: 105,
    rationale: 'Lost 30 marks in mock test'
  },
  {
    id: 'autopsy-bio-cell',
    title: 'Practice: Cell Division Recovery',
    description: 'Calculated/conceptual mistakes recovery',
    type: 'practice',
    subject: 'Biology',
    chapter: 'Cell Division',
    estimatedMinutes: 60,
    priority: 'medium',
    score: 85,
    rationale: 'Lost 15 marks in mock test'
  },

  // 4. New Roadmap Concepts (Total: 240m)
  {
    id: 'concept-electromagnetic',
    title: 'Learn: Electromagnetic Induction',
    description: 'New concept',
    type: 'study',
    subject: 'Physics',
    chapter: 'Electromagnetic Induction',
    estimatedMinutes: 60,
    priority: 'medium',
    score: 50,
    rationale: 'Roadmap progression'
  },
  {
    id: 'concept-coordination',
    title: 'Learn: Coordination Compounds',
    description: 'New concept',
    type: 'study',
    subject: 'Chemistry',
    chapter: 'Coordination Compounds',
    estimatedMinutes: 60,
    priority: 'medium',
    score: 50,
    rationale: 'Roadmap progression'
  },
  {
    id: 'concept-genetics',
    title: 'Learn: Principles of Inheritance',
    description: 'New concept',
    type: 'study',
    subject: 'Biology',
    chapter: 'Principles of Inheritance',
    estimatedMinutes: 60,
    priority: 'medium',
    score: 50,
    rationale: 'Roadmap progression'
  },
  {
    id: 'concept-biotech',
    title: 'Learn: Biotechnology Principles',
    description: 'New concept',
    type: 'study',
    subject: 'Biology',
    chapter: 'Biotechnology',
    estimatedMinutes: 60,
    priority: 'medium',
    score: 50,
    rationale: 'Roadmap progression'
  }
];

function runTest() {
  console.log("=========================================");
  console.log("COMMAND ENGINE v2.0 - packing unit tests");
  console.log("=========================================\n");

  const planner = new CommandPlanner();
  
  // Set study budget to 8 hours (480 minutes)
  const studyHours = 8;
  const totalBudgetMinutes = studyHours * 60;
  console.log(`Study Hours Budget: ${studyHours} hours (${totalBudgetMinutes} minutes)`);
  console.log(`Total Candidates Raw Minutes: ${mockCandidates.reduce((s, c) => s + c.estimatedMinutes, 0)} minutes\n`);

  // Pack the daily schedule
  const packedSchedule = planner.packDailySchedule(mockCandidates, studyHours);

  console.log("------------ PACKED SCHEDULE ------------");
  let totalTimePlanned = 0;
  let backlogCount = 0;
  let backlogTime = 0;
  let revisionTime = 0;
  let autopsyTime = 0;
  let studyTime = 0;
  let breakCount = 0;
  let breakTime = 0;

  packedSchedule.forEach((task, index) => {
    const isBacklog = task.title.startsWith('[BACKLOG]');
    
    if (task.type === 'break') {
      breakCount++;
      breakTime += task.estimated_minutes;
      console.log(`[BREAK] ${task.title} - ${task.estimated_minutes}m | Rationale: ${task.rationale}`);
    } else {
      totalTimePlanned += task.estimated_minutes;
      if (isBacklog) {
        backlogCount++;
        backlogTime += task.estimated_minutes;
      } else if (task.type === 'revision') {
        revisionTime += task.estimated_minutes;
      } else if (task.type === 'practice') {
        autopsyTime += task.estimated_minutes;
      } else if (task.type === 'study') {
        studyTime += task.estimated_minutes;
      }
      console.log(`${index + 1}. [${task.type.toUpperCase()}] ${task.title} - ${task.estimated_minutes}m (Score weight: ${isBacklog ? 'Backlog-capped' : 'Regular-capped'})`);
    }
  });

  console.log("\n------------ STATS & GUARDRAIL CHECKS ------------");
  console.log(`Total Task Minutes Planned: ${totalTimePlanned}m (Target Cap: ${totalBudgetMinutes}m)`);
  console.log(`Total Break Minutes Scheduled: ${breakTime}m (${breakCount} breaks)`);

  const backlogLimit = 0.30 * totalBudgetMinutes;
  const revisionLimit = 0.25 * totalBudgetMinutes;
  const autopsyLimit = 0.30 * totalBudgetMinutes;
  const studyLimit = 0.40 * totalBudgetMinutes;

  console.log(`\nBacklog Pack: ${backlogTime}m / Limit: ${backlogLimit}m - ${backlogTime <= backlogLimit ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Revision Pack: ${revisionTime}m / Limit: ${revisionLimit}m - ${revisionTime <= revisionLimit ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Autopsy Pack: ${autopsyTime}m / Limit: ${autopsyLimit}m - ${autopsyTime <= autopsyLimit ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Study Pack: ${studyTime}m / Limit: ${studyLimit}m - ${studyTime <= studyLimit ? '✅ PASS' : '❌ FAIL'}`);

  console.log("\n=========================================");
}

runTest();
