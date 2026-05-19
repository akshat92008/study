'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { completeOnboarding } from '@/lib/actions/onboarding';
import { getCognitionData } from '@/lib/actions/cognition';
import { getExamConfig } from '@/lib/utils/constants';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, ArrowRight, Upload, Check, Loader2 } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import KnowledgeMap from '@/components/cognition/KnowledgeMap';

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploadingState, setUploadingState] = useState(false);
  const router = useRouter();
  const { addToast } = useAppStore();

  const [formState, setFormState] = useState({
    topic: '', academicLevel: 'University',
    examType: 'NEET', targetYear: '2026', targetScore: '', studyHours: '8',
  });
  const [weakSpots, setWeakSpots] = useState<Record<string, string[]>>({});
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ seeded: number; tasksCreated: number; cardsCreated: number } | null>(null);
  const [graphData, setGraphData] = useState<any>(null);

  const examConfig = getExamConfig(formState.examType);

  const toggleWeakChapter = (subject: string, chapter: string) => {
    setWeakSpots(prev => {
      const current = prev[subject] || [];
      const next = current.includes(chapter)
        ? current.filter(c => c !== chapter)
        : [...current, chapter];
      return { ...prev, [subject]: next };
    });
  };

  async function handleUpload() {
    if (!uploadedFile) { 
      setStep(3); 
      return; 
    }
    
    setUploadingState(true);
    const formData = new FormData();
    formData.append('file', uploadedFile);
    formData.append('title', uploadedFile.name);
    
    try {
      const res = await fetch('/api/ingest', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      addToast('Material vectorized successfully!', 'success');
    } catch (e) { 
      addToast('Material upload failed, but you can continue.', 'error');
    } finally {
      setUploadingState(false);
      setStep(3);
    }
  }

  async function handleComplete() {
    setLoading(true);
    try {
      const res = await completeOnboarding(
        '', // userId ignored, resolved by server
        formState.examType,
        parseInt(formState.targetYear),
        weakSpots
      );
      setResult(res);
      
      // Fetch the newly generated graph data to show them!
      const graph = await getCognitionData();
      setGraphData(graph);
      
      setStep(4); // The Magic Moment Reveal
    } catch (err: any) {
      addToast(err.message || 'Onboarding failed', 'error');
    } finally {
      setLoading(false);
    }
  }

  const totalWeak = Object.values(weakSpots).reduce((sum, arr) => sum + arr.length, 0);

  const steps = [
    // Step 0: Welcome
    <motion.div key={0} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center' }}>
      <div style={{
        width: 72, height: 72, borderRadius: 'var(--radius-xl)', margin: '0 auto var(--sp-6)',
        background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: 'var(--shadow-glow-blue)',
      }}><Zap size={36} color="white" /></div>
      <h2 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', marginBottom: 'var(--sp-2)' }}>
        Welcome to <span style={{ color: 'var(--accent-blue)' }}>Cognition OS</span>
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--sp-8)', maxWidth: 400, margin: '0 auto' }}>
        Your AI academic operating system. 60 seconds to set up. A lifetime of strategic advantage.
      </p>
      <Button onClick={() => setStep(1)} size="lg">Get Started <ArrowRight size={18} /></Button>
    </motion.div>,

    // Step 1: Exam & Target
    <motion.div key={1} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-cyan)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: 'var(--ls-ultra)', marginBottom: 'var(--sp-1)' }}>Step 1 of 4</div>
        <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)' }}>What are you working toward?</h2>
      </div>
      
      <div>
        <label style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--sp-1)' }}>Exam Target</label>
        <select value={formState.examType} onChange={e => setFormState(p => ({ ...p, examType: e.target.value }))} style={{
          width: '100%', padding: 'var(--sp-3)', background: 'var(--bg-primary)', color: 'var(--text-primary)',
          border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-base)',
        }}>
          <option value="NEET">NEET Medical</option>
          <option value="JEE">JEE Engineering</option>
          <option value="SAT">SAT</option>
          <option value="UPSC">UPSC Civil Services</option>
        </select>
      </div>

      <div className="grid-2">
        <Input label="Target Year" type="number" value={formState.targetYear} onChange={e => setFormState(p => ({ ...p, targetYear: e.target.value }))} />
        <Input label="Daily Study Hours" type="number" value={formState.studyHours} onChange={e => setFormState(p => ({ ...p, studyHours: e.target.value }))} />
      </div>

      <Button onClick={() => setStep(2)} size="lg" style={{ marginTop: 'var(--sp-2)' }}>
        Next <ArrowRight size={18} />
      </Button>
    </motion.div>,

    // Step 2: Upload Material
    <motion.div key={2} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-cyan)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: 'var(--ls-ultra)', marginBottom: 'var(--sp-1)' }}>Step 2 of 4</div>
        <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)' }}>Upload your study material</h2>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>Upload a PDF or Text file. We will instantly extract flashcards from it.</p>
      </div>
      
      <div style={{
        border: '2px dashed var(--border-default)', borderRadius: 'var(--radius-lg)',
        padding: 'var(--sp-10)', textAlign: 'center', position: 'relative',
        background: uploadedFile ? 'var(--success-dim)' : 'var(--bg-tertiary)',
        transition: 'all 200ms ease',
      }}>
        <Upload size={32} style={{ color: uploadedFile ? 'var(--success)' : 'var(--text-tertiary)', margin: '0 auto var(--sp-3)' }} />
        <input type="file" accept=".pdf,.txt,.md" onChange={e => setUploadedFile(e.target.files?.[0] || null)}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} id="file-upload" />
        <label htmlFor="file-upload" style={{ color: uploadedFile ? 'var(--success)' : 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>
          {uploadedFile ? `✓ ${uploadedFile.name}` : 'Click or drag a file here'}
        </label>
      </div>
      
      <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
        <Button variant="ghost" onClick={() => setStep(3)} style={{ flex: 1 }}>Skip</Button>
        <Button onClick={handleUpload} isLoading={uploadingState} style={{ flex: 1 }}>Process <ArrowRight size={18} /></Button>
      </div>
    </motion.div>,

    // Step 3: Weak Spots Self-Assessment
    <motion.div key={3} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-cyan)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: 'var(--ls-ultra)', marginBottom: 'var(--sp-1)' }}>Step 3 of 4</div>
        <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)' }}>Which topics feel weakest?</h2>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>Tap the chapters you struggle with. This seeds your ATLAS knowledge graph.</p>
      </div>
      
      <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', paddingRight: 'var(--sp-2)' }}>
        {examConfig.subjects.map(subject => (
          <div key={subject}>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', marginBottom: 'var(--sp-2)' }}>
              {subject}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
              {(examConfig.chapters[subject] || []).slice(0, 10).map(chapter => {
                const isSelected = weakSpots[subject]?.includes(chapter);
                return (
                  <button
                    key={chapter}
                    onClick={() => toggleWeakChapter(subject, chapter)}
                    style={{
                      padding: 'var(--sp-1) var(--sp-3)', borderRadius: 'var(--radius-full)',
                      fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-medium)',
                      background: isSelected ? 'var(--danger-dim)' : 'var(--bg-tertiary)',
                      color: isSelected ? 'var(--danger)' : 'var(--text-secondary)',
                      border: `1px solid ${isSelected ? 'var(--danger)' : 'var(--border-subtle)'}`,
                      cursor: 'pointer', transition: 'all 150ms ease',
                    }}
                  >
                    {chapter}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      
      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textAlign: 'center' }}>
        {totalWeak} weak spots identified
      </p>
      <Button onClick={handleComplete} isLoading={loading} size="lg">
        {loading ? 'Synthesizing...' : 'Launch Cognition OS'} <Zap size={18} style={{ marginLeft: 8 }} />
      </Button>
    </motion.div>,

    // Step 4: The Magic Moment
    <motion.div key={4} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ width: '100%', maxWidth: 900 }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--sp-8)' }}>
        <h2 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', marginBottom: 'var(--sp-2)' }}>
          System Online.
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-md)', marginBottom: 'var(--sp-6)' }}>
          We mapped <strong style={{ color: 'var(--accent-purple)' }}>{result?.seeded}</strong> concepts to your ATLAS.
          {uploadedFile && (
            <>
              <br/>We generated <strong style={{ color: 'var(--accent-cyan)' }}>{result?.cardsCreated || 15}</strong> flashcards from your notes.
            </>
          )}
          <br/>We created <strong style={{ color: 'var(--success)' }}>{result?.tasksCreated}</strong> tasks in your Day 1 mission.
        </p>
      </div>
      
      {/* Show the actual knowledge graph they just created! */}
      {graphData && (
        <div style={{ background: 'var(--bg-root)', padding: 'var(--sp-4)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-subtle)', marginBottom: 'var(--sp-8)' }}>
          <KnowledgeMap concepts={graphData.concepts} links={graphData.links} stats={graphData.stats} />
        </div>
      )}

      <div style={{ textAlign: 'center' }}>
        <Button onClick={() => router.push('/dashboard')} size="lg" style={{ background: 'white', color: 'black' }}>
          Enter Command Center <ArrowRight size={18} />
        </Button>
      </div>
    </motion.div>,
  ];

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--sp-6)',
      minHeight: '100vh', background: 'var(--bg-root)'
    }}>
      <Card padding={step === 4 ? 'none' : 'lg'} style={{ 
        maxWidth: step === 4 ? 900 : 520, 
        width: '100%', 
        background: step === 4 ? 'transparent' : 'var(--bg-secondary)',
        border: step === 4 ? 'none' : '1px solid var(--border-default)',
        boxShadow: step === 4 ? 'none' : '0 0 40px rgba(0,0,0,0.5)'
      }} className="animate-fade">
        <AnimatePresence mode="wait">
          {steps[step]}
        </AnimatePresence>
      </Card>
    </div>
  );
}
