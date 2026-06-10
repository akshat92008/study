-- Migration: 20260530000010_atlas_orphan_cleanup.sql
-- Purpose: Audit revealed 'student_nodes' and 'mastery_edges' DO NOT EXIST in the schema.
-- The claim is hallucinated/legacy. Trusting only executable code.
-- No action required.
select 1;
