function intFromEnv(key: string, fallback: number, min: number, max: number): number {
  const value = Number(process.env[key]);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function boolFromEnv(key: string, fallback: boolean): boolean {
  const value = process.env[key];
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export function getAutopsyV3Limits() {
  return {
    enabled: boolFromEnv('AUTOPSY_V3_ENABLED', true),
    maxPdfMb: intFromEnv('AUTOPSY_MAX_PDF_MB', 5, 1, 25),
    maxQuestionsPerAssessment: intFromEnv('AUTOPSY_MAX_QUESTIONS_PER_ASSESSMENT', 200, 1, 500),
    maxAiMistakesPerBatch: intFromEnv('AUTOPSY_MAX_AI_MISTAKES_PER_BATCH', 25, 1, 100),
    maxReportTokens: intFromEnv('AUTOPSY_MAX_REPORT_TOKENS', 1200, 200, 5000),
    dailyAssessmentsPerUser: intFromEnv('AUTOPSY_DAILY_ASSESSMENTS_PER_USER', 3, 1, 50),
    dailyPdfUploadsPerUser: intFromEnv('AUTOPSY_DAILY_PDF_UPLOADS_PER_USER', 2, 0, 50),
    dailyReportsPerUser: intFromEnv('AUTOPSY_DAILY_REPORTS_PER_USER', 3, 0, 50),
    experimentalOcrEnabled: boolFromEnv('AUTOPSY_EXPERIMENTAL_OCR_ENABLED', false),
    hermesEnabled: boolFromEnv('HERMES_AUTOPSY_V3_ENABLED', true),
    hermesMode: process.env.HERMES_AUTOPSY_V3_MODE || 'lite',
    maxMemoryWritesPerReport: intFromEnv('HERMES_AUTOPSY_MAX_MEMORY_WRITES_PER_REPORT', 10, 0, 50),
    maxRevisionCardsPerReport: intFromEnv('AUTOPSY_MAX_REVISION_CARDS_PER_REPORT', 20, 0, 50),
    maxReminders: intFromEnv('HERMES_AUTOPSY_MAX_REMINDERS', 3, 1, 10),
  };
}

export function maxPdfBytes(): number {
  return getAutopsyV3Limits().maxPdfMb * 1024 * 1024;
}

export function since24HoursIso(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}
