'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useAppStore } from '@/stores/appStore';
import { Upload, Loader2, Sparkles, TrendingUp, ShieldAlert, Crosshair } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AutopsyDashboard from '@/components/autopsy/AutopsyDashboard';
import { createClient } from '@/lib/supabase/client';

export default function MockAutopsyPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [result, setResult] = useState<any>(null);
  
  // Custom scoring state
  const [correctMarks, setCorrectMarks] = useState<number | ''>('');
  const [negativeMarks, setNegativeMarks] = useState<number | ''>('');
  const [trendsData, setTrendsData] = useState<any[]>([]);

  const { addToast } = useAppStore();

  useEffect(() => {
    async function fetchTrends() {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;
      
      const { data } = await supabase
        .from('mock_autopsies')
        .select('current_score, created_at')
        .eq('user_id', authData.user.id)
        .order('created_at', { ascending: true });
      
      if (data) {
        setTrendsData(data.map(d => ({
          date: new Date(d.created_at).toLocaleDateString(),
          score: d.current_score
        })));
      }
    }
    fetchTrends();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return addToast('Please select a mock paper to analyze', 'error');

    setLoading(true);
    setStatusMsg('Reading OMR and scanning PDF...');
    
    // Fake streaming status for magical UX effect
    const states = [
      'Extracting answers via Gemini 2.5 Flash...',
      'Mapping incorrect responses to NCERT chapters...',
      'Diagnosing root cognitive failures...',
      'Generating Mentor insights...'
    ];
    let i = 0;
    const interval = setInterval(() => {
      if (i < states.length) setStatusMsg(states[i++]);
    }, 2000);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('testName', file.name);
      if (correctMarks !== '') formData.append('correctMarks', correctMarks.toString());
      if (negativeMarks !== '') formData.append('negativeMarks', negativeMarks.toString());

      const res = await fetch('/api/autopsy/ingest', {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

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
        <h1 style={{ fontSize: 'var(--fs-3xl)', fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-tight)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
          <Crosshair color="var(--accent-cyan)" size={32} />
          Mock Test Autopsy Engine
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--sp-2)' }}>
          Upload your mock test. Let an elite AI Mentor extract every recoverable point.
        </p>
      </div>

      {!result && !loading && (
        <Card padding="lg" style={{ borderStyle: 'dashed', borderWidth: '2px', borderColor: 'var(--border-strong)', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
          <div style={{ background: 'var(--accent-cyan-dim)', padding: 'var(--sp-4)', borderRadius: 'var(--radius-full)', marginBottom: 'var(--sp-4)' }}>
            <Upload color="var(--accent-cyan)" size={32} />
          </div>
          <h3 style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-semibold)', marginBottom: 'var(--sp-2)' }}>Upload Mock Paper</h3>
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '28rem', marginBottom: 'var(--sp-8)' }}>
            Upload the PDF of your mock paper (with answer key or OMR attached). Gemini Flash will read it directly.
          </p>
          
          <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-4)', width: '100%', maxWidth: '28rem' }}>
            <input 
              type="file" 
              accept="application/pdf, text/plain, image/*" 
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              style={{
                width: '100%', fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)',
                color: 'var(--accent-cyan)', padding: 'var(--sp-2)', borderRadius: 'var(--radius-md)'
              }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)', width: '100%', marginBottom: 'var(--sp-2)' }}>
              <div>
                <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--sp-1)' }}>Marks per Correct Answer</label>
                <input 
                  type="number" 
                  placeholder="Default (e.g. 4)"
                  value={correctMarks}
                  onChange={(e) => setCorrectMarks(e.target.value === '' ? '' : Number(e.target.value))}
                  style={{ width: '100%', padding: 'var(--sp-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 'var(--fs-sm)' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--sp-1)' }}>Negative Marks per Error</label>
                <input 
                  type="number" 
                  placeholder="Default (e.g. -1)"
                  value={negativeMarks}
                  onChange={(e) => setNegativeMarks(e.target.value === '' ? '' : Number(e.target.value))}
                  style={{ width: '100%', padding: 'var(--sp-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 'var(--fs-sm)' }}
                />
              </div>
            </div>
            <Button type="submit" disabled={!file} size="lg" style={{ width: '100%', background: 'var(--accent-cyan)', color: 'var(--text-inverse)', fontWeight: 'var(--fw-bold)' }}>
              <Sparkles size={18} style={{ marginRight: 'var(--sp-2)' }} />
              Run Autopsy
            </Button>
          </form>
        </Card>
      )}

      {loading && (
        <Card padding="lg" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', borderColor: 'var(--accent-cyan-dim)', boxShadow: 'var(--shadow-glow-blue)' }}>
          <Loader2 color="var(--accent-cyan)" size={48} style={{ marginBottom: 'var(--sp-6)', animation: 'spin 1s linear infinite' }} />
          <h3 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)', marginBottom: 'var(--sp-2)' }}>Performing Autopsy...</h3>
          <p style={{ color: 'var(--accent-cyan)' }}>{statusMsg}</p>
        </Card>
      )}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
          <AutopsyDashboard result={result} trendsData={trendsData} />
          <Button size="lg" variant="ghost" onClick={() => {setResult(null); setFile(null);}} style={{ width: '100%', padding: 'var(--sp-6) 0' }}>
            Autopsy Another Mock Test
          </Button>
        </div>
      )}
    </div>
  );
}
