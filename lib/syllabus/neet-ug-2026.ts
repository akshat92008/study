export const NEET_UG_2026_SYLLABUS = {
  version: 'NEET_UG_2026',
  source: 'NMC/UGMEB official NEET UG 2026 syllabus',
};

export const NEET_UG_2026_SUBJECTS = ['Physics', 'Chemistry', 'Biology'] as const;

export type NeetUgUnit = {
  subject: 'Physics' | 'Chemistry' | 'Biology';
  unitNumber: number;
  unitTitle: string;
  chapterSlug: string;
  aliases: string[];
  ncertMapping: string[];
  classLevel: '11' | '12' | 'mixed';
  keywords: string[];
};

export const NEET_UG_2026_UNITS: NeetUgUnit[] = [
  // PHYSICS (20 Units)
  { subject: 'Physics', unitNumber: 1, unitTitle: 'Physics and Measurement', chapterSlug: 'physics-and-measurement', aliases: ['units and measurements', 'physical world'], ncertMapping: ['Units and Measurements'], classLevel: '11', keywords: ['measurement', 'units', 'dimensions', 'errors', 'vernier', 'screw gauge'] },
  { subject: 'Physics', unitNumber: 2, unitTitle: 'Kinematics', chapterSlug: 'kinematics', aliases: ['motion in a straight line', 'motion in a plane', 'projectile motion'], ncertMapping: ['Motion in a Straight Line', 'Motion in a Plane'], classLevel: '11', keywords: ['kinematics', 'velocity', 'acceleration', 'projectile', 'circular motion', 'relative velocity'] },
  { subject: 'Physics', unitNumber: 3, unitTitle: 'Laws of Motion', chapterSlug: 'laws-of-motion', aliases: ['newton laws', 'nlms', 'friction'], ncertMapping: ['Laws of Motion'], classLevel: '11', keywords: ['laws of motion', 'newton', 'friction', 'momentum', 'impulse'] },
  { subject: 'Physics', unitNumber: 4, unitTitle: 'Work, Energy and Power', chapterSlug: 'work-energy-power', aliases: ['work energy theorem', 'wep'], ncertMapping: ['Work, Energy and Power'], classLevel: '11', keywords: ['work', 'energy', 'power', 'collisions', 'conservation of energy'] },
  { subject: 'Physics', unitNumber: 5, unitTitle: 'Rotational Motion', chapterSlug: 'rotational-motion', aliases: ['system of particles', 'rigid body dynamics'], ncertMapping: ['System of Particles and Rotational Motion'], classLevel: '11', keywords: ['rotational', 'torque', 'angular momentum', 'moment of inertia', 'rolling'] },
  { subject: 'Physics', unitNumber: 6, unitTitle: 'Gravitation', chapterSlug: 'gravitation', aliases: ['gravity', 'kepler laws'], ncertMapping: ['Gravitation'], classLevel: '11', keywords: ['gravitation', 'kepler', 'escape velocity', 'satellites', 'acceleration due to gravity'] },
  { subject: 'Physics', unitNumber: 7, unitTitle: 'Properties of Solids and Liquids', chapterSlug: 'properties-of-solids-and-liquids', aliases: ['mechanical properties of solids', 'mechanical properties of fluids', 'fluid mechanics', 'surface tension', 'viscosity'], ncertMapping: ['Mechanical Properties of Solids', 'Mechanical Properties of Fluids'], classLevel: '11', keywords: ['solids', 'fluids', 'elasticity', 'surface tension', 'viscosity', 'bernoulli', 'pascal'] },
  { subject: 'Physics', unitNumber: 8, unitTitle: 'Thermodynamics', chapterSlug: 'thermodynamics', aliases: ['thermal physics', 'heat transfer'], ncertMapping: ['Thermodynamics', 'Thermal Properties of Matter'], classLevel: '11', keywords: ['thermodynamics', 'heat', 'temperature', 'carnot', 'entropy'] },
  { subject: 'Physics', unitNumber: 9, unitTitle: 'Kinetic Theory of Gases', chapterSlug: 'kinetic-theory-of-gases', aliases: ['ktg'], ncertMapping: ['Kinetic Theory'], classLevel: '11', keywords: ['kinetic theory', 'gases', 'rms', 'mean free path', 'degrees of freedom'] },
  { subject: 'Physics', unitNumber: 10, unitTitle: 'Oscillations and Waves', chapterSlug: 'oscillations-and-waves', aliases: ['shm', 'simple harmonic motion', 'sound waves', 'doppler effect'], ncertMapping: ['Oscillations', 'Waves'], classLevel: '11', keywords: ['oscillations', 'waves', 'shm', 'resonance', 'doppler', 'beats'] },
  { subject: 'Physics', unitNumber: 11, unitTitle: 'Electrostatics', chapterSlug: 'electrostatics', aliases: ['electric charges and fields', 'electrostatic potential and capacitance', 'capacitors'], ncertMapping: ['Electric Charges and Fields', 'Electrostatic Potential and Capacitance'], classLevel: '12', keywords: ['electrostatics', 'charge', 'coulomb', 'electric field', 'gauss', 'potential', 'capacitance'] },
  { subject: 'Physics', unitNumber: 12, unitTitle: 'Current Electricity', chapterSlug: 'current-electricity', aliases: ['circuits', 'ohm law', 'kirchhoff'], ncertMapping: ['Current Electricity'], classLevel: '12', keywords: ['current', 'electricity', 'ohm', 'resistance', 'kirchhoff', 'potentiometer', 'bridge'] },
  { subject: 'Physics', unitNumber: 13, unitTitle: 'Magnetic Effects of Current and Magnetism', chapterSlug: 'magnetic-effects-and-magnetism', aliases: ['moving charges and magnetism', 'magnetism and matter'], ncertMapping: ['Moving Charges and Magnetism', 'Magnetism and Matter'], classLevel: '12', keywords: ['magnetic effect', 'magnetism', 'biot-savart', 'ampere', 'lorentz', 'earth magnetism', 'dia', 'para', 'ferro'] },
  { subject: 'Physics', unitNumber: 14, unitTitle: 'Electromagnetic Induction and Alternating Currents', chapterSlug: 'emi-and-ac', aliases: ['emi', 'alternating current', 'ac', 'transformers'], ncertMapping: ['Electromagnetic Induction', 'Alternating Current'], classLevel: '12', keywords: ['induction', 'faraday', 'lenz', 'alternating current', 'lcr', 'transformer', 'resonance'] },
  { subject: 'Physics', unitNumber: 15, unitTitle: 'Electromagnetic Waves', chapterSlug: 'electromagnetic-waves', aliases: ['em waves'], ncertMapping: ['Electromagnetic Waves'], classLevel: '12', keywords: ['electromagnetic waves', 'em spectrum', 'maxwell', 'displacement current'] },
  { subject: 'Physics', unitNumber: 16, unitTitle: 'Optics', chapterSlug: 'optics', aliases: ['ray optics', 'wave optics', 'optical instruments', 'ydse'], ncertMapping: ['Ray Optics and Optical Instruments', 'Wave Optics'], classLevel: '12', keywords: ['optics', 'reflection', 'refraction', 'lenses', 'mirrors', 'interference', 'diffraction', 'polarization'] },
  { subject: 'Physics', unitNumber: 17, unitTitle: 'Dual Nature of Matter and Radiation', chapterSlug: 'dual-nature', aliases: ['photoelectric effect', 'de broglie'], ncertMapping: ['Dual Nature of Radiation and Matter'], classLevel: '12', keywords: ['dual nature', 'photoelectric', 'einstein', 'de broglie', 'matter waves'] },
  { subject: 'Physics', unitNumber: 18, unitTitle: 'Atoms and Nuclei', chapterSlug: 'atoms-and-nuclei', aliases: ['modern physics', 'radioactivity', 'bohr model'], ncertMapping: ['Atoms', 'Nuclei'], classLevel: '12', keywords: ['atoms', 'nuclei', 'bohr', 'hydrogen spectrum', 'radioactivity', 'fission', 'fusion'] },
  { subject: 'Physics', unitNumber: 19, unitTitle: 'Electronic Devices', chapterSlug: 'electronic-devices', aliases: ['semiconductors', 'logic gates', 'diodes'], ncertMapping: ['Semiconductor Electronics: Materials, Devices and Simple Circuits'], classLevel: '12', keywords: ['electronic devices', 'semiconductor', 'diode', 'transistor', 'logic gates'] },
  { subject: 'Physics', unitNumber: 20, unitTitle: 'Experimental Skills', chapterSlug: 'experimental-skills', aliases: ['practical physics', 'experiments'], ncertMapping: [], classLevel: 'mixed', keywords: ['experimental skills', 'vernier', 'screw gauge', 'metre bridge', 'pendulum', 'prism'] },

  // CHEMISTRY (20 Units)
  { subject: 'Chemistry', unitNumber: 1, unitTitle: 'Some Basic Concepts in Chemistry', chapterSlug: 'some-basic-concepts', aliases: ['mole concept', 'stoichiometry'], ncertMapping: ['Some Basic Concepts of Chemistry'], classLevel: '11', keywords: ['basic concepts', 'mole', 'stoichiometry', 'molarity', 'empirical formula'] },
  { subject: 'Chemistry', unitNumber: 2, unitTitle: 'Atomic Structure', chapterSlug: 'atomic-structure', aliases: ['structure of atom'], ncertMapping: ['Structure of Atom'], classLevel: '11', keywords: ['atomic structure', 'bohr', 'quantum numbers', 'orbitals', 'aufbau', 'pauli', 'hund'] },
  { subject: 'Chemistry', unitNumber: 3, unitTitle: 'Chemical Bonding and Molecular Structure', chapterSlug: 'chemical-bonding', aliases: ['chemical bonding', 'vsepr', 'mot'], ncertMapping: ['Chemical Bonding and Molecular Structure'], classLevel: '11', keywords: ['chemical bonding', 'vsepr', 'hybridisation', 'mot', 'dipole moment', 'hydrogen bonding'] },
  { subject: 'Chemistry', unitNumber: 4, unitTitle: 'Chemical Thermodynamics', chapterSlug: 'chemical-thermodynamics', aliases: ['thermodynamics'], ncertMapping: ['Thermodynamics'], classLevel: '11', keywords: ['thermodynamics', 'enthalpy', 'entropy', 'gibbs free energy', 'hess law', 'first law'] },
  { subject: 'Chemistry', unitNumber: 5, unitTitle: 'Solutions', chapterSlug: 'solutions', aliases: ['solution chemistry', 'colligative properties'], ncertMapping: ['Solutions'], classLevel: '12', keywords: ['solutions', 'raoult', 'colligative properties', 'osmotic pressure', 'van t hoff'] },
  { subject: 'Chemistry', unitNumber: 6, unitTitle: 'Equilibrium', chapterSlug: 'equilibrium', aliases: ['chemical equilibrium', 'ionic equilibrium'], ncertMapping: ['Equilibrium'], classLevel: '11', keywords: ['equilibrium', 'le chatelier', 'kp kc', 'ph', 'buffer', 'solubility product', 'ionic'] },
  { subject: 'Chemistry', unitNumber: 7, unitTitle: 'Redox Reactions and Electrochemistry', chapterSlug: 'redox-and-electrochemistry', aliases: ['redox', 'electrochemistry', 'galvanic cells'], ncertMapping: ['Redox Reactions', 'Electrochemistry'], classLevel: 'mixed', keywords: ['redox', 'oxidation state', 'electrochemistry', 'nernst', 'faraday', 'kohlrausch', 'cells'] },
  { subject: 'Chemistry', unitNumber: 8, unitTitle: 'Chemical Kinetics', chapterSlug: 'chemical-kinetics', aliases: ['kinetics', 'rate of reaction'], ncertMapping: ['Chemical Kinetics'], classLevel: '12', keywords: ['kinetics', 'rate law', 'order', 'molecularity', 'half life', 'arrhenius', 'activation energy'] },
  { subject: 'Chemistry', unitNumber: 9, unitTitle: 'Classification of Elements and Periodicity in Properties', chapterSlug: 'periodicity', aliases: ['periodic table', 'periodic properties'], ncertMapping: ['Classification of Elements and Periodicity in Properties'], classLevel: '11', keywords: ['periodicity', 'classification', 'ionization enthalpy', 'electron gain enthalpy', 'electronegativity', 'radius'] },
  { subject: 'Chemistry', unitNumber: 10, unitTitle: 'p-Block Elements', chapterSlug: 'p-block-elements', aliases: ['p block'], ncertMapping: ['The p-Block Elements'], classLevel: 'mixed', keywords: ['p-block', 'boron', 'carbon', 'nitrogen', 'oxygen', 'halogens', 'noble gases'] },
  { subject: 'Chemistry', unitNumber: 11, unitTitle: 'd- and f-Block Elements', chapterSlug: 'd-and-f-block-elements', aliases: ['d block', 'f block', 'transition elements'], ncertMapping: ['The d- and f-Block Elements'], classLevel: '12', keywords: ['d-block', 'f-block', 'transition elements', 'lanthanoids', 'actinoids', 'kmno4', 'k2cr2o7'] },
  { subject: 'Chemistry', unitNumber: 12, unitTitle: 'Coordination Compounds', chapterSlug: 'coordination-compounds', aliases: ['coordination chemistry', 'complexes'], ncertMapping: ['Coordination Compounds'], classLevel: '12', keywords: ['coordination', 'ligands', 'isomerism', 'vbt', 'cft', 'werner'] },
  { subject: 'Chemistry', unitNumber: 13, unitTitle: 'Purification and Characterisation of Organic Compounds', chapterSlug: 'purification-characterisation-organic', aliases: ['purification', 'characterisation', 'qualitative analysis organic'], ncertMapping: ['Organic Chemistry - Some Basic Principles and Techniques'], classLevel: '11', keywords: ['purification', 'characterisation', 'chromatography', 'distillation', 'lassaigne', 'kjeldahl', 'dumas'] },
  { subject: 'Chemistry', unitNumber: 14, unitTitle: 'Some Basic Principles of Organic Chemistry', chapterSlug: 'goc', aliases: ['goc', 'general organic chemistry', 'isomerism', 'reaction mechanism'], ncertMapping: ['Organic Chemistry - Some Basic Principles and Techniques'], classLevel: '11', keywords: ['basic principles', 'goc', 'inductive', 'resonance', 'hyperconjugation', 'isomerism', 'carbocation', 'carbanion', 'free radical', 'electrophile', 'nucleophile'] },
  { subject: 'Chemistry', unitNumber: 15, unitTitle: 'Hydrocarbons', chapterSlug: 'hydrocarbons', aliases: ['alkanes', 'alkenes', 'alkynes', 'aromatic hydrocarbons'], ncertMapping: ['Hydrocarbons'], classLevel: '11', keywords: ['hydrocarbons', 'alkanes', 'alkenes', 'alkynes', 'benzene', 'markovnikov', 'friedel-crafts', 'ozonolysis'] },
  { subject: 'Chemistry', unitNumber: 16, unitTitle: 'Organic Compounds Containing Halogens', chapterSlug: 'haloalkanes-haloarenes', aliases: ['haloalkanes', 'haloarenes', 'alkyl halides'], ncertMapping: ['Haloalkanes and Haloarenes'], classLevel: '12', keywords: ['halogens', 'haloalkanes', 'haloarenes', 'sn1', 'sn2', 'grignard', 'elimination'] },
  { subject: 'Chemistry', unitNumber: 17, unitTitle: 'Organic Compounds Containing Oxygen', chapterSlug: 'oxygen-containing-compounds', aliases: ['alcohols phenols ethers', 'aldehydes ketones carboxylic acids'], ncertMapping: ['Alcohols, Phenols and Ethers', 'Aldehydes, Ketones and Carboxylic Acids'], classLevel: '12', keywords: ['oxygen compounds', 'alcohols', 'phenols', 'ethers', 'aldehydes', 'ketones', 'carboxylic acids', 'aldol', 'cannizzaro'] },
  { subject: 'Chemistry', unitNumber: 18, unitTitle: 'Organic Compounds Containing Nitrogen', chapterSlug: 'nitrogen-containing-compounds', aliases: ['amines', 'diazonium salts'], ncertMapping: ['Amines'], classLevel: '12', keywords: ['nitrogen compounds', 'amines', 'diazonium', 'carbylamine', 'hoffmann', 'gabriel'] },
  { subject: 'Chemistry', unitNumber: 19, unitTitle: 'Biomolecules', chapterSlug: 'biomolecules', aliases: ['carbohydrates', 'proteins', 'nucleic acids'], ncertMapping: ['Biomolecules'], classLevel: '12', keywords: ['biomolecules', 'carbohydrates', 'proteins', 'amino acids', 'dna', 'rna', 'vitamins'] },
  { subject: 'Chemistry', unitNumber: 20, unitTitle: 'Principles Related to Practical Chemistry', chapterSlug: 'practical-chemistry', aliases: ['practical chemistry', 'salt analysis', 'titrations'], ncertMapping: [], classLevel: 'mixed', keywords: ['practical chemistry', 'salt analysis', 'titration', 'functional group tests', 'cations', 'anions'] },

  // BIOLOGY (10 Units)
  { subject: 'Biology', unitNumber: 1, unitTitle: 'Diversity in Living World', chapterSlug: 'diversity-in-living-world', aliases: ['the living world', 'biological classification', 'plant kingdom', 'animal kingdom'], ncertMapping: ['The Living World', 'Biological Classification', 'Plant Kingdom', 'Animal Kingdom'], classLevel: '11', keywords: ['diversity', 'taxonomy', 'classification', 'monera', 'protista', 'fungi', 'plantae', 'animalia'] },
  { subject: 'Biology', unitNumber: 2, unitTitle: 'Structural Organisation in Animals and Plants', chapterSlug: 'structural-organisation', aliases: ['morphology of flowering plants', 'anatomy of flowering plants', 'structural organisation in animals', 'frog', 'plant tissue', 'root stem leaf', 'stem modification', 'root morphology', 'leaf modification', 'morphology'], ncertMapping: ['Morphology of Flowering Plants', 'Anatomy of Flowering Plants', 'Structural Organisation in Animals'], classLevel: '11', keywords: ['structural organisation', 'morphology', 'anatomy', 'tissues', 'root', 'stem', 'leaf', 'flower', 'frog'] },
  { subject: 'Biology', unitNumber: 3, unitTitle: 'Cell Structure and Function', chapterSlug: 'cell-structure-and-function', aliases: ['cell the unit of life', 'cell cycle and cell division', 'biomolecules (biology)'], ncertMapping: ['Cell: The Unit of Life', 'Biomolecules', 'Cell Cycle and Cell Division'], classLevel: '11', keywords: ['cell structure', 'organelles', 'biomolecules', 'enzymes', 'mitosis', 'meiosis', 'cell cycle'] },
  { subject: 'Biology', unitNumber: 4, unitTitle: 'Plant Physiology', chapterSlug: 'plant-physiology', aliases: ['photosynthesis in higher plants', 'respiration in plants', 'plant growth and development'], ncertMapping: ['Photosynthesis in Higher Plants', 'Respiration in Plants', 'Plant Growth and Development'], classLevel: '11', keywords: ['plant physiology', 'photosynthesis', 'respiration', 'plant growth', 'hormones', 'auxin'] },
  { subject: 'Biology', unitNumber: 5, unitTitle: 'Human Physiology: Digestion and Absorption', chapterSlug: 'human-physiology-digestion', aliases: ['digestive system', 'digestion'], ncertMapping: ['Digestion and Absorption'], classLevel: '11', keywords: ['human physiology', 'digestion', 'stomach', 'intestine'] },
  { subject: 'Biology', unitNumber: 5, unitTitle: 'Human Physiology: Breathing and Exchange of Gases', chapterSlug: 'human-physiology-breathing', aliases: ['respiratory system', 'breathing', 'lungs'], ncertMapping: ['Breathing and Exchange of Gases'], classLevel: '11', keywords: ['human physiology', 'breathing', 'respiration', 'lungs'] },
  { subject: 'Biology', unitNumber: 5, unitTitle: 'Human Physiology: Body Fluids and Circulation', chapterSlug: 'human-physiology-circulation', aliases: ['circulatory system', 'blood vascular system', 'human heart', 'blood circulation'], ncertMapping: ['Body Fluids and Circulation'], classLevel: '11', keywords: ['human physiology', 'circulation', 'heart', 'blood'] },
  { subject: 'Biology', unitNumber: 5, unitTitle: 'Human Physiology: Excretory Products and Their Elimination', chapterSlug: 'human-physiology-excretion', aliases: ['excretory system', 'kidney', 'urine'], ncertMapping: ['Excretory Products and Their Elimination'], classLevel: '11', keywords: ['human physiology', 'excretion', 'kidney', 'urine', 'nephron'] },
  { subject: 'Biology', unitNumber: 5, unitTitle: 'Human Physiology: Locomotion and Movement', chapterSlug: 'human-physiology-locomotion', aliases: ['locomotion', 'muscular system', 'skeletal system', 'bones'], ncertMapping: ['Locomotion and Movement'], classLevel: '11', keywords: ['human physiology', 'locomotion', 'muscle', 'skeleton', 'bones', 'joints'] },
  { subject: 'Biology', unitNumber: 5, unitTitle: 'Human Physiology: Neural Control and Coordination', chapterSlug: 'human-physiology-neural', aliases: ['nervous system', 'brain', 'neural control'], ncertMapping: ['Neural Control and Coordination'], classLevel: '11', keywords: ['human physiology', 'neural control', 'brain', 'nerve', 'neuron'] },
  { subject: 'Biology', unitNumber: 5, unitTitle: 'Human Physiology: Chemical Coordination and Integration', chapterSlug: 'human-physiology-chemical', aliases: ['endocrine system', 'hormones', 'glands'], ncertMapping: ['Chemical Coordination and Integration'], classLevel: '11', keywords: ['human physiology', 'endocrine', 'hormones', 'glands', 'pituitary'] },
  { subject: 'Biology', unitNumber: 6, unitTitle: 'Reproduction', chapterSlug: 'reproduction', aliases: ['sexual reproduction in flowering plants', 'human reproduction', 'reproductive health'], ncertMapping: ['Sexual Reproduction in Flowering Plants', 'Human Reproduction', 'Reproductive Health'], classLevel: '12', keywords: ['reproduction', 'flower', 'pollination', 'human reproduction', 'menstrual cycle', 'reproductive health', 'birth control'] },
  { subject: 'Biology', unitNumber: 7, unitTitle: 'Genetics and Evolution', chapterSlug: 'genetics-and-evolution', aliases: ['principles of inheritance and variation', 'molecular basis of inheritance', 'evolution'], ncertMapping: ['Principles of Inheritance and Variation', 'Molecular Basis of Inheritance', 'Evolution'], classLevel: '12', keywords: ['genetics', 'inheritance', 'mendel', 'molecular basis', 'dna', 'rna', 'transcription', 'translation', 'evolution', 'darwin', 'hardy-weinberg'] },
  { subject: 'Biology', unitNumber: 8, unitTitle: 'Biology and Human Welfare', chapterSlug: 'biology-and-human-welfare', aliases: ['human health and disease', 'microbes in human welfare'], ncertMapping: ['Human Health and Disease', 'Microbes in Human Welfare'], classLevel: '12', keywords: ['human welfare', 'health', 'disease', 'immunity', 'hiv', 'cancer', 'drugs', 'microbes', 'sewage'] },
  { subject: 'Biology', unitNumber: 9, unitTitle: 'Biotechnology and Its Applications', chapterSlug: 'biotechnology', aliases: ['biotechnology', 'biotechnology principles and processes', 'biotechnology and its applications', 'biotech', 'pcr', 'rdna', 'recombinant dna'], ncertMapping: ['Biotechnology: Principles and Processes', 'Biotechnology and its Applications'], classLevel: '12', keywords: ['biotechnology', 'recombinant dna', 'rdna', 'restriction enzyme', 'pcr', 'cloning vector', 'bt cotton', 'rnai', 'gene therapy'] },
  { subject: 'Biology', unitNumber: 10, unitTitle: 'Ecology and Environment', chapterSlug: 'ecology-and-environment', aliases: ['organisms and populations', 'ecosystem', 'biodiversity and conservation', 'environmental issues', 'ecology'], ncertMapping: ['Organisms and Populations', 'Ecosystem', 'Biodiversity and Conservation', 'Environmental Issues'], classLevel: '12', keywords: ['ecology', 'environment', 'population', 'ecosystem', 'biodiversity', 'conservation', 'pollution', 'succession'] }
];

export const NEET_UG_2026_CHAPTER_SLUGS = NEET_UG_2026_UNITS.map(u => u.chapterSlug);

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type GoalMode = 'mastery' | 'revision' | 'practice' | 'unknown';

export type NormalizedGoal = {
  rawTitle: string;
  normalizedTitle: string;
  exam: string | null;
  subject: string | null;
  classLevel: string | null;
  chapter: string | null;
  chapterSlug: string | null;
  mode: GoalMode;
  confidence: number;
};

export function inferMode(text: string): GoalMode {
  if (/\b(revise|revision|review|recap)\b/.test(text)) return 'revision';
  if (/\b(practice|pyq|questions?|quiz|ask me|test me)\b/.test(text)) return 'practice';
  if (/\b(master|mastery|complete|learn|understand|ncert|principles|applications|full chapter)\b/.test(text)) return 'mastery';
  return 'unknown';
}

function matchesWordOrPhrase(text: string, target: string): boolean {
  if (!target) return false;
  const regex = new RegExp(`(^|\\s)${target}(\\s|$)`, 'i');
  return regex.test(text);
}

export function findNeetUnitByGoalText(goalText: string, activeSubjectContext?: string | null): NeetUgUnit | null {
  const normalizedGoal = normalizeText(goalText);
  let bestMatch: NeetUgUnit | null = null;
  let bestScore = 0;

  for (const unit of NEET_UG_2026_UNITS) {
    let score = 0;
    
    // Exact title match
    if (matchesWordOrPhrase(normalizedGoal, normalizeText(unit.unitTitle))) score += 100;
    
    // Alias match
    for (const alias of unit.aliases) {
      if (matchesWordOrPhrase(normalizedGoal, normalizeText(alias))) score += 80;
    }
    
    // Keyword match
    let keywordHits = 0;
    for (const keyword of unit.keywords) {
      if (matchesWordOrPhrase(normalizedGoal, normalizeText(keyword))) keywordHits++;
    }
    score += keywordHits * 10;
    
    if (activeSubjectContext && normalizeText(activeSubjectContext) === normalizeText(unit.subject)) {
      score += 20;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = unit;
    }
  }

  // Disambiguation
  if (normalizedGoal.includes('respiration')) {
    if (normalizedGoal.includes('plant') || activeSubjectContext === 'Biology' && bestMatch?.unitTitle === 'Plant Physiology') {
        return NEET_UG_2026_UNITS.find(u => u.unitTitle === 'Plant Physiology') || null;
    }
    if (normalizedGoal.includes('human') || normalizedGoal.includes('breathing')) {
        return NEET_UG_2026_UNITS.find(u => u.unitTitle === 'Human Physiology') || null;
    }
  }

  return bestScore >= 20 ? bestMatch : null;
}

export function normalizeNeetGoal(rawTitle: string, activeSubjectContext?: string | null): NormalizedGoal {
  const raw = rawTitle.trim();
  const text = normalizeText(raw);
  const mode = inferMode(text);

  const matchedUnit = findNeetUnitByGoalText(text, activeSubjectContext);

  if (matchedUnit) {
    const resolvedMode = mode === 'unknown' ? 'mastery' : mode;
    const titlePrefix = resolvedMode === 'revision'
      ? 'Revise'
      : resolvedMode === 'practice'
        ? 'Practice'
        : 'Master';

    return {
      rawTitle: raw,
      normalizedTitle: `${titlePrefix} ${matchedUnit.unitTitle}`,
      exam: 'NEET',
      subject: matchedUnit.subject,
      classLevel: matchedUnit.classLevel === 'mixed' ? null : matchedUnit.classLevel,
      chapter: matchedUnit.unitTitle,
      chapterSlug: `neet-${matchedUnit.subject.toLowerCase()}-${matchedUnit.chapterSlug}`,
      mode: resolvedMode,
      confidence: 0.99,
    };
  }

  return {
    rawTitle: raw,
    normalizedTitle: raw,
    exam: null,
    subject: null,
    classLevel: null,
    chapter: null,
    chapterSlug: null,
    mode,
    confidence: mode === 'unknown' ? 0.2 : 0.35,
  };
}
