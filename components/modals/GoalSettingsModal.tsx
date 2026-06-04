'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Sparkles, Loader2, Save } from 'lucide-react';
import { useAppStore, LearningGoal } from '@/stores/appStore';
import { getPresetOptions } from '@/lib/types/universal-domain';

function InputField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
      <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)', padding: '10px 12px', color: 'var(--text-primary)',
          fontSize: 'var(--fs-sm)', outline: 'none', minWidth: 0
        }}
      />
    </div>
  );
}

export default function GoalSettingsModal({ goal, onClose }: { goal: LearningGoal, onClose: () => void }) {
  const { updateLearningGoal } = useAppStore();

  const [title, setTitle] = useState(goal.title || '');
  const [presetId, setPresetId] = useState(goal.preset_id || 'custom_learning_goal');
  const [subject, setSubject] = useState(goal.subject || '');
  const [targetLevel, setTargetLevel] = useState(goal.target_level || '');
  const [deadline, setDeadline] = useState(goal.target_date || goal.deadline || '');
  const [currentLevel, setCurrentLevel] = useState(goal.metadata?.currentLevel || 'beginner');
  const [learningStyle, setLearningStyle] = useState(goal.metadata?.preferredLearningStyle || 'read_write');
  const [dailyHours, setDailyHours] = useState(goal.metadata?.timeAvailable || 8);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const presets = getPresetOptions();

  const handleUpdateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    
    const selectedPreset = presets.find(p => p.id === presetId);

    const updated = await updateLearningGoal(goal.id, {
      title: title.trim(),
      presetId,
      examType: selectedPreset?.goal_type || 'custom',
      deadline,
      subject,
      targetLevel,
      currentLevel,
      timeAvailable: dailyHours,
      preferredLearningStyle: learningStyle,
    });
    
    setIsSubmitting(false);

    if (updated) {
      onClose();
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 'var(--sp-4)'
    }}>
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        style={{
          background: 'var(--bg-primary)', border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '500px',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: 'var(--shadow-xl)',
          maxHeight: '90vh'
        }}
      >
        <div style={{
          padding: 'var(--sp-4) var(--sp-5)', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg-secondary)'
        }}>
          <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <Sparkles size={20} color="var(--accent-blue)" /> Goal Settings
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleUpdateGoal} style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <div style={{ padding: 'var(--sp-5)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            
            <InputField
              label="Goal Title"
              value={title}
              onChange={setTitle}
              placeholder="e.g., Crack NEET 2027, Master Python, Build SaaS"
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
              <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Preset / Operating Mode
              </label>
              <select
                value={presetId}
                onChange={(e) => setPresetId(e.target.value)}
                style={{
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)', padding: '10px 12px', color: 'var(--text-primary)',
                  fontSize: 'var(--fs-sm)', outline: 'none', minWidth: 0, appearance: 'none'
                }}
              >
                {presets.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 'var(--sp-4)' }}>
              <InputField
                label="Target Date / Deadline"
                value={deadline}
                onChange={setDeadline}
                placeholder="e.g., May 2027"
              />
              <InputField
                label="Target Level/Score"
                value={targetLevel}
                onChange={setTargetLevel}
                placeholder="e.g., 700+, Senior Level"
              />
            </div>
            
            <InputField
              label="Subject (Optional)"
              value={subject}
              onChange={setSubject}
              placeholder="e.g., Biology, Computer Science"
            />

            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                background: 'transparent', border: 'none', color: 'var(--accent-blue)',
                fontSize: 'var(--fs-xs)', cursor: 'pointer', textAlign: 'left', padding: 0,
                marginTop: 'var(--sp-2)'
              }}
            >
              {showAdvanced ? '- Hide Advanced Settings' : '+ Show Advanced Settings'}
            </button>

            {showAdvanced && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', marginTop: 'var(--sp-2)', paddingTop: 'var(--sp-4)', borderTop: '1px dashed var(--border-subtle)' }}>
                <div style={{ display: 'flex', gap: 'var(--sp-4)' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
                    <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Current Level</label>
                    <select value={currentLevel} onChange={(e) => setCurrentLevel(e.target.value)} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '10px', color: 'var(--text-primary)' }}>
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
                    <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Hours / Day</label>
                    <input type="number" min="1" max="16" value={dailyHours} onChange={(e) => setDailyHours(parseInt(e.target.value))} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '10px', color: 'var(--text-primary)' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
                  <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Preferred Learning Style</label>
                  <select value={learningStyle} onChange={(e) => setLearningStyle(e.target.value)} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '10px', color: 'var(--text-primary)' }}>
                    <option value="read_write">Reading & Writing (Notes, Books)</option>
                    <option value="visual">Visual (Diagrams, Videos)</option>
                    <option value="auditory">Auditory (Lectures, Discussions)</option>
                    <option value="kinesthetic">Kinesthetic (Practice, Projects)</option>
                  </select>
                </div>
              </motion.div>
            )}

          </div>

          <div style={{
            padding: 'var(--sp-4) var(--sp-5)', borderTop: '1px solid var(--border-subtle)',
            display: 'flex', justifyContent: 'flex-end', gap: 'var(--sp-3)',
            background: 'var(--bg-secondary)', marginTop: 'auto'
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 16px', background: 'transparent', border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', fontWeight: 'bold',
                cursor: 'pointer', fontSize: 'var(--fs-sm)'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              style={{
                padding: '10px 20px', background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
                border: 'none', borderRadius: 'var(--radius-md)', color: 'white', fontWeight: 'bold',
                cursor: (isSubmitting || !title.trim()) ? 'not-allowed' : 'pointer',
                opacity: (isSubmitting || !title.trim()) ? 0.6 : 1,
                fontSize: 'var(--fs-sm)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)'
              }}
            >
              {isSubmitting ? (
                <><Loader2 size={16} className="spinner" /> Saving...</>
              ) : (
                <><Save size={16} /> Save Changes</>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
