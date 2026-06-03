const { processMockAutopsy } = require('./lib/engines/autopsy-engine');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const base64 = fs.readFileSync('/Users/ashishsingh/Downloads/original.pdf').toString('base64');
  const fileData = { kind: 'inline', mimeType: 'application/pdf', data: base64 };

  try {
    const result = await processMockAutopsy(
      '5f7b7f7b-8ece-412d-a823-323d0539a713',
      fileData,
      'Test PDF',
      'NEET'
    );
    console.log('Success:', result);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
