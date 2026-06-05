'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Atom,
  BookOpen,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Code2,
  Compass,
  FileStack,
  LibraryBig,
  LineChart,
  ListChecks,
  Map,
  Menu,
  MessageSquareText,
  Network,
  Rocket,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Target,
  UploadCloud,
  X,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';

type ProductMode = 'goal' | 'sources' | 'tutor' | 'autopsy' | 'review' | 'mission';
type FeatureMockKind = 'goal' | 'sources' | 'tutor' | 'autopsy' | 'mission';

const navItems = [
  { label: 'Product', href: '#product' },
  { label: 'Method', href: '#method' },
  { label: 'Pricing', href: '#pricing' },
];

const loopSteps: Array<{ label: string; icon: LucideIcon }> = [
  { label: 'Create Goal', icon: Target },
  { label: 'Upload Sources', icon: UploadCloud },
  { label: 'Ask Tutor', icon: MessageSquareText },
  { label: 'Autopsy Mistakes', icon: SearchCheck },
  { label: 'Review Memory', icon: BrainCircuit },
  { label: 'Get Mission', icon: Compass },
];

const featureVideos: Array<{
  title: string;
  copy: string;
  videoSrc: string;
  mock: FeatureMockKind;
}> = [
  {
    title: 'Start with any goal.',
    copy: 'Class 10 History, NEET Biology, React Hooks, UPSC Polity, CFA Quant. Cognition OS turns the goal into a structured roadmap.',
    videoSrc: '/landing/goal-roadmap.mp4',
    mock: 'goal',
  },
  {
    title: 'Upload the chaos.',
    copy: 'PDFs, notes, question papers, and class material become searchable source memory for your AI tutor.',
    videoSrc: '/landing/source-memory.mp4',
    mock: 'sources',
  },
  {
    title: 'Ask with context.',
    copy: 'The tutor answers from your goal, sources, weak areas, due reviews, and recent mistakes. Not an empty chat.',
    videoSrc: '/landing/tutor-context.mp4',
    mock: 'tutor',
  },
  {
    title: 'Autopsy every mistake.',
    copy: "Don't just see what went wrong. Find the exact concept gap, reasoning error, and next repair task.",
    videoSrc: '/landing/autopsy.mp4',
    mock: 'autopsy',
  },
  {
    title: 'Wake up to your next mission.',
    copy: "Every session becomes tomorrow's plan: what to revise, what to solve, and what to fix.",
    videoSrc: '/landing/daily-mission.mp4',
    mock: 'mission',
  },
];

const storySteps: Array<{
  title: string;
  copy: string;
  mode: ProductMode;
  icon: LucideIcon;
}> = [
  {
    title: 'Create a goal',
    copy: 'Name what you want to master, then let the system shape it into milestones.',
    mode: 'goal',
    icon: Target,
  },
  {
    title: 'Add sources',
    copy: 'Drop in the material you actually study from so answers stay grounded.',
    mode: 'sources',
    icon: FileStack,
  },
  {
    title: 'Learn with tutor',
    copy: 'Ask questions with the full learning state already attached.',
    mode: 'tutor',
    icon: MessageSquareText,
  },
  {
    title: 'Diagnose mistakes',
    copy: 'Convert errors into precise gaps, traps, and repair work.',
    mode: 'autopsy',
    icon: SearchCheck,
  },
  {
    title: 'Review with memory',
    copy: 'Bring back the ideas that are fading before they cost you later.',
    mode: 'review',
    icon: BrainCircuit,
  },
  {
    title: 'Receive next mission',
    copy: 'Wake up to the smallest serious plan that moves the goal forward.',
    mode: 'mission',
    icon: Compass,
  },
];

const universalExamples = [
  {
    title: 'Class 12 Physics',
    goal: 'Master electrostatics before the weekly test',
    nodes: ['Field lines', 'Gauss law', 'Potential energy'],
    mission: 'Solve 18 targeted questions, then review 6 fading formulas.',
    icon: Atom,
  },
  {
    title: 'Class 10 History',
    goal: 'Understand nationalism in Europe',
    nodes: ['Timeline', 'Key thinkers', 'Map practice'],
    mission: 'Explain 3 causes aloud and autopsy the last source-based error.',
    icon: BookOpen,
  },
  {
    title: 'React Hooks',
    goal: 'Stop confusing effects and memoization',
    nodes: ['useEffect model', 'Dependency arrays', 'Custom hooks'],
    mission: 'Refactor one component and answer 5 context questions.',
    icon: Code2,
  },
  {
    title: 'UPSC Polity',
    goal: 'Build recall for fundamental rights',
    nodes: ['Articles', 'Case links', 'PYQ patterns'],
    mission: 'Revise due cards, then compare two constitutional remedies.',
    icon: ShieldCheck,
  },
];

const featureGrid = [
  {
    title: 'Source Library',
    copy: 'Keep PDFs, notes, and papers indexed around the goal.',
    icon: LibraryBig,
    lines: ['NCERT Ch. 7', 'PYQ Set B', 'Lecture notes'],
  },
  {
    title: 'AI Tutor',
    copy: 'Ask from context, not from a blank prompt.',
    icon: MessageSquareText,
    lines: ['Goal', 'Weak areas', 'Due reviews'],
  },
  {
    title: 'Deep Autopsy',
    copy: 'Turn wrong answers into a repairable diagnosis.',
    icon: SearchCheck,
    lines: ['Concept gap', 'Reasoning trap', 'Repair task'],
  },
  {
    title: 'Memory Review',
    copy: 'See what needs recall before it fades.',
    icon: BrainCircuit,
    lines: ['Due today', 'Fragile', 'Recovered'],
  },
  {
    title: 'Learning Map',
    copy: 'Watch concepts connect as the goal becomes clearer.',
    icon: Network,
    lines: ['Core', 'Linked', 'Needs work'],
  },
  {
    title: 'Daily Mission',
    copy: 'End each session with tomorrow already planned.',
    icon: Compass,
    lines: ['Revise', 'Solve', 'Fix'],
  },
];

const pageContainerClass = 'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener('change', updatePreference);

    return () => mediaQuery.removeEventListener('change', updatePreference);
  }, []);

  return prefersReducedMotion;
}

function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = usePrefersReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0.72, y: 18 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.65, ease: 'easeOut', delay }}
    >
      {children}
    </motion.div>
  );
}

function PrimaryButton({
  href,
  children,
  variant = 'primary',
}: {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <Link
      href={href}
      className={cx(
        'group inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 py-3 text-[0.95rem] font-semibold no-underline transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:px-6',
        variant === 'primary'
          ? 'bg-white text-[#08080c] shadow-[0_0_36px_rgba(168,85,247,0.24)] hover:bg-cyan-100'
          : 'border border-white/16 bg-white/[0.06] text-white backdrop-blur hover:border-cyan-300/40 hover:bg-white/[0.1]',
      )}
    >
      {children}
      <ArrowRight className="h-4 w-4 transition duration-200 group-hover:translate-x-0.5" />
    </Link>
  );
}

export function CinematicLandingPage({ availableVideos = [] }: { availableVideos?: string[] }) {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#050509] text-white selection:bg-violet-500/30">
      <div className="pointer-events-none fixed inset-0 z-0 landing-grid opacity-70" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(180deg,rgba(124,58,237,0.18)_0%,rgba(5,5,9,0)_28%,rgba(5,5,9,0)_70%,rgba(34,211,238,0.08)_100%)]" />
      <LandingNav />
      <HeroSection />
      <ProductLoop />
      <FeatureVideoSections availableVideos={availableVideos} />
      <StickyStory />
      <UniversalExamples />
      <FeatureGrid />
      <PricingSection />
      <FinalCTA />
      <LandingFooter />
    </main>
  );
}

function LandingNav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#050509]/72 backdrop-blur-xl">
      <div className={cx(pageContainerClass, 'flex h-16 items-center justify-between')}>
        <Link href="/" className="flex items-center gap-3 text-white no-underline">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-violet-300/25 bg-violet-400/10 shadow-[0_0_28px_rgba(124,58,237,0.22)]">
            <BrainCircuit className="h-5 w-5 text-violet-200" />
          </span>
          <span className="font-display text-[1rem] font-semibold">Cognition OS</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[0.9rem] font-medium text-white/62 no-underline transition hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-[0.9rem] font-medium text-white/68 no-underline transition hover:text-white"
          >
            Sign In
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-4 py-2 text-[0.9rem] font-semibold text-[#08080c] no-underline shadow-[0_0_26px_rgba(168,85,247,0.18)] transition hover:bg-cyan-100"
          >
            <Rocket className="h-4 w-4" />
            Launch App
          </Link>
        </div>

        <button
          type="button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.06] text-white md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-white/10 bg-[#08080f]/95 md:hidden"
          >
            <div className={cx(pageContainerClass, 'grid gap-2 py-4')}>
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-3 text-[1rem] font-medium text-white/78 no-underline hover:bg-white/[0.06] hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
              <div className="mt-2 grid grid-cols-2 gap-3">
                <Link
                  href="/login"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/14 text-[0.95rem] font-semibold text-white no-underline"
                >
                  Sign In
                </Link>
                <Link
                  href="/dashboard"
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-white text-[0.95rem] font-semibold text-[#08080c] no-underline"
                >
                  Launch App
                </Link>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </nav>
  );
}

function HeroSection() {
  const reduceMotion = usePrefersReducedMotion();
  const particles = [
    'left-[11%] top-[22%]',
    'left-[22%] top-[72%]',
    'left-[78%] top-[26%]',
    'left-[89%] top-[66%]',
    'left-[62%] top-[12%]',
    'left-[38%] top-[88%]',
  ];

  return (
    <section className="relative z-10 overflow-hidden pb-20 pt-16 sm:pb-24 sm:pt-20">
      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(124,58,237,0.16),rgba(5,5,9,0)_34%,rgba(34,211,238,0.12)_72%,rgba(5,5,9,0))]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/40 to-transparent" />
      {particles.map((position, index) => (
        <motion.span
          key={position}
          className={cx(
            'pointer-events-none absolute h-1 w-1 rounded-[2px] bg-cyan-200/70 shadow-[0_0_18px_rgba(34,211,238,0.65)]',
            position,
          )}
          animate={
            reduceMotion
              ? undefined
              : {
                  opacity: [0.25, 0.95, 0.25],
                  y: [0, index % 2 === 0 ? -12 : 12, 0],
                }
          }
          transition={{ duration: 5 + index, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      <div className={cx(pageContainerClass, 'relative flex flex-col items-center text-center')}>
        <Reveal>
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-300/[0.08] px-4 py-2 text-[0.85rem] font-medium text-violet-100 shadow-[0_0_30px_rgba(124,58,237,0.16)] backdrop-blur">
            <Sparkles className="h-4 w-4" />
            Private beta for serious learners
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <h1 className="mt-8 max-w-6xl font-display text-[3rem] font-semibold leading-[1] text-white sm:text-[4.45rem] lg:text-[5.55rem]">
            Understand anything.
            <span className="block bg-gradient-to-r from-white via-violet-100 to-cyan-100 bg-clip-text text-transparent">
              Remember everything.
            </span>
          </h1>
        </Reveal>

        <Reveal delay={0.16}>
          <p className="mx-auto mt-7 max-w-3xl text-[1.05rem] leading-8 text-white/68 sm:text-[1.22rem]">
            Cognition OS turns your goals, sources, mistakes, and reviews into a daily learning mission &mdash; guided by an AI tutor that knows your progress.
          </p>
        </Reveal>

        <Reveal delay={0.24}>
          <div className="mt-9 flex w-full max-w-md [flex-direction:column] gap-3 sm:max-w-none sm:[flex-direction:row] sm:justify-center">
            <PrimaryButton href="/dashboard">Launch Cognition OS</PrimaryButton>
            <PrimaryButton href="/waitlist" variant="secondary">
              Join private beta
            </PrimaryButton>
          </div>
        </Reveal>

        <Reveal className="mt-14 w-full" delay={0.32}>
          <div className="relative mx-auto w-full max-w-6xl">
            <div className="absolute inset-x-6 -top-5 h-24 bg-gradient-to-r from-violet-500/20 via-cyan-400/14 to-violet-500/20 blur-3xl" />
            <ProductMockup mode="mission" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function ProductMockup({ mode = 'mission' }: { mode?: ProductMode }) {
  const config: Record<ProductMode, { label: string; goal: string; mission: string; accent: string }> = {
    goal: {
      label: 'Goal Builder',
      goal: 'React Hooks mastery',
      mission: 'Turn goal into 4 roadmap lanes',
      accent: 'text-violet-200 border-violet-300/35 bg-violet-400/10',
    },
    sources: {
      label: 'Source Memory',
      goal: 'UPSC Polity revision',
      mission: 'Index 6 sources and extract weak links',
      accent: 'text-cyan-100 border-cyan-300/35 bg-cyan-300/10',
    },
    tutor: {
      label: 'AI Tutor',
      goal: 'Class 12 Physics',
      mission: 'Explain Gauss law from uploaded notes',
      accent: 'text-violet-100 border-violet-300/35 bg-violet-300/10',
    },
    autopsy: {
      label: 'Mistake Autopsy',
      goal: 'CFA Quant repair',
      mission: 'Diagnose 3 recurring reasoning traps',
      accent: 'text-amber-100 border-amber-300/35 bg-amber-300/10',
    },
    review: {
      label: 'Review Queue',
      goal: 'History source practice',
      mission: 'Recover 14 fragile memory cards',
      accent: 'text-cyan-100 border-cyan-300/35 bg-cyan-300/10',
    },
    mission: {
      label: "Today's Mission",
      goal: 'Daily mastery plan',
      mission: 'Revise cell cycle, solve 30 questions, autopsy 5 misses',
      accent: 'text-violet-100 border-violet-300/35 bg-violet-300/10',
    },
  };
  const current = config[mode];

  return (
    <div className="relative w-full max-w-full overflow-hidden rounded-lg border border-white/14 bg-[#0b0b13]/88 text-left shadow-[0_30px_100px_rgba(0,0,0,0.55)] backdrop-blur">
      <div className="flex h-11 items-center justify-between border-b border-white/10 bg-white/[0.035] px-4">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-300/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-300/70" />
        </div>
        <div className="hidden rounded-full border border-white/10 bg-black/20 px-4 py-1 text-[0.75rem] text-white/42 sm:block">
          cognition.os/mission
        </div>
        <div className="h-6 w-16 rounded-full border border-white/10 bg-white/[0.04]" />
      </div>

      <div className="grid min-h-[520px] grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden border-r border-white/10 bg-black/18 p-4 lg:block">
          <div className="mb-5 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-400/12">
              <BrainCircuit className="h-4 w-4 text-violet-200" />
            </div>
            <div>
              <p className="text-[0.78rem] font-semibold text-white">Cognition OS</p>
              <p className="text-[0.7rem] text-white/40">Learning state live</p>
            </div>
          </div>
          {[
            { label: "Today's Mission", icon: Compass, key: 'mission' },
            { label: 'Active Goal', icon: Target, key: 'goal' },
            { label: 'Source Memory', icon: FileStack, key: 'sources' },
            { label: 'AI Tutor', icon: MessageSquareText, key: 'tutor' },
            { label: 'Mistake Autopsy', icon: SearchCheck, key: 'autopsy' },
            { label: 'Review Queue', icon: BrainCircuit, key: 'review' },
            { label: 'Learning Map', icon: Network, key: 'mission' },
          ].map((item) => (
            <div
              key={item.label}
              className={cx(
                'mb-2 flex items-center gap-3 rounded-lg border px-3 py-2.5 text-[0.78rem] transition',
                item.key === mode
                  ? current.accent
                  : 'border-transparent bg-transparent text-white/48',
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </div>
          ))}
        </aside>

        <div className="relative overflow-hidden p-4 sm:p-5 lg:p-6">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(124,58,237,0.12),transparent_34%,rgba(34,211,238,0.08)_75%,transparent)]" />
          <div className="relative grid gap-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
              <section className="rounded-lg border border-white/12 bg-[#11111b]/82 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[0.8rem] font-medium text-cyan-100/72">{current.label}</p>
                    <h3 className="mt-2 text-[1.45rem] font-semibold leading-tight text-white sm:text-[1.9rem]">
                      {current.goal}
                    </h3>
                  </div>
                  <span className={cx('rounded-full border px-3 py-1 text-[0.75rem]', current.accent)}>
                    Live
                  </span>
                </div>
                <div className="mt-6 rounded-lg border border-white/10 bg-black/20 p-4">
                  <div className="mb-3 flex items-center gap-2 text-[0.8rem] font-semibold text-white/74">
                    <ListChecks className="h-4 w-4 text-cyan-200" />
                    Daily mission
                  </div>
                  <p className="text-[1rem] leading-7 text-white/84">{current.mission}</p>
                  <div className="mt-5 grid gap-2 sm:grid-cols-3">
                    {['Revise', 'Solve', 'Repair'].map((item, index) => (
                      <div key={item} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                        <div className="mb-2 h-1.5 rounded-full bg-white/10">
                          <motion.div
                            className={cx(
                              'h-full rounded-full',
                              index === 0 ? 'bg-cyan-300' : index === 1 ? 'bg-violet-300' : 'bg-amber-300',
                            )}
                            initial={{ width: '24%' }}
                            animate={{ width: `${58 + index * 15}%` }}
                            transition={{ duration: 1.2, ease: 'easeOut' }}
                          />
                        </div>
                        <p className="text-[0.78rem] text-white/56">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-white/12 bg-[#101019]/82 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[0.8rem] font-semibold text-white">AI Tutor</p>
                    <p className="text-[0.72rem] text-white/42">Context attached</p>
                  </div>
                  <MessageSquareText className="h-5 w-5 text-violet-200" />
                </div>
                <div className="space-y-3">
                  <div className="ml-6 rounded-lg border border-white/10 bg-white/[0.05] p-3 text-[0.78rem] leading-5 text-white/62">
                    Why did I miss this question again?
                  </div>
                  <div className="mr-4 rounded-lg border border-violet-200/18 bg-violet-300/[0.08] p-3 text-[0.78rem] leading-5 text-white/78">
                    Your last two errors share the same trigger: applying the formula before checking the condition.
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {['Goal', 'Sources', 'Mistakes', 'Reviews'].map((chip) => (
                    <span key={chip} className="rounded-full border border-cyan-200/14 bg-cyan-300/[0.06] px-2.5 py-1 text-[0.7rem] text-cyan-100/76">
                      {chip}
                    </span>
                  ))}
                </div>
              </section>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <MiniPanel
                active={mode === 'sources'}
                icon={FileStack}
                title="Source Memory"
                metric="24 indexed"
                items={['NCERT notes', 'Question paper', 'Lecture transcript']}
              />
              <MiniPanel
                active={mode === 'autopsy'}
                icon={SearchCheck}
                title="Mistake Autopsy"
                metric="3 gaps found"
                items={['Concept gap', 'Reasoning error', 'Repair task']}
              />
              <MiniPanel
                active={mode === 'review'}
                icon={BrainCircuit}
                title="Review Queue"
                metric="18 due"
                items={['Fragile facts', 'Formula recall', 'Mixed practice']}
              />
            </div>

            <section className="rounded-lg border border-white/12 bg-[#101019]/82 p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[0.82rem] font-semibold text-white">Learning Map</p>
                  <p className="text-[0.74rem] text-white/42">Goal connected to sources, mistakes, and reviews</p>
                </div>
                <Map className="h-5 w-5 text-cyan-200" />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {['Goal', 'Sources', 'Tutor', 'Autopsy', 'Review', 'Mission', 'Memory', 'Roadmap'].map((node, index) => (
                  <div
                    key={node}
                    className={cx(
                      'relative rounded-lg border p-3 text-[0.75rem] font-medium',
                      index === 0 || node.toLowerCase().includes(mode)
                        ? 'border-cyan-200/30 bg-cyan-300/[0.08] text-cyan-50'
                        : 'border-white/10 bg-white/[0.035] text-white/52',
                    )}
                  >
                    <span className="relative z-10">{node}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniPanel({
  active,
  icon: Icon,
  title,
  metric,
  items,
}: {
  active?: boolean;
  icon: LucideIcon;
  title: string;
  metric: string;
  items: string[];
}) {
  return (
    <section
      className={cx(
        'rounded-lg border p-4 transition',
        active ? 'border-cyan-200/30 bg-cyan-300/[0.08]' : 'border-white/12 bg-[#101019]/82',
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <Icon className={cx('h-5 w-5', active ? 'text-cyan-100' : 'text-violet-200')} />
        <span className="text-[0.72rem] text-white/44">{metric}</span>
      </div>
      <p className="text-[0.86rem] font-semibold text-white">{title}</p>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item} className="flex items-center gap-2 text-[0.74rem] text-white/52">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-200/70" />
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

function ProductLoop() {
  return (
    <section id="product" className="relative z-10 overflow-hidden border-y border-white/10 bg-white/[0.02] py-16 sm:py-20">
      <div className={pageContainerClass}>
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-[2.25rem] font-semibold leading-tight text-white sm:text-[3.4rem]">
            One loop. Every day.
          </h2>
          <p className="mt-4 text-[1rem] leading-7 text-white/62 sm:text-[1.15rem]">
            Stop managing scattered tools. Cognition OS builds the next action from everything you learn.
          </p>
        </Reveal>

        <Reveal className="mt-12">
          <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6 lg:gap-3">
            <div className="absolute left-7 right-7 top-7 hidden h-px bg-gradient-to-r from-transparent via-violet-200/30 to-transparent lg:block" />
            {loopSteps.map((step, index) => (
              <div key={step.label} className="relative flex gap-4 lg:flex-col lg:items-center lg:text-center">
                <div
                  className={cx(
                    'relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border bg-[#090910] shadow-[0_0_24px_rgba(124,58,237,0.16)]',
                    index === loopSteps.length - 1
                      ? 'border-cyan-200/45 text-cyan-100'
                      : 'border-violet-200/25 text-violet-100',
                  )}
                >
                  <step.icon className="h-5 w-5" />
                  {index === loopSteps.length - 1 ? (
                    <span className="absolute inset-0 rounded-full border border-cyan-200/40 landing-pulse-ring" />
                  ) : null}
                </div>
                <div className="min-w-0 pt-2 md:pt-0">
                  <p className="text-[0.9rem] font-semibold text-white">{step.label}</p>
                  <p className="mt-1 text-[0.76rem] leading-5 text-white/42">Step {index + 1}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function FeatureVideoSections({ availableVideos }: { availableVideos: string[] }) {
  return (
    <>
      {featureVideos.map((feature, index) => (
        <FeatureVideoSection
          key={feature.title}
          feature={feature}
          index={index}
          videoAvailable={availableVideos.includes(feature.videoSrc)}
        />
      ))}
    </>
  );
}

function FeatureVideoSection({
  feature,
  index,
  videoAvailable,
}: {
  feature: (typeof featureVideos)[number];
  index: number;
  videoAvailable: boolean;
}) {
  const reverse = index % 2 === 1;

  return (
    <section className="relative z-10 overflow-hidden py-20 sm:py-24">
      <div className={cx(pageContainerClass, 'grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-14')}>
        <Reveal className={cx(reverse && 'lg:order-2')}>
          <div className="mx-auto max-w-xl lg:mx-0">
            <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-white/12 bg-white/[0.05] text-cyan-100">
              {feature.mock === 'goal' ? (
                <Target className="h-5 w-5" />
              ) : feature.mock === 'sources' ? (
                <FileStack className="h-5 w-5" />
              ) : feature.mock === 'tutor' ? (
                <MessageSquareText className="h-5 w-5" />
              ) : feature.mock === 'autopsy' ? (
                <SearchCheck className="h-5 w-5" />
              ) : (
                <Compass className="h-5 w-5" />
              )}
            </div>
            <h2 className="font-display text-[2.3rem] font-semibold leading-tight text-white sm:text-[3.5rem]">
              {feature.title}
            </h2>
            <p className="mt-5 text-[1rem] leading-8 text-white/62 sm:text-[1.14rem]">{feature.copy}</p>
          </div>
        </Reveal>

        <Reveal className={cx(reverse && 'lg:order-1')} delay={0.12}>
          <VideoOrMock
            videoSrc={feature.videoSrc}
            kind={feature.mock}
            title={feature.title}
            videoAvailable={videoAvailable}
          />
        </Reveal>
      </div>
    </section>
  );
}

function VideoOrMock({
  videoSrc,
  kind,
  title,
  videoAvailable,
}: {
  videoSrc: string;
  kind: FeatureMockKind;
  title: string;
  videoAvailable: boolean;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="relative mx-auto min-h-[360px] w-full max-w-2xl overflow-hidden rounded-lg border border-white/14 bg-[#0b0b13] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.42)] sm:min-h-[420px] sm:p-7">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(124,58,237,0.16),transparent_42%,rgba(34,211,238,0.12))]" />
      <div className="relative z-10">
        <FeatureMock kind={kind} />
        {videoAvailable && !failed ? (
          <video
            aria-label={title}
            className="absolute inset-0 h-full w-full object-cover"
            src={videoSrc}
            muted
            loop
            playsInline
            autoPlay
            onError={() => setFailed(true)}
          />
        ) : null}
      </div>
    </div>
  );
}

function FeatureMock({ kind }: { kind: FeatureMockKind }) {
  if (kind === 'goal') {
    return (
      <div>
        <MockHeader label="Goal to roadmap" />
        <div className="mt-7 rounded-lg border border-white/12 bg-black/22 p-4">
          <p className="text-[0.76rem] text-white/44">Learning goal</p>
          <div className="mt-3 flex items-center justify-between rounded-lg border border-violet-200/20 bg-violet-300/[0.08] px-4 py-3">
            <span className="text-[0.95rem] font-semibold text-white">Master React Hooks</span>
            <ChevronRight className="h-4 w-4 text-cyan-100" />
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {['Mental model', 'Effect timing', 'Dependency traps', 'Custom hook fluency'].map((node, index) => (
            <motion.div
              key={node}
              className="rounded-lg border border-white/12 bg-white/[0.05] p-4"
              animate={{ opacity: [0.9, 1, 0.9] }}
              transition={{ duration: 4 + index, repeat: Infinity, ease: 'easeInOut' }}
            >
              <p className="text-[0.86rem] font-medium text-white">{node}</p>
              <div className="mt-3 h-1.5 rounded-full bg-white/10">
                <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-violet-300 to-cyan-200" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (kind === 'sources') {
    return (
      <div>
        <MockHeader label="Source memory" />
        <div className="mt-7 grid gap-3">
          {[
            ['PDF', 'NCERT Polity Chapter 3', 'Indexed 92 passages'],
            ['Notes', 'Class board summary', 'Linked to 14 concepts'],
            ['Paper', 'PYQ 2025 Set A', 'Tagged 31 traps'],
            ['Audio', 'Lecture transcript', 'Ready for tutor'],
          ].map(([type, title, meta], index) => (
            <motion.div
              key={title}
              className="flex items-center justify-between rounded-lg border border-white/12 bg-white/[0.05] p-4"
              initial={{ opacity: 0.65 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: index * 0.12 }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-200/18 bg-cyan-300/[0.08] text-[0.7rem] font-semibold text-cyan-100">
                  {type}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[0.9rem] font-semibold text-white">{title}</p>
                  <p className="mt-1 text-[0.75rem] text-white/44">{meta}</p>
                </div>
              </div>
              <Check className="h-4 w-4 shrink-0 text-cyan-200" />
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (kind === 'tutor') {
    return (
      <div>
        <MockHeader label="Context tutor" />
        <div className="mt-7 rounded-lg border border-white/12 bg-black/24 p-4">
          <div className="flex flex-wrap gap-2">
            {['Goal: electrostatics', 'Source: notes p.42', 'Weak: flux', 'Due: 8 cards'].map((chip) => (
              <span key={chip} className="rounded-full border border-cyan-200/14 bg-cyan-300/[0.07] px-3 py-1 text-[0.72rem] text-cyan-50/78">
                {chip}
              </span>
            ))}
          </div>
          <div className="mt-6 space-y-4">
            <div className="ml-auto max-w-[82%] rounded-lg border border-white/10 bg-white/[0.06] p-4 text-[0.88rem] leading-6 text-white/72">
              Explain why the flux is zero here.
            </div>
            <div className="max-w-[88%] rounded-lg border border-violet-200/18 bg-violet-300/[0.08] p-4 text-[0.88rem] leading-6 text-white/82">
              Your source defines flux as field through a surface. Here the field is tangent, so no field line crosses the surface.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (kind === 'autopsy') {
    return (
      <div>
        <MockHeader label="Mistake autopsy" />
        <div className="mt-7 grid gap-4">
          {[
            ['Concept gap', 'Mixed up condition with conclusion', 'violet'],
            ['Reasoning error', 'Skipped sign check before substitution', 'amber'],
            ['Next repair task', 'Solve 8 boundary-condition questions', 'cyan'],
          ].map(([title, copy, color]) => (
            <div key={title} className="rounded-lg border border-white/12 bg-white/[0.05] p-4">
              <div className="flex items-center gap-3">
                <span
                  className={cx(
                    'h-2.5 w-2.5 rounded-full',
                    color === 'amber' ? 'bg-amber-300' : color === 'cyan' ? 'bg-cyan-200' : 'bg-violet-300',
                  )}
                />
                <p className="text-[0.86rem] font-semibold text-white">{title}</p>
              </div>
              <p className="mt-3 text-[0.82rem] leading-6 text-white/58">{copy}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <MockHeader label="Daily mission" />
      <div className="mt-7 rounded-lg border border-white/12 bg-white/[0.05] p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[0.78rem] text-cyan-100/70">Tomorrow</p>
            <h3 className="mt-2 text-[1.5rem] font-semibold leading-tight text-white">Repair the exact weak link.</h3>
          </div>
          <Compass className="h-8 w-8 text-cyan-100" />
        </div>
        <div className="mt-7 space-y-3">
          {['Revise 12 source-backed cards', 'Solve 20 mixed questions', 'Autopsy anything below 70%', 'Ask tutor for one summary'].map((task, index) => (
            <div key={task} className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/20 p-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-300/[0.1] text-[0.75rem] font-semibold text-violet-100">
                {index + 1}
              </span>
              <span className="text-[0.86rem] text-white/72">{task}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MockHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 pb-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-400/10">
          <BrainCircuit className="h-4 w-4 text-violet-100" />
        </span>
        <div>
          <p className="text-[0.88rem] font-semibold text-white">{label}</p>
          <p className="text-[0.72rem] text-white/42">Cognition OS</p>
        </div>
      </div>
      <span className="rounded-full border border-cyan-200/18 bg-cyan-300/[0.07] px-3 py-1 text-[0.72rem] text-cyan-100">
        Live state
      </span>
    </div>
  );
}

function StickyStory() {
  return (
    <section id="method" className="relative z-10 overflow-hidden border-y border-white/10 bg-[#07070d] py-20 sm:py-24">
      <div className={pageContainerClass}>
        <Reveal className="max-w-3xl">
          <h2 className="font-display text-[2.35rem] font-semibold leading-tight text-white sm:text-[3.6rem]">
            The system changes as you learn.
          </h2>
          <p className="mt-5 text-[1rem] leading-8 text-white/62 sm:text-[1.14rem]">
            Every source, question, mistake, and review updates the same loop.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="mx-auto w-full max-w-2xl lg:mx-0">
            <ProductMockup mode="mission" />
          </div>

          <div className="grid gap-4 lg:gap-8">
            {storySteps.map((step, index) => (
              <article
                key={step.title}
                className={cx(
                  'rounded-lg border p-5 transition duration-300 lg:min-h-[220px] lg:p-6',
                  index === 0
                    ? 'border-cyan-200/28 bg-cyan-300/[0.07] shadow-[0_0_36px_rgba(34,211,238,0.08)]'
                    : 'border-white/10 bg-white/[0.035]',
                )}
              >
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg border border-white/12 bg-black/22">
                  <step.icon className={cx('h-5 w-5', index === 0 ? 'text-cyan-100' : 'text-violet-100')} />
                </div>
                <h3 className="font-display text-[1.45rem] font-semibold text-white sm:text-[1.75rem]">{step.title}</h3>
                <p className="mt-3 text-[0.98rem] leading-7 text-white/58">{step.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function UniversalExamples() {
  return (
    <section className="relative z-10 overflow-hidden py-20 sm:py-24">
      <div className={pageContainerClass}>
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-[2.35rem] font-semibold leading-tight text-white sm:text-[3.55rem]">
            Built for any subject, exam, or skill.
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {universalExamples.map((example, index) => (
            <Reveal key={example.title} delay={index * 0.05}>
              <article className="h-full rounded-lg border border-white/12 bg-white/[0.045] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-violet-200/18 bg-violet-300/[0.08]">
                      <example.icon className="h-5 w-5 text-violet-100" />
                    </span>
                    <h3 className="text-[1.05rem] font-semibold text-white">{example.title}</h3>
                  </div>
                  <LineChart className="h-5 w-5 text-cyan-100/70" />
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <p className="text-[0.75rem] text-white/42">Goal</p>
                  <p className="mt-2 text-[0.95rem] leading-6 text-white/82">{example.goal}</p>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {example.nodes.map((node) => (
                    <div key={node} className="rounded-lg border border-white/10 bg-white/[0.04] p-3 text-[0.78rem] leading-5 text-white/62">
                      {node}
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-lg border border-cyan-200/16 bg-cyan-300/[0.06] p-4">
                  <p className="text-[0.75rem] text-cyan-100/64">Sample daily mission</p>
                  <p className="mt-2 text-[0.9rem] leading-6 text-white/78">{example.mission}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureGrid() {
  return (
    <section className="relative z-10 overflow-hidden border-y border-white/10 bg-white/[0.02] py-20 sm:py-24">
      <div className={pageContainerClass}>
        <Reveal className="max-w-3xl">
          <h2 className="font-display text-[2.35rem] font-semibold leading-tight text-white sm:text-[3.55rem]">
            Everything your learning loop needs.
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {featureGrid.map((feature, index) => (
            <Reveal key={feature.title} delay={index * 0.04}>
              <article className="h-full rounded-lg border border-white/12 bg-[#0c0c14]/86 p-5">
                <div className="mb-5 flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-violet-200/18 bg-violet-300/[0.08]">
                    <feature.icon className="h-5 w-5 text-violet-100" />
                  </span>
                  <div className="flex gap-1">
                    <span className="h-1.5 w-5 rounded-full bg-cyan-200/55" />
                    <span className="h-1.5 w-3 rounded-full bg-violet-200/40" />
                  </div>
                </div>
                <h3 className="text-[1.1rem] font-semibold text-white">{feature.title}</h3>
                <p className="mt-3 min-h-[3.25rem] text-[0.9rem] leading-6 text-white/56">{feature.copy}</p>
                <div className="mt-5 rounded-lg border border-white/10 bg-black/18 p-3">
                  {feature.lines.map((line, lineIndex) => (
                    <div key={line} className="flex items-center gap-2 py-1.5 text-[0.75rem] text-white/52">
                      <span
                        className={cx(
                          'h-1.5 rounded-full',
                          lineIndex === 0 ? 'w-7 bg-cyan-200/70' : lineIndex === 1 ? 'w-5 bg-violet-200/60' : 'w-4 bg-amber-200/55',
                        )}
                      />
                      {line}
                    </div>
                  ))}
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  return (
    <section id="pricing" className="relative z-10 overflow-hidden py-20 sm:py-24">
      <div className={pageContainerClass}>
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-[2.35rem] font-semibold leading-tight text-white sm:text-[3.55rem]">
            Start in private beta.
          </h2>
        </Reveal>
        <div className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-2">
          <PricingCard
            title="Free Beta"
            icon={Rocket}
            highlighted
            items={[
              'Create learning goals',
              'Upload limited sources',
              'Run mistake autopsies',
              'Review memory cards',
              'Generate daily missions',
            ]}
            cta="Join private beta"
            href="/waitlist"
          />
          <PricingCard
            title="Pro Coming Soon"
            icon={CircleDollarSign}
            items={[
              'Larger source memory',
              'Deeper autopsy reports',
              'Advanced planning',
              'More review intelligence',
              'Priority limits',
            ]}
            cta="Launch app"
            href="/dashboard"
          />
        </div>
      </div>
    </section>
  );
}

function PricingCard({
  title,
  icon: Icon,
  items,
  cta,
  href,
  highlighted,
}: {
  title: string;
  icon: LucideIcon;
  items: string[];
  cta: string;
  href: string;
  highlighted?: boolean;
}) {
  return (
    <Reveal>
      <article
        className={cx(
          'h-full rounded-lg border p-5 sm:p-6',
          highlighted
            ? 'border-violet-200/24 bg-violet-300/[0.07] shadow-[0_0_42px_rgba(124,58,237,0.12)]'
            : 'border-white/12 bg-white/[0.04]',
        )}
      >
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/12 bg-black/18">
              <Icon className="h-5 w-5 text-cyan-100" />
            </span>
            <h3 className="text-[1.25rem] font-semibold text-white">{title}</h3>
          </div>
          {highlighted ? (
            <span className="rounded-full border border-cyan-200/18 bg-cyan-300/[0.07] px-3 py-1 text-[0.72rem] text-cyan-100">
              Open
            </span>
          ) : null}
        </div>
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item} className="flex gap-3 text-[0.93rem] leading-6 text-white/66">
              <Check className="mt-1 h-4 w-4 shrink-0 text-cyan-100" />
              {item}
            </li>
          ))}
        </ul>
        <Link
          href={href}
          className={cx(
            'mt-7 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-[0.95rem] font-semibold no-underline transition',
            highlighted ? 'bg-white text-[#08080c] hover:bg-cyan-100' : 'border border-white/14 text-white hover:bg-white/[0.08]',
          )}
        >
          {cta}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </article>
    </Reveal>
  );
}

function FinalCTA() {
  return (
    <section className="relative z-10 overflow-hidden pb-16 pt-8 sm:pb-20">
      <Reveal>
        <div className={pageContainerClass}>
          <div className="mx-auto max-w-5xl overflow-hidden rounded-lg border border-white/14 bg-[linear-gradient(135deg,rgba(124,58,237,0.18),rgba(8,8,15,0.94)_48%,rgba(34,211,238,0.13))] p-7 text-center shadow-[0_24px_80px_rgba(0,0,0,0.42)] sm:p-12">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-cyan-200/18 bg-cyan-300/[0.08]">
              <ClipboardCheck className="h-6 w-6 text-cyan-100" />
            </div>
            <h2 className="mx-auto mt-6 max-w-3xl font-display text-[2.3rem] font-semibold leading-tight text-white sm:text-[4rem]">
              Build your comeback system.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-[1rem] leading-7 text-white/64 sm:text-[1.14rem]">
              Start with one goal. Cognition OS builds the loop around it.
            </p>
            <div className="mt-8 flex [flex-direction:column] justify-center gap-3 sm:[flex-direction:row]">
              <PrimaryButton href="/dashboard">Launch Cognition OS</PrimaryButton>
              <PrimaryButton href="/waitlist" variant="secondary">
                Join private beta
              </PrimaryButton>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="relative z-10 border-t border-white/10 py-10">
      <div className={cx(pageContainerClass, 'flex [flex-direction:column] gap-6 sm:[flex-direction:row] sm:items-center sm:justify-between')}>
        <Link href="/" className="flex items-center gap-3 text-white no-underline">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-violet-300/20 bg-violet-300/[0.08]">
            <BrainCircuit className="h-5 w-5 text-violet-100" />
          </span>
          <span className="font-display text-[1rem] font-semibold">Cognition OS</span>
        </Link>
        <div className="flex flex-wrap gap-x-6 gap-y-3 text-[0.9rem]">
          <Link href="#product" className="text-white/56 no-underline hover:text-white">
            Product
          </Link>
          <Link href="/privacy" className="text-white/56 no-underline hover:text-white">
            Privacy
          </Link>
          <Link href="/terms" className="text-white/56 no-underline hover:text-white">
            Terms
          </Link>
          <Link href="mailto:hello@cognitionos.ai" className="text-white/56 no-underline hover:text-white">
            Contact
          </Link>
        </div>
      </div>
    </footer>
  );
}
