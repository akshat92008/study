/**
 * lib/services/session-card-cache.ts  (PATCHED)
 * ================================================
 * This file is kept for backward compatibility.
 * All logic has moved to session-card-invalidation.ts
 *
 * Existing engine imports continue to work unchanged:
 *   import { invalidateSessionCards } from '@/lib/services/session-card-cache';
 *
 * New code should import from the canonical location:
 *   import { invalidateSessionCard } from '@/lib/services/session-card-invalidation';
 */

export {
  invalidateSessionCards,
  invalidateSessionCard,
  markSessionCardCompleted,
} from '@/lib/services/session-card-invalidation';
