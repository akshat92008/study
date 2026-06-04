const RULES: Array<{ topic: string; patterns: RegExp[] }> = [
  {
    topic: 'Motion graphs',
    patterns: [
      /\bv\s*[- ]?\s*t\b/i,
      /\bvelocity\s*time\b/i,
      /\bx\s*[- ]?\s*t\b/i,
      /\bdisplacement\s*time\b/i,
      /\bposition\s*time\b/i,
      /\bgraph\b/i,
      /\bslope\b/i,
      /\barea under\b/i,
    ],
  },
  {
    topic: 'Projectile motion',
    patterns: [
      /\bprojectile\b/i,
      /\brange\b/i,
      /\btime of flight\b/i,
      /\bmaximum height\b/i,
      /\btrajectory\b/i,
      /\bhorizontal component\b/i,
      /\bvertical component\b/i,
    ],
  },
  {
    topic: 'Free fall',
    patterns: [
      /\bfree fall\b/i,
      /\bfalling body\b/i,
      /\bdropped from\b/i,
      /\bacceleration due to gravity\b/i,
      /\bgravity\b/i,
    ],
  },
  {
    topic: 'Motion under gravity',
    patterns: [
      /\bthrown upward\b/i,
      /\bthrown down/i,
      /\bvertical motion\b/i,
      /\bupward motion\b/i,
      /\bdownward motion\b/i,
    ],
  },
  {
    topic: 'Equations of motion',
    patterns: [
      /\bequation of motion\b/i,
      /\bequations of motion\b/i,
      /\bsuvat\b/i,
      /\bv\s*=\s*u\s*\+\s*a\s*t/i,
      /\bconstant acceleration\b/i,
    ],
  },
  {
    topic: 'Sign convention mistakes',
    patterns: [
      /\bsign convention\b/i,
      /\bsign error\b/i,
      /\bnegative sign\b/i,
      /\bdirection error\b/i,
      /\bwrong sign\b/i,
    ],
  },
  {
    topic: 'Coulomb’s law',
    patterns: [
      /\bcoulomb\b/i,
      /\bpoint charge\b/i,
      /\bforce between charges\b/i,
    ],
  },
  {
    topic: 'Electric field',
    patterns: [
      /\belectric field\b/i,
      /\bfield due to charge\b/i,
      /\be field\b/i,
    ],
  },
  {
    topic: 'Electric potential',
    patterns: [
      /\belectric potential\b/i,
      /\bpotential difference\b/i,
      /\bvoltage\b/i,
    ],
  },
  {
    topic: 'VSEPR theory',
    patterns: [
      /\bvsepr\b/i,
      /\bshape\b/i,
      /\bmolecular geometry\b/i,
    ],
  },
  {
    topic: 'Hybridisation',
    patterns: [
      /\bhybridisation\b/i,
      /\bhybridization\b/i,
      /\bsp3\b/i,
      /\bsp2\b/i,
      /\bsp\b/i,
    ],
  },
  {
    topic: 'Menstrual cycle',
    patterns: [
      /\bmenstrual\b/i,
      /\bfollicular\b/i,
      /\bluteal\b/i,
      /\bovulation\b/i,
    ],
  },
  {
    topic: 'Spermatogenesis',
    patterns: [
      /\bspermatogenesis\b/i,
      /\bsperm formation\b/i,
    ],
  },
  {
    topic: 'Oogenesis',
    patterns: [
      /\boogenesis\b/i,
      /\bovum formation\b/i,
    ],
  },
  {
    topic: 'Double fertilisation',
    patterns: [
      /\bdouble fertilisation\b/i,
      /\bdouble fertilization\b/i,
      /\btriple fusion\b/i,
      /\bsyngamy\b/i,
    ],
  },
  {
    topic: 'JavaScript Basics',
    patterns: [
      /\bjavascript\b/i,
      /\bjs\b/i,
    ],
  },
  {
    topic: 'Python Basics',
    patterns: [
      /\bpython\b/i,
    ],
  },
];
export function mapTextToSeededTopic(raw: unknown): string | null {
  const text = String(raw ?? '');
  if (!text.trim()) return null;
  for (const rule of RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return rule.topic;
    }
  }
  return null;
}
