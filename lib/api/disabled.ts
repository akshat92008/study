import { NextResponse } from 'next/server';

export const DISABLED_FOR_MVP = {
  error: 'disabled_for_mvp',
  message: 'This feature is not part of the production MVP.',
} as const;

export function disabledForMvp(status = 404) {
  return NextResponse.json(DISABLED_FOR_MVP, { status });
}
