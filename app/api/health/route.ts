// app/api/health/route.ts
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Redis } from '@upstash/redis';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {};
  
  // Supabase
  const sbStart = Date.now();
  try {
    const sb = createAdminClient();
    const { error } = await sb.from('profiles').select('id').limit(1);
    checks.supabase = { 
      ok: !error, 
      latencyMs: Date.now() - sbStart,
      error: error?.message,
    };
  } catch (err: any) {
    checks.supabase = { ok: false, error: err.message };
  }
  
  // Redis
  const rdStart = Date.now();
  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    await redis.ping();
    checks.redis = { ok: true, latencyMs: Date.now() - rdStart };
  } catch (err: any) {
    checks.redis = { ok: false, error: err.message };
  }
  
  // AI providers (only check presence of keys, not actual calls)
  checks.ai_providers = {
    ok: !!(
      process.env.CEREBRAS_API_KEY ||
      process.env.GROQ_API_KEY ||
      process.env.GEMINI_API_KEY
    ),
  };
  
  // Embeddings status
  checks.embeddings = {
    ok: process.env.DISABLE_EMBEDDINGS !== 'true',
  };
  
  const allOk = Object.values(checks).every((c) => c.ok);
  
  return NextResponse.json(
    { status: allOk ? 'healthy' : 'degraded', checks, timestamp: new Date().toISOString() },
    { status: allOk ? 200 : 503 }
  );
}
