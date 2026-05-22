import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/utils/rate-limit';
import { safeError, logger } from '@/lib/utils/logger';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // --- NEW RATE LIMIT ---
    // 20 requests per 24 hours
    if (!await rateLimit(`audio-${user.id}`, 20, 24 * 60 * 60 * 1000)) {
      return NextResponse.json({ error: 'Daily audio generation limit reached.' }, { status: 429 });
    }

    const { materialId } = await req.json();
    if (!materialId) return NextResponse.json({ error: 'materialId required' }, { status: 400 });

    // Mock Audio generation response
    // In a real app, this would use Google Cloud TTS, ElevenLabs, or similar.
    return NextResponse.json({ 
      success: true, 
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', // Mock URL
      message: 'Audio overview generated successfully.'
    });
  } catch (error: any) {
    logger.error('Audio generation failed', error);
    return NextResponse.json(safeError(error), { status: 500 });
  }
}
