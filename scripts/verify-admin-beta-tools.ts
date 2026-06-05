import fs from 'fs';
import path from 'path';

function checkFile(filepath: string, requiredContent: string[]) {
  const fullPath = path.join(process.cwd(), filepath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Missing file: ${filepath}`);
    process.exit(1);
  }
  const content = fs.readFileSync(fullPath, 'utf-8');
  for (const text of requiredContent) {
    if (!content.includes(text)) {
      console.error(`❌ File ${filepath} missing required content: "${text}"`);
      process.exit(1);
    }
  }
}

async function verifyAdminTools() {
  console.log('Verifying Admin Beta Tools...');
  checkFile('app/api/admin/users/grant-beta/route.ts', ['grantBetaAccess']);
  checkFile('app/api/admin/users/revoke-beta/route.ts', ['revokeBetaAccess']);
  checkFile('lib/admin/user-management.ts', ['grantBetaAccess', 'revokeBetaAccess']);
  console.log('✅ Admin Beta Tools Verified');
}

verifyAdminTools().catch((err) => {
  console.error(err);
  process.exit(1);
});
