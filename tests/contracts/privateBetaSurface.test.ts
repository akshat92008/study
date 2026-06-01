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

  it('blocks disabled private-beta routes in middleware while allowing MVP APIs', () => {
    const middleware = read('middleware.ts');

    for (const disabled of [
      '"/planner"',
      '"/knowledge"',
      '"/analytics"',
      '"/mistakes"',
      '"/api/planner"',
      '"/api/knowledge"',
      '"/api/ingest"',
      '"/api/ai/revision-coach"',
    ]) {
      expect(middleware).toContain(disabled);
    }

    for (const allowed of [
      '"/api/ai/chat"',
      '"/api/dashboard/session-card"',
      '"/api/autopsy/ingest"',
      '"/api/revision"',
      '"/api/atlas/mastery"',
      '"/api/cron"',
    ]) {
      const disabledRoutesBlock = middleware.slice(
        middleware.indexOf('const MVP_DISABLED_ROUTES'),
        middleware.indexOf('];', middleware.indexOf('const MVP_DISABLED_ROUTES'))
      );
      expect(disabledRoutesBlock).not.toContain(allowed);
    }
  });
});
