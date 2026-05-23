import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { EventDispatcher } from './orchestrator';

/**
 * Utility tools for observability, tracing, and replaying events from the DLQ.
 */
export class EventReplayTooling {
  /**
   * Fetches events currently sitting in the Dead Letter Queue.
   */
  static async getDLQEvents(limit: number = 50, unresolvedOnly: boolean = true) {
    const supabase = await createClient();
    let query = supabase
      .from('dlq_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unresolvedOnly) {
      query = query.is('resolved_at', null);
    }

    const { data, error } = await query;
    if (error) {
      logger.error('Failed to fetch DLQ events', error);
      throw error;
    }
    return data || [];
  }

  /**
   * Replays a specific event from the DLQ by re-injecting it into the main event bus.
   * It creates a new trace_id but keeps the original event ID in the metadata for traceability.
   */
  static async replayDLQEvent(dlqEventId: string, resolutionNotes: string = 'Replayed manually via EventReplayTooling'): Promise<string> {
    const supabase = await createClient();

    // 1. Fetch DLQ event
    const { data: dlqEvent, error: fetchErr } = await supabase
      .from('dlq_events')
      .select('*')
      .eq('id', dlqEventId)
      .is('resolved_at', null)
      .single();

    if (fetchErr || !dlqEvent) {
      throw new Error(`DLQ Event ${dlqEventId} not found or already resolved.`);
    }

    try {
      // 2. Publish new event
      // We append the original trace and event ID to the metadata to maintain lineage.
      const newEventId = await EventDispatcher.publish({
        user_id: dlqEvent.user_id,
        type: dlqEvent.type as any,
        data: dlqEvent.data,
        idempotency_key: undefined, // Strip idempotency so it isn't dropped
        metadata: {
          ...dlqEvent.metadata,
          source: 'dlq_replay',
          original_event_id: dlqEvent.event_id,
          original_trace_id: dlqEvent.trace_id,
          replay_timestamp: new Date().toISOString()
        }
      });

      if (newEventId === 'idempotent_skip') {
         throw new Error('Unexpected idempotency hit during replay.');
      }

      // 3. Mark DLQ event as resolved
      await supabase
        .from('dlq_events')
        .update({
          resolved_at: new Date().toISOString(),
          resolution_notes: resolutionNotes
        })
        .eq('id', dlqEventId);

      logger.info('Successfully replayed DLQ event', {
        dlqEventId,
        newEventId,
        originalTraceId: dlqEvent.trace_id
      });

      return newEventId;
    } catch (err) {
      logger.error('Failed to replay DLQ event', { dlqEventId, error: err });
      throw err;
    }
  }

  /**
   * Gets the full trace history of an event by its trace_id
   */
  static async getTraceHistory(traceId: string) {
    const supabase = await createClient();
    
    const { data: events, error: eventErr } = await supabase
      .from('student_events')
      .select('id, user_id, type, status, version, metadata, created_at, last_error')
      .eq('trace_id', traceId);

    if (eventErr || !events) {
      return null;
    }

    // Fetch consumer tracking for all events in this trace
    const eventIds = events.map(e => e.id);
    const { data: consumers, error: consErr } = await supabase
      .from('event_consumer_tracking')
      .select('*')
      .in('event_id', eventIds);

    // Fetch DLQ history
    const { data: dlq, error: dlqErr } = await supabase
      .from('dlq_events')
      .select('*')
      .eq('trace_id', traceId);

    return {
      trace_id: traceId,
      events,
      consumer_tracking: consumers || [],
      dlq_history: dlq || []
    };
  }
}
