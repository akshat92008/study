/**
 * Logs a student event to the event bus in a fire-and-forget manner.
 */
export function logStudentEvent(type: string, data: any) {
  try {
    fetch('/api/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type, data }),
    }).catch(err => {
      // Fail silently in production, log to console in dev
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Failed to log student event:', err);
      }
    });
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Error emitting student event:', e);
    }
  }
}
