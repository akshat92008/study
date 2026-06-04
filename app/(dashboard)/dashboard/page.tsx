'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import type { LearningGoal } from '@/stores/appStore';
import { Loader2, Brain, MessageSquare, Activity, RefreshCw, Upload, X, Music } from 'lucide-react';
import { getPreset } from '@/lib/types/universal-domain';
import { useRouter } from 'next/navigation';
import CognitionDashboard from '@/components/cognition/CognitionDashboard';
import RevisionQueue from '@/components/revision/RevisionQueue';
import AutopsyDashboard from '@/components/autopsy/AutopsyDashboard';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import CurrentTaskCard from '@/components/dashboard/CurrentTaskCard';
import MicrotargetsCard from '@/components/dashboard/MicrotargetsCard';
import { SeededTopicsCard } from '@/components/dashboard/SeededTopicsCard';
import DeepAutopsyCard from '@/components/dashboard/DeepAutopsyCard';
import GoalCreationModal from '@/components/modals/GoalCreationModal';
import GoalSettingsModal from '@/components/modals/GoalSettingsModal';
import { createClient } from '@/lib/supabase/client';

export default function DashboardPage() {
  const {
    activeGoalId,
    learningGoals,
    chatId,
    activeDrawer,
    setActiveDrawer,
    autopsyResult,
    setAutopsyResult,
    isUploadingMock,
    setIsUploadingMock,
    uploadStatus,
    setUploadStatus,
    addToast,
  } = useAppStore();

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [masteryData, setMasteryData] = useState<any>(null);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showGoalSettingsModal, setShowGoalSettingsModal] = useState(false);
  const router = useRouter();

  // Local state for the drawer upload mechanism
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  // 1. Initial Data Loading
  const loadTelemetry = useCallback(async () => {
    try {
      const suffix = activeGoalId ? `?goalId=${activeGoalId}` : '';
      const [resDash, resMastery] = await Promise.all([
        fetch(`/api/dashboard${suffix}`),
        fetch(`/api/atlas/mastery${suffix}`)
      ]);
      if (resDash.ok) {
        const data = await resDash.json();
        setDashboardData(data);
      }
      if (resMastery.ok) {
        const mData = await resMastery.json();
        setMasteryData(mData);
      }
    } catch (e) {
      console.error('Failed to load dashboard data', e);
    }
  }, [activeGoalId]);

  const loadAutopsy = useCallback(async () => {
    try {
      const suffix = activeGoalId ? `?goalId=${activeGoalId}` : '';
      const res = await fetch(`/api/autopsy${suffix}`);
      if (res.ok) {
        const data = await res.json();
        setAutopsyResult(data.result);
      }
    } catch (e) {
      console.error('Failed to load autopsy data', e);
    }
  }, [activeGoalId, setAutopsyResult]);

  useEffect(() => {
    loadTelemetry();
    loadAutopsy();

    const handleRefresh = () => {
      loadTelemetry();
    };
    window.addEventListener('refresh-dashboard', handleRefresh);
    return () => window.removeEventListener('refresh-dashboard', handleRefresh);
  }, [loadAutopsy, loadTelemetry]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('magic') === 'true') {
        setActiveDrawer('cognition');
      }
    }
  }, [setActiveDrawer]);

  // 2. Mock Autopsy Ingest within Drawer
  const handleMockUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileToUpload) return addToast('Please select a mock paper', 'error');

    setIsUploadingMock(true);
    setUploadStatus('Uploading...');

    const statuses = [
      'Upload received. Waiting for the worker queue...',
      'Queued for processing...',
    ];
    let i = 0;
    const interval = setInterval(() => {
      if (i < statuses.length) setUploadStatus(statuses[i++]);
    }, 2500);

    try {
      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('testName', fileToUpload.name);
      if (activeGoalId) formData.append('goalId', activeGoalId);
      if (chatId) formData.append('chatSessionId', chatId);

      const res = await fetch('/api/autopsy/ingest', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Mistake Review failed');

      if (data.status === 'completed') {
        setAutopsyResult(data);
        addToast('Mistake Review completed successfully!', 'success');
        loadTelemetry(); // refresh telemetry
      } else {
        // Start polling if pending/processing
        const supabase = createClient();
        
        // Timeout handling
        const maxWait = 900000; // 15 min max
        const timeoutId = setTimeout(() => {
          supabase.removeChannel(channel);
          setIsUploadingMock(false);
          setUploadStatus('');
          addToast('Analysis timed out', 'error');
        }, maxWait);

        // Realtime Subscription
        const channel = supabase.channel(`autopsy_job_${data.jobId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'autopsy_jobs',
              filter: `id=eq.${data.jobId}`
            },
            async (payload) => {
              const newStatus = payload.new.status;
              
              if (newStatus === 'processing') {
                setUploadStatus('Processing upload...');
              } else if (newStatus === 'needs_user_input' || newStatus === 'needs_input') {
                supabase.removeChannel(channel);
                clearTimeout(timeoutId);
                setIsUploadingMock(false);
                setUploadStatus('');
                addToast(payload.new.error || 'Mistake Review needs user input.', 'error');
              } else if (newStatus === 'failed') {
                supabase.removeChannel(channel);
                clearTimeout(timeoutId);
                setIsUploadingMock(false);
                setUploadStatus('');
                addToast(payload.new.error || 'Mistake Review failed.', 'error');
              } else if (newStatus === 'completed') {
                supabase.removeChannel(channel);
                clearTimeout(timeoutId);
                
                const suffix = activeGoalId ? `?goalId=${activeGoalId}` : '';
                const resultRes = await fetch(`/api/autopsy${suffix}`);
                if (resultRes.ok) {
                  const resultData = await resultRes.json();
                  setAutopsyResult(resultData.result);
                } else {
                  setAutopsyResult(payload.new);
                }
                
                setIsUploadingMock(false);
                setUploadStatus('');
                addToast('Mistake Review completed successfully!', 'success');
                loadTelemetry();
              }
            }
          )
          .subscribe();
          
        // End of the successful try block, we don't clean up UI state here because
        // we're waiting for the WebSocket event to complete it asynchronously.
        // We do want to clear the interval though.
        clearInterval(interval);
        return; // Early return to avoid triggering the finally block
      }
    } catch (err: any) {
      console.error('Mistake Review upload failed', err);
      addToast('Mistake Review failed. Please try again with a clearer upload.', 'error');
      setIsUploadingMock(false);
      setUploadStatus('');
    } finally {
      clearInterval(interval);
    }
  };

  // Find active goal title
  const activeGoal = learningGoals.find((g: LearningGoal) => g.id === activeGoalId);

  // Numeric Stats definitions
  const overallMastery = masteryData?.overallPct ?? dashboardData?.cognition?.stats?.overallMastery ?? dashboardData?.profile?.overall_mastery ?? 0;
  const cardsDue = dashboardData?.revision?.due?.length ?? 0;
  const marksLost = autopsyResult?.recoverableMarks ?? 0;

  // Use preset scoring model for display
  const preset = activeGoal ? getPreset(activeGoal.preset_id) : getPreset('custom_learning_goal');
  const scoreLabel = preset.dashboard_labels.score_label || 'Progress';
  
  let displayScore = `${overallMastery}%`;
  if (preset.scoring_model.type === 'marks' && preset.scoring_model.max_score) {
    const rawMarks = Math.round((overallMastery / 100) * preset.scoring_model.max_score);
    displayScore = `${rawMarks} / ${preset.scoring_model.max_score}`;
  } else if (preset.scoring_model.type === 'level') {
    // If it's level-based, we'd ideally have logic here, but fallback to % for now or just number
    displayScore = `${overallMastery}%`;
  }

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)', minHeight: '100%' }}>
      
      {/* Floating Telemetry Toolbar */}
      <div style={{
        padding: 'var(--sp-3) var(--sp-4)',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-glass)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 'var(--sp-4)',
        borderRadius: 'var(--radius-lg)',
        zIndex: 10
      }}>
        {activeGoal ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-purple)' }} />
            Active Goal: <strong>{activeGoal.title}</strong>
            <button
              onClick={() => setShowGoalSettingsModal(true)}
              style={{
                marginLeft: '8px',
                padding: '2px 8px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-default)',
                borderRadius: '4px',
                fontSize: '10px',
                cursor: 'pointer',
                color: 'var(--text-secondary)'
              }}
            >
              Edit Settings
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
            Select or create a learning goal in the sidebar
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-black)', color: 'var(--text-primary)', margin: 0 }}>
            Today's Mission
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', marginTop: 4, lineHeight: 1.5 }}>
            {activeGoal
              ? `Your mission for ${activeGoal.title}. Ask the AI Tutor for help, use Sources for grounding, and Review to lock it in.`
              : 'Create or select a learning goal to start.'}
          </p>
        </div>
        {!activeGoal ? (
          <Card padding="lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
            <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, marginBottom: 'var(--sp-2)' }}>Create or select a learning goal</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', marginBottom: 'var(--sp-4)' }}>
              Each goal gets its own mission, sources, AI tutor, review queue, progress, and mistake review.
            </p>
            <Button onClick={() => setShowGoalModal(true)}>Create Learning Goal</Button>
          </Card>
        ) : (
          <CurrentTaskCard goalId={activeGoalId ?? undefined} onSessionComplete={loadTelemetry} />
        )}

        {activeGoal && dashboardData?.tasks && (
          <MicrotargetsCard tasks={dashboardData.tasks} />
        )}

        {activeGoal && dashboardData?.seededTopics && dashboardData.seededTopics.length > 0 && (
          <SeededTopicsCard 
            seededTopics={dashboardData.seededTopics} 
            onStartTopic={() => router.push('/chat')} 
          />
        )}

        {activeGoal && (
          <DeepAutopsyCard deepAutopsy={dashboardData?.deepAutopsy} />
        )}
        
        <Card padding="lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', marginBottom: 'var(--sp-2)' }}>Study Profile</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-xs)', marginBottom: 'var(--sp-4)' }}>
              Cognition OS turns your sessions, doubts, mistakes, and assessments into the next daily study mission.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
              <button
                onClick={() => setActiveDrawer(activeDrawer === 'cognition' ? null : 'cognition')}
                style={{ textAlign: 'left', cursor: 'pointer', flex: '1 1 200px', background: activeDrawer === 'cognition' ? 'var(--accent-purple-dim)' : 'var(--bg-primary)', padding: 'var(--sp-4)', borderRadius: 'var(--radius-md)', border: `1px solid ${activeDrawer === 'cognition' ? 'var(--accent-purple)' : 'var(--border-subtle)'}`, transition: 'all 0.2s' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                  <Brain size={12} style={{ color: 'var(--accent-purple)' }} />
                  {scoreLabel}
                </div>
                <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-black)', color: 'var(--accent-purple)', marginTop: 4 }}>{displayScore}</div>
              </button>

              <button
                onClick={() => router.push('/chat')}
                style={{ textAlign: 'left', cursor: 'pointer', flex: '1 1 200px', background: 'var(--accent-cyan-dim)', padding: 'var(--sp-4)', borderRadius: 'var(--radius-md)', border: `1px solid var(--accent-cyan)`, transition: 'all 0.2s' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                  <MessageSquare size={12} style={{ color: 'var(--accent-cyan)' }} />
                  AI Tutor
                </div>
                <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-black)', color: 'var(--accent-cyan)', marginTop: 4 }}>Chat</div>
              </button>
              
              <button
                onClick={() => setActiveDrawer(activeDrawer === 'revision' ? null : 'revision')}
                style={{ textAlign: 'left', cursor: 'pointer', flex: '1 1 200px', background: activeDrawer === 'revision' ? 'var(--accent-blue-dim)' : 'var(--bg-primary)', padding: 'var(--sp-4)', borderRadius: 'var(--radius-md)', border: `1px solid ${activeDrawer === 'revision' ? 'var(--accent-blue)' : 'var(--border-subtle)'}`, transition: 'all 0.2s' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                  <RefreshCw size={12} style={{ color: 'var(--accent-blue)' }} />
                  Revision Due
                </div>
                <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-black)', color: 'var(--accent-blue)', marginTop: 4 }}>{cardsDue}</div>
              </button>
              
              <button
                onClick={() => setActiveDrawer(activeDrawer === 'autopsy' ? null : 'autopsy')}
                style={{ textAlign: 'left', cursor: 'pointer', flex: '1 1 200px', background: activeDrawer === 'autopsy' ? 'var(--danger-glow)' : 'var(--bg-primary)', padding: 'var(--sp-4)', borderRadius: 'var(--radius-md)', border: `1px solid ${activeDrawer === 'autopsy' ? 'var(--danger)' : 'var(--border-subtle)'}`, transition: 'all 0.2s' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                  <Activity size={12} style={{ color: 'var(--danger)' }} />
                  Mistake Review
                </div>
                <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-black)', color: 'var(--danger)', marginTop: 4 }}>{marksLost} mistakes found</div>
              </button>
            </div>
          </Card>
          
        {/* Agent Activity Read-only Feedback */}
        {(marksLost > 0 || cardsDue > 0) && (
          <div style={{
            background: 'var(--bg-glass)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--sp-4)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--sp-3)',
            marginTop: 'var(--sp-2)'
          }}>
            <div style={{ background: 'var(--accent-cyan-dim)', padding: 8, borderRadius: '50%', marginTop: 2 }}>
              <Brain size={16} color="var(--accent-cyan)" />
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>Agent Detection:</strong>{' '}
              {marksLost > 0 && `Identified ${marksLost} mistake patterns from your recent activity. `}
              {cardsDue > 0 && `Added ${cardsDue} concepts to your priority revision queue.`}
            </div>
          </div>
        )}
      </div>

      {/* Backdrop overlay for drawers */}
      {activeDrawer && (
        <div
          onClick={() => setActiveDrawer(null)}
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(3px)',
            zIndex: 90, animation: 'var(--animation-fade-in)'
          }}
        />
      )}

      {/* Contextual Drawers */}
      <div
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0,
          width: 'min(640px, 100vw)', background: 'var(--bg-primary)',
          borderLeft: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-xl)', zIndex: 100,
          transform: activeDrawer ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform var(--duration-normal) var(--ease-out)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          maxWidth: '100%'
        }}
      >
        {/* Drawer Header */}
        <div style={{ padding: 'var(--sp-4) var(--sp-5)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexWrap: 'wrap', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            {activeDrawer === 'cognition' && (
              <>
                <Brain size={18} style={{ color: 'var(--accent-purple)' }} />
                <span style={{ fontWeight: 'bold', fontSize: 'var(--fs-md)' }}>Progress</span>
              </>
            )}
            {activeDrawer === 'revision' && (
              <>
                <RefreshCw size={18} style={{ color: 'var(--accent-blue)' }} />
                <span style={{ fontWeight: 'bold', fontSize: 'var(--fs-md)' }}>Revision Due</span>
              </>
            )}
            {activeDrawer === 'autopsy' && (
              <>
                <Activity size={18} style={{ color: 'var(--danger)' }} />
                <span style={{ fontWeight: 'bold', fontSize: 'var(--fs-md)' }}>Mistake Review</span>
              </>
            )}
            {activeDrawer === 'beats' && (
              <>
                <Music size={18} style={{ color: 'var(--warning)' }} />
                <span style={{ fontWeight: 'bold', fontSize: 'var(--fs-md)' }}>Focus Beats</span>
              </>
            )}
          </div>
          <button
            onClick={() => setActiveDrawer(null)}
            style={{
              background: 'transparent', border: 'none', color: 'var(--text-secondary)',
              cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center',
              justifyContent: 'center', borderRadius: 4
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Drawer Body Scroll */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--sp-5)' }}>
          {/* A. Progress Drawer */}
          {activeDrawer === 'cognition' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
              {dashboardData?.cognition ? (
                <ErrorBoundary fallback={<div className="text-sm text-muted-foreground p-4">Progress map unavailable</div>}>
                  <CognitionDashboard data={dashboardData.cognition} />
                </ErrorBoundary>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--sp-12)' }}>
                  <Loader2 className="animate-spin" color="var(--accent-purple)" size={32} />
                </div>
              )}
            </div>
          )}

          {/* B. Review Queue Drawer */}
          {activeDrawer === 'revision' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
              <ErrorBoundary fallback={<div className="text-sm text-muted-foreground p-4">Revision queue unavailable</div>}>
                <RevisionQueue goalId={activeGoalId ?? undefined} />
              </ErrorBoundary>
            </div>
          )}

          {/* C. Mistake Review Drawer */}
          {activeDrawer === 'autopsy' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
              
              {/* Autopsy Upload State */}
              {!autopsyResult && !isUploadingMock && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                  <Card
                    padding="lg"
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault(); setDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) setFileToUpload(file);
                    }}
                    style={{
                      borderStyle: 'dashed', borderWidth: '2px',
                      borderColor: dragging ? 'var(--accent-cyan)' : 'var(--border-strong)',
                      background: dragging ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center', minHeight: '260px', transition: 'all 0.25s'
                    }}
                  >
                    <div style={{ background: 'var(--accent-cyan-dim)', padding: 'var(--sp-3)', borderRadius: 'var(--radius-full)', marginBottom: 'var(--sp-3)' }}>
                      <Upload color="var(--accent-cyan)" size={24} />
                    </div>
                    <h4 style={{ fontSize: 'var(--fs-base)', fontWeight: 'var(--fw-semibold)', marginBottom: '4px' }}>
                      {dragging ? 'Drop to upload' : 'Drag & Drop Mock Paper'}
                    </h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-xs)', marginBottom: 'var(--sp-4)', textAlign: 'center' }}>
                      Support PDF, TXT, MD, or Image up to 10MB
                    </p>

                    <form onSubmit={handleMockUpload} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-3)', width: '100%', maxWidth: '16rem' }}>
                      <input
                        type="file"
                        accept=".pdf,.txt,.md,image/*"
                        onChange={(e) => setFileToUpload(e.target.files?.[0] || null)}
                        style={{
                          width: '100%', padding: '4px var(--sp-2)',
                          border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 'var(--fs-xs)'
                        }}
                      />
                      {fileToUpload && (
                        <div style={{ fontSize: '11px', color: 'var(--accent-cyan)', textAlign: 'center', background: 'var(--accent-cyan-dim)', padding: '4px 10px', borderRadius: 'var(--radius-sm)', width: '100%' }}>
                          Staged: <strong>{fileToUpload.name}</strong>
                        </div>
                      )}
                      <Button type="submit" disabled={!fileToUpload} size="sm" style={{ width: '100%', background: 'var(--accent-cyan)', color: 'var(--text-inverse)' }}>
                        Run Mistake Review
                      </Button>
                    </form>
                  </Card>
                </div>
              )}

              {/* Autopsy Loading State */}
              {isUploadingMock && (
                <Card padding="lg" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '260px' }}>
                  <Loader2 color="var(--accent-cyan)" size={32} className="animate-spin" style={{ marginBottom: 'var(--sp-4)' }} />
                  <h4 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-bold)' }}>Reading Test Data...</h4>
                  <p style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', marginTop: 8 }}>{uploadStatus}</p>
                </Card>
              )}

              {/* Autopsy Results Dashboard */}
              {autopsyResult && !isUploadingMock && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                  <ErrorBoundary fallback={<div className="text-sm text-muted-foreground p-4">Mistake Review unavailable</div>}>
                    <AutopsyDashboard result={autopsyResult} />
                  </ErrorBoundary>
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--sp-4)' }}>
                    <Button variant="secondary" size="sm" onClick={() => { setAutopsyResult(null); setFileToUpload(null); }}>
                      Analyze Another Assessment
                    </Button>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* D. BEATS Drawer */}
          {activeDrawer === 'beats' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', height: '100%' }}>
              <iframe
                width="100%"
                height="315"
                src="https://www.youtube.com/embed/jfKfPfyJRdk"
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                style={{ borderRadius: 'var(--radius-lg)', border: 'none' }}
              ></iframe>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', textAlign: 'center' }}>
                Lofi beats to relax/study to.
              </p>
            </div>
          )}
        </div>

      </div>

      {showGoalModal && <GoalCreationModal onClose={() => setShowGoalModal(false)} />}
      {showGoalSettingsModal && activeGoal && (
        <GoalSettingsModal goal={activeGoal} onClose={() => setShowGoalSettingsModal(false)} />
      )}

    </div>
  );
}
