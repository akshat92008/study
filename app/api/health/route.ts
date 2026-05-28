import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRedisClientSafe } from '@/lib/events/redisClient';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, 'ok' | 'degraded' | 'down'> = {};
  const startTime = Date.now();

  // --- Supabase check ---
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)
      .maybeSingle();
    checks.supabase = error ? 'degraded' : 'ok';
  } catch {
    checks.supabase = 'down';
  }

  // --- Redis check ---
  try {
    const redis = getRedisClientSafe();
    if (!redis) {
      checks.redis = 'degraded';
    } else {
      await redis.ping();
      checks.redis = 'ok';
    }
  } catch {
    checks.redis = 'degraded';
  }

  // --- AI provider check (just checks env vars are set) ---
  const aiProviders = {
    cerebras: !!process.env.CEREBRAS_API_KEY,
    groq: !!process.env.GROQ_API_KEY,
    sambanova: !!process.env.SAMBANOVA_API_KEY,
    google: process.env.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY' && !!process.env.GEMINI_API_KEY,
    cloudflare: !!process.env.CLOUDFLARE_AI_GATEWAY_URL,
  };
  const anyAiAvailable = Object.values(aiProviders).some(Boolean);
  checks.ai_providers = anyAiAvailable ? 'ok' : 'down';

  // --- Embeddings check ---
  checks.embeddings = process.env.DISABLE_EMBEDDINGS === 'true' ? 'degraded' : 'ok';

  const allOk = Object.values(checks).every((v) => v === 'ok');
  const anyDown = Object.values(checks).some((v) => v === 'down');
  const overallStatus = anyDown ? 'degraded' : allOk ? 'ok' : 'degraded';

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      latency_ms: Date.now() - startTime,
      checks,
      ai_providers: aiProviders,
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? 'unknown',
    },
    { status: anyDown ? 503 : 200 }
  );
}
