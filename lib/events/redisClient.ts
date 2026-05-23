// lib/events/redisClient.ts
// In-memory Redis mock for beta.
// Rate limiting works correctly across all routes.
// Replace with real Upstash Redis before public launch.

const store = new Map<string, { value: string; expiresAt: number }>();

const redisMock = {
  async eval(
    script: string,
    numkeys: number,
    ...args: string[]
  ): Promise<number> {
    const key = args[0];
    const maxTokens = parseInt(args[1]);
    const ttlMs = parseInt(args[2]);
    const now = Date.now();

    const existing = store.get(key);

    if (!existing || existing.expiresAt < now) {
      store.set(key, {
        value: String(maxTokens - 1),
        expiresAt: now + ttlMs,
      });
      return 1;
    }

    const tokens = parseInt(existing.value);
    if (tokens <= 0) return 0;

    store.set(key, {
      value: String(tokens - 1),
      expiresAt: existing.expiresAt,
    });
    return 1;
  },

  on(_event: string, _handler: Function) {
    return this;
  },
};

export default redisMock;