import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(file: string) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

describe('landing page layout contract', () => {
  it('keeps the global reset in Tailwind base so spacing utilities can win', () => {
    const css = read('app/globals.css');

    expect(css).toMatch(/@layer base\s*{\s*\*,\s*\*::before,\s*\*::after\s*{/);
    expect(css).toContain('box-sizing: border-box');
  });

  it('keeps landing content in centered normal-flow containers', () => {
    const landing = read('components/landing/CinematicLandingPage.tsx');

    expect(landing).toContain("const pageContainerClass = 'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'");
    expect(landing).toContain('<main className="relative min-h-screen overflow-x-hidden');
    expect(landing).toContain('grid grid-cols-1 items-center gap-12 lg:grid-cols-2');
    expect(landing).toContain('grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6');

    for (const unsafeClass of ['w-screen', 'overflow-visible', '-translate-x-1/2', 'lg:sticky']) {
      expect(landing).not.toContain(unsafeClass);
    }
  });
});
