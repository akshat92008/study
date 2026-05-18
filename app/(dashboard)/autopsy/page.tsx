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
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-12 animate-fade">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100 flex items-center gap-3">
          <Crosshair className="text-cyan-500" size={32} />
          Mock Test Autopsy Engine
        </h1>
        <p className="text-zinc-400 mt-2">
          Upload your mock test. Let an AIR Mentor extract every recoverable mark.
        </p>
      </div>

      {!result && !loading && (
        <Card padding="lg" className="border-dashed border-2 border-zinc-800 bg-zinc-950/50 flex flex-col items-center justify-center min-h-[400px]">
          <div className="bg-cyan-500/10 p-4 rounded-full mb-4">
            <Upload className="text-cyan-500" size={32} />
          </div>
          <h3 className="text-xl font-semibold mb-2">Upload Mock Paper</h3>
          <p className="text-zinc-400 text-center max-w-md mb-8">
            Upload the PDF of your mock paper (with answer key or OMR attached). Gemini Flash will read it directly.
          </p>
          
          <form onSubmit={handleUpload} className="flex flex-col items-center gap-4 w-full max-w-md">
            <input 
              type="file" 
              accept="application/pdf, text/plain" 
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-500/10 file:text-cyan-400 hover:file:bg-cyan-500/20"
            />
            <Button type="submit" disabled={!file} size="lg" className="w-full bg-cyan-600 hover:bg-cyan-500 text-black font-bold">
              <Sparkles size={18} className="mr-2" />
              Run Autopsy
            </Button>
          </form>
        </Card>
      )}

      {loading && (
        <Card padding="lg" className="flex flex-col items-center justify-center min-h-[400px] border-cyan-500/30 shadow-[0_0_50px_-12px_rgba(6,182,212,0.15)]">
          <Loader2 className="animate-spin text-cyan-500 mb-6" size={48} />
          <h3 className="text-2xl font-bold text-zinc-100 mb-2">Performing Autopsy...</h3>
          <p className="text-cyan-400 animate-pulse">{statusMsg}</p>
        </Card>
      )}

      {result && (
        <AnimatePresence>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6">
            
            {/* Top Score Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card padding="lg" className="bg-gradient-to-br from-zinc-900 to-zinc-950 border-zinc-800">
                <div className="text-zinc-400 text-sm font-medium mb-1">Current Score</div>
                <div className="text-4xl font-bold text-zinc-100">{result.currentScore}</div>
              </Card>
              <Card padding="lg" className="bg-gradient-to-br from-cyan-950/30 to-zinc-950 border-cyan-900/50">
                <div className="text-cyan-400 text-sm font-medium mb-1">Potential Score</div>
                <div className="text-4xl font-bold text-cyan-500">{result.potentialScore}</div>
                <div className="text-xs text-cyan-500/70 mt-1">If silly mistakes were fixed</div>
              </Card>
              <Card padding="lg" className="bg-gradient-to-br from-green-950/30 to-zinc-950 border-green-900/50">
                <div className="text-green-400 text-sm font-medium mb-1">Recoverable Marks</div>
                <div className="text-4xl font-bold text-green-500">+{result.recoverableMarks}</div>
                <div className="text-xs text-green-500/70 mt-1 flex items-center gap-1"><TrendingUp size={12}/> High ROI</div>
              </Card>
            </div>

            {/* Topper Mentor Insight */}
            <Card padding="lg" className="relative overflow-hidden border-orange-900/30 bg-orange-950/10">
              <ShieldAlert className="absolute right-[-20px] top-[-20px] text-orange-500/10" size={150} />
              <div className="relative z-10">
                <h3 className="text-orange-400 font-bold tracking-widest text-xs uppercase mb-4">AIR Mentor Insight</h3>
                <p className="text-xl text-zinc-200 leading-relaxed font-serif italic">
                  "{result.mentorQuote}"
                </p>
              </div>
            </Card>

            {/* Recovery Plan */}
            {result.plan && (
              <Card padding="lg">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Sparkles className="text-cyan-500" size={20} />
                  {result.plan.title}
                </h3>
                <div className="space-y-3">
                  {result.plan.tasks.map((task: any, idx: number) => (
                    <div key={idx} className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 flex flex-col md:flex-row justify-between gap-4">
                      <div>
                        <div className="text-cyan-400 text-xs font-bold uppercase tracking-wider mb-1">Day {task.day} • {task.subject}</div>
                        <div className="text-zinc-200 font-medium">{task.action}</div>
                      </div>
                      <div className="text-green-400 font-bold text-lg whitespace-nowrap bg-green-400/10 px-3 py-1 rounded-md self-start">
                        +{task.marksGain} Marks
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Button className="w-full py-6 text-lg" variant="ghost" onClick={() => {setResult(null); setFile(null);}}>
              Autopsy Another Mock Test
            </Button>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
