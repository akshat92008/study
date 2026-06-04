import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
function readMigrations() {
  const dir = path.join(process.cwd(), 'supabase', 'migrations');
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .map((file) => fs.readFileSync(path.join(dir, file), 'utf8'))
    .join('\n');
}
describe('seeded_topics schema', () => {
  it('contains runtime-required seeded_topics columns', () => {
    const sql = readMigrations();
    expect(sql).toContain('seeded_topics');
    expect(sql).toContain('order_index');
    expect(sql).toContain('topic_slug');
    expect(sql).toContain('microtarget_slug');
    expect(sql).toContain('metadata');
  });
  it('contains idempotency constraint', () => {
    const sql = readMigrations();
    expect(sql).toContain('seeded_topics_goal_template_topic_microtarget_key');
    expect(sql).toContain('topic_slug');
    expect(sql).toContain('microtarget_slug');
  });
});
