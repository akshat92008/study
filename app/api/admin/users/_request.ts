import type { NextRequest } from 'next/server';

export async function readAdminUserRequest(req: NextRequest) {
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return (await req.json().catch(() => ({}))) as Record<string, string>;
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) return {};
  return Object.fromEntries(formData.entries()) as Record<string, string>;
}

export function requireTargetUserId(body: Record<string, any>): string {
  const targetUserId = String(body.targetUserId || body.userId || '').trim();
  if (!targetUserId) throw new Error('targetUserId is required');
  return targetUserId;
}
