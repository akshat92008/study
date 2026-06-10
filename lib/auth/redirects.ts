import { getUserAccessState } from '@/lib/access/beta-access';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Profile = any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type User = any;

/**
 * Returns a redirect URL based on the user's current state and the path they are visiting.
 * Returns null if no redirect is necessary.
 */
export async function getAuthRedirectUrl(
  user: User,
  profile: Profile,
  currentPath: string
): Promise<string | null> {
  if (!user) {
    if (['/login', '/signup', '/waitlist', '/'].includes(currentPath)) {
      return null;
    }
    return '/login';
  }

  // User exists, check profile and onboarding
  if (!profile || profile.onboarding_complete !== true) {
    if (currentPath !== '/onboarding') {
      return '/onboarding';
    }
    return null;
  }

  // Profile exists and onboarding is complete. Check access state.
  const access = await getUserAccessState(user.id);
  
  if (access.blockedReason === 'account_suspended' || access.blockedReason === 'beta_access_expired') {
    if (currentPath !== '/access') {
      return '/access';
    }
    return null;
  }
  
  if (access.blockedReason === 'payment_required' || access.blockedReason === 'beta_access_required') {
    if (currentPath !== '/access') {
      return '/access';
    }
    return null;
  }

  // If user is authenticated, completed onboarding, and has access, redirect away from public entry pages
  if (['/login', '/signup', '/waitlist', '/', '/onboarding'].includes(currentPath)) {
    return '/dashboard';
  }

  return null;
}
