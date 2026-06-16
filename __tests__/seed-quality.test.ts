import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function checkSeedFiles(dirPath: string, isPhysicsOrChem: boolean) {
  if (!fs.existsSync(dirPath)) return;
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Check for "placeholder" in any file
    expect(content.toLowerCase()).not.toContain('placeholder');
    
    // Check for the biology string in non-biology files
    if (isPhysicsOrChem) {
      expect(content).not.toContain('identify biological structures');
      expect(content).not.toContain('biological structures');
    }
  }
}

describe('NEET Seed Quality', () => {
  const baseDir = path.join(process.cwd(), 'lib/topic-seeding/templates/neet/data');
  
  it('physics seeds should not contain biology placeholders', () => {
    checkSeedFiles(path.join(baseDir, 'physics'), true);
  });

  it('chemistry seeds should not contain biology placeholders', () => {
    checkSeedFiles(path.join(baseDir, 'chemistry'), true);
  });

  it('biology seeds should not contain generic placeholders', () => {
    checkSeedFiles(path.join(baseDir, 'biology'), false);
  });
});
