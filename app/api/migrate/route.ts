import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!password) {
    return NextResponse.json({ error: 'Missing SUPABASE_DB_PASSWORD in environment' }, { status: 500 });
  }

  const sqlPath = path.join(process.cwd(), 'scratch', 'soul_layer_migration.sql');
  if (!fs.existsSync(sqlPath)) {
    return NextResponse.json({ error: 'Migration SQL file not found at: ' + sqlPath }, { status: 404 });
  }
  const sql = fs.readFileSync(sqlPath, 'utf8');

  let success = false;
  let connectionLog: string[] = [];

  // Try direct database host connection first
  const directConnStr = `postgresql://postgres:${password}@db.ubzvhajvcoiovkgwnsgu.supabase.co:5432/postgres`;
  connectionLog.push('Testing direct connection to db.ubzvhajvcoiovkgwnsgu.supabase.co:5432...');
  
  let directClient = new Client({
    connectionString: directConnStr,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });

  try {
    await directClient.connect();
    connectionLog.push('🎉 SUCCESS! Connected directly to Supabase host. Running migration...');
    await directClient.query(sql);
    connectionLog.push('✅ Soul Layer migration applied successfully!');
    await directClient.end();
    success = true;
  } catch (err: any) {
    connectionLog.push(`Direct connection failed: ${err.message}`);
  }

  if (!success) {
    const regions = [
      'ap-south-1',
      'ap-southeast-1',
      'ap-southeast-2',
      'ap-northeast-1',
      'ap-northeast-2',
      'us-east-1',
      'us-east-2',
      'us-west-1',
      'us-west-2',
      'ca-central-1',
      'eu-west-1',
      'eu-west-2',
      'eu-west-3',
      'eu-central-1',
      'sa-east-1'
    ];

    for (const region of regions) {
      for (const port of [6543, 5432]) {
        const connStr = `postgresql://postgres.ubzvhajvcoiovkgwnsgu:${password}@aws-0-${region}.pooler.supabase.com:${port}/postgres`;
        connectionLog.push(`Testing pooler ${region} on port ${port}...`);

        const client = new Client({
          connectionString: connStr,
          ssl: { rejectUnauthorized: false },
          connectionTimeoutMillis: 3000
        });

        try {
          await client.connect();
          connectionLog.push(`🎉 SUCCESS! Connected to pooler ${region} on port ${port}. Running migration...`);
          await client.query(sql);
          connectionLog.push('✅ Soul Layer migration applied successfully!');
          await client.end();
          success = true;
          break;
        } catch (err: any) {
          connectionLog.push(`Failed connection to pooler ${region} on port ${port}: ${err.message}`);
        }
      }
      if (success) break;
    }
  }

  if (success) {
    return NextResponse.json({ success: true, log: connectionLog });
  } else {
    return NextResponse.json({ success: false, log: connectionLog }, { status: 500 });
  }
}
