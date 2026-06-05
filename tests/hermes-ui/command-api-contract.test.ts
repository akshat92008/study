import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const commandRoute = path.join(root, 'app/api/hermes/command/route.ts');
const dashboardSource = fs.readFileSync(path.join(root, 'app/(dashboard)/dashboard/page.tsx'), 'utf8');
const chatSource = fs.readFileSync(path.join(root, 'components/chat/GlobalChat.tsx'), 'utf8');

describe('Public Hermes command surface contract', () => {
  it('removes the user-facing Hermes command route', () => {
    expect(fs.existsSync(commandRoute)).toBe(false);
  });

  it('does not call the deleted Hermes command API from active UI surfaces', () => {
    expect(dashboardSource).not.toContain('HermesCommandCard');
    expect(dashboardSource).toContain('AmauraNotificationFeed');
    expect(chatSource).not.toContain('/api/hermes/command');
    expect(chatSource).not.toContain('classifyHermesIntent');
  });
});
