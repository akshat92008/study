'use client';

import NextLink from 'next/link';
import { motion, Variants } from 'framer-motion';
import { Brain, Target, RefreshCw, BarChart3, Calendar, Sparkles, Zap, ArrowRight } from 'lucide-react';

const features = [
  { icon: Brain, title: 'Cognition Graph', desc: 'Dynamic model of your entire knowledge state', color: 'var(--accent-purple)' },
  { icon: Target, title: 'Mistake Intelligence', desc: 'AI analysis of why you lose marks', color: 'var(--danger)' },
  { icon: RefreshCw, title: 'Adaptive Revision', desc: 'FSRS-5 spaced repetition engine', color: 'var(--accent-cyan)' },
  { icon: Sparkles, title: 'AI Mentor', desc: 'Emotionally intelligent academic coach', color: 'var(--accent-purple)' },
  { icon: Calendar, title: 'Smart Planner', desc: 'AI-generated adaptive daily plans', color: 'var(--accent-blue)' },
  { icon: BarChart3, title: 'Performance Analytics', desc: 'Bloomberg-grade academic intelligence', color: 'var(--success)' },
];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 15 } },
};

export default function LandingClient() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-root)', overflow: 'hidden' }}>
      {/* Nav */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'var(--sp-4) var(--sp-8)', maxWidth: 1200, margin: '0 auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><Zap size={18} color="white" /></div>
          <span style={{ fontWeight: 'var(--fw-bold)' as any, fontSize: 'var(--fs-md)' }}>Cognition OS</span>
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
          <NextLink href="/login" style={{
            padding: 'var(--sp-2) var(--sp-4)', borderRadius: 'var(--radius-md)',
            color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', textDecoration: 'none',
          }}>Sign In</NextLink>
          <NextLink href="/signup" style={{
            padding: 'var(--sp-2) var(--sp-5)', borderRadius: 'var(--radius-md)',
            background: 'var(--accent-blue)', color: 'white', fontSize: 'var(--fs-sm)',
            fontWeight: 'var(--fw-semibold)' as any, textDecoration: 'none',
          }}>Get Started</NextLink>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        textAlign: 'center', padding: 'var(--sp-20) var(--sp-8) var(--sp-16)',
        maxWidth: 800, margin: '0 auto',
        backgroundImage: 'radial-gradient(ellipse at 50% 20%, hsla(220,90%,56%,0.1) 0%, transparent 50%)',
      }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          style={{
            display: 'inline-block', padding: 'var(--sp-1) var(--sp-4)',
            background: 'var(--accent-blue-glow)', border: '1px solid var(--accent-blue-dim)',
            borderRadius: 'var(--radius-full)', fontSize: 'var(--fs-xs)',
            color: 'var(--accent-blue)', fontWeight: 'var(--fw-semibold)' as any,
            letterSpacing: 'var(--ls-wide)', textTransform: 'uppercase', marginBottom: 'var(--sp-6)',
          }}
        >
          AI-Native Academic OS
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          style={{
            fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 'var(--fw-black)' as any,
            lineHeight: 'var(--lh-tight)', letterSpacing: 'var(--ls-tight)', marginBottom: 'var(--sp-5)',
          }}
        >
          The AI that actually <br />
          <span style={{
            background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple), var(--accent-cyan))',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            knows you
          </span>.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          style={{
            fontSize: 'var(--fs-lg)', color: 'var(--text-secondary)',
            lineHeight: 'var(--lh-relaxed)', maxWidth: 600, margin: '0 auto var(--sp-8)',
          }}
        >
          Upload what you're studying. Tell it your deadline. It takes over from there.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'center' }}
        >
          <NextLink href="/signup" style={{
            padding: 'var(--sp-3) var(--sp-8)', borderRadius: 'var(--radius-lg)',
            background: 'var(--accent-blue)', color: 'white', fontSize: 'var(--fs-md)',
            fontWeight: 'var(--fw-semibold)' as any, textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-2)',
            boxShadow: 'var(--shadow-glow-blue)',
            transition: 'all 0.2s',
          }}>
            Start Free <ArrowRight size={18} />
          </NextLink>
        </motion.div>
      </section>

      {/* Use Cases Grid */}
      <motion.section
        variants={containerVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-100px' }}
        style={{
          maxWidth: 1000, margin: '0 auto', padding: '0 var(--sp-8) var(--sp-12)',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--sp-4)',
        }}
      >
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -4, borderColor: 'var(--accent-blue)' }}
          style={{
            padding: 'var(--sp-6)', borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
            textAlign: 'left', transition: 'border-color 0.2s, background-color 0.2s'
          }}
        >
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-blue)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', marginBottom: 'var(--sp-2)' }}>For University Students</div>
          <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', marginBottom: 'var(--sp-2)' }}>Acing Finals</h3>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>Upload your lecture slides and textbook chapters. The AI builds a daily study plan backward from your exam date.</p>
        </motion.div>
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -4, borderColor: 'var(--accent-purple)' }}
          style={{
            padding: 'var(--sp-6)', borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
            textAlign: 'left', transition: 'border-color 0.2s, background-color 0.2s'
          }}
        >
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-purple)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', marginBottom: 'var(--sp-2)' }}>For Professionals</div>
          <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', marginBottom: 'var(--sp-2)' }}>CFA & Certifications</h3>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>Tell the AI your exact professional certification. It maps the official syllabus and tests you daily on weak concepts.</p>
        </motion.div>
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -4, borderColor: 'var(--danger)' }}
          style={{
            padding: 'var(--sp-6)', borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
            textAlign: 'left', transition: 'border-color 0.2s, background-color 0.2s'
          }}
        >
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--danger)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', marginBottom: 'var(--sp-2)' }}>For Exam Aspirants</div>
          <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', marginBottom: 'var(--sp-2)' }}>Competitive Exams</h3>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>Upload your mock tests. The AI runs an autopsy to show exactly where you lost marks and assigns a high-ROI recovery sprint.</p>
        </motion.div>
      </motion.section>

      {/* Features Grid */}
      <motion.section
        variants={containerVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-100px' }}
        style={{
          maxWidth: 1000, margin: '0 auto', padding: '0 var(--sp-8) var(--sp-20)',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--sp-4)',
        }}
      >
        {features.map((f) => (
          <motion.div
            key={f.title}
            variants={itemVariants}
            whileHover={{ y: -4, scale: 1.01 }}
            style={{
              padding: 'var(--sp-6)', borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
          >
            <f.icon size={24} style={{ color: f.color, marginBottom: 'var(--sp-3)' }} />
            <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-semibold)', marginBottom: 'var(--sp-1)' }}>
              {f.title}
            </h3>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
              {f.desc}
            </p>
          </motion.div>
        ))}
      </motion.section>

      {/* Bottom CTA */}
      <section style={{
        textAlign: 'center', padding: 'var(--sp-16) var(--sp-8)',
        borderTop: '1px solid var(--border-subtle)',
        backgroundImage: 'radial-gradient(ellipse at 50% 100%, hsla(265,80%,60%,0.08) 0%, transparent 50%)',
      }}>
        <h2 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)', marginBottom: 'var(--sp-3)' }}>
          Ready to upgrade your brain?
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--sp-6)' }}>
          Join the cognitive revolution in learning.
        </p>
        <NextLink href="/signup" style={{
          padding: 'var(--sp-3) var(--sp-8)', borderRadius: 'var(--radius-lg)',
          background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
          color: 'white', fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-semibold)' as any,
          textDecoration: 'none', display: 'inline-block',
        }}>Get Started Free</NextLink>
      </section>

      {/* Footer */}
      <footer style={{
        textAlign: 'center', padding: 'var(--sp-6)',
        borderTop: '1px solid var(--border-subtle)',
        fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)',
      }}>
        © 2026 Cognition OS. The intelligence layer between humans and learning.
      </footer>
    </div>
  );
}
