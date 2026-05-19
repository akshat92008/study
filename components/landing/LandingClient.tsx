'use client';

import NextLink from 'next/link';
import { motion } from 'framer-motion';
import { 
  Brain, 
  Compass, 
  Microscope, 
  Network, 
  Zap, 
  Activity, 
  ArrowRight, 
  Sparkles, 
  Lock, 
  Check, 
  Flame,
  FileText,
  MessageSquare
} from 'lucide-react';

export default function LandingClient() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#09090b', 
      color: '#fafafa', 
      fontFamily: 'system-ui, -apple-system, sans-serif',
      overflowX: 'hidden'
    }}>
      {/* Navigation */}
      <nav style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(9, 9, 11, 0.8)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        padding: 'var(--sp-4) var(--sp-8)'
      }}>
        <div style={{
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          maxWidth: 1200, 
          margin: '0 auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <div style={{
              width: 32, 
              height: 32, 
              borderRadius: 8,
              background: 'linear-gradient(135deg, #00f0ff, #a855f7)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
            }}>
              <Brain size={18} color="white" />
            </div>
            <span style={{ fontWeight: 800, fontSize: 'var(--fs-lg)', letterSpacing: '-0.025em' }}>Cognition OS</span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
            <NextLink href="/login" style={{
              padding: 'var(--sp-2) var(--sp-4)', 
              borderRadius: 8,
              color: '#a1a1aa', 
              fontSize: 'var(--fs-sm)', 
              textDecoration: 'none',
              transition: 'color 0.2s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#a1a1aa'; }}
            >
              Sign In
            </NextLink>
            <NextLink href="/signup" style={{
              padding: 'var(--sp-2) var(--sp-5)', 
              borderRadius: 8,
              background: 'linear-gradient(135deg, #0055ff, #00f0ff)', 
              color: 'white', 
              fontSize: 'var(--fs-sm)',
              fontWeight: 600, 
              textDecoration: 'none',
              boxShadow: '0 0 15px rgba(0, 85, 255, 0.3)'
            }}>
              Get Started
            </NextLink>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header style={{
        position: 'relative',
        textAlign: 'center',
        padding: '120px var(--sp-8) 60px',
        maxWidth: 1000,
        margin: '0 auto',
        backgroundImage: 'radial-gradient(ellipse at 50% 20%, rgba(168, 85, 247, 0.08) 0%, transparent 60%)',
      }}>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 16px',
            background: 'rgba(168, 85, 247, 0.1)',
            border: '1px solid rgba(168, 85, 247, 0.2)',
            borderRadius: 9999,
            fontSize: 'var(--fs-xs)',
            color: '#c084fc',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 'var(--sp-6)'
          }}
        >
          <Sparkles size={12} />
          Confidential Vision Document · May 2026
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          style={{
            fontSize: 'clamp(2.5rem, 7vw, 4.5rem)',
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: '-0.04em',
            marginBottom: 'var(--sp-6)',
          }}
        >
          Cognition OS
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          style={{
            fontSize: 'clamp(1.1rem, 2vw, 1.4rem)',
            color: '#a1a1aa',
            fontWeight: 400,
            maxWidth: 600,
            margin: '0 auto var(--sp-8)',
          }}
        >
          The AI study partner that actually knows you.
        </motion.p>

        {/* Global Market Data Grid */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
            maxWidth: 900,
            margin: '40px auto 0',
            textAlign: 'left'
          }}
        >
          {[
            { value: '$42B', label: 'AI in Education by 2030', sub: 'Growing at 40.9% CAGR' },
            { value: '$33B', label: 'India EdTech by 2034', sub: 'Second largest global market' },
            { value: '30.5%', label: 'AI Tutor CAGR', sub: 'From $2.75B today' },
            { value: '$19/mo', label: 'Pro Pricing Point', sub: 'High value retention model' }
          ].map((stat, i) => (
            <div key={i} style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: 12,
              padding: '20px',
            }}>
              <div style={{
                fontSize: '2.2rem',
                fontWeight: 900,
                background: 'linear-gradient(135deg, #00f0ff, #a855f7)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginBottom: 4
              }}>{stat.value}</div>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600 }}>{stat.label}</div>
              <div style={{ fontSize: 'var(--fs-xs)', color: '#71717a', marginTop: 2 }}>{stat.sub}</div>
            </div>
          ))}
        </motion.div>
      </header>

      {/* Main Body Grid */}
      <main style={{ maxWidth: 1000, margin: '0 auto', padding: '0 var(--sp-8) 120px' }}>
        
        {/* SECTION 01 — THE PROBLEM */}
        <section style={{ margin: '80px 0', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: 60 }}>
          <div style={{ color: '#00f0ff', fontSize: 'var(--fs-xs)', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
            01 — The Problem
          </div>
          <h2 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, marginBottom: 'var(--sp-4)', letterSpacing: '-0.02em' }}>
            Every student is their own systems integrator.
          </h2>
          <p style={{ color: '#a1a1aa', fontSize: 'var(--fs-md)', lineHeight: 1.6, maxWidth: 800, marginBottom: 24 }}>
            A student today wakes up and opens seven different apps. YouTube for lectures. ChatGPT for doubts. Anki for flashcards. Notion for notes. PDFs for tests. Excel to track mistakes. A timer app to manage sessions.
          </p>
          <p style={{ color: '#e4e4e7', fontWeight: 600, fontSize: 'var(--fs-md)', lineHeight: 1.6, maxWidth: 800, marginBottom: 24 }}>
            None of these tools know each other. None of them know her. None of them know she spent three hours on thermodynamics yesterday and still doesn't understand Carnot cycles. None of them know she's been scoring 12% lower on Physics for three weeks.
          </p>

          <div style={{
            background: 'rgba(239, 68, 68, 0.03)',
            borderLeft: '4px solid #ef4444',
            padding: '20px 24px',
            borderRadius: '0 12px 12px 0',
            fontStyle: 'italic',
            color: '#fca5a5',
            fontSize: 'var(--fs-md)'
          }}>
            "The fragmentation is the problem. The passivity is the problem. The amnesia is the problem."
          </div>
        </section>

        {/* SECTION 02 — THE PRODUCT */}
        <section style={{ margin: '80px 0', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: 60 }}>
          <div style={{ color: '#00f0ff', fontSize: 'var(--fs-xs)', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
            02 — The Product
          </div>
          <h2 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, marginBottom: 'var(--sp-4)', letterSpacing: '-0.02em' }}>
            Two surfaces. One intelligence.
          </h2>
          <p style={{ color: '#a1a1aa', fontSize: 'var(--fs-md)', lineHeight: 1.6, maxWidth: 800, marginBottom: 40 }}>
            Cognition OS is built around a simple insight: students need a conversation and a dashboard — not six separate apps. The chat is the front door. The OS is the house. They share one brain.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 24
          }}>
            {/* The Chat Card */}
            <div style={{
              background: 'rgba(0, 240, 255, 0.02)',
              border: '1px solid rgba(0, 240, 255, 0.1)',
              borderRadius: 16,
              padding: 32,
              boxShadow: '0 0 30px rgba(0, 240, 255, 0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <MessageSquare style={{ color: '#00f0ff' }} size={24} />
                <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 800 }}>The Chat <span style={{ fontSize: 10, background: 'rgba(0, 240, 255, 0.1)', color: '#00f0ff', padding: '2px 8px', borderRadius: 4, marginLeft: 8 }}>PRIMARY</span></h3>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12, color: '#a1a1aa', fontSize: 'var(--fs-sm)' }}>
                {['Talks to all six modules simultaneously', 'Remembers everything — mistakes, gaps, history', 'Teaches Socratically, not passively', 'Generates flashcards inline, in conversation', 'Runs Autopsy when you upload a test', 'Tells you what to study right now', 'Watches OS activity and responds proactively'].map((item, idx) => (
                  <li key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ color: '#00f0ff' }}>→</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* The Dashboard Card */}
            <div style={{
              background: 'rgba(168, 85, 247, 0.02)',
              border: '1px solid rgba(168, 85, 247, 0.1)',
              borderRadius: 16,
              padding: 32,
              boxShadow: '0 0 30px rgba(168, 85, 247, 0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <Activity style={{ color: '#a855f7' }} size={24} />
                <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 800 }}>The OS Dashboard <span style={{ fontSize: 10, background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', padding: '2px 8px', borderRadius: 4, marginLeft: 8 }}>DEPTH</span></h3>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12, color: '#a1a1aa', fontSize: 'var(--fs-sm)' }}>
                {['ATLAS — Dynamic concept knowledge graph', 'MEMORY — Math-backed FSRS flashcard queue', 'AUTOPSY — Error root-cause classifier', 'COMMAND — AI mission daily planner', 'PULSE — Silent mental state burnout monitor', 'Analytics — Bloomberg-grade performance trends'].map((item, idx) => (
                  <li key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ color: '#a855f7' }}>→</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* SECTION 03 — THE DAILY HABIT */}
        <section style={{ margin: '80px 0', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: 60 }}>
          <div style={{ color: '#00f0ff', fontSize: 'var(--fs-xs)', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
            03 — The Daily Habit
          </div>
          <h2 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, marginBottom: 'var(--sp-4)', letterSpacing: '-0.02em' }}>
            One session. Every day. Gets smarter each time.
          </h2>
          <p style={{ color: '#a1a1aa', fontSize: 'var(--fs-md)', lineHeight: 1.6, maxWidth: 800, marginBottom: 40 }}>
            Duolingo's biggest lesson: **habit first, intelligence second**. You cannot teach someone who stops opening your app. We replace a confusing checklist of 65 tasks with one focused session.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
            {/* Duolingo style mock session card */}
            <motion.div 
              whileHover={{ y: -4 }}
              style={{
                width: '100%',
                maxWidth: 420,
                background: 'linear-gradient(135deg, #111115, #0a0a0d)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 20,
                padding: 30,
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <span style={{ color: '#00f0ff', fontFamily: 'monospace', fontSize: 'var(--fs-xs)', fontWeight: 'bold' }}>DAY 23</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#f97316', fontWeight: 'bold', fontSize: 'var(--fs-sm)' }}>
                  <Flame size={16} fill="#f97316" /> STREAK 23
                </span>
              </div>

              <h3 style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, marginBottom: 4 }}>Today's Focus</h3>
              <p style={{ color: '#a855f7', fontWeight: 600, fontSize: 'var(--fs-md)', marginBottom: 16 }}>Electrochemistry · 25 minutes</p>
              
              <div style={{ 
                background: 'rgba(255, 255, 255, 0.02)', 
                border: '1px solid rgba(255, 255, 255, 0.05)', 
                borderRadius: 12, 
                padding: 16, 
                marginBottom: 24,
                fontSize: 'var(--fs-xs)',
                color: '#71717a'
              }}>
                Based on mock test yesterday + 3 cards overdue
              </div>

              <NextLink href="/onboarding" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                background: 'linear-gradient(135deg, #0055ff, #00f0ff)',
                color: 'white',
                padding: '16px',
                borderRadius: 12,
                fontWeight: 700,
                textDecoration: 'none',
                boxShadow: '0 4px 20px rgba(0, 240, 255, 0.2)'
              }}>
                Start Session <ArrowRight size={16} />
              </NextLink>
            </motion.div>
          </div>
        </section>

        {/* SECTION 04 — THE INTELLIGENCE ENGINE */}
        <section style={{ margin: '80px 0', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: 60 }}>
          <div style={{ color: '#00f0ff', fontSize: 'var(--fs-xs)', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
            04 — The Intelligence Engine
          </div>
          <h2 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, marginBottom: 'var(--sp-4)', letterSpacing: '-0.02em' }}>
            Six modules. All invisible. All connected.
          </h2>
          <p style={{ color: '#a1a1aa', fontSize: 'var(--fs-md)', lineHeight: 1.6, maxWidth: 800, marginBottom: 40 }}>
            Students never see names of modules or graphs. Under the hood, six AI systems synchronize to form one continuously-updating student brain model.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 20,
            marginBottom: 40
          }}>
            {[
              { icon: Brain, title: 'MIND', label: 'Socratic AI Tutor', desc: 'Reads your notes, mistake history, and weak concepts. Guides understanding rather than giving answers.', color: '#a855f7' },
              { icon: Compass, title: 'COMMAND', label: 'Daily Mission Engine', desc: 'Overnight synthesis of 7 data streams into tomorrow morning\'s single focused session.', color: '#3b82f6' },
              { icon: Microscope, title: 'AUTOPSY', label: 'Mock Test Intelligence', desc: 'Ingest PDFs or images. Classifies error root causes: conceptual gaps, calculation slips, or anxiety.', color: '#ef4444' },
              { icon: Network, title: 'ATLAS', label: 'Knowledge Graph', desc: 'Living map tracking prerequisite chains and masteries across topics.', color: '#00f0ff' },
              { icon: Zap, title: 'MEMORY', label: 'FSRS-5 Revision Engine', desc: 'Math-backed spacing scheduler that prompts reviews at the optimal forgetting point.', color: '#eab308' },
              { icon: Activity, title: 'PULSE', label: 'Mental State Engine', desc: 'Silently monitors burnout triggers (drop in session time/accuracy) and dials back load.', color: '#ec4899' },
            ].map((engine, idx) => (
              <div key={idx} style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: 16,
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 12
              }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  background: `rgba(${engine.title === 'MIND' ? '168,85,247' : engine.title === 'COMMAND' ? '59,130,246' : engine.title === 'AUTOPSY' ? '239,68,68' : engine.title === 'ATLAS' ? '0,240,255' : engine.title === 'MEMORY' ? '234,179,8' : '236,72,153'}, 0.1)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <engine.icon style={{ color: engine.color }} size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: engine.color, fontFamily: 'monospace', fontWeight: 'bold' }}>{engine.title}</div>
                  <h4 style={{ fontSize: 'var(--fs-md)', fontWeight: 700, margin: '2px 0 6px' }}>{engine.label}</h4>
                  <p style={{ fontSize: 'var(--fs-xs)', color: '#a1a1aa', lineHeight: 1.5 }}>{engine.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.01)',
            border: '1px solid rgba(255, 255, 255, 0.04)',
            padding: 20,
            borderRadius: 12,
            fontSize: 'var(--fs-xs)',
            color: '#71717a',
            lineHeight: 1.5
          }}>
            <strong>The magic:</strong> when you get a question wrong in a mock test, <span style={{ color: '#ef4444' }}>AUTOPSY</span> classifies the error → <span style={{ color: '#00f0ff' }}>ATLAS</span> downscales mastery → <span style={{ color: '#eab308' }}>MEMORY</span> creates a flashcard → <span style={{ color: '#3b82f6' }}>COMMAND</span> adds remediation to tomorrow → <span style={{ color: '#a855f7' }}>MIND</span> is primed to approach it differently next time. One mistake triggers the entire system. Automatically.
          </div>
        </section>

        {/* SECTION 05 — PRICING & TIER GATING */}
        <section style={{ margin: '80px 0', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: 60 }}>
          <div style={{ color: '#00f0ff', fontSize: 'var(--fs-xs)', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
            05 — Revenue Model
          </div>
          <h2 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, marginBottom: 'var(--sp-4)', letterSpacing: '-0.02em' }}>
            Three tiers. Subscription. No ads.
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 24,
            marginTop: 32
          }}>
            {/* Free Card */}
            <div style={{
              background: '#0e0e11',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: 16,
              padding: 28
            }}>
              <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700 }}>Free</h3>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, margin: '8px 0 16px' }}>$0 <span style={{ fontSize: 'var(--fs-xs)', color: '#71717a' }}>/ month</span></div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 'var(--fs-xs)', color: '#a1a1aa' }}>
                <li style={{ display: 'flex', gap: 8 }}><Check size={14} style={{ color: '#22c55e' }} /> 1 syllabus document upload</li>
                <li style={{ display: 'flex', gap: 8 }}><Check size={14} style={{ color: '#22c55e' }} /> 10 tutor chats / day</li>
                <li style={{ display: 'flex', gap: 8 }}><Check size={14} style={{ color: '#22c55e' }} /> 1 mock test autopsy / month</li>
                <li style={{ display: 'flex', gap: 8 }}><Check size={14} style={{ color: '#22c55e' }} /> 20 flashcard reviews / day</li>
              </ul>
              <NextLink href="/signup" style={{ display: 'block', textAlign: 'center', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'white', padding: 12, borderRadius: 8, fontSize: 'var(--fs-xs)', fontWeight: 600, textDecoration: 'none' }}>
                Sign Up
              </NextLink>
            </div>

            {/* Pro Card */}
            <div style={{
              background: 'linear-gradient(135deg, #12121c, #0e0e14)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              borderRadius: 16,
              padding: 28,
              position: 'relative'
            }}>
              <div style={{ position: 'absolute', top: -12, right: 16, background: '#a855f7', color: 'white', padding: '2px 10px', borderRadius: 20, fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' }}>Most Popular</div>
              <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700 }}>Pro</h3>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, margin: '8px 0 16px' }}>$19 <span style={{ fontSize: 'var(--fs-xs)', color: '#71717a' }}>/ month</span></div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 'var(--fs-xs)', color: '#e4e4e7' }}>
                <li style={{ display: 'flex', gap: 8 }}><Check size={14} style={{ color: '#a855f7' }} /> Unlimited tutor chats & uploads</li>
                <li style={{ display: 'flex', gap: 8 }}><Check size={14} style={{ color: '#a855f7' }} /> Full ATLAS knowledge graph</li>
                <li style={{ display: 'flex', gap: 8 }}><Check size={14} style={{ color: '#a855f7' }} /> Unlimited autopsies & reviews</li>
                <li style={{ display: 'flex', gap: 8 }}><Check size={14} style={{ color: '#a855f7' }} /> Daily mission + morning briefs</li>
                <li style={{ display: 'flex', gap: 8 }}><Check size={14} style={{ color: '#a855f7' }} /> PULSE burnout monitoring</li>
              </ul>
              <NextLink href="/signup" style={{ display: 'block', textAlign: 'center', background: '#a855f7', color: 'white', padding: 12, borderRadius: 8, fontSize: 'var(--fs-xs)', fontWeight: 600, textDecoration: 'none' }}>
                Upgrade to Pro
              </NextLink>
            </div>

            {/* Teams Card */}
            <div style={{
              background: '#0e0e11',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: 16,
              padding: 28
            }}>
              <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700 }}>Teams</h3>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, margin: '8px 0 16px' }}>$49 <span style={{ fontSize: 'var(--fs-xs)', color: '#71717a' }}>/ user / mo</span></div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 'var(--fs-xs)', color: '#a1a1aa' }}>
                <li style={{ display: 'flex', gap: 8 }}><Check size={14} style={{ color: '#3b82f6' }} /> Everything in Pro</li>
                <li style={{ display: 'flex', gap: 8 }}><Check size={14} style={{ color: '#3b82f6' }} /> Custom curriculum seeding</li>
                <li style={{ display: 'flex', gap: 8 }}><Check size={14} style={{ color: '#3b82f6' }} /> Educator dashboard</li>
                <li style={{ display: 'flex', gap: 8 }}><Check size={14} style={{ color: '#3b82f6' }} /> At-risk student alert analytics</li>
              </ul>
              <NextLink href="/signup" style={{ display: 'block', textAlign: 'center', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'white', padding: 12, borderRadius: 8, fontSize: 'var(--fs-xs)', fontWeight: 600, textDecoration: 'none' }}>
                Contact Sales
              </NextLink>
            </div>
          </div>
        </section>

        {/* BOTTOM CALL TO ACTION */}
        <section style={{ 
          textAlign: 'center', 
          padding: '80px 40px',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          backgroundImage: 'radial-gradient(ellipse at 50% 100%, rgba(0, 240, 255, 0.08) 0%, transparent 60%)',
          borderRadius: 24,
          background: 'rgba(255, 255, 255, 0.01)',
          marginTop: 60
        }}>
          <h2 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 900, marginBottom: 12 }}>
            Start your daily streak today.
          </h2>
          <p style={{ color: '#a1a1aa', maxWidth: 500, margin: '0 auto 32px', fontSize: 'var(--fs-md)' }}>
            One session a day is all it takes to build a durable model of understanding.
          </p>
          <NextLink href="/signup" style={{
            padding: '16px 36px',
            borderRadius: 12,
            background: 'linear-gradient(135deg, #00f0ff, #a855f7)',
            color: 'white',
            fontSize: 'var(--fs-md)',
            fontWeight: 700,
            textDecoration: 'none',
            display: 'inline-block',
            boxShadow: '0 0 30px rgba(0, 240, 255, 0.2)'
          }}>
            Get Started Free
          </NextLink>
        </section>

      </main>

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '30px var(--sp-6)',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        fontSize: 'var(--fs-xs)',
        color: '#52525b',
        background: '#070709'
      }}>
        © 2026 Cognition OS. The intelligence layer between humans and learning.
      </footer>
    </div>
  );
}
