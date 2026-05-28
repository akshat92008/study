import { AsyncLocalStorage } from 'async_hooks';

// AsyncLocalStorage provides a way to pass context through asynchronous operations
// without having to explicitly pass it as a parameter to every function.
// This is used for generating and tracking Correlation IDs across the entire request lifecycle.

const storage = typeof window === 'undefined' ? new AsyncLocalStorage<string>() : null;

export function withCorrelationId<T>(id: string, fn: () => T): T {
  if (storage) {
    return storage.run(id, fn);
  }
  return fn();
}

export function getCorrelationId(): string | undefined {
  if (storage) {
    return storage.getStore();
  }
  return undefined;
}

export function generateCorrelationId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID 
    ? crypto.randomUUID() 
    : Math.random().toString(36).substring(2, 15);
}
