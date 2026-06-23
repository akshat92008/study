import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

async function requireAdminResponse() {
  const admin = await requireAdmin();
  if (admin.error) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }
  return null;
}

async function git(args: string[]) {
  return execFileAsync('git', args, { cwd: process.cwd(), maxBuffer: 1024 * 1024 });
}

export async function GET(req: NextRequest) {
  const authError = await requireAdminResponse();
  if (authError) return authError;
  void req;

  try {
    const { stdout, stderr } = await git(['status', '--short']);
    return NextResponse.json({ status: stdout || stderr });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authError = await requireAdminResponse();
  if (authError) return authError;

  try {
    const { message } = await req.json();
    if (typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Commit message is required' }, { status: 400 });
    }

    const add = await git(['add', '.']);
    const commit = await git(['commit', '-m', message.trim()]);
    const push = await git(['push']);
    
    return NextResponse.json({ 
      success: true, 
      output: [add.stdout, commit.stdout, push.stdout].filter(Boolean).join('\n'),
      errorOutput: [add.stderr, commit.stderr, push.stderr].filter(Boolean).join('\n')
    });
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      stdout: error.stdout,
      stderr: error.stderr
    }, { status: 500 });
  }
}
