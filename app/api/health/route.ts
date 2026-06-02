// app/api/health/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateCronRequest } from '@/lib/middleware/cronAuth';
import { Redis } from '@upstash/redis';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authError = validateCronRequest(req);
  if (authError) return authError;

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
  let workerHealth = {
    pendingEvents: 0,
    processingEvents: 0,
    failedEvents: 0,
    dlqCount: 0,
    oldestPendingAgeSeconds: 0,
    lastWorkerRunAt: null as string | null,
    failedConsumersByType: {} as Record<string, number>,
    autopsyJobs: {
      pending: 0,
      processing: 0,
      failed: 0,
      needsUserInput: 0,
    },
  };
  const queueStart = Date.now();
  try {
    const sb = createAdminClient();
    const [pending, processing, failed, dlq, oldestPending, lastAttempt, failedConsumers, autopsyPending, autopsyProcessing, autopsyFailed, autopsyNeedsInput] = await Promise.all([
      sb.from('event_queue').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
      sb.from('event_queue').select('*', { count: 'exact', head: true }).eq('status', 'PROCESSING'),
      sb.from('event_queue').select('*', { count: 'exact', head: true }).in('status', ['FAILED', 'DLQ']),
      sb.from('event_dlq').select('*', { count: 'exact', head: true }).is('resolved_at', null),
      sb.from('event_queue').select('created_at').eq('status', 'PENDING').order('created_at', { ascending: true }).limit(1).maybeSingle(),
      sb.from('event_attempts').select('finished_at').not('finished_at', 'is', null).order('finished_at', { ascending: false }).limit(1).maybeSingle(),
      sb.from('consumer_locks').select('consumer_name').in('status', ['FAILED', 'DLQ']).limit(500),
      sb.from('autopsy_jobs').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      sb.from('autopsy_jobs').select('*', { count: 'exact', head: true }).eq('status', 'processing'),
      sb.from('autopsy_jobs').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
      sb.from('autopsy_jobs').select('*', { count: 'exact', head: true }).eq('status', 'needs_user_input'),
    ]);
    const oldestCreatedAt = oldestPending.data?.created_at ? new Date(oldestPending.data.created_at).getTime() : null;
    const failedConsumersByType = (failedConsumers.data || []).reduce((acc: Record<string, number>, lock: any) => {
      const name = lock.consumer_name || 'unknown';
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});
    workerHealth = {
      pendingEvents: pending.count || 0,
      processingEvents: processing.count || 0,
      failedEvents: failed.count || 0,
      dlqCount: dlq.count || 0,
      oldestPendingAgeSeconds: oldestCreatedAt
        ? Math.max(0, Math.round((Date.now() - oldestCreatedAt) / 1000))
        : 0,
      lastWorkerRunAt: lastAttempt.data?.finished_at ?? null,
      failedConsumersByType,
      autopsyJobs: {
        pending: autopsyPending.count || 0,
        processing: autopsyProcessing.count || 0,
        failed: autopsyFailed.count || 0,
        needsUserInput: autopsyNeedsInput.count || 0,
      },
    };
    checks.queue = {
      ok: !pending.error && !processing.error && !failed.error && !dlq.error && !oldestPending.error && !lastAttempt.error && !failedConsumers.error && !autopsyPending.error && !autopsyProcessing.error && !autopsyFailed.error && !autopsyNeedsInput.error,
      latencyMs: Date.now() - queueStart,
      error: pending.error?.message || processing.error?.message || failed.error?.message || dlq.error?.message || oldestPending.error?.message || lastAttempt.error?.message || failedConsumers.error?.message || autopsyPending.error?.message || autopsyProcessing.error?.message || autopsyFailed.error?.message || autopsyNeedsInput.error?.message,
    };
    checks.queue_status = {
      ok: (dlq.count || 0) === 0,
      error: `pending=${pending.count || 0}; processing=${processing.count || 0}; failed=${failed.count || 0}; unresolved_dlq=${dlq.count || 0}`,
    };
  } catch (err: any) {
    checks.queue = { ok: false, error: err.message };
  }
  
  const allOk = Object.values(checks).every((c) => c.ok);
  
  return NextResponse.json(
    { status: allOk ? 'healthy' : 'degraded', checks, worker: workerHealth, timestamp: new Date().toISOString() },
    { status: allOk ? 200 : 503 }
  );
}
