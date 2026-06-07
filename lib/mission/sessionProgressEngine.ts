export function nextRecommendedActionFromMutations(summary: {
  revisionCardsCreated: number;
  conceptsUpdated: number;
  microtargetsUpdated: number;
}) {
  if (summary.revisionCardsCreated > 0) return { type: 'review', label: 'Review the new MEMORY card' };
  if (summary.conceptsUpdated > 0) return { type: 'practice', label: 'Do one quick check on the weak concept' };
  if (summary.microtargetsUpdated > 0) return { type: 'mission', label: "Continue today's mission" };
  return { type: 'continue', label: 'Continue studying' };
}
