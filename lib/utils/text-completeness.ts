/**
 * Checks if a piece of AI-generated text looks truncated or incomplete.
 */
export function looksTruncated(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  // Ends cleanly with a terminal punctuation or a closing code fence
  const endsCleanly = /[.!?)]$/.test(trimmed) || trimmed.endsWith('```') || trimmed.endsWith('*/') || trimmed.endsWith('}');
  
  // Check for unclosed code fences
  const codeFenceCount = (trimmed.match(/```/g) || []).length;
  const hasOpenCodeFence = codeFenceCount % 2 === 1;

  // If it doesn't end cleanly and is reasonably long, it's likely truncated
  // Or if it has an unclosed code block
  return hasOpenCodeFence || (!endsCleanly && trimmed.length > 500);
}
