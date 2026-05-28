-- Migration 021: Allow educators to read profiles of students in their institute
-- Without this, the educator dashboard returns null for all student names and states

-- Educators can read profiles of students who share the same institute
CREATE POLICY "educators_read_institute_student_profiles"
  ON profiles
  FOR SELECT
  USING (
    -- Allow if the viewer is an educator in an institute that contains this profile's user
    EXISTS (
      SELECT 1
      FROM institute_memberships viewer_mem
      JOIN institute_memberships student_mem
        ON student_mem.institute_id = viewer_mem.institute_id
      WHERE viewer_mem.user_id = auth.uid()
        AND viewer_mem.role = 'educator'
        AND student_mem.user_id = profiles.id
        AND student_mem.role = 'student'
    )
  );

-- Educators can read concepts (mastery data) for students in their institute
CREATE POLICY "educators_read_institute_student_concepts"
  ON concepts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM institute_memberships viewer_mem
      JOIN institute_memberships student_mem
        ON student_mem.institute_id = viewer_mem.institute_id
      WHERE viewer_mem.user_id = auth.uid()
        AND viewer_mem.role = 'educator'
        AND student_mem.user_id = concepts.user_id
        AND student_mem.role = 'student'
    )
  );

-- Educators can read autopsy sessions for students in their institute
-- (needed for "at-risk" indicators)
CREATE POLICY "educators_read_institute_student_autopsies"
  ON autopsy_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM institute_memberships viewer_mem
      JOIN institute_memberships student_mem
        ON student_mem.institute_id = viewer_mem.institute_id
      WHERE viewer_mem.user_id = auth.uid()
        AND viewer_mem.role = 'educator'
        AND student_mem.user_id = autopsy_sessions.user_id
        AND student_mem.role = 'student'
    )
  );

-- Verify: Run this after applying to confirm policies exist
-- SELECT policyname, tablename FROM pg_policies 
-- WHERE policyname LIKE 'educators_%'
-- ORDER BY tablename;
