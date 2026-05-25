import { NextResponse } from 'next/server';
import { getProviderStats } from '@/lib/ai/providers';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const stats = getProviderStats();
  
  // Check which providers have keys configured
  const configured = {
    cerebras: !!process.env.CEREBRAS_API_KEY,
    sambanova: !!process.env.SAMBANOVA_API_KEY,
    groq: !!process.env.GROQ_API_KEY,
    cloudflare: !!(process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN),
    google: !!process.env.GOOGLE_AI_KEY,
  };

  return NextResponse.json({
    configured,
    health: stats,
    embeddingsEnabled: process.env.DISABLE_EMBEDDINGS !== 'true',
    timestamp: new Date().toISOString(),
  });
}
