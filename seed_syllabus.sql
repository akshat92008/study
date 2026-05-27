-- Run this in the Supabase SQL Editor

-- 1. Ensure unique constraint exists for ON CONFLICT DO NOTHING to work
ALTER TABLE concepts ADD CONSTRAINT concepts_user_subject_chapter_unique 
UNIQUE (user_id, subject, chapter);

-- 2. Function to seed syllabus for a user on signup
CREATE OR REPLACE FUNCTION seed_syllabus_for_user(p_user_id uuid, p_exam_type text)
RETURNS void AS $$
DECLARE
  v_subject text;
  v_chapter text;
BEGIN
  -- Only seed if user has no concepts yet
  IF (SELECT COUNT(*) FROM concepts WHERE user_id = p_user_id) > 0 THEN
    RETURN;
  END IF;

  -- NEET syllabus
  IF p_exam_type ILIKE '%neet%' THEN

    -- Physics
    FOR v_chapter IN SELECT unnest(ARRAY[
      'Physical World and Measurement',
      'Kinematics',
      'Laws of Motion',
      'Work Energy and Power',
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
      'Electronic Devices'
    ]) LOOP
      INSERT INTO concepts (user_id, subject, chapter, mastery, last_reviewed)
      VALUES (p_user_id, 'Physics', v_chapter, 'not_started', now())
      ON CONFLICT DO NOTHING;
    END LOOP;

    -- Chemistry
    FOR v_chapter IN SELECT unnest(ARRAY[
      'Some Basic Concepts of Chemistry',
      'Structure of Atom',
      'Classification of Elements and Periodicity in Properties',
      'Chemical Bonding and Molecular Structure',
      'States of Matter',
      'Thermodynamics',
      'Equilibrium',
      'Redox Reactions',
      'Hydrogen',
      'The s-Block Elements',
      'The p-Block Elements',
      'Organic Chemistry: Basic Principles and Techniques',
      'Hydrocarbons',
      'Environmental Chemistry',
      'The Solid State',
      'Solutions',
      'Electrochemistry',
      'Chemical Kinetics',
      'Surface Chemistry',
      'General Principles and Processes of Isolation of Elements',
      'The d and f Block Elements',
      'Coordination Compounds',
      'Haloalkanes and Haloarenes',
      'Alcohols Phenols and Ethers',
      'Aldehydes Ketones and Carboxylic Acids',
      'Amines',
      'Biomolecules',
      'Polymers',
      'Chemistry in Everyday Life'
    ]) LOOP
      INSERT INTO concepts (user_id, subject, chapter, mastery, last_reviewed)
      VALUES (p_user_id, 'Chemistry', v_chapter, 'not_started', now())
      ON CONFLICT DO NOTHING;
    END LOOP;

    -- Biology
    FOR v_chapter IN SELECT unnest(ARRAY[
      'The Living World',
      'Biological Classification',
      'Plant Kingdom',
      'Animal Kingdom',
      'Morphology of Flowering Plants',
      'Anatomy of Flowering Plants',
      'Structural Organisation in Animals',
      'Cell The Unit of Life',
      'Cell Structure and Function',
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
      'Excretory Products and their Elimination',
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
      'Environmental Issues'
    ]) LOOP
      INSERT INTO concepts (user_id, subject, chapter, mastery, last_reviewed)
      VALUES (p_user_id, 'Biology', v_chapter, 'not_started', now())
      ON CONFLICT DO NOTHING;
    END LOOP;

  END IF;

  -- JEE syllabus (add similarly when ready)
  -- IF p_exam_type ILIKE '%jee%' THEN ... END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Trigger on profile creation
CREATE OR REPLACE FUNCTION handle_new_user_syllabus()
RETURNS trigger AS $$
BEGIN
  IF NEW.exam_type IS NOT NULL THEN
    PERFORM seed_syllabus_for_user(NEW.id, NEW.exam_type);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Safely recreate the trigger
DROP TRIGGER IF EXISTS on_profile_created_seed_syllabus ON profiles;
CREATE TRIGGER on_profile_created_seed_syllabus
  AFTER INSERT OR UPDATE OF exam_type ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_syllabus();


-- 4. Backfill for existing users who already have an exam type but no syllabus
SELECT seed_syllabus_for_user(id, exam_type)
FROM profiles
WHERE exam_type IS NOT NULL;
