import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { getExamConfig } from '../lib/utils/constants';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function seedConceptsForSubject(userId: string, subject: string, chapters: string[]) {
  const conceptRows: any[] = [];
  const CHAPTER_EXPANSIONS: Record<string, Array<{ topic: string, name: string }>> = {
    'Kinematics': [
      { name: 'Motion in a Straight Line', topic: 'Kinematics' },
      { name: 'Motion in a Plane', topic: 'Kinematics' },
      { name: 'Relative Velocity', topic: 'Kinematics' },
      { name: 'Projectile Motion', topic: 'Kinematics' }
    ],
    'Laws of Motion': [
      { name: 'Newton Laws of Motion', topic: 'Laws of Motion' },
      { name: 'Friction', topic: 'Laws of Motion' },
      { name: 'Circular Motion Dynamics', topic: 'Laws of Motion' }
    ],
    'Thermodynamics': [
      { name: 'Thermal Equilibrium and Temperature', topic: 'Thermodynamics' },
      { name: 'First Law of Thermodynamics', topic: 'Thermodynamics' },
      { name: 'Thermodynamic Processes', topic: 'Thermodynamics' },
      { name: 'Second Law of Thermodynamics', topic: 'Thermodynamics' }
    ],
    'Electrostatics': [
      { name: 'Electric Charges and Fields', topic: 'Electrostatics' },
      { name: 'Electrostatic Potential', topic: 'Electrostatics' },
      { name: 'Capacitance and Capacitors', topic: 'Electrostatics' }
    ],
    'Cell: The Unit of Life': [
      { name: 'Cell Theory', topic: 'Cell: The Unit of Life' },
      { name: 'Prokaryotic Cells', topic: 'Cell: The Unit of Life' },
      { name: 'Eukaryotic Cells', topic: 'Cell: The Unit of Life' },
      { name: 'Cell Organelles', topic: 'Cell: The Unit of Life' }
    ],
    'Human Reproduction': [
      { name: 'Male Reproductive System', topic: 'Human Reproduction' },
      { name: 'Female Reproductive System', topic: 'Human Reproduction' },
      { name: 'Gametogenesis', topic: 'Human Reproduction' },
      { name: 'Menstrual Cycle', topic: 'Human Reproduction' },
      { name: 'Fertilization and Implantation', topic: 'Human Reproduction' }
    ]
  };

  chapters.forEach((chapter) => {
    const expansions = CHAPTER_EXPANSIONS[chapter];
    if (expansions && expansions.length > 0) {
      expansions.forEach((exp) => {
        conceptRows.push({
          user_id: userId,
          name: exp.name,
          subject,
          chapter,
          topic: exp.topic,
          mastery: 'not_started',
          confidence: 'low',
          times_reviewed: 0,
          times_correct: 0,
          times_incorrect: 0,
          forgetting_probability: 1.0,
          retention_strength: 0.0,
        });
      });
    } else {
      conceptRows.push({
        user_id: userId,
        name: chapter,
        subject,
        chapter,
        topic: 'General',
        mastery: 'not_started',
        confidence: 'low',
        times_reviewed: 0,
        times_correct: 0,
        times_incorrect: 0,
        forgetting_probability: 1.0,
        retention_strength: 0.0,
      });
    }
  });

  let insertedCount = 0;
  if (conceptRows.length > 0) {
    const { data: inserted, error } = await supabase.from('concepts').insert(conceptRows).select();
    if (error || !inserted) throw error || new Error('Seeding failed');
    insertedCount += inserted.length;
  }
  return { seeded: insertedCount };
}

async function run() {
  try {
    const { data: users } = await supabase.from('profiles').select('id, email').limit(1);
    if (!users || users.length === 0) {
      console.log("No profiles found");
      return;
    }
    const testUserId = users[0].id;
    console.log("Testing with User:", users[0]);

    console.log("Testing seedConceptsForSubject...");
    const config = getExamConfig("NEET");
    console.log("Exam Config subjects:", config.subjects);
    
    const subject = config.subjects[0];
    const chapters = config.chapters[subject] || [];
    console.log(`Seeding subject: ${subject} with ${chapters.length} chapters...`);
    const seedRes = await seedConceptsForSubject(testUserId, subject, chapters);
    console.log("Seeding success:", seedRes);
  } catch (err: any) {
    console.error("DIAGNOSTIC ERROR:", err);
    if (err.message) console.error("Message:", err.message);
    if (err.details) console.error("Details:", err.details);
    if (err.hint) console.error("Hint:", err.hint);
    if (err.stack) console.error("Stack:", err.stack);
  }
}

run();
