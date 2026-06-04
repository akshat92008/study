import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

export type BetaGateResult = {
  allowed: boolean;
  reason?: string;
};

function enabled(value: string | undefined, fallback = false): boolean {
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function listFromEnv(key: string): string[] {
  return (process.env[key] || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function isPublicBetaMode(): boolean {
  return enabled(process.env.PUBLIC_BETA_MODE, false);
}

export async function enforceBetaSignupGate(input: {
  email: string;
  inviteCode?: string | null;
}): Promise<BetaGateResult> {
  if (!isPublicBetaMode()) return { allowed: true };

  const email = input.email.trim().toLowerCase();
  const adminEmails = listFromEnv('ADMIN_EMAILS').map((value) => value.toLowerCase());
  if (adminEmails.includes(email)) return { allowed: true };

  if (enabled(process.env.REQUIRE_INVITE_CODE, false)) {
    const validCodes = new Set(listFromEnv('BETA_INVITE_CODES'));
    const inviteCode = input.inviteCode?.trim();
    if (!inviteCode || !validCodes.has(inviteCode)) {
      return {
        allowed: false,
        reason: 'This beta is invite-only right now. Join the waitlist or use a valid invite code.',
      };
    }
  }

  const maxUsers = Number(process.env.MAX_BETA_USERS ?? 300);
  if (Number.isFinite(maxUsers) && maxUsers > 0) {
    const supabase = createAdminClient();
    const { count, error } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true });

    if (error) {
      return {
        allowed: false,
        reason: 'Beta capacity could not be verified. Please join the waitlist and try again later.',
      };
    }

    if ((count ?? 0) >= maxUsers) {
      return {
        allowed: false,
        reason: 'The current beta cohort is full. Please join the waitlist.',
      };
    }
  }

  return { allowed: true };
}
