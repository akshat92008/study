import { createAdminClient } from '@/lib/supabase/admin';

const mode = process.argv.includes('--repair') ? 'repair' : 'dry-run';
const supabase = createAdminClient();
const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();

const checks = [
  { name: 'stuck_sources', table: 'study_materials', statuses: ['uploaded', 'queued', 'processing', 'parsed', 'embedding'], failedStatus: 'failed' },
  { name: 'stuck_autopsy', table: 'assessments', statuses: ['parsing', 'diagnosing', 'report_generating'], failedStatus: 'failed' },
  { name: 'stuck_events', table: 'event_queue', statuses: ['PROCESSING'], failedStatus: 'FAILED' },
];

const report: Record<string, unknown> = { mode, generatedAt: new Date().toISOString(), checks: [] };
for (const check of checks) {
  const { data, error } = await supabase
    .from(check.table)
    .select('id, user_id, status, updated_at')
    .in('status', check.statuses)
    .lt('updated_at', cutoff)
    .limit(500);
  if (error) throw error;
  (report.checks as unknown[]).push({ name: check.name, count: data?.length ?? 0, rows: data ?? [] });
  if (mode === 'repair' && data?.length) {
    await supabase
      .from(check.table)
      .update({ status: check.failedStatus })
      .in('id', data.map((row: any) => row.id));
  }
}

const { data: orphanCards, error: orphanError } = await supabase
  .from('revision_cards')
  .select('id, user_id, goal_id, concept_id, created_at')
  .is('concept_id', null)
  .limit(500);
if (orphanError) throw orphanError;
(report.checks as unknown[]).push({ name: 'revision_cards_without_concept', count: orphanCards?.length ?? 0, rows: orphanCards ?? [] });

console.log(JSON.stringify(report, null, 2));
if ((report.checks as any[]).some((check) => check.count > 0)) process.exitCode = 1;
