import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeSubscriptionTier, type SubscriptionTier } from '@/lib/billing/tiers';
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

export async function setSubscriptionTier(adminUserId: string, targetUserId: string, plan: string) {
  const manualPlan: SubscriptionTier = normalizeSubscriptionTier(plan);
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

export async function resetOnboarding(adminUserId: string, targetUserId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      onboarding_completed: false,
      onboarding_completed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', targetUserId);
  if (error) throw error;
  await logAdminAction(adminUserId, 'reset_onboarding', { targetUserId });
}

export async function deleteUserData(adminUserId: string, targetUserId: string) {
  const supabase = createAdminClient();
  
  // Actually delete the user account in Auth, which cascades to public.profiles via ON DELETE CASCADE (assuming it's set up that way, else we use the admin client).
  // The master plan says "delete user data according to policy".
  // @ts-expect-error - deleteUser type signature mismatch on admin client
  const { error } = await supabase.auth.admin.deleteUser(targetUserId);
  if (error) throw error;
  
  await logAdminAction(adminUserId, 'delete_user_data', { targetUserId });
}
