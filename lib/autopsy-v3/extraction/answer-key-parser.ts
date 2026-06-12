export interface ParsedAnswerKeyItem {
  question_number: number;
  correct_answer: string;
  confidence: number;
}

export function parseAnswerKeyText(input: string): ParsedAnswerKeyItem[] {
  // Normalize input string:
  // 1. Convert table bars '|' to commas so they act as delimiters.
  // 2. Add spaces around common delimiters so tightly coupled answers like "31)A" become "31 ) A" which is easier to regex.
  let normalizedInput = input.replace(/\|/g, ',');
  
  const results = new Map<number, ParsedAnswerKeyItem>();
  
  // Split on newlines, commas, or multiple spaces (acting as column separators)
  const tokens = normalizedInput.split(/\r?\n|,|\s{2,}/).map(t => t.trim()).filter(Boolean);

  for (const token of tokens) {
    // Match common formats: "1 A", "1. A", "1) A", "1-A", "1)A"
    // Also captures just the numbers and answer tokens if separated
    const match =
      token.match(/^(?:q(?:uestion)?\s*)?(\d{1,4})\s*[:.)-]?\s*([A-Da-d1-4])\b/i) ||
      token.match(/^(\d{1,4})\s+(.{1,80})$/i);
    
    if (match) {
      const questionNumber = Number(match[1]);
      const answer = match[2]?.trim();
      if (Number.isInteger(questionNumber) && questionNumber > 0 && answer) {
        results.set(questionNumber, {
          question_number: questionNumber,
          correct_answer: answer.toUpperCase(),
          confidence: /^[A-Da-d1-4]$/.test(answer) ? 0.95 : 0.65,
        });
      }
      continue;
    }

    // Try to extract multiple question-answer pairs packed in a single token without clear delimiters
    // e.g. "1A 2B 3C" or "31 A 32 B 33 C"
    const packedMatches = Array.from(token.matchAll(/(?:^|\s)(\d{1,4})\s*[:.)-]?\s*([A-Da-d1-4])(?=\s|$|\d)/gi));
    if (packedMatches.length > 0) {
      for (const m of packedMatches) {
        const questionNumber = Number(m[1]);
        const answer = m[2]?.trim();
        if (Number.isInteger(questionNumber) && questionNumber > 0 && answer) {
          results.set(questionNumber, {
            question_number: questionNumber,
            correct_answer: answer.toUpperCase(),
            confidence: 0.95,
          });
        }
      }
    }
  }

  return Array.from(results.values()).sort((a, b) => a.question_number - b.question_number);
}
