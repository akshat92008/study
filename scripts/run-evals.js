const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const datasetPath = path.join(root, 'evals', 'seed-ground-truth.json');
const resultsPath = path.join(root, 'evals', 'latest-results.json');

const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

function mockedAnswer(item) {
  switch (item.task) {
    case 'autopsy':
      return 'I cannot diagnose mistakes from a bare question paper. Upload the answer key, student answers, OMR/result sheet, or marked copy first.';
    case 'tutor':
      return 'The sign comes from whether enthalpy is absorbed or released. Socratic question: what does a positive enthalpy change mean in your own words?';
    case 'daily_plan':
      return 'Start with due cards, then a torque prerequisite drill, then rotational motion practice. Keep the first task specific and short.';
    case 'revision_card':
      return 'Front: Is a nucleophile electron-rich or electron-poor? Back: A nucleophile is electron-rich and attacks an electrophile.';
    default:
      return '';
  }
}

const results = dataset.map((item) => {
  const answer = mockedAnswer(item).toLowerCase();
  const required = item.must_include || [];
  const passedTerms = required.filter((term) => answer.includes(term.toLowerCase()));
  return {
    id: item.id,
    task: item.task,
    score: required.length === 0 ? 1 : passedTerms.length / required.length,
    passed_terms: passedTerms,
    missing_terms: required.filter((term) => !passedTerms.includes(term)),
    mode: process.env.LIVE_AI_EVALS === 'true' ? 'live_placeholder' : 'mocked_ci',
  };
});

const summary = {
  generated_at: new Date().toISOString(),
  average_score: results.reduce((sum, result) => sum + result.score, 0) / Math.max(1, results.length),
  results,
};

fs.writeFileSync(resultsPath, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
