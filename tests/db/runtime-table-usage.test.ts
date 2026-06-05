import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Runtime Table Usage Consistency', () => {
  it('ensures referenced tables in Supabase calls exist in known tables', () => {
    const knownTables = new Set([
      'concepts', 'profiles', 'mock_autopsies', 'study_materials', 'mistakes', 'study_tasks', 'revision_cards', 'agent_actions', 'learning_evidence', 'student_mastery', 'mistake_patterns', 'daily_missions', 'daily_microtasks', 'agent_runs', 'agent_action_approvals', 'agent_state_snapshots', 'performance_snapshots', 'student_models', 'chat_messages', 'ai_usage_events', 'semantic_cache', 'concept_links', 'concept_templates', 'learning_goals', 'goal_curriculum_nodes', 'practice_items', 'concept_resolution_logs', 'unresolved_concept_mentions', 'concept_aliases', 'revision_logs', 'mastery_events', 'mastery_evidence_ledger', 'materials', 'material_chunks', 'study_sessions', 'autopsy_questions', 'session_closing_messages', 'provider_health', 'event_dlq', 'event_queue', 'consumer_locks', 'event_attempts', 'study-materials', 'session_cards', 'message_citations', 'study_material_chunks', 'rag_ingestion_jobs', 'rag_query_logs', 'ai_usage_daily', 'autopsy_jobs', 'chat_sessions', 'tutor_sessions', 'chat_memory', 'episodic_memories', 'daily_plans', 'learner_states', 'concept_mastery', 'mastery_evidence_log', 'mastery_confidence', 'practice_sets', 'review_logs', 'practice_attempts', 'study_sessions', 'concept_edges', 'command_sessions', 'agents', 'agent_tasks', 'learning_documents', 'user_mastery', 'ai_response_cache', 'chat_session_summaries', 'student_events', 'beta_waitlist', 'rate_limit_events', 'upload_events', 'admin_audit', 'assessments', 'assessment_questions', 'mistake_diagnoses', 'hermes_learning_memories', 'autopsy_reports', 'learning_signals', 'seeded_topics', 'assessment_extractions', 'admin_audit_logs', 'admin_audit_log', 'feature_usage_events', 'app_error_events', 'amaura_agent_runs', 'amaura_notifications', 'amaura_pattern_memories'
    ]);

    const findFromCalls = (dir: string, foundTables: Set<string>) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          findFromCalls(fullPath, foundTables);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          // Match .from('tableName')
          const matches = [...content.matchAll(/\.from\(['"]([^'"]+)['"]\)/g)];
          for (const match of matches) {
            foundTables.add(match[1]);
          }
        }
      }
    };

    const usedTables = new Set<string>();
    const libDir = path.join(process.cwd(), 'lib');
    const appDir = path.join(process.cwd(), 'app');
    
    if (fs.existsSync(libDir)) findFromCalls(libDir, usedTables);
    if (fs.existsSync(appDir)) findFromCalls(appDir, usedTables);

    for (const table of Array.from(usedTables)) {
      // Ignore some storage bucket references or other non-table things if any
      if (['study-materials', 'documents', 'artifacts', 'autopsy-evidence'].includes(table)) continue;
      
      // If a table is used, it must be known
      expect(knownTables.has(table), `Table ${table} used in runtime code but not known in test schema list.`).toBe(true);
    }
  });
});
