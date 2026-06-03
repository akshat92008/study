const { processMockAutopsy } = require('./lib/engines/autopsy-engine');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const fileData = { kind: 'text', text: fs.readFileSync('/Users/ashishsingh/Downloads/kinetics.md', 'utf-8') };
  try {
    const result = await processMockAutopsy('test-user-id', fileData, 'Kinetics Test', 'NEET', { correctMarks: 4, negativeMarks: -1 });
    console.log(result);
  } catch (err) {
    console.error("Error:", err);
  }
}

// Next.js config uses ts-node if we import ts files, but let's just use ts-node
