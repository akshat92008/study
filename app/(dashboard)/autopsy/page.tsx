'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useAppStore } from '@/stores/appStore';
import { Upload, Loader2, Sparkles, TrendingUp, ShieldAlert, Crosshair } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function MockAutopsyPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [result, setResult] = useState<any>(null);
  const { addToast } = useAppStore();

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
      'Generating Topper Mentor insights...'
    ];
    let i = 0;
    const interval = setInterval(() => {
      if (i < states.length) setStatusMsg(states[i++]);
    }, 2000);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('testName', file.name);

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
          Upload your mock test. Let an AIR Mentor extract every recoverable mark.
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
        <AnimatePresence>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
            
            {/* Top Score Cards */}
            <div className="grid-3">
              <Card padding="lg" style={{ background: 'linear-gradient(to bottom right, var(--bg-secondary), var(--bg-primary))', border: '1px solid var(--border-default)' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-medium)', marginBottom: 'var(--sp-1)' }}>Current Score</div>
                <div style={{ fontSize: 'var(--fs-3xl)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)' }}>{result.currentScore}</div>
              </Card>
              <Card padding="lg" style={{ background: 'linear-gradient(to bottom right, var(--accent-cyan-dim), var(--bg-primary))', border: '1px solid var(--accent-cyan-dim)' }}>
                <div style={{ color: 'var(--accent-cyan)', fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-medium)', marginBottom: 'var(--sp-1)' }}>Potential Score</div>
                <div style={{ fontSize: 'var(--fs-3xl)', fontWeight: 'var(--fw-bold)', color: 'var(--accent-cyan)' }}>{result.potentialScore}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: 'var(--sp-1)' }}>If silly mistakes were fixed</div>
              </Card>
              <Card padding="lg" style={{ background: 'linear-gradient(to bottom right, var(--success-dim), var(--bg-primary))', border: '1px solid var(--success-dim)' }}>
                <div style={{ color: 'var(--success)', fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-medium)', marginBottom: 'var(--sp-1)' }}>Recoverable Marks</div>
                <div style={{ fontSize: 'var(--fs-3xl)', fontWeight: 'var(--fw-bold)', color: 'var(--success)' }}>+{result.recoverableMarks}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: 'var(--sp-1)', display: 'flex', alignItems: 'center', gap: 'var(--sp-1)' }}><TrendingUp size={12}/> High ROI</div>
              </Card>
            </div>

            {/* Topper Mentor Insight */}
            <Card padding="lg" style={{ position: 'relative', overflow: 'hidden', border: '1px solid var(--warning-dim)', background: 'var(--warning-glow)' }}>
              <ShieldAlert color="var(--warning-dim)" size={150} style={{ position: 'absolute', right: '-20px', top: '-20px', opacity: 0.2 }} />
              <div style={{ position: 'relative', zIndex: 10 }}>
                <h3 style={{ color: 'var(--warning)', fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-wide)', fontSize: 'var(--fs-xs)', textTransform: 'uppercase', marginBottom: 'var(--sp-4)' }}>AIR Mentor Insight</h3>
                <p style={{ fontSize: 'var(--fs-xl)', color: 'var(--text-primary)', lineHeight: 'var(--lh-relaxed)', fontStyle: 'italic' }}>
                  "{result.mentorQuote}"
                </p>
              </div>
            </Card>

            {/* Recovery Plan */}
            {result.plan && (
              <Card padding="lg">
                <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', marginBottom: 'var(--sp-4)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                  <Sparkles color="var(--accent-cyan)" size={20} />
                  {result.plan.title}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                  {result.plan.tasks.map((task: any, idx: number) => (
                    <div key={idx} style={{ padding: 'var(--sp-4)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-4)' }}>
                      <div>
                        <div style={{ color: 'var(--accent-cyan)', fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', marginBottom: 'var(--sp-1)' }}>Day {task.day} • {task.subject}</div>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 'var(--fw-medium)' }}>{task.action}</div>
                      </div>
                      <div style={{ color: 'var(--success)', fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-lg)', whiteSpace: 'nowrap', background: 'var(--success-glow)', padding: 'var(--sp-1) var(--sp-3)', borderRadius: 'var(--radius-md)', alignSelf: 'flex-start' }}>
                        +{task.marksGain} Marks
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Button size="lg" variant="ghost" onClick={() => {setResult(null); setFile(null);}} style={{ width: '100%', padding: 'var(--sp-6) 0' }}>
              Autopsy Another Mock Test
            </Button>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
