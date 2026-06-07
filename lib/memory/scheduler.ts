export function firstDueAt(now = new Date()) {
  return now.toISOString();
}

export function nextDueAt(days: number, now = new Date()) {
  return new Date(now.getTime() + days * 86_400_000).toISOString();
}

