import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { seedInitialCards } from '@/lib/actions/onboarding';
import { logger, safeError } from '@/lib/utils/logger';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Mark onboarding complete on the profile
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({
        onboarding_complete: true,
      })
      .eq('id', user.id);

    if (profileErr) {
      logger.warn('Failed to mark onboarding complete', { userId: user.id, err: profileErr.message });
    }

    // Seed initial flashcards from the seeded concepts — non-blocking
    // We don't await this — onboarding completes immediately, cards appear within seconds
    seedInitialCards(user.id)
      .then(result => logger.info('Onboarding cards seeded', { userId: user.id, ...result }))
      .catch(err => logger.error('Onboarding card seed failed', err));

    return NextResponse.json({ success: true, message: 'Onboarding complete. Cards being generated.' });

  } catch (error: any) {
    logger.error('Onboarding completion failed', error);
    return NextResponse.json(safeError(error), { status: 500 });
  }
}
