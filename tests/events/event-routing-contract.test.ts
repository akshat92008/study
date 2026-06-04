import { describe, it, expect } from 'vitest';
import { EVENT_CONSUMER_MATRIX, EVENT_CONSUMERS } from '@/lib/events/routes';
import { HANDLED_EVENT_CONSUMERS } from '@/lib/events/worker';

describe('Event Routing Contract', () => {
  it('every consumer in EVENT_CONSUMER_MATRIX must have a worker handler implementation', () => {
    const allRegisteredConsumers = new Set<string>();
    
    // Collect all consumers that are actually assigned to an event
    Object.values(EVENT_CONSUMER_MATRIX).forEach(consumers => {
      consumers.forEach(consumer => allRegisteredConsumers.add(consumer));
    });

    const handledConsumers = new Set(HANDLED_EVENT_CONSUMERS);

    const unhandledConsumers = Array.from(allRegisteredConsumers).filter(c => !handledConsumers.has(c));

    expect(unhandledConsumers).toEqual([]);
  });
  
  it('all EVENT_CONSUMERS array items must be correctly defined', () => {
    // This just ensures the types align
    const handledConsumers = new Set(HANDLED_EVENT_CONSUMERS);
    const unusedInWorkerButDefined = EVENT_CONSUMERS.filter(c => !handledConsumers.has(c));
    
    expect(unusedInWorkerButDefined).toEqual([]);
  });
});
