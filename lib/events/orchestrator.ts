import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { StrictStudentEventSchema, StrictStudentEvent } from './schema';
import { LearningStateEngine } from '@/lib/engines/learning-state-engine';

// Import New Consumers
import { AtlasConsumer } from '@/lib/engines/cognition-graph';
import { MemoryConsumer } from '@/lib/engines/revision-engine';
import { CommandConsumer } from '@/lib/engines/command-engine';
import { ConceptExpansionConsumer } from '@/lib/engines/concept-expansion-engine';

const MAX_RETRIES = 5;

// Define known consumers
export const EVENT_CONSUMERS = [
  'learning_state_engine',
  'atlas_engine',
  'memory_engine',
  'command_engine',
  'concept_expansion_engine'
] as const;

export type EventConsumer = typeof EVENT_CONSUMERS[number];

/**
 * The EventDispatcher manages the lifecycle of cross-system events.
 * It enforces strict schemas, guarantees idempotency, handles retries,
 * enforces consumer isolation, and routes fatally failed events to a Dead Letter Queue (DLQ).
 */
export class EventDispatcher {
  /**
   * Safely publishes an event to the bus (student_events table).
   * Generates trace_id and ensures consumers are registered.
   */
  static async publish(eventData: Omit<StrictStudentEvent, 'id' | 'status' | 'retry_count' | 'created_at' | 'trace_id' | 'version'>): Promise<string> {
    const supabase = await createClient();
    
    try {
      const traceId = crypto.randomUUID();
      
      const validated = StrictStudentEventSchema.parse({
        ...eventData,
        status: 'pending',
        retry_count: 0,
        version: 'v2',
        trace_id: traceId,
        metadata: {
          ...eventData.metadata,
          source: eventData.metadata?.source || 'system_publish'
        }
      });

      const { data: insertedEvent, error } = await supabase.from('student_events').insert({
        user_id: validated.user_id,
        type: validated.type,
        data: validated.data,
        status: validated.status,
        idempotency_key: validated.idempotency_key,
        trace_id: validated.trace_id,
        version: validated.version,
        metadata: validated.metadata
      }).select('id').single();

      if (error) {
        if (error.code === '23505') {
          logger.info('Idempotency key prevented duplicate event ingestion', { key: validated.idempotency_key, traceId });
          // In real production, we might fetch and return the existing ID
          return 'idempotent_skip';
        }
        throw error;
      }

      // Initialize consumer tracking for the new event
      if (insertedEvent) {
        await this.registerConsumers(insertedEvent.id);
        // Trigger processing in the background asynchronously for real-time responsiveness
        Promise.allSettled(
          EVENT_CONSUMERS.map(consumer => this.processConsumer(insertedEvent.id, consumer))
        ).catch(err => {
          logger.error('Failed to trigger background event consumer processing', { eventId: insertedEvent.id, err });
        });
      }
      
      logger.info('Event published successfully', { type: validated.type, traceId });
      return insertedEvent?.id || traceId;
    } catch (err) {
      logger.error('Failed to publish event', err);
      throw err;
    }
  }

  /**
   * Register tracking rows for all known consumers for this event
   */
  private static async registerConsumers(eventId: string) {
    const supabase = await createClient();
    
    // We register all consumers. If a consumer doesn't care about an event type,
    // its handler will quickly NO-OP and mark it completed.
    const trackingRows = EVENT_CONSUMERS.map(consumer => ({
      event_id: eventId,
      consumer_name: consumer,
      status: 'processing'
    }));

    await supabase.from('event_consumer_tracking').insert(trackingRows);
  }

  /**
   * Processes a single pending event for a specific consumer.
   */
  static async processConsumer(eventId: string, consumer: EventConsumer): Promise<void> {
    const supabase = await createClient();

    // 1. Lock the consumer tracking record
    const { data: tracking, error: lockErr } = await supabase
      .from('event_consumer_tracking')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('event_id', eventId)
      .eq('consumer_name', consumer)
      .in('status', ['processing', 'failed']) // Matches database constraints (default status is processing)
      .select('*')
      .single();

    if (lockErr || !tracking) {
      return; // Already processed or locked by another worker
    }

    // Fetch the full event
    const { data: event } = await supabase
      .from('student_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (!event) return;

    try {
      logger.info(`Consumer [${consumer}] processing event`, { eventId, type: event.type, traceId: event.trace_id });

      // 2. Route to appropriate domain handlers based on consumer
      await this.routeToConsumer(event, consumer);

      // 3. Mark completed for this consumer
      await supabase
        .from('event_consumer_tracking')
        .update({ status: 'completed', last_error: null, updated_at: new Date().toISOString() })
        .eq('event_id', eventId)
        .eq('consumer_name', consumer);

      logger.info(`Consumer [${consumer}] completed successfully`, { eventId, traceId: event.trace_id });

      // Check if ALL consumers are done, if so, mark the parent event as completed
      await this.checkParentEventCompletion(eventId);

    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Consumer [${consumer}] failed`, { eventId, errorMsg, traceId: event.trace_id });
      
      const newRetryCount = (tracking.retry_count || 0) + 1;

      if (newRetryCount > MAX_RETRIES) {
        // 4. Move to DLQ and mark consumer tracking as fatally failed
        await this.moveToDLQ(event, `Consumer [${consumer}] failed fatally: ${errorMsg}`);
        
        await supabase
          .from('event_consumer_tracking')
          .update({ status: 'failed', retry_count: newRetryCount, last_error: 'Max retries exceeded' })
          .eq('event_id', eventId)
          .eq('consumer_name', consumer);

        await supabase
          .from('student_events')
          .update({ status: 'failed', last_error: `Consumer ${consumer} DLQ'd` })
          .eq('id', eventId);
      } else {
        // 5. Backoff logic (exponential handled by worker polling intervals checking updated_at + retry_count)
        await supabase
          .from('event_consumer_tracking')
          .update({ status: 'failed', retry_count: newRetryCount, last_error: errorMsg, updated_at: new Date().toISOString() })
          .eq('event_id', eventId)
          .eq('consumer_name', consumer);
      }
    }
  }

  private static async checkParentEventCompletion(eventId: string) {
    const supabase = await createClient();
    const { data: trackings } = await supabase
      .from('event_consumer_tracking')
      .select('status')
      .eq('event_id', eventId);

    if (trackings && trackings.every(t => t.status === 'completed')) {
      await supabase
        .from('student_events')
        .update({ status: 'completed', last_error: null })
        .eq('id', eventId);
    }
  }

  /**
   * Routes the event to domain-specific handlers for a given consumer.
   */
  private static async routeToConsumer(event: any, consumer: EventConsumer): Promise<void> {
    switch (consumer) {
      case 'learning_state_engine':
        const mappedType = this.mapToLegacyType(event.type);
        if (mappedType) {
          await LearningStateEngine.processLegacyEvent({
            userId: event.user_id,
            type: mappedType as any,
            data: event.data
          });
        }
        break;
      
      case 'atlas_engine':
        if (event.type === 'AUTOPSY_MOCK_PROCESSED') {
          await AtlasConsumer.handleAutopsyProcessed(event.user_id, event.metadata);
        } else if (event.type === 'STUDY_SESSION_COMPLETED') {
          await AtlasConsumer.handleStudySessionCompleted(event.user_id, event.data);
        }
        break;

      case 'memory_engine':
        if (event.type === 'AUTOPSY_MOCK_PROCESSED') {
          await MemoryConsumer.handleAutopsyProcessed(event.user_id, event.metadata);
        } else if (event.type === 'STUDY_SESSION_COMPLETED') {
          await MemoryConsumer.handleStudySessionCompleted(event.user_id, event.data);
        }
        break;
        
      case 'command_engine':
        if (event.type === 'AUTOPSY_MOCK_PROCESSED') {
          await CommandConsumer.handleAutopsyProcessed(event.user_id, event.metadata, event.data);
        } else if (event.type === 'STUDY_SESSION_COMPLETED') {
          await CommandConsumer.handleStudySessionCompleted(event.user_id, event.data);
        }
        break;

      case 'concept_expansion_engine':
        if (event.type === 'CONCEPT_DISCOVERED') {
          await ConceptExpansionConsumer.handleConceptDiscovered(event.user_id, event.data);
        }
        break;
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
      trace_id: event.trace_id,
      version: event.version,
      type: event.type,
      data: event.data,
      metadata: event.metadata,
      error_message: errorMessage
    });

    if (error) {
      logger.error('CRITICAL: Failed to write to Dead Letter Queue', { eventId: event.id, traceId: event.trace_id, error });
    } else {
      logger.info('Event moved to DLQ', { eventId: event.id, traceId: event.trace_id });
    }
  }
}

// Backward compatibility for existing code calls
export const EventOrchestrator = EventDispatcher;
