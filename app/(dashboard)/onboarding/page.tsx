'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/components/ui/Card';
import { Sparkles, Send, Loader2, UploadCloud, FileText, CheckCircle } from 'lucide-react';

export default function ConversationalOnboarding() {
  const router = useRouter();
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hello. I'm Cognition. I'll be running your academic schedule from now on. What exactly are we preparing for, and when is the exam?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [buildingSystem, setBuildingSystem] = useState(false);
  const [buildSteps, setBuildSteps] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading || buildingSystem) return;
    
    const userMsg = input.trim();
    setInput('');
    const newHistory = [...messages, { role: 'user', content: userMsg }];
    setMessages(newHistory);
    setLoading(true);
    setUploadError(null);

    try {
      const res = await fetch('/api/ai/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, history: newHistory.slice(0, -1) }),
      });
      const data = await res.json();

      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);

      if (data.isComplete) {
        setBuildingSystem(true);
        setBuildSteps([
          'Analyzing preparation profile...',
          'Seeding standard academic curriculum...',
          'Generating Day 1 study focus block...',
          'Onboarding complete!'
        ]);
        setTimeout(() => {
          router.push('/dashboard');
        }, 4000);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Network error. Try again?" }]);
    } finally {
      setLoading(false);
    }
  };

  // Onboarding Magic Moment: PDF/Syllabus File Ingestion
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || buildingSystem) return;

    setLoading(true);
    setBuildingSystem(true);
    setUploadError(null);
    setBuildSteps(['Reading uploaded document...']);

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Step 1: Upload and parse
      setBuildSteps(prev => [...prev, `Uploading ${file.name}...`]);
      
      const res = await fetch('/api/onboarding/upload', {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to parse syllabus');
      }

      setBuildSteps(prev => [
        ...prev,
        'Analyzing curriculum structures with Gemini...',
        `Extracted custom curriculum: "${data.title}"`,
        `Seeding ${data.seededCount} concept nodes in ATLAS graph...`,
        'Generating personalized spaced-repetition deck...',
        'Compiling Day 1 missions...'
      ]);

      setTimeout(() => {
        setBuildSteps(prev => [...prev, 'All systems online! Redirecting...']);
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      }, 2500);

    } catch (err: any) {
      setUploadError(err.message || 'Syllabus processing failed. Let\'s continue conversing.');
      setBuildingSystem(false);
      setMessages(prev => [
        ...prev, 
        { role: 'assistant', content: `Ah, I had some trouble extracting details from that document. Error: ${err.message || 'unknown'}. Let's continue conversing instead! What exam are you preparing for?` }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-root)', padding: 'var(--sp-4)' }}>
      <Card padding="lg" style={{ 
        maxWidth: 650, width: '100%', minHeight: '70vh', 
        display: 'flex', flexDirection: 'column', 
        border: '1px solid var(--accent-purple-dim)', 
        boxShadow: 'var(--shadow-glow-purple-dim)',
        background: 'var(--bg-secondary)'
      }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--sp-6)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--sp-4)' }}>
          <Sparkles size={32} style={{ color: 'var(--accent-purple)', margin: '0 auto var(--sp-2)' }} />
          <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)' }}>System Initialization</h2>
          <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: 2 }}>Cognition OS Student Setup</p>
        </div>

        {/* Chat History & File Upload Option */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '85%', padding: 'var(--sp-3) var(--sp-4)', borderRadius: 'var(--radius-lg)',
                background: msg.role === 'user' ? 'var(--accent-purple)' : 'var(--bg-tertiary)',
                color: '#fff',
                fontSize: 'var(--fs-md)', lineHeight: 'var(--lh-relaxed)',
                border: msg.role === 'assistant' ? '1px solid var(--border-subtle)' : 'none',
              }}>
                {msg.content}
              </div>
            </div>
          ))}

          {/* Prompt file upload alternative */}
          {messages.length === 1 && !buildingSystem && (
            <div style={{ padding: '0 var(--sp-4)' }}>
              <div 
                onClick={triggerFileSelect}
                style={{
                  border: '2px dashed var(--accent-purple-dim)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--sp-6)',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: 'rgba(168, 85, 247, 0.02)',
                  transition: 'background var(--duration-fast) var(--ease-out)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 'var(--sp-2)'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(168, 85, 247, 0.06)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(168, 85, 247, 0.02)'; }}
              >
                <UploadCloud size={32} style={{ color: 'var(--accent-purple)' }} />
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Onboarding Magic Moment
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', maxWidth: 400, margin: '0 auto' }}>
                  Upload a PDF/Image of your syllabus, test series index, or curriculum checklist. 
                  Gemini will extract it and map your entire ATLAS graph in seconds.
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept=".pdf,.png,.jpg,.jpeg,.txt" 
                  style={{ display: 'none' }} 
                />
              </div>
            </div>
          )}

          {loading && !buildingSystem && (
            <div style={{ color: 'var(--accent-purple)', fontSize: 'var(--fs-md)', padding: 'var(--sp-3) var(--sp-4)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Loader2 size={16} className="animate-spin" />
              <span>Analyzing inputs...</span>
            </div>
          )}
        </div>

        {/* Big Loading / Progress State when building */}
        {buildingSystem ? (
          <div style={{ 
            background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)', padding: 'var(--sp-6)', color: 'var(--accent-cyan)' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
              <Loader2 size={24} className="animate-spin" />
              <span style={{ fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-md)' }}>Building Student Graph & Scheduling Missions</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              {buildSteps.map((stepMsg, index) => (
                <div key={index} style={{ 
                  display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', 
                  fontSize: 'var(--fs-xs)', color: index === buildSteps.length - 1 ? 'var(--accent-cyan)' : 'var(--text-tertiary)',
                  animation: 'fadeIn var(--duration-normal) var(--ease-out)'
                }}>
                  {index === buildSteps.length - 1 && !stepMsg.includes('Redirecting') ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <CheckCircle size={12} style={{ color: 'var(--success)' }} />
                  )}
                  <span>{stepMsg}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Input Field */
          <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
            <input 
              value={input} 
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
              placeholder="Type your response..."
              disabled={loading}
              style={{
                flex: 1, padding: 'var(--sp-4)', background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)', border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-full)', outline: 'none', fontSize: 'var(--fs-base)'
              }}
            />
            <button 
              onClick={handleSend}
              disabled={loading || !input.trim()}
              style={{
                width: 50, height: 50, borderRadius: 'var(--radius-full)',
                background: 'var(--accent-purple)', color: 'white', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
              }}
            >
              <Send size={20} />
            </button>
          </div>
        )}
      </Card>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}
