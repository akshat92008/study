// app/api/billing/create-checkout/route.ts
// Monetisation disabled — Cognition OS is free for all students.
import { NextRequest } from 'next/server';

export async function POST(_req: NextRequest) {
  return new Response(
    JSON.stringify({ message: 'Cognition OS is free for all students.' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
