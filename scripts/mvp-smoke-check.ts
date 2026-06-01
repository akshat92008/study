import fs from 'fs';
import path from 'path';
import http from 'http';
import dotenv from 'dotenv';

async function checkSmoke() {
  const modeArg = process.argv.find((arg) => arg.startsWith('--mode='));
  const mode = modeArg?.split('=')[1] || 'local';
  console.log('--- Cognition OS MVP Smoke Check ---\n');
  let passed = true;

  // 1. Node version
  const nodeVer = process.version;
  console.log(`Node version: ${nodeVer}`);
  if (parseInt(nodeVer.replace('v', '').split('.')[0]) < 18) {
    console.error('❌ Node version must be 18+');
    passed = false;
  } else {
    console.log('✅ Node version ok');
  }

  // 2. npm install completed
  const nodeModulesPath = path.join(process.cwd(), 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    console.error('❌ node_modules not found. Run npm install.');
    passed = false;
  } else {
    console.log('✅ node_modules found');
  }

  // 3. Required env vars exist
  dotenv.config({ path: path.join(process.cwd(), '.env.local') });
  dotenv.config();
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'CRON_SECRET',
  ];
  
  if (process.env.SKIP_ENV_VALIDATION === '1') {
    console.log('⚠️ Skipping env var validation due to SKIP_ENV_VALIDATION=1');
  } else {
    for (const v of requiredVars) {
      if (!process.env[v]) {
        console.error(`❌ Missing env var: ${v}`);
        passed = false;
      } else {
        console.log(`✅ ${v} exists`);
      }
    }
  }

  const aiProviders = [
    'OPENAI_API_KEY',
    'GEMINI_API_KEY',
    'CEREBRAS_API_KEY',
    'GROQ_API_KEY',
    'SAMBANOVA_API_KEY',
    'CF_API_TOKEN',
  ];
  if (process.env.SKIP_ENV_VALIDATION === '1') {
    // Skip checking AI providers
  } else if (aiProviders.some((v) => process.env[v])) {
    console.log('✅ At least one AI provider is configured');
  } else {
    console.error(`❌ Missing AI provider. Configure one of: ${aiProviders.join(', ')}`);
    passed = false;
  }

  // Upstash conditional
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      console.error('❌ Missing Upstash env vars in production');
      passed = false;
    } else {
      console.log('✅ Upstash env vars exist for production');
    }
  } else {
    console.log('✅ Upstash optional in non-production (mocked)');
  }

  // 4. Migration files exist
  const migrationsPath = path.join(process.cwd(), 'supabase', 'migrations');
  if (fs.existsSync(migrationsPath) && fs.readdirSync(migrationsPath).length > 0) {
    console.log(`✅ Migrations exist at ${migrationsPath}`);
  } else {
    console.error('❌ No migrations found');
    passed = false;
  }

  // 5. Package scripts
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  const scripts = ['typecheck', 'test', 'audit:schema', 'verify:schema', 'verify:local', 'verify:production', 'verify:mvp'];
  for (const s of scripts) {
    if (!pkg.scripts[s]) {
      console.error(`❌ Missing package script: ${s}`);
      passed = false;
    } else {
      console.log(`✅ Package script ${s} exists`);
    }
  }

  if (mode === 'mvp') {
    const packageJsonText = fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8');
    if (/verify:mvp[^"]*SKIP_ENV_VALIDATION/.test(packageJsonText) || /verify:production[^"]*SKIP_ENV_VALIDATION/.test(packageJsonText)) {
      console.error('❌ Production/MVP verification must not skip env validation');
      passed = false;
    } else {
      console.log('✅ Production/MVP verification does not skip env validation');
    }

    const migrationSql = fs
      .readdirSync(migrationsPath)
      .filter((file) => file.endsWith('.sql'))
      .sort()
      .map((file) => fs.readFileSync(path.join(migrationsPath, file), 'utf8'))
      .join('\n');

    const requiredSqlSignals = [
      'create or replace function public.complete_study_session',
      'auth.uid() is null or auth.uid() <> p_user_id',
      'create or replace function public.ingest_mock_autopsy',
      'create or replace function public.reserve_ai_budget',
      'create unique index if not exists idx_revision_cards_unique_source',
    ];

    for (const signal of requiredSqlSignals) {
      if (!migrationSql.includes(signal)) {
        console.error(`❌ Missing MVP migration signal: ${signal}`);
        passed = false;
      } else {
        console.log(`✅ Migration signal present: ${signal}`);
      }
    }

    for (const file of [
      'lib/events/autopsy-evidence.ts',
      'lib/engines/cognition-graph.ts',
      'lib/engines/revision-engine.ts',
      'lib/engines/command-engine.ts',
    ]) {
      const contents = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      if (!contents.includes('isVerifiedAutopsyMistake')) {
        console.error(`❌ ${file} does not enforce verified AUTOPSY evidence`);
        passed = false;
      } else {
        console.log(`✅ ${file} enforces verified AUTOPSY evidence`);
      }
    }
  }

  // 6. Local server health
  console.log('Checking local server health (http://localhost:3000/api/health)...');
  try {
    const req = http.get('http://localhost:3000/api/health', (res) => {
      console.log(`✅ Server responded with status ${res.statusCode}`);
    });
    req.on('error', (e) => {
      console.log('⚠️ Server not running or /api/health not available, skipping health check');
    });
    req.end();
  } catch (err) {
    console.log('⚠️ Server check skipped');
  }

  setTimeout(() => {
    if (!passed) {
      console.error('\n❌ Smoke check failed.');
      process.exit(1);
    } else {
      console.log('\n✅ All smoke checks passed.');
      process.exit(0);
    }
  }, 1000);
}

checkSmoke();
