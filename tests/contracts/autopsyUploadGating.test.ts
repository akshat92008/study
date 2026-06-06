/**
 * tests/contracts/autopsyUploadGating.test.ts
 *
 * Contract: AUTOPSY uploads are controlled by ENABLE_AUTOPSY_UPLOADS,
 * independent of ENABLE_VISION_UPLOADS (which applies to chat).
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const root = process.cwd();

describe('Autopsy Upload Gating Contracts', () => {
  it('autopsyUploads flag exists in flags.ts', () => {
    const flagsPath = path.join(root, 'lib', 'config', 'flags.ts');
    const flags = fs.readFileSync(flagsPath, 'utf8');
    
    // The flag should be defined as: autopsyUploads: () => isEnabled('ENABLE_AUTOPSY_UPLOADS', true),
    expect(flags).toContain('autopsyUploads:');
    expect(flags).toContain('ENABLE_AUTOPSY_UPLOADS');
  });

  it('Autopsy v3 upload route checks autopsyUploads flag', () => {
    const v3UploadPath = path.join(root, 'app', 'api', 'autopsy', 'v3', 'upload', 'route.ts');
    
    // Some routes might not exist if v3 is disabled, but if it exists, it must be gated
    if (fs.existsSync(v3UploadPath)) {
      const v3Upload = fs.readFileSync(v3UploadPath, 'utf8');
      expect(v3Upload).toContain('featureFlags.autopsyUploads()');
      
      // Ensure it's not checking visionUploads
      expect(v3Upload).not.toContain('featureFlags.visionUploads()');
    }
  });

  it('Chat upload routing checks visionUploads flag, not autopsyUploads', () => {
    const chatPipelinePath = path.join(root, 'lib', 'chat', 'pipeline.ts');
    const chatPipeline = fs.readFileSync(chatPipelinePath, 'utf8');
    
    expect(chatPipeline).toContain('featureFlags.visionUploads()');
    expect(chatPipeline).not.toContain('featureFlags.autopsyUploads()');
  });
});
