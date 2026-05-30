import { NextRequest, NextResponse } from 'next/server';
import { generateCorrelationId, withCorrelationId } from '@/lib/telemetry/correlation';
import { Metrics } from '@/lib/observability/metrics';

type RouteHandler = (
  req: NextRequest,
  context: any
) => Promise<NextResponse> | NextResponse;

/**
 * Wraps an API route handler with distributed tracing.
 * Extracts x-correlation-id from headers or generates a new one.
 */
export function withTracing(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, context: any) => {
    const traceId = req.headers.get('x-correlation-id') || generateCorrelationId();
    
    return withCorrelationId(traceId, async () => {
      const start = Date.now();
      try {
        const response = await handler(req, context);
        // Include the correlation ID in the response headers for debugging
        response.headers.set('x-correlation-id', traceId);
        return response;
      } catch (error: any) {
        Metrics.captureError(error, { 
          context: 'api_route_unhandled_error', 
          path: req.nextUrl.pathname 
        });
        return NextResponse.json(
          { error: 'Internal Server Error', trace_id: traceId },
          { status: 500, headers: { 'x-correlation-id': traceId } }
        );
      } finally {
        const latency = Date.now() - start;
        if (req.nextUrl.pathname.startsWith('/api/ai/')) {
          Metrics.studentResponseLatency(latency);
        }
      }
    });
  };
}
