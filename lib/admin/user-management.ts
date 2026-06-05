import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeManualPlan, type ManualPlan } from '@/lib/billing/plan-limits';
import { logAdminAction } from '@/lib/admin/audit';

export async function grantBetaAccess(adminUserId: string, targetUserId: string, betaAccessUntil?: string | null) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      beta_access: true,
      beta_access_until: betaAccessUntil || null,
      suspended: false,
      suspended_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', targetUserId);
  if (error) throw error;
  await logAdminAction(adminUserId, 'grant_beta_access', { targetUserId, betaAccessUntil: betaAccessUntil || null });
}

export async function revokeBetaAccess(adminUserId: string, targetUserId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      beta_access: false,
      beta_access_until: null,
      manual_plan: 'free',
      updated_at: new Date().toISOString(),
    })
    .eq('id', targetUserId);
  if (error) throw error;
  await logAdminAction(adminUserId, 'revoke_beta_access', { targetUserId });
}

export async function setManualPlan(adminUserId: string, targetUserId: string, plan: string) {
  const manualPlan: ManualPlan = normalizeManualPlan(plan);
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      manual_plan: manualPlan,
      updated_at: new Date().toISOString(),
    })
    .eq('id', targetUserId);
  if (error) throw error;
  await logAdminAction(adminUserId, 'set_manual_plan', { targetUserId, plan: manualPlan });
}

export async function suspendUser(adminUserId: string, targetUserId: string, reason?: string | null) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      suspended: true,
      suspended_reason: reason || 'Paused by beta admin',
      updated_at: new Date().toISOString(),
    })
    .eq('id', targetUserId);
  if (error) throw error;
  await logAdminAction(adminUserId, 'suspend_user', { targetUserId, reason: reason || null });
}

export async function unsuspendUser(adminUserId: string, targetUserId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      suspended: false,
      suspended_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', targetUserId);
  if (error) throw error;
  await logAdminAction(adminUserId, 'unsuspend_user', { targetUserId });
}
