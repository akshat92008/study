const rateLimitMap = new Map<string, { count: number; lastReset: number }>();

export function rateLimit(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(ip);

  if (!userLimit) {
    rateLimitMap.set(ip, { count: 1, lastReset: now });
    return true; // Allowed
  }

  if (now - userLimit.lastReset > windowMs) {
    // Reset window
    rateLimitMap.set(ip, { count: 1, lastReset: now });
    return true; // Allowed
  }

  if (userLimit.count >= limit) {
    return false; // Rate limit exceeded
  }

  userLimit.count += 1;
  return true; // Allowed
}
