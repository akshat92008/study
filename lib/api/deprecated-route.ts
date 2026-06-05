import { NextResponse } from 'next/server';

export function deprecatedRouteResponse(replacement?: string): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: 'deprecated_route',
        message: replacement
          ? `This route is deprecated. Use ${replacement}.`
          : 'This route is deprecated. Use the current Cognition OS route.',
      },
    },
    { status: 410 },
  );
}
