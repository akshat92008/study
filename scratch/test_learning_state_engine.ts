// scratch/test_learning_state_engine.ts
import Module from 'module';

// Initialize mock storage
const mockCalls: any[] = [];
let mockDbData: Record<string, any> = {};

// 1. Mock Supabase builder
class MockQueryBuilder {
  table: string;
  constructor(table: string) {
    this.table = table;
  }
  select(fields?: string, options?: any) {
    return this;
  }
  insert(data: any) {
    mockCalls.push({ type: 'insert', table: this.table, data });
    return this;
  }
  upsert(data: any, options?: any) {
    mockCalls.push({ type: 'upsert', table: this.table, data, options });
    return this;
  }
  update(data: any) {
    mockCalls.push({ type: 'update', table: this.table, data });
    return this;
  }
  delete() {
    mockCalls.push({ type: 'delete', table: this.table });
    return this;
  }
  eq(col: string, val: any) {
    return this;
  }
  in(col: string, vals: any[]) {
    return this;
  }
  gte(col: string, val: any) {
    return this;
  }
  lte(col: string, val: any) {
    return this;
  }
  order(col: string, options?: any) {
    return this;
  }
  limit(n: number) {
    return this;
  }
  async maybeSingle() {
    return { data: mockDbData[this.table]?.maybeSingle || null, error: null };
  }
  async single() {
    return { data: mockDbData[this.table]?.single || null, error: null };
  }
  async then(onfulfilled: any) {
    const data = mockDbData[this.table]?.list || [];
    const count = mockDbData[this.table]?.count || data.length;
    return onfulfilled({ data, count, error: null });
  }
}

const mockSupabase = {
  from: (table: string) => new MockQueryBuilder(table),
  rpc: async (fn: string, params: any) => {
    mockCalls.push({ type: 'rpc', fn, params });
    return { data: null, error: null };
  }
};

// 2. Setup Require Hijack to mock server modules
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id.includes('lib/supabase/server') || id === '@/lib/supabase/server') {
    return {
      createClient: async () => mockSupabase,
    };
  }
  if (id.includes('engines/command-engine') || id.includes('command-engine')) {
    return {
      CommandPlanner: class {
        async computeScores() {
          return [
            {
              id: 'task-c1',
              title: 'Study mock task',
              description: 'Mock task desc',
              type: 'study',
              subject: 'Physics',
              chapter: 'Kinematics',
              estimatedMinutes: 45,
              priority: 'critical',
              score: 95,
              rationale: 'Roadmap requirement',
            }
          ];
        }
        packDailySchedule(candidates: any[], hours: number) {
          return [
            {
              title: 'Study mock task',
              description: 'Mock task desc',
              type: 'study',
              subject: 'Physics',
              chapter: 'Kinematics',
              priority: 'critical',
              estimated_minutes: 45,
              rationale: 'Packed by mock planner',
            }
          ];
        }
      }
    };
  }
  if (id.includes('engines/revision-engine') || id.includes('revision-engine')) {
    return {
      generateCardsForConcept: async (userId: string, conceptId: string, subject: string, chapter: string) => {
        mockCalls.push({ type: 'generate_cards', conceptId, subject, chapter });
      }
    };
  }
  return originalRequire.apply(this, arguments as any);
};

// We dynamically import the engine inside the runner function so the require hijack is evaluated.
async function testEngine() {
  const { LearningStateEngine } = await import('../lib/engines/learning-state-engine');

  console.log("==================================================");
  console.log("🧪 RUNNING LEARNING STATE ENGINE OFFLINE UNIT TESTS");
  console.log("==================================================\n");

  const userId = 'test-student-123';

  // ------------------------------------------------------------------
  // TEST 1: Confidence Level Calculation
  // C = 0.2 * PulseWeight + 0.5 * QuizAccuracy + 0.3 * CardRecallRate
  // ------------------------------------------------------------------
  console.log("Test 1: Verifying Confidence Level formula...");
  mockDbData = {
    profiles: {
      maybeSingle: { emotional_state: 'anxious' } // PulseWeight should be 0.6
    },
    performance_snapshots: {
      list: [
        { questions_attempted: 10, questions_correct: 8 },
        { questions_attempted: 10, questions_correct: 7 }
      ] // Total: 20 attempted, 15 correct => QuizAccuracy = 0.75
    },
    review_logs: {
      list: [
        { rating: 3 }, // correct
        { rating: 1 }, // incorrect
        { rating: 4 }, // correct
        { rating: 2 }  // correct
      ] // RecallRate = 3 / 4 = 0.75
    }
  };

  const confidence = await LearningStateEngine.calculateConfidence(userId);
  const expectedConfidence = 0.2 * 0.6 + 0.5 * 0.75 + 0.3 * 0.75;
  console.log(`- Calculated Confidence: ${confidence}`);
  console.log(`- Expected Confidence:   ${expectedConfidence}`);
  if (Math.abs(confidence - expectedConfidence) < 0.001) {
    console.log("✅ Test 1 Passed.\n");
  } else {
    throw new Error("❌ Test 1 Failed: Confidence calculation is incorrect.");
  }

  // ------------------------------------------------------------------
  // TEST 2: Estimated Retention Calculation
  // R = e^(ln(0.9) * t / S)
  // ------------------------------------------------------------------
  console.log("Test 2: Verifying Estimated Retention calculation...");
  const now = Date.now();
  mockDbData = {
    revision_cards: {
      list: [
        { stability: 10, last_review: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString() }, // t = 5, S = 10. R1 = 0.9^(5/10) = 0.94868
        { stability: 5, last_review: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString() }  // t = 5, S = 5. R2 = 0.9^(5/5) = 0.9
      ]
    }
  };

  const retention = await LearningStateEngine.calculateRetention(userId);
  const r1 = Math.exp(Math.log(0.9) * (5 / 10));
  const r2 = Math.exp(Math.log(0.9) * (5 / 5));
  const expectedRetention = (r1 + r2) / 2;
  console.log(`- Calculated Retention: ${retention}`);
  console.log(`- Expected Retention:   ${expectedRetention}`);
  if (Math.abs(retention - expectedRetention) < 0.001) {
    console.log("✅ Test 2 Passed.\n");
  } else {
    throw new Error("❌ Test 2 Failed: Retention calculation is incorrect.");
  }

  // ------------------------------------------------------------------
  // TEST 3: Weekly Velocity
  // ------------------------------------------------------------------
  console.log("Test 3: Verifying Weekly Velocity (mastered concepts count)...");
  mockDbData = {
    concepts: {
      list: [
        { id: 'c1' },
        { id: 'c2' },
        { id: 'c3' }
      ]
    }
  };
  const velocity = await LearningStateEngine.calculateVelocity(userId);
  console.log(`- Calculated Velocity: ${velocity}`);
  if (velocity === 3) {
    console.log("✅ Test 3 Passed.\n");
  } else {
    throw new Error("❌ Test 3 Failed: Velocity calculation is incorrect.");
  }

  // ------------------------------------------------------------------
  // TEST 4: Struggle Index & Patterns
  // SI = 0.5 * (1 - R) + 0.3 * (IncorrectReviews / (Total + 1)) + 0.2 * responseTimeFriction
  // ------------------------------------------------------------------
  console.log("Test 4: Verifying Struggle Index computation and classification...");
  mockDbData = {
    concepts: {
      list: [
        { id: 'c-struggle', name: 'Vectors', subject: 'Physics', chapter: 'Kinematics', times_reviewed: 10, times_incorrect: 9 },
        { id: 'c-easy', name: 'Scalar', subject: 'Physics', chapter: 'Kinematics', times_reviewed: 10, times_incorrect: 1 }
      ]
    },
    revision_cards: {
      list: [
        { id: 'rc-struggle', concept_id: 'c-struggle', stability: 1, last_review: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString() }, // t = 5, S = 1 => R = 0.9^5 = 0.59049
        { id: 'rc-easy', concept_id: 'c-easy', stability: 20, last_review: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString() }  // t = 1, S = 20 => R = 0.9^0.05 = 0.9947
      ]
    },
    review_logs: {
      list: [
        { card_id: 'rc-struggle', response_time_ms: 30000 }, // friction = 1.0
        { card_id: 'rc-easy', response_time_ms: 3000 }      // friction = 0.1
      ]
    },
    mistakes: {
      list: [
        { category: 'calculation_error' },
        { category: 'calculation_error' },
        { category: 'conceptual_gap' }
      ]
    }
  };

  const struggleAnalysis = await LearningStateEngine.calculateStrugglePatternsAndWeakAreas(userId);
  console.log("- Calculated Weak Areas:", JSON.stringify(struggleAnalysis.weakAreas, null, 2));
  console.log("- Calculated Struggle Patterns:", JSON.stringify(struggleAnalysis.strugglePatterns, null, 2));

  // Compute expected SI for c-struggle:
  // R = 0.9^5 = 0.59049 => 1 - R = 0.40951
  // incorrect reviews rate = 9 / 11 = 0.81818
  // friction = 30000 / 30000 = 1.0
  // SI = 0.5 * 0.40951 + 0.3 * 0.81818 + 0.2 * 1.0 = 0.204755 + 0.245454 + 0.2 = 0.6502
  const expectedSI = 0.5 * (1 - Math.exp(Math.log(0.9) * 5)) + 0.3 * (9 / 11) + 0.2 * 1.0;

  if (struggleAnalysis.weakAreas.length === 1 && struggleAnalysis.weakAreas[0].conceptId === 'c-struggle') {
    const calcSI = struggleAnalysis.weakAreas[0].struggleIndex;
    console.log(`- Calculated SI: ${calcSI}`);
    console.log(`- Expected SI:   ${expectedSI}`);
    if (Math.abs(calcSI - expectedSI) < 0.001) {
      console.log("✅ Test 4 Passed.\n");
    } else {
      throw new Error("❌ Test 4 Failed: Struggle index calculation is incorrect.");
    }
  } else {
    throw new Error("❌ Test 4 Failed: Struggle identification or filtering did not isolate the weak concept.");
  }

  // ------------------------------------------------------------------
  // TEST 5: Telemetry Event Ingestion & Reactive Rules
  // ------------------------------------------------------------------
  console.log("Test 5: Ingesting SESSION_COMPLETED struggle event...");
  mockCalls.length = 0; // Clear call tracker

  // Setup DB mocks for event ingestion
  mockDbData = {
    profiles: {
      maybeSingle: { emotional_state: 'motivated' }
    },
    performance_snapshots: { list: [] },
    review_logs: { list: [] },
    revision_cards: { list: [] }, // No cards exist -> triggers seeding
    concepts: {
      list: [
        { id: 'concept-struggle-id', name: 'Concept Struggle', subject: 'Physics', chapter: 'Kinematics', mastery: 'exposed' }
      ]
    },
    concept_links: {
      list: [
        { source_concept_id: 'prereq-id' } // Target has a prerequisite
      ]
    }
  };

  // Inject prerequisite concepts returned by the query inside handleConceptStruggle
  mockDbData['concepts'] = {
    list: [
      { id: 'concept-struggle-id', name: 'Concept Struggle', subject: 'Physics', chapter: 'Kinematics', mastery: 'exposed' },
      { id: 'prereq-id', name: 'Vector Addition', subject: 'Physics', chapter: 'Vectors', mastery: 'not_started' } // Unmastered prerequisite
    ]
  };

  await LearningStateEngine.ingestEvent({
    userId,
    type: 'SESSION_COMPLETED',
    data: {
      conceptId: 'concept-struggle-id',
      subject: 'Physics',
      chapter: 'Kinematics',
      understandingGained: false
    }
  });

  console.log("- Operations triggered:");
  mockCalls.forEach(call => {
    console.log(`  -> ${call.type.toUpperCase()} on table "${call.table || call.fn}"`, call.data || call.params || '');
  });

  // Verify that:
  // 1. student_events was inserted
  // 2. learner_states was upserted
  // 3. learner_daily_metrics was upserted
  // 4. generateCardsForConcept was called (or card seeding triggered)
  // 5. study_tasks was inserted (prerequisite study task injection)
  // 6. replan was executed (delete existing study_tasks for today and insert packed plan)
  const insertedEvent = mockCalls.find(c => c.type === 'insert' && c.table === 'student_events');
  const upsertedState = mockCalls.find(c => c.type === 'upsert' && c.table === 'learner_states');
  const seededCards = mockCalls.find(c => c.type === 'generate_cards');
  const injectedPrereq = mockCalls.find(c => c.type === 'insert' && c.table === 'study_tasks' && c.data[0]?.title?.includes('Prerequisite'));
  const replanTasks = mockCalls.filter(c => c.table === 'study_tasks');

  if (insertedEvent && upsertedState && seededCards && injectedPrereq && replanTasks.length >= 2) {
    console.log("\n✅ Test 5 Passed.");
    console.log("🎉 ALL OFFLINE UNIT TESTS PASSED SUCCESSFULLY! 🎉\n");
  } else {
    throw new Error("❌ Test 5 Failed: Reactive rules and orchestration calls did not execute as expected.");
  }
}

testEngine().catch(err => {
  console.error(err);
  process.exit(1);
});
