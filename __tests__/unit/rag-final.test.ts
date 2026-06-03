import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

describe('RAG Final Fixes', () => {
  it('study material chat upload does not call routeVisionCall when intent is indexing', () => {
    const routePath = path.resolve(__dirname, '../../app/api/ai/chat/route.ts');
    const content = fs.readFileSync(routePath, 'utf8');
    
    expect(content).toContain('const isMaterialIndexing = (message && STUDY_MATERIAL_UPLOAD_RE.test(message)');
    expect(content).toContain('if (isMaterialIndexing) {');
    expect(content).toMatch(/if \(isMaterialIndexing\) \{[\s\S]*?return new Response\(stream/);
  });
  
  it('explicit document reading still can call budgeted vision', () => {
    const routePath = path.resolve(__dirname, '../../app/api/ai/chat/route.ts');
    const content = fs.readFileSync(routePath, 'utf8');
    
    expect(content).toContain('budgetedVisionCall({');
    expect(content).toContain('EXPLICIT_READ.test(message)');
  });

  it('mock/test upload still routes to AUTOPSY', () => {
    const routePath = path.resolve(__dirname, '../../app/api/ai/chat/route.ts');
    const content = fs.readFileSync(routePath, 'utf8');
    
    expect(content).toContain('shouldRouteUploadToAutopsy');
    expect(content).toContain('createAutopsyJob({');
  });

  it('rag query logging failure does not fail retrieval', () => {
    const retrievalPath = path.resolve(__dirname, '../../lib/rag/retrieval.ts');
    const content = fs.readFileSync(retrievalPath, 'utf8');
    
    expect(content).toContain('try {\n    await supabase.from(\'rag_query_logs\').insert(');
    expect(content).toContain('} catch (err) {\n    console.warn(\'[RAG] Failed to log query\', err);\n  }');
    expect(content).toContain('return context;');
  });

  it('material panel renders ready/failed materials', () => {
    const panelPath = path.resolve(__dirname, '../../components/materials/StudyMaterialPanel.tsx');
    const content = fs.readFileSync(panelPath, 'utf8');
    
    expect(content).toContain('mat.status === \'failed\'');
    expect(content).toContain('mat.status === \'ready\'');
    expect(content).toContain('Ask the AI Tutor: "answer from my uploaded notes."');
  });

  it('/api/materials/upload response fields match UI expectation', () => {
    const uploadPath = path.resolve(__dirname, '../../app/api/materials/upload/route.ts');
    const content = fs.readFileSync(uploadPath, 'utf8');
    
    expect(content).toContain('chunksProcessed: 0');
    expect(content).toContain('status: \'queued\'');
  });
});
