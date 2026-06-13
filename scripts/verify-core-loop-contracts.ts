import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE_ROOTS = ['app', 'components', 'lib', 'stores'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return EXTENSIONS.has(path.extname(entry.name)) ? [full] : [];
  });
}

const files = SOURCE_ROOTS.flatMap((root) => walk(path.join(ROOT, root)));
const violations: string[] = [];
const forbidden = [
  ['legacy event RPC', /publish_event_with_consumers/g],
  ['legacy replan RPC', /atomic_replan/g],
  ['legacy task increment RPC', /increment_daily_tasks_completed/g],
  ['legacy mastery field', /\.select\([^\n]*mastery_level|\bmastery_level\b/g],
  ['user-facing PULSE route', /href\s*=\s*["']\/pulse|router\.push\(["']\/pulse/g],
  ['recovery_ready without recoverable count check', /status\s*:\s*['"]recovery_ready['"].*?(?!recoverable)/g],
  ['needs_review without parsed answers/diagnoses', /status\s*:\s*['"]needs_review['"].*?(?!parsed_answers|diagnoses)/g],
];

for (const file of files) {
  const relative = path.relative(ROOT, file);
  const text = fs.readFileSync(file, 'utf8');
  for (const [label, pattern] of forbidden as Array<[string, RegExp]>) {
    if (pattern.test(text)) violations.push(`${relative}: ${label}`);
    pattern.lastIndex = 0;
  }
  if (relative === 'components/dashboard/CommandCenter.tsx' && /activeGoalId\s*:\s*null/.test(text)) {
    violations.push(`${relative}: goal-less dashboard chat`);
  }
  if (/extractAndStorePracticeArtifacts/.test(text) && /app\/api\/practice\/sets/.test(relative)) {
    violations.push(`${relative}: canonical practice generation cannot parse assistant markdown`);
  }
  if (/from\(['"]revision_cards['"]\)\.insert/.test(text) && !/concept_id|conceptId/.test(text)) {
    violations.push(`${relative}: revision card insert lacks concept linkage`);
  }
  if (/app\/admin\/.*page\.tsx|app\/api\/admin\/.*route\.ts/.test(relative) && !/requireAdmin/.test(text)) {
    violations.push(`${relative}: direct admin route export without requireAdmin`);
  }
  if (/(?:applyLearningEvent|projectLearningSignal|createRevisionCardsForUser)[^}]*catch\s*\([^)]*\)\s*\{\s*console\.(?:warn|error)/.test(text) && !/(?:throw|return \{)/.test(text)) {
    violations.push(`${relative}: swallowed core error`);
  }
  const lines = text.split('\n');
  for (const line of lines) {
    if (/((?:concept|topic)[a-zA-Z0-9_]*\s*(?:\|\||\?\?)\s*['"]unknown['"])|(?:\b(?:concept|topic)\b[^,;{}]*(?:\|\||\?\?)\s*['"]unknown['"])/i.test(line) && !/INVALID_TOPICS/.test(line)) {
      violations.push(`${relative}: concept fallback to "unknown"`);
    }
  }
}

if (violations.length > 0) {
  console.error(JSON.stringify({ ok: false, violations }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, filesScanned: files.length }, null, 2));
