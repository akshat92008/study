import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(file: string) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

describe('private beta MVP surface', () => {
  it('keeps main navigation limited to the MVP loop', () => {
    const sidebar = read('components/layout/Sidebar.tsx');
    const commandBar = read('components/ui/CommandBar.tsx');
    const navText = `${sidebar}\n${commandBar}`;

    for (const label of ['Today', 'MIND', 'Test Analysis', 'Progress', 'Revision Due']) {
      expect(navText).toContain(label);
    }

    for (const disabled of ['/planner', '/knowledge', '/analytics', '/mistakes', '/mentor', '/tutor']) {
      expect(navText).not.toContain(`route: '${disabled}'`);
      expect(navText).not.toContain(`href: '${disabled}'`);
      expect(navText).not.toContain(`href="${disabled}"`);
    }
  });

  it('does not hide beta-critical product routes in middleware', () => {
    const middleware = read('middleware.ts');

    expect(middleware).not.toContain('MVP_DISABLED_ROUTES');
    expect(middleware).not.toContain('disabled_for_mvp');

    for (const route of [
      '/planner',
      '/knowledge',
      '/analytics',
      '/mistakes',
      '/goals',
      '/api/planner',
      '/api/knowledge',
      '/api/ingest',
      '/api/ai/revision-coach',
    ]) {
      expect(middleware).not.toContain(`"${route}"`);
    }

    expect(middleware).toContain('CRON_ROUTES');
    expect(middleware).toContain('Authentication is required');
  });
});
