const AUTOPSY_TERMS = /\b(autopsy|mock|test analysis|analyse my test|analyze my test|analyse my mock|analyze my mock|omr|answer key|response sheet|result sheet|marksheet|marks lost|wrong answers)\b/i;
const EXPLANATION_TERMS = /\b(explain|summari[sz]e|teach|solve|read this|what does this say|make notes|notes from)\b/i;

export function isAutopsyUploadIntent(message?: string | null, fileName?: string | null): boolean {
  const text = `${message ?? ''} ${fileName ?? ''}`.trim();
  if (!text) return false;
  if (EXPLANATION_TERMS.test(message ?? '') && !AUTOPSY_TERMS.test(message ?? '')) return false;
  return AUTOPSY_TERMS.test(text);
}
