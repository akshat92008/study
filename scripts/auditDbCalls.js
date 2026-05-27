const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const extensions = new Set(['.ts', '.tsx']);

const ignoredPathParts = [
  `${path.sep}node_modules${path.sep}`,
  `${path.sep}.next${path.sep}`,
  `${path.sep}scratch${path.sep}`,
  `${path.sep}lib${path.sep}db${path.sep}migrations${path.sep}`,
];

const forbiddenTokens = [
  'next_review',
  'last_study_date',
  'last_session_date',
  'friction_score',
  'signal_data',
  'detected_at',
  'tutor_session_states',
  'mastery_level:',
  "select('id, mastery_level",
  'mastery_level =',
];

function shouldSkip(file) {
  return ignoredPathParts.some((part) => file.includes(part));
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (shouldSkip(full)) continue;

    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full, files);
    } else if (extensions.has(path.extname(full))) {
      files.push(full);
    }
  }
  return files;
}

const offenders = [];

for (const file of walk(root)) {
  if (file.endsWith('noSchemaDrift.test.ts')) continue;

  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    for (const token of forbiddenTokens) {
      if (line.includes(token)) {
        offenders.push(`${path.relative(root, file)}:${index + 1} -> ${token}`);
      }
    }
  });
}

if (offenders.length > 0) {
  console.error('Schema drift tokens found:');
  offenders.forEach((offender) => console.error(`- ${offender}`));
  process.exit(1);
}

console.log('✅ No forbidden schema drift tokens found in live TypeScript code.');
