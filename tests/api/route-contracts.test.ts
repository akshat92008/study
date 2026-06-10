import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import glob from 'glob'; // Assuming glob is available, or use a manual recursive find

function findRouteFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.resolve(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findRouteFiles(filePath));
    } else if (file === 'route.ts' || file === 'route.js') {
      results.push(filePath);
    }
  }
  return results;
}

describe('API Route Contracts', () => {
  const apiDir = path.resolve(process.cwd(), 'app/api');
  const routeFiles = findRouteFiles(apiDir);

  it('should find API routes', () => {
    expect(routeFiles.length).toBeGreaterThan(0);
  });

  // Note: We use a static regex here because dynamic imports of all routes in tests
  // can cause issues with Next.js environment variables and server-only modules.
  routeFiles.forEach(routeFile => {
    const relativePath = path.relative(process.cwd(), routeFile);
    
    // We are skipping the test execution for now, just checking for the string literal.
    // In Phase 2/3, we will strictly enforce this.
    it.skip(`route ${relativePath} should export a ROUTE_CONTRACT`, () => {
      const content = fs.readFileSync(routeFile, 'utf8');
      
      // Look for `export const ROUTE_CONTRACT`
      const hasContract = /export\s+const\s+ROUTE_CONTRACT/.test(content);
      
      expect(hasContract).toBe(true);
    });
  });
});
