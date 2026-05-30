// app/api/health/route.ts
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Redis } from '@upstash/redis';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {};

  const requiredEnv = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'CRON_SECRET',
  ];
  const missingEnv = requiredEnv.filter((key) => !process.env[key]);
  checks.env = {
    ok: missingEnv.length === 0,
    error: missingEnv.length ? `Missing: ${missingEnv.join(', ')}` : undefined,
  };
  
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
  
  // Redis is optional for local/dev, but if configured it must answer.
  const rdStart = Date.now();
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      await redis.ping();
      checks.redis = { ok: true, latencyMs: Date.now() - rdStart };
    } catch (err: any) {
      checks.redis = { ok: false, error: err.message };
    }
  } else {
    checks.redis = {
      ok: process.env.NODE_ENV !== 'production',
      error: process.env.NODE_ENV === 'production' ? 'Missing Upstash Redis env vars' : 'Redis not configured; optional outside production',
    };
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

  // Queue/DLQ status
  const queueStart = Date.now();
  try {
    const sb = createAdminClient();
    const [pending, failed, dlq] = await Promise.all([
      sb.from('event_queue').select('*', { count: 'exact', head: true }).in('status', ['PENDING', 'PROCESSING']),
      sb.from('event_queue').select('*', { count: 'exact', head: true }).in('status', ['FAILED', 'DLQ']),
      sb.from('event_dlq').select('*', { count: 'exact', head: true }).is('resolved_at', null),
    ]);
    checks.queue = {
      ok: !pending.error && !failed.error && !dlq.error,
      latencyMs: Date.now() - queueStart,
      error: pending.error?.message || failed.error?.message || dlq.error?.message,
    };
    checks.queue_status = {
      ok: (dlq.count || 0) === 0,
      error: `pending=${pending.count || 0}; failed=${failed.count || 0}; unresolved_dlq=${dlq.count || 0}`,
    };
  } catch (err: any) {
    checks.queue = { ok: false, error: err.message };
  }
  
  const allOk = Object.values(checks).every((c) => c.ok);
  
  return NextResponse.json(
    { status: allOk ? 'healthy' : 'degraded', checks, timestamp: new Date().toISOString() },
    { status: allOk ? 200 : 503 }
  );
}
