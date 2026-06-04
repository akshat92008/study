export interface ParsedAnswerKeyItem {
  question_number: number;
  correct_answer: string;
  confidence: number;
}

export function parseAnswerKeyText(input: string): ParsedAnswerKeyItem[] {
  const results = new Map<number, ParsedAnswerKeyItem>();
  const lines = input.split(/\r?\n|,/).map((line) => line.trim()).filter(Boolean);

  for (const line of lines) {
    const match =
      line.match(/^(?:q(?:uestion)?\s*)?(\d{1,4})\s*[:.)-]?\s*([A-Da-d1-4])\b/i) ||
      line.match(/^(\d{1,4})\s+(.{1,80})$/i);
    if (!match) continue;

    const questionNumber = Number(match[1]);
    const answer = match[2]?.trim();
    if (!Number.isInteger(questionNumber) || questionNumber <= 0 || !answer) continue;

    results.set(questionNumber, {
      question_number: questionNumber,
      correct_answer: answer.toUpperCase(),
      confidence: /^[A-Da-d1-4]$/.test(answer) ? 0.95 : 0.65,
    });
  }

  return Array.from(results.values()).sort((a, b) => a.question_number - b.question_number);
}
