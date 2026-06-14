export const EVENT_CONSUMERS = [
  'downstream_publisher_qstash',
  'downstream_publisher_kafka',
] as const;

export type EventConsumer = typeof EVENT_CONSUMERS[number];

export function getConsumersForEvent(type: string): readonly EventConsumer[] {
  // The worker no longer performs learner-state mutations.
  // It strictly publishes domain events to downstream systems.
  return ['downstream_publisher_qstash', 'downstream_publisher_kafka'];
}

export function assertEventConsumerRoute(type: string, consumer: string): asserts consumer is EventConsumer {
  const expected = getConsumersForEvent(type);
  if (!expected.includes(consumer as EventConsumer)) {
    throw new Error(`Event routing error: ${consumer} is not registered for ${type}`);
  }
}
