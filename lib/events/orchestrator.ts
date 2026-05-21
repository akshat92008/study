import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { StrictStudentEventSchema, StrictStudentEvent } from './schema';
import { LearningStateEngine } from '@/lib/engines/learning-state-engine';

const MAX_RETRIES = 3;

/**
 * The EventOrchestrator manages the lifecycle of cross-system events.
 * It enforces strict schemas, guarantees idempotency, handles retries,
 * and routes fatally failed events to a Dead Letter Queue (DLQ).
 */
export class EventOrchestrator {
  /**
   * Safely publishes an event to the bus (student_events table).
   * It will remain in 'pending' status until processed by a worker/trigger.
   */
  static async publishEvent(eventData: Omit<StrictStudentEvent, 'id' | 'status' | 'retry_count' | 'created_at'>): Promise<void> {
    const supabase = await createClient();
    
    try {
      // Validate strict schema
      const validated = StrictStudentEventSchema.parse({
        ...eventData,
        status: 'pending',
        retry_count: 0
      });

      const { error } = await supabase.from('student_events').insert({
        user_id: validated.user_id,
        type: validated.type,
        data: validated.data,
        status: validated.status,
        idempotency_key: validated.idempotency_key,
      });

      if (error) {
        // Handle unique constraint violation on idempotency gracefully
        if (error.code === '23505') {
          logger.info('Idempotency key prevented duplicate event ingestion', { key: validated.idempotency_key });
          return;
        }
        throw error;
      }
      
      logger.info('Event published successfully', { type: validated.type, userId: validated.user_id });
    } catch (err) {
      logger.error('Failed to publish event', err);
      throw err;
    }
  }

  /**
   * Processes a single pending event.
   * This should ideally be called by an API endpoint triggered by Supabase Realtime or a Cron job.
   */
  static async processEvent(eventId: string): Promise<void> {
    const supabase = await createClient();

    // 1. Lock the event (Optimistic locking by updating status to processing)
    const { data: event, error: lockErr } = await supabase
      .from('student_events')
      .update({ status: 'processing' })
      .eq('id', eventId)
      .eq('status', 'pending')
      .select('*')
      .single();

    if (lockErr || !event) {
      // Either already processed, or doesn't exist
      return;
    }

    try {
      logger.info('Processing event', { eventId, type: event.type });

      // 2. Route to appropriate handlers
      await this.routeEvent(event);

      // 3. Mark completed
      await supabase
        .from('student_events')
        .update({ status: 'completed', error_message: null })
        .eq('id', eventId);

      logger.info('Event processing completed', { eventId });
    } catch (error: any) {
      logger.error('Event processing failed', { eventId, error });
      
      const newRetryCount = (event.retry_count || 0) + 1;
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (newRetryCount > MAX_RETRIES) {
        // 4. Move to DLQ
        await this.moveToDLQ(event, errorMsg);
        await supabase
          .from('student_events')
          .update({ status: 'failed', retry_count: newRetryCount, error_message: 'Max retries exceeded. Moved to DLQ.' })
          .eq('id', eventId);
      } else {
        // 5. Requeue for retry
        await supabase
          .from('student_events')
          .update({ status: 'pending', retry_count: newRetryCount, error_message: errorMsg })
          .eq('id', eventId);
      }
    }
  }

  /**
   * Routes the event to domain-specific handlers.
   */
  private static async routeEvent(event: any): Promise<void> {
    // We map the strict taxonomy back to the legacy LearningStateEngine for now,
    // but in a fully decoupled architecture, each module would subscribe independently.
    
    // Convert new strict types to legacy LearningStateEngine ingest format if needed
    const mappedType = this.mapToLegacyType(event.type);
    
    if (mappedType) {
      await LearningStateEngine.processLegacyEvent({
        userId: event.user_id,
        type: mappedType as any,
        data: event.data
      });
    }

    // Handle new specific routing
    switch (event.type) {
      case 'MIND_TUTOR_COMPLETED':
        // e.g. Handle specific FSRS injection
        break;
      case 'MEMORY_CARD_REVIEWED':
        // Handle pulse friction detection
        break;
      // Add other specific routings here
    }
  }

  private static mapToLegacyType(type: string): string | null {
    switch (type) {
      case 'MIND_TUTOR_COMPLETED': return 'SESSION_COMPLETED';
      case 'MEMORY_CARD_REVIEWED': return 'CARD_REVIEWED';
      case 'COMMAND_TASK_COMPLETED': return 'TASK_COMPLETED';
      default: return type;
    }
  }

  private static async moveToDLQ(event: any, errorMessage: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from('dlq_events').insert({
      event_id: event.id,
      user_id: event.user_id,
      type: event.type,
      data: event.data,
      error_message: errorMessage
    });

    if (error) {
      logger.error('CRITICAL: Failed to write to Dead Letter Queue', { eventId: event.id, error });
    } else {
      logger.info('Event moved to DLQ', { eventId: event.id });
    }
  }
}
