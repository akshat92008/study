import { createAdminClient } from '@/lib/supabase/admin';

export async function logAdminAction(adminUserId: string, action: string, details: any = {}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from('admin_audit_logs').insert({
    admin_id: adminUserId,
    action: action,
    details: details,
  });

  const { error: canonicalError } = await supabase.from('admin_audit_log').insert({
    admin_user_id: adminUserId,
    action,
    target_user_id: details?.targetUserId ?? null,
    metadata: details ?? {},
  });
  
  // If the table doesn't exist yet, we just swallow the error in this phase.
  // In a robust system, we would log this to a structured logger.
  if (error && canonicalError) {
    console.warn('[Admin Audit Logger] Failed to insert audit log. Does the table exist?', error, canonicalError);
  }
}
