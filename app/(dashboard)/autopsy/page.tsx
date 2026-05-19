'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useAppStore } from '@/stores/appStore';
import { Upload, Loader2, Crosshair } from 'lucide-react';
import AutopsyDashboard from '@/components/autopsy/AutopsyDashboard';

export default function MockAutopsyPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [result, setResult] = useState<any>(null);
  
  const { addToast } = useAppStore();

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return addToast('Please select a mock paper', 'error');

    setLoading(true);
    setStatusMsg('Uploading and running OCR extraction...');
    
    // Fake streaming status updates for better UX during long Gemini calls
    const states = [
      'Extracting answers via Gemini 2.5 Flash...',
      'Mapping incorrect responses to syllabus chapters...',
      'Diagnosing root cognitive failures...',
      'Generating Mentor sprint plan...'
    ];
    let i = 0;
    const interval = setInterval(() => {
      if (i < states.length) setStatusMsg(states[i++]);
    }, 2500);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('testName', file.name);

      const res = await fetch('/api/autopsy/ingest', {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Autopsy failed');

      setResult(data);
      addToast('Autopsy completed successfully!', 'success');
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)', maxWidth: '64rem', margin: '0 auto', paddingBottom: 'var(--sp-12)' }}>
      
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 'var(--fs-3xl)', fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-tight)', display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
          <Crosshair color="var(--accent-cyan)" size={32} />
          Mock Test Autopsy
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--sp-2)' }}>
          Upload your mock test PDF or Text. Let the AI extract every recoverable point.
        </p>
      </div>

      {/* Upload State */}
      {!result && !loading && (
        <Card padding="lg" style={{ borderStyle: 'dashed', borderWidth: '2px', borderColor: 'var(--border-strong)', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '350px' }}>
          <div style={{ background: 'var(--accent-cyan-dim)', padding: 'var(--sp-4)', borderRadius: 'var(--radius-full)', marginBottom: 'var(--sp-4)' }}>
            <Upload color="var(--accent-cyan)" size={32} />
          </div>
          <h3 style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-semibold)', marginBottom: 'var(--sp-2)' }}>Upload Mock Paper</h3>
          
          <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-4)', width: '100%', maxWidth: '20rem', marginTop: 'var(--sp-4)' }}>
            <input 
              type="file" 
              accept=".pdf,.txt,.md,image/*" 
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              style={{
                width: '100%', padding: 'var(--sp-2)', 
                border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
                background: 'var(--bg-secondary)', color: 'var(--text-primary)'
              }}
            />
            <Button type="submit" disabled={!file} size="lg" style={{ width: '100%', background: 'var(--accent-cyan)', color: 'var(--text-inverse)' }}>
              Run Autopsy
            </Button>
          </form>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <Card padding="lg" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '350px', borderColor: 'var(--accent-cyan-dim)', boxShadow: 'var(--shadow-glow-blue)' }}>
          <Loader2 color="var(--accent-cyan)" size={48} style={{ marginBottom: 'var(--sp-6)', animation: 'spin 1s linear infinite' }} />
          <h3 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)', marginBottom: 'var(--sp-2)' }}>Performing Autopsy...</h3>
          <p style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>{statusMsg}</p>
        </Card>
      )}

      {/* Results Dashboard */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
          <AutopsyDashboard result={result} />
          <Button variant="secondary" onClick={() => {setResult(null); setFile(null);}} style={{ alignSelf: 'center' }}>
            Autopsy Another Mock
          </Button>
        </div>
      )}
    </div>
  );
}
