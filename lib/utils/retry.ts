// lib/utils/retry.ts
/**
 * Simple exponential backoff retry helper.
 * @param fn async function to execute
 * @param retries number of attempts (default 3)
 * @param baseDelay initial delay in ms (default 500)
 */
export async function retry<T>(
  fn: () => Promise<T>,
  retries = 3,
  baseDelay = 500
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt > retries) throw err;
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
}
