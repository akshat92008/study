/**
 * NEET Topic Skeleton — Deterministic, NCERT-aligned topic list for all 50 chapters.
 *
 * This file is the SINGLE SOURCE OF TRUTH for which topics belong to which chapter.
 * It prevents cross-chapter contamination and ensures correct topic display regardless
 * of the quality of microtarget data in the JSON seed files.
 *
 * Rules:
 * 1. Every topic slug must be unique within its chapter.
 * 2. Every topic slug must contain only lowercase letters, numbers, and hyphens.
 * 3. Topics must be ordered in NCERT teaching sequence.
 * 4. Aliases must include common student search terms.
 * 5. No topic may appear under a chapter it doesn't belong to.
 */

export interface TopicSkeletonEntry {
  slug: string;
  displayName: string;
  aliases: string[];
  orderIndex: number;
  /** Optional parent topic slug for subtopics */
  parentTopicSlug?: string;
}

export interface ChapterSkeleton {
  chapterSlug: string;
  chapterTitle: string;
  subject: 'Physics' | 'Chemistry' | 'Biology';
  /** For Biology, maps to specific NCERT chapter within the unit */
  ncertChapter?: string;
  topics: TopicSkeletonEntry[];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PHYSICS (20 chapters)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const PHYSICS_SKELETONS: ChapterSkeleton[] = [
  {
    chapterSlug: 'physics-and-measurement',
    chapterTitle: 'Physics and Measurement',
    subject: 'Physics',
    topics: [
      { slug: 'physical-quantities-and-units', displayName: 'Physical Quantities and Units', aliases: ['si units', 'fundamental units', 'derived units'], orderIndex: 1 },
      { slug: 'dimensional-analysis', displayName: 'Dimensional Analysis', aliases: ['dimensions', 'dimensional formula', 'dimensional equation'], orderIndex: 2 },
      { slug: 'significant-figures', displayName: 'Significant Figures', aliases: ['significant digits', 'rounding off'], orderIndex: 3 },
      { slug: 'errors-in-measurement', displayName: 'Errors in Measurement', aliases: ['absolute error', 'relative error', 'percentage error', 'propagation of errors'], orderIndex: 4 },
      { slug: 'vernier-callipers', displayName: 'Vernier Callipers', aliases: ['vernier', 'least count'], orderIndex: 5 },
      { slug: 'screw-gauge', displayName: 'Screw Gauge', aliases: ['micrometer', 'screw gauge least count'], orderIndex: 6 },
    ],
  },
  {
    chapterSlug: 'kinematics',
    chapterTitle: 'Kinematics',
    subject: 'Physics',
    topics: [
      { slug: 'distance-and-displacement', displayName: 'Distance and Displacement', aliases: ['scalar and vector', 'path length'], orderIndex: 1 },
      { slug: 'speed-and-velocity', displayName: 'Speed and Velocity', aliases: ['average speed', 'instantaneous velocity'], orderIndex: 2 },
      { slug: 'acceleration', displayName: 'Acceleration', aliases: ['uniform acceleration', 'non-uniform acceleration', 'retardation'], orderIndex: 3 },
      { slug: 'equations-of-motion', displayName: 'Equations of Motion', aliases: ['kinematic equations', 'suvat', 'v=u+at'], orderIndex: 4 },
      { slug: 'motion-graphs', displayName: 'Motion Graphs', aliases: ['x-t graph', 'v-t graph', 'position-time', 'velocity-time', 'area under curve'], orderIndex: 5 },
      { slug: 'relative-velocity', displayName: 'Relative Velocity', aliases: ['relative motion', 'river boat problem', 'rain man problem'], orderIndex: 6 },
      { slug: 'projectile-motion', displayName: 'Projectile Motion', aliases: ['trajectory', 'range', 'time of flight', 'maximum height', 'horizontal projectile'], orderIndex: 7 },
      { slug: 'circular-motion', displayName: 'Circular Motion', aliases: ['uniform circular motion', 'centripetal acceleration', 'angular velocity'], orderIndex: 8 },
    ],
  },
  {
    chapterSlug: 'laws-of-motion',
    chapterTitle: 'Laws of Motion',
    subject: 'Physics',
    topics: [
      { slug: 'newtons-first-law', displayName: "Newton's First Law", aliases: ['law of inertia', 'inertia'], orderIndex: 1 },
      { slug: 'newtons-second-law', displayName: "Newton's Second Law", aliases: ['f=ma', 'force and acceleration'], orderIndex: 2 },
      { slug: 'newtons-third-law', displayName: "Newton's Third Law", aliases: ['action reaction', 'action and reaction'], orderIndex: 3 },
      { slug: 'free-body-diagram', displayName: 'Free Body Diagram', aliases: ['fbd', 'force diagram'], orderIndex: 4 },
      { slug: 'friction', displayName: 'Friction', aliases: ['static friction', 'kinetic friction', 'coefficient of friction', 'rolling friction'], orderIndex: 5 },
      { slug: 'momentum', displayName: 'Momentum', aliases: ['linear momentum', 'conservation of momentum', 'impulse'], orderIndex: 6 },
      { slug: 'connected-bodies', displayName: 'Connected Bodies', aliases: ['pulley problems', 'tension', 'normal reaction', 'constraint relations'], orderIndex: 7 },
      { slug: 'circular-motion-dynamics', displayName: 'Circular Motion Dynamics', aliases: ['centripetal force', 'banking of roads', 'conical pendulum'], orderIndex: 8 },
    ],
  },
  {
    chapterSlug: 'work-energy-power',
    chapterTitle: 'Work, Energy and Power',
    subject: 'Physics',
    topics: [
      { slug: 'work-done', displayName: 'Work Done by a Force', aliases: ['work done', 'work by variable force', 'positive and negative work'], orderIndex: 1 },
      { slug: 'kinetic-energy', displayName: 'Kinetic Energy', aliases: ['ke', 'work energy theorem'], orderIndex: 2 },
      { slug: 'potential-energy', displayName: 'Potential Energy', aliases: ['pe', 'gravitational pe', 'elastic pe', 'spring pe'], orderIndex: 3 },
      { slug: 'conservation-of-energy', displayName: 'Conservation of Energy', aliases: ['mechanical energy conservation', 'conservative forces'], orderIndex: 4 },
      { slug: 'power', displayName: 'Power', aliases: ['average power', 'instantaneous power', 'watt'], orderIndex: 5 },
      { slug: 'collisions', displayName: 'Collisions', aliases: ['elastic collision', 'inelastic collision', 'perfectly inelastic', 'coefficient of restitution'], orderIndex: 6 },
    ],
  },
  {
    chapterSlug: 'rotational-motion',
    chapterTitle: 'Rotational Motion',
    subject: 'Physics',
    topics: [
      { slug: 'centre-of-mass', displayName: 'Centre of Mass', aliases: ['center of mass', 'com', 'centre of gravity'], orderIndex: 1 },
      { slug: 'moment-of-inertia', displayName: 'Moment of Inertia', aliases: ['moi', 'parallel axis theorem', 'perpendicular axis theorem'], orderIndex: 2 },
      { slug: 'torque', displayName: 'Torque', aliases: ['moment of force', 'couple'], orderIndex: 3 },
      { slug: 'angular-momentum', displayName: 'Angular Momentum', aliases: ['conservation of angular momentum', 'angular impulse'], orderIndex: 4 },
      { slug: 'rotational-kinematics', displayName: 'Rotational Kinematics', aliases: ['angular velocity', 'angular acceleration', 'rotational equations'], orderIndex: 5 },
      { slug: 'rolling-motion', displayName: 'Rolling Motion', aliases: ['rolling without slipping', 'rolling on incline'], orderIndex: 6 },
    ],
  },
  {
    chapterSlug: 'gravitation',
    chapterTitle: 'Gravitation',
    subject: 'Physics',
    topics: [
      { slug: 'newtons-law-of-gravitation', displayName: "Newton's Law of Gravitation", aliases: ['universal gravitation', 'gravitational constant'], orderIndex: 1 },
      { slug: 'acceleration-due-to-gravity', displayName: 'Acceleration due to Gravity', aliases: ['variation of g', 'g with height', 'g with depth'], orderIndex: 2 },
      { slug: 'gravitational-potential-energy', displayName: 'Gravitational Potential Energy', aliases: ['gravitational potential', 'binding energy'], orderIndex: 3 },
      { slug: 'escape-velocity', displayName: 'Escape Velocity', aliases: ['escape speed'], orderIndex: 4 },
      { slug: 'orbital-velocity', displayName: 'Orbital Velocity', aliases: ['satellite velocity', 'time period of satellite'], orderIndex: 5 },
      { slug: 'keplers-laws', displayName: "Kepler's Laws", aliases: ['kepler first law', 'kepler second law', 'kepler third law', 'law of orbits', 'law of areas', 'law of periods'], orderIndex: 6 },
      { slug: 'geostationary-satellite', displayName: 'Geostationary Satellite', aliases: ['geo satellite', 'polar satellite', 'weightlessness'], orderIndex: 7 },
    ],
  },
  {
    chapterSlug: 'properties-of-solids-and-liquids',
    chapterTitle: 'Properties of Solids and Liquids',
    subject: 'Physics',
    topics: [
      { slug: 'elasticity', displayName: 'Elasticity', aliases: ['stress', 'strain', 'youngs modulus', 'bulk modulus', 'shear modulus', 'hookes law'], orderIndex: 1 },
      { slug: 'pressure-in-fluids', displayName: 'Pressure in Fluids', aliases: ['pascal law', 'hydraulic lift', 'atmospheric pressure'], orderIndex: 2 },
      { slug: 'buoyancy', displayName: 'Buoyancy', aliases: ['archimedes principle', 'floating and sinking'], orderIndex: 3 },
      { slug: 'fluid-dynamics', displayName: 'Fluid Dynamics', aliases: ['equation of continuity', 'bernoulli theorem', 'bernoulli principle', 'venturi meter', 'magnus effect'], orderIndex: 4 },
      { slug: 'viscosity', displayName: 'Viscosity', aliases: ['stokes law', 'terminal velocity', 'coefficient of viscosity', 'reynolds number'], orderIndex: 5 },
      { slug: 'surface-tension', displayName: 'Surface Tension', aliases: ['surface energy', 'capillarity', 'capillary rise', 'angle of contact', 'excess pressure'], orderIndex: 6 },
      { slug: 'thermal-expansion', displayName: 'Thermal Expansion', aliases: ['linear expansion', 'area expansion', 'volume expansion', 'thermal stress'], orderIndex: 7 },
      { slug: 'calorimetry', displayName: 'Calorimetry', aliases: ['specific heat capacity', 'latent heat', 'heat transfer'], orderIndex: 8 },
      { slug: 'heat-transfer', displayName: 'Heat Transfer', aliases: ['conduction', 'convection', 'radiation', 'newtons law of cooling', 'stefan boltzmann'], orderIndex: 9 },
    ],
  },
  {
    chapterSlug: 'thermodynamics',
    chapterTitle: 'Thermodynamics',
    subject: 'Physics',
    topics: [
      { slug: 'thermal-equilibrium', displayName: 'Thermal Equilibrium', aliases: ['zeroth law', 'zeroth law of thermodynamics'], orderIndex: 1 },
      { slug: 'internal-energy', displayName: 'Internal Energy', aliases: ['first law of thermodynamics', 'heat and work'], orderIndex: 2 },
      { slug: 'thermodynamic-processes', displayName: 'Thermodynamic Processes', aliases: ['isothermal', 'adiabatic', 'isobaric', 'isochoric', 'pv diagram'], orderIndex: 3 },
      { slug: 'heat-engines', displayName: 'Heat Engines', aliases: ['carnot engine', 'carnot cycle', 'efficiency'], orderIndex: 4 },
      { slug: 'second-law-of-thermodynamics', displayName: 'Second Law of Thermodynamics', aliases: ['kelvin planck', 'clausius statement', 'entropy'], orderIndex: 5 },
      { slug: 'refrigerator', displayName: 'Refrigerator', aliases: ['heat pump', 'coefficient of performance', 'cop'], orderIndex: 6 },
    ],
  },
  {
    chapterSlug: 'kinetic-theory-of-gases',
    chapterTitle: 'Kinetic Theory of Gases',
    subject: 'Physics',
    topics: [
      { slug: 'ideal-gas-equation', displayName: 'Ideal Gas Equation', aliases: ['gas laws', 'boyle law', 'charles law', 'pv=nrt'], orderIndex: 1 },
      { slug: 'kinetic-interpretation-of-temperature', displayName: 'Kinetic Interpretation of Temperature', aliases: ['rms speed', 'average speed', 'most probable speed', 'maxwell distribution'], orderIndex: 2 },
      { slug: 'degrees-of-freedom', displayName: 'Degrees of Freedom', aliases: ['law of equipartition of energy', 'specific heat of gases', 'cp cv'], orderIndex: 3 },
      { slug: 'mean-free-path', displayName: 'Mean Free Path', aliases: ['collision frequency'], orderIndex: 4 },
    ],
  },
  {
    chapterSlug: 'oscillations-and-waves',
    chapterTitle: 'Oscillations and Waves',
    subject: 'Physics',
    topics: [
      { slug: 'simple-harmonic-motion', displayName: 'Simple Harmonic Motion', aliases: ['shm', 'shm equations', 'amplitude', 'time period', 'frequency'], orderIndex: 1 },
      { slug: 'energy-in-shm', displayName: 'Energy in SHM', aliases: ['kinetic energy in shm', 'potential energy in shm'], orderIndex: 2 },
      { slug: 'spring-mass-system', displayName: 'Spring-Mass System', aliases: ['springs in series', 'springs in parallel', 'spring constant'], orderIndex: 3 },
      { slug: 'simple-pendulum', displayName: 'Simple Pendulum', aliases: ['pendulum time period', 'seconds pendulum'], orderIndex: 4 },
      { slug: 'damped-and-forced-oscillations', displayName: 'Damped and Forced Oscillations', aliases: ['damping', 'resonance', 'forced vibrations'], orderIndex: 5 },
      { slug: 'wave-motion', displayName: 'Wave Motion', aliases: ['transverse waves', 'longitudinal waves', 'wave equation', 'wave speed'], orderIndex: 6 },
      { slug: 'superposition-of-waves', displayName: 'Superposition of Waves', aliases: ['principle of superposition', 'standing waves', 'stationary waves', 'nodes and antinodes'], orderIndex: 7 },
      { slug: 'beats', displayName: 'Beats', aliases: ['beat frequency'], orderIndex: 8 },
      { slug: 'doppler-effect', displayName: 'Doppler Effect', aliases: ['doppler shift', 'apparent frequency'], orderIndex: 9 },
    ],
  },
  {
    chapterSlug: 'electrostatics',
    chapterTitle: 'Electrostatics',
    subject: 'Physics',
    topics: [
      { slug: 'electric-charge', displayName: 'Electric Charge', aliases: ['charge', 'quantization of charge', 'conservation of charge', 'coulombs law'], orderIndex: 1 },
      { slug: 'electric-field', displayName: 'Electric Field', aliases: ['electric field intensity', 'field lines', 'electric dipole'], orderIndex: 2 },
      { slug: 'gauss-law', displayName: "Gauss's Law", aliases: ['gauss theorem', 'electric flux', 'gaussian surface'], orderIndex: 3 },
      { slug: 'electric-potential', displayName: 'Electric Potential', aliases: ['potential difference', 'equipotential surfaces', 'potential due to point charge'], orderIndex: 4 },
      { slug: 'capacitance', displayName: 'Capacitance', aliases: ['parallel plate capacitor', 'capacitors in series', 'capacitors in parallel', 'energy stored in capacitor'], orderIndex: 5 },
      { slug: 'dielectrics', displayName: 'Dielectrics', aliases: ['dielectric constant', 'polarization', 'capacitance with dielectric'], orderIndex: 6 },
    ],
  },
  {
    chapterSlug: 'current-electricity',
    chapterTitle: 'Current Electricity',
    subject: 'Physics',
    topics: [
      { slug: 'electric-current', displayName: 'Electric Current', aliases: ['current', 'drift velocity', 'mobility', 'current density'], orderIndex: 1 },
      { slug: 'ohms-law', displayName: "Ohm's Law", aliases: ['ohm law', 'v=ir'], orderIndex: 2 },
      { slug: 'resistance-and-resistivity', displayName: 'Resistance and Resistivity', aliases: ['resistivity', 'conductivity', 'temperature dependence of resistance', 'colour code of resistors'], orderIndex: 3 },
      { slug: 'series-and-parallel-resistors', displayName: 'Series and Parallel Resistors', aliases: ['combination of resistors', 'equivalent resistance'], orderIndex: 4 },
      { slug: 'kirchhoffs-laws', displayName: "Kirchhoff's Laws", aliases: ['kirchhoff', 'kvl', 'kcl', 'junction rule', 'loop rule'], orderIndex: 5 },
      { slug: 'wheatstone-bridge', displayName: 'Wheatstone Bridge', aliases: ['balanced bridge', 'wheatstone'], orderIndex: 6 },
      { slug: 'meter-bridge', displayName: 'Meter Bridge', aliases: ['metre bridge', 'slide wire bridge'], orderIndex: 7 },
      { slug: 'potentiometer', displayName: 'Potentiometer', aliases: ['potential gradient', 'comparison of emf', 'internal resistance measurement'], orderIndex: 8 },
      { slug: 'internal-resistance', displayName: 'Internal Resistance', aliases: ['emf', 'terminal voltage', 'cells in series', 'cells in parallel'], orderIndex: 9 },
      { slug: 'electrical-energy-and-power', displayName: 'Electrical Energy and Power', aliases: ['joule heating', 'power dissipation'], orderIndex: 10 },
    ],
  },
  {
    chapterSlug: 'magnetic-effects-and-magnetism',
    chapterTitle: 'Magnetic Effects of Current and Magnetism',
    subject: 'Physics',
    topics: [
      { slug: 'biot-savart-law', displayName: 'Biot-Savart Law', aliases: ['biot savart', 'magnetic field due to current'], orderIndex: 1 },
      { slug: 'amperes-law', displayName: "Ampere's Law", aliases: ['ampere circuital law', 'solenoid', 'toroid'], orderIndex: 2 },
      { slug: 'force-on-current-carrying-conductor', displayName: 'Force on Current-Carrying Conductor', aliases: ['force between parallel conductors', 'definition of ampere'], orderIndex: 3 },
      { slug: 'lorentz-force', displayName: 'Lorentz Force', aliases: ['force on moving charge', 'cyclotron', 'velocity selector'], orderIndex: 4 },
      { slug: 'moving-coil-galvanometer', displayName: 'Moving Coil Galvanometer', aliases: ['galvanometer', 'ammeter', 'voltmeter', 'conversion'], orderIndex: 5 },
      { slug: 'magnetism', displayName: 'Magnetism', aliases: ['bar magnet', 'magnetic dipole', 'earth magnetism', 'magnetic declination', 'inclination'], orderIndex: 6 },
      { slug: 'magnetic-materials', displayName: 'Magnetic Materials', aliases: ['diamagnetic', 'paramagnetic', 'ferromagnetic', 'hysteresis', 'curie temperature'], orderIndex: 7 },
    ],
  },
  {
    chapterSlug: 'emi-and-ac',
    chapterTitle: 'Electromagnetic Induction and Alternating Currents',
    subject: 'Physics',
    topics: [
      { slug: 'faradays-law', displayName: "Faraday's Law", aliases: ['electromagnetic induction', 'emf induction', 'magnetic flux'], orderIndex: 1 },
      { slug: 'lenzs-law', displayName: "Lenz's Law", aliases: ['lenz law', 'direction of induced emf'], orderIndex: 2 },
      { slug: 'motional-emf', displayName: 'Motional EMF', aliases: ['emf in rotating coil', 'eddy currents'], orderIndex: 3 },
      { slug: 'self-and-mutual-inductance', displayName: 'Self and Mutual Inductance', aliases: ['self inductance', 'mutual inductance', 'inductor', 'henry'], orderIndex: 4 },
      { slug: 'alternating-current', displayName: 'Alternating Current', aliases: ['ac', 'rms value', 'peak value', 'mean value'], orderIndex: 5 },
      { slug: 'ac-circuits', displayName: 'AC Circuits', aliases: ['lcr circuit', 'impedance', 'reactance', 'power factor', 'resonance', 'quality factor'], orderIndex: 6 },
      { slug: 'transformer', displayName: 'Transformer', aliases: ['step up transformer', 'step down transformer', 'turns ratio', 'power transmission'], orderIndex: 7 },
    ],
  },
  {
    chapterSlug: 'electromagnetic-waves',
    chapterTitle: 'Electromagnetic Waves',
    subject: 'Physics',
    topics: [
      { slug: 'displacement-current', displayName: 'Displacement Current', aliases: ['maxwell displacement current', 'modified ampere law'], orderIndex: 1 },
      { slug: 'em-wave-properties', displayName: 'EM Wave Properties', aliases: ['electromagnetic wave', 'transverse nature', 'speed of em waves'], orderIndex: 2 },
      { slug: 'electromagnetic-spectrum', displayName: 'Electromagnetic Spectrum', aliases: ['em spectrum', 'radio waves', 'microwaves', 'infrared', 'visible', 'ultraviolet', 'x-rays', 'gamma rays'], orderIndex: 3 },
    ],
  },
  {
    chapterSlug: 'optics',
    chapterTitle: 'Optics',
    subject: 'Physics',
    topics: [
      { slug: 'reflection-of-light', displayName: 'Reflection of Light', aliases: ['mirror formula', 'spherical mirror', 'concave mirror', 'convex mirror'], orderIndex: 1 },
      { slug: 'refraction-of-light', displayName: 'Refraction of Light', aliases: ['snells law', 'total internal reflection', 'critical angle', 'optical fibre'], orderIndex: 2 },
      { slug: 'lenses', displayName: 'Lenses', aliases: ['lens formula', 'convex lens', 'concave lens', 'lens makers formula', 'power of lens', 'combination of lenses'], orderIndex: 3 },
      { slug: 'prism', displayName: 'Prism', aliases: ['dispersion', 'minimum deviation', 'prism formula'], orderIndex: 4 },
      { slug: 'optical-instruments', displayName: 'Optical Instruments', aliases: ['microscope', 'telescope', 'magnifying power', 'human eye', 'defects of vision'], orderIndex: 5 },
      { slug: 'wave-optics-interference', displayName: 'Interference', aliases: ['ydse', 'youngs double slit', 'fringe width', 'coherent sources', 'constructive interference', 'destructive interference'], orderIndex: 6 },
      { slug: 'diffraction', displayName: 'Diffraction', aliases: ['single slit diffraction', 'resolving power'], orderIndex: 7 },
      { slug: 'polarization', displayName: 'Polarization', aliases: ['malus law', 'brewster angle', 'polaroid'], orderIndex: 8 },
    ],
  },
  {
    chapterSlug: 'dual-nature',
    chapterTitle: 'Dual Nature of Matter and Radiation',
    subject: 'Physics',
    topics: [
      { slug: 'photoelectric-effect', displayName: 'Photoelectric Effect', aliases: ['einstein photoelectric equation', 'work function', 'threshold frequency', 'stopping potential'], orderIndex: 1 },
      { slug: 'photon-theory', displayName: 'Photon Theory', aliases: ['photon energy', 'photon momentum', 'radiation pressure'], orderIndex: 2 },
      { slug: 'de-broglie-hypothesis', displayName: 'de Broglie Hypothesis', aliases: ['matter waves', 'de broglie wavelength', 'wave-particle duality'], orderIndex: 3 },
      { slug: 'davisson-germer-experiment', displayName: 'Davisson-Germer Experiment', aliases: ['electron diffraction'], orderIndex: 4 },
    ],
  },
  {
    chapterSlug: 'atoms-and-nuclei',
    chapterTitle: 'Atoms and Nuclei',
    subject: 'Physics',
    topics: [
      { slug: 'atomic-models', displayName: 'Atomic Models', aliases: ['rutherford model', 'alpha scattering', 'thomson model'], orderIndex: 1 },
      { slug: 'bohr-model', displayName: 'Bohr Model', aliases: ['bohr postulates', 'energy levels', 'hydrogen spectrum', 'spectral series', 'lyman', 'balmer', 'paschen'], orderIndex: 2 },
      { slug: 'nuclear-structure', displayName: 'Nuclear Structure', aliases: ['mass number', 'atomic number', 'isotopes', 'isobars', 'isotones', 'nuclear size'], orderIndex: 3 },
      { slug: 'mass-energy-relation', displayName: 'Mass-Energy Relation', aliases: ['mass defect', 'binding energy', 'binding energy per nucleon', 'nuclear stability'], orderIndex: 4 },
      { slug: 'radioactivity', displayName: 'Radioactivity', aliases: ['alpha decay', 'beta decay', 'gamma decay', 'half life', 'decay constant', 'radioactive decay law'], orderIndex: 5 },
      { slug: 'nuclear-reactions', displayName: 'Nuclear Reactions', aliases: ['nuclear fission', 'nuclear fusion', 'chain reaction', 'nuclear reactor'], orderIndex: 6 },
    ],
  },
  {
    chapterSlug: 'electronic-devices',
    chapterTitle: 'Electronic Devices',
    subject: 'Physics',
    topics: [
      { slug: 'semiconductors', displayName: 'Semiconductors', aliases: ['intrinsic semiconductor', 'extrinsic semiconductor', 'n-type', 'p-type', 'energy bands'], orderIndex: 1 },
      { slug: 'pn-junction-diode', displayName: 'PN Junction Diode', aliases: ['p-n junction', 'forward bias', 'reverse bias', 'depletion region', 'barrier potential'], orderIndex: 2 },
      { slug: 'diode-applications', displayName: 'Diode Applications', aliases: ['rectifier', 'half wave rectifier', 'full wave rectifier', 'zener diode', 'led', 'photodiode', 'solar cell'], orderIndex: 3 },
      { slug: 'transistor', displayName: 'Transistor', aliases: ['npn', 'pnp', 'transistor as switch', 'transistor as amplifier', 'common emitter'], orderIndex: 4 },
      { slug: 'logic-gates', displayName: 'Logic Gates', aliases: ['and gate', 'or gate', 'not gate', 'nand gate', 'nor gate', 'boolean algebra'], orderIndex: 5 },
    ],
  },
  {
    chapterSlug: 'experimental-skills',
    chapterTitle: 'Experimental Skills',
    subject: 'Physics',
    topics: [
      { slug: 'vernier-and-screw-gauge-experiments', displayName: 'Vernier and Screw Gauge Experiments', aliases: ['measurement experiments'], orderIndex: 1 },
      { slug: 'simple-pendulum-experiment', displayName: 'Simple Pendulum Experiment', aliases: ['g by pendulum'], orderIndex: 2 },
      { slug: 'metre-bridge-experiment', displayName: 'Metre Bridge Experiment', aliases: ['meter bridge experiment', 'resistance measurement'], orderIndex: 3 },
      { slug: 'ohms-law-experiment', displayName: "Ohm's Law Experiment", aliases: ['v-i characteristics'], orderIndex: 4 },
      { slug: 'prism-experiment', displayName: 'Prism Experiment', aliases: ['refractive index of prism', 'minimum deviation experiment'], orderIndex: 5 },
      { slug: 'lens-experiment', displayName: 'Lens Experiment', aliases: ['focal length of lens', 'u-v method'], orderIndex: 6 },
    ],
  },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CHEMISTRY (20 chapters)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const CHEMISTRY_SKELETONS: ChapterSkeleton[] = [
  {
    chapterSlug: 'some-basic-concepts',
    chapterTitle: 'Some Basic Concepts in Chemistry',
    subject: 'Chemistry',
    topics: [
      { slug: 'laws-of-chemical-combination', displayName: 'Laws of Chemical Combination', aliases: ['law of conservation of mass', 'law of definite proportions', 'law of multiple proportions'], orderIndex: 1 },
      { slug: 'mole-concept', displayName: 'Mole Concept', aliases: ['avogadro number', 'molar mass', 'mole'], orderIndex: 2 },
      { slug: 'stoichiometry', displayName: 'Stoichiometry', aliases: ['balanced equation', 'limiting reagent', 'excess reagent'], orderIndex: 3 },
      { slug: 'concentration-terms', displayName: 'Concentration Terms', aliases: ['molarity', 'molality', 'mole fraction', 'ppm', 'normality'], orderIndex: 4 },
      { slug: 'empirical-and-molecular-formula', displayName: 'Empirical and Molecular Formula', aliases: ['percentage composition', 'empirical formula', 'molecular formula'], orderIndex: 5 },
    ],
  },
  {
    chapterSlug: 'atomic-structure',
    chapterTitle: 'Atomic Structure',
    subject: 'Chemistry',
    topics: [
      { slug: 'atomic-models-chem', displayName: 'Atomic Models', aliases: ['thomson model', 'rutherford model', 'bohr model'], orderIndex: 1 },
      { slug: 'quantum-numbers', displayName: 'Quantum Numbers', aliases: ['principal quantum number', 'azimuthal', 'magnetic', 'spin'], orderIndex: 2 },
      { slug: 'electronic-configuration', displayName: 'Electronic Configuration', aliases: ['aufbau principle', 'pauli exclusion', 'hund rule', 'filling order'], orderIndex: 3 },
      { slug: 'shapes-of-orbitals', displayName: 'Shapes of Orbitals', aliases: ['s orbital', 'p orbital', 'd orbital', 'nodes', 'radial nodes', 'angular nodes'], orderIndex: 4 },
      { slug: 'photoelectric-effect-chem', displayName: 'Photoelectric Effect and Dual Nature', aliases: ['de broglie', 'heisenberg uncertainty'], orderIndex: 5 },
    ],
  },
  {
    chapterSlug: 'chemical-bonding',
    chapterTitle: 'Chemical Bonding and Molecular Structure',
    subject: 'Chemistry',
    topics: [
      { slug: 'kossel-lewis-approach', displayName: 'Kossel-Lewis Approach', aliases: ['octet rule', 'lewis structure', 'lewis dot'], orderIndex: 1 },
      { slug: 'ionic-bond', displayName: 'Ionic Bond', aliases: ['electrovalent bond', 'lattice enthalpy', 'born-haber cycle'], orderIndex: 2 },
      { slug: 'covalent-bond', displayName: 'Covalent Bond', aliases: ['bond parameters', 'bond length', 'bond energy', 'bond order', 'bond angle'], orderIndex: 3 },
      { slug: 'formal-charge', displayName: 'Formal Charge', aliases: ['resonance structures', 'resonance'], orderIndex: 4 },
      { slug: 'vsepr-theory', displayName: 'VSEPR Theory', aliases: ['vsepr', 'shape of molecules', 'lone pair', 'bond pair'], orderIndex: 5 },
      { slug: 'valence-bond-theory', displayName: 'Valence Bond Theory', aliases: ['vbt', 'overlapping of orbitals'], orderIndex: 6 },
      { slug: 'hybridisation', displayName: 'Hybridisation', aliases: ['sp3', 'sp2', 'sp', 'sp3d', 'sp3d2', 'hybridization'], orderIndex: 7 },
      { slug: 'molecular-orbital-theory', displayName: 'Molecular Orbital Theory', aliases: ['mot', 'bond order', 'magnetic character', 'bmo', 'abmo'], orderIndex: 8 },
      { slug: 'hydrogen-bonding', displayName: 'Hydrogen Bonding', aliases: ['intermolecular forces', 'van der waals', 'dipole-dipole'], orderIndex: 9 },
    ],
  },
  {
    chapterSlug: 'chemical-thermodynamics',
    chapterTitle: 'Chemical Thermodynamics',
    subject: 'Chemistry',
    topics: [
      { slug: 'system-and-surroundings', displayName: 'System and Surroundings', aliases: ['open system', 'closed system', 'isolated system', 'state functions'], orderIndex: 1 },
      { slug: 'first-law-chem', displayName: 'First Law of Thermodynamics', aliases: ['internal energy', 'enthalpy', 'heat capacity'], orderIndex: 2 },
      { slug: 'enthalpy-of-reaction', displayName: 'Enthalpy of Reaction', aliases: ['enthalpy of formation', 'enthalpy of combustion', 'enthalpy of neutralization', 'hess law'], orderIndex: 3 },
      { slug: 'bond-enthalpy', displayName: 'Bond Enthalpy', aliases: ['bond dissociation energy', 'lattice enthalpy'], orderIndex: 4 },
      { slug: 'entropy', displayName: 'Entropy', aliases: ['second law', 'spontaneity', 'entropy change'], orderIndex: 5 },
      { slug: 'gibbs-free-energy', displayName: 'Gibbs Free Energy', aliases: ['gibbs energy', 'delta g', 'spontaneous reaction', 'equilibrium constant and gibbs'], orderIndex: 6 },
    ],
  },
  {
    chapterSlug: 'solutions',
    chapterTitle: 'Solutions',
    subject: 'Chemistry',
    topics: [
      { slug: 'types-of-solutions', displayName: 'Types of Solutions', aliases: ['solute', 'solvent', 'concentration'], orderIndex: 1 },
      { slug: 'henrys-law', displayName: "Henry's Law", aliases: ['solubility of gases', 'henry law'], orderIndex: 2 },
      { slug: 'raoults-law', displayName: "Raoult's Law", aliases: ['raoult', 'vapour pressure lowering', 'ideal solution', 'non-ideal solution'], orderIndex: 3 },
      { slug: 'colligative-properties', displayName: 'Colligative Properties', aliases: ['elevation of boiling point', 'depression of freezing point', 'osmotic pressure', 'van t hoff factor'], orderIndex: 4 },
      { slug: 'abnormal-molar-mass', displayName: 'Abnormal Molar Mass', aliases: ['association', 'dissociation', 'van t hoff factor'], orderIndex: 5 },
    ],
  },
  {
    chapterSlug: 'equilibrium',
    chapterTitle: 'Equilibrium',
    subject: 'Chemistry',
    topics: [
      { slug: 'equilibrium-constant', displayName: 'Equilibrium Constant', aliases: ['kp', 'kc', 'relationship kp kc', 'reaction quotient'], orderIndex: 1 },
      { slug: 'le-chatelier-principle', displayName: "Le Chatelier's Principle", aliases: ['le chatelier', 'equilibrium shift', 'effect of concentration', 'effect of pressure', 'effect of temperature'], orderIndex: 2 },
      { slug: 'ionic-equilibrium', displayName: 'Ionic Equilibrium', aliases: ['acids and bases', 'arrhenius', 'bronsted lowry', 'lewis acids bases'], orderIndex: 3 },
      { slug: 'ph-and-poh', displayName: 'pH and pOH', aliases: ['ph scale', 'ionic product of water', 'pka', 'pkb'], orderIndex: 4 },
      { slug: 'buffer-solutions', displayName: 'Buffer Solutions', aliases: ['henderson hasselbalch', 'buffer action', 'acidic buffer', 'basic buffer'], orderIndex: 5 },
      { slug: 'solubility-product', displayName: 'Solubility Product', aliases: ['ksp', 'common ion effect', 'solubility equilibrium'], orderIndex: 6 },
    ],
  },
  {
    chapterSlug: 'redox-and-electrochemistry',
    chapterTitle: 'Redox Reactions and Electrochemistry',
    subject: 'Chemistry',
    topics: [
      { slug: 'oxidation-and-reduction', displayName: 'Oxidation and Reduction', aliases: ['oxidation state', 'oxidation number', 'redox reactions'], orderIndex: 1 },
      { slug: 'balancing-redox-reactions', displayName: 'Balancing Redox Reactions', aliases: ['ion electron method', 'oxidation number method'], orderIndex: 2 },
      { slug: 'electrochemical-cells', displayName: 'Electrochemical Cells', aliases: ['galvanic cell', 'daniel cell', 'salt bridge', 'cell notation'], orderIndex: 3 },
      { slug: 'standard-electrode-potential', displayName: 'Standard Electrode Potential', aliases: ['emf of cell', 'electrochemical series'], orderIndex: 4 },
      { slug: 'nernst-equation', displayName: 'Nernst Equation', aliases: ['nernst', 'cell potential concentration dependence'], orderIndex: 5 },
      { slug: 'electrolysis', displayName: 'Electrolysis', aliases: ['faraday laws', 'faraday first law', 'faraday second law', 'electrolytic cell'], orderIndex: 6 },
      { slug: 'conductance', displayName: 'Conductance', aliases: ['molar conductivity', 'kohlrausch law', 'specific conductivity'], orderIndex: 7 },
    ],
  },
  {
    chapterSlug: 'chemical-kinetics',
    chapterTitle: 'Chemical Kinetics',
    subject: 'Chemistry',
    topics: [
      { slug: 'rate-of-reaction', displayName: 'Rate of Reaction', aliases: ['average rate', 'instantaneous rate', 'rate expression'], orderIndex: 1 },
      { slug: 'rate-law', displayName: 'Rate Law', aliases: ['rate constant', 'order of reaction', 'molecularity'], orderIndex: 2 },
      { slug: 'integrated-rate-equations', displayName: 'Integrated Rate Equations', aliases: ['zero order', 'first order', 'second order', 'half life'], orderIndex: 3 },
      { slug: 'arrhenius-equation', displayName: 'Arrhenius Equation', aliases: ['activation energy', 'temperature dependence', 'arrhenius plot'], orderIndex: 4 },
      { slug: 'collision-theory', displayName: 'Collision Theory', aliases: ['threshold energy', 'effective collisions', 'orientation'], orderIndex: 5 },
    ],
  },
  {
    chapterSlug: 'periodicity',
    chapterTitle: 'Classification of Elements and Periodicity',
    subject: 'Chemistry',
    topics: [
      { slug: 'modern-periodic-law', displayName: 'Modern Periodic Law', aliases: ['periodic table', 'groups', 'periods', 'blocks'], orderIndex: 1 },
      { slug: 'electronic-configuration-and-classification', displayName: 'Electronic Configuration and Classification', aliases: ['s block', 'p block', 'd block', 'f block'], orderIndex: 2 },
      { slug: 'periodic-trends', displayName: 'Periodic Trends', aliases: ['atomic radius', 'ionic radius', 'ionization enthalpy', 'electron gain enthalpy', 'electronegativity'], orderIndex: 3 },
      { slug: 'anomalous-properties', displayName: 'Anomalous Properties', aliases: ['diagonal relationship', 'inert pair effect'], orderIndex: 4 },
    ],
  },
  {
    chapterSlug: 'p-block-elements',
    chapterTitle: 'p-Block Elements',
    subject: 'Chemistry',
    topics: [
      { slug: 'group-13-boron-family', displayName: 'Group 13 (Boron Family)', aliases: ['boron', 'aluminium', 'borax', 'diborane'], orderIndex: 1 },
      { slug: 'group-14-carbon-family', displayName: 'Group 14 (Carbon Family)', aliases: ['carbon', 'silicon', 'allotropes of carbon', 'silicones'], orderIndex: 2 },
      { slug: 'group-15-nitrogen-family', displayName: 'Group 15 (Nitrogen Family)', aliases: ['nitrogen', 'phosphorus', 'ammonia', 'nitric acid'], orderIndex: 3 },
      { slug: 'group-16-oxygen-family', displayName: 'Group 16 (Oxygen Family)', aliases: ['oxygen', 'sulphur', 'ozone', 'sulphuric acid'], orderIndex: 4 },
      { slug: 'group-17-halogens', displayName: 'Group 17 (Halogens)', aliases: ['fluorine', 'chlorine', 'bromine', 'iodine', 'interhalogen compounds', 'hcl'], orderIndex: 5 },
      { slug: 'group-18-noble-gases', displayName: 'Group 18 (Noble Gases)', aliases: ['helium', 'neon', 'argon', 'xenon compounds'], orderIndex: 6 },
    ],
  },
  {
    chapterSlug: 'd-and-f-block-elements',
    chapterTitle: 'd- and f-Block Elements',
    subject: 'Chemistry',
    topics: [
      { slug: 'general-properties-of-transition-elements', displayName: 'General Properties of Transition Elements', aliases: ['transition metals', 'variable oxidation state', 'coloured compounds', 'catalytic properties'], orderIndex: 1 },
      { slug: 'important-compounds-of-transition-elements', displayName: 'Important Compounds', aliases: ['kmno4', 'k2cr2o7', 'potassium permanganate', 'potassium dichromate'], orderIndex: 2 },
      { slug: 'lanthanoids', displayName: 'Lanthanoids', aliases: ['lanthanide contraction', 'rare earth elements'], orderIndex: 3 },
      { slug: 'actinoids', displayName: 'Actinoids', aliases: ['actinide', 'uranium', 'thorium'], orderIndex: 4 },
    ],
  },
  {
    chapterSlug: 'coordination-compounds',
    chapterTitle: 'Coordination Compounds',
    subject: 'Chemistry',
    topics: [
      { slug: 'werner-theory', displayName: "Werner's Theory", aliases: ['coordination number', 'ligands', 'central metal atom', 'coordination sphere'], orderIndex: 1 },
      { slug: 'nomenclature-of-coordination-compounds', displayName: 'Nomenclature', aliases: ['iupac naming', 'naming of complexes'], orderIndex: 2 },
      { slug: 'isomerism-in-coordination-compounds', displayName: 'Isomerism', aliases: ['geometrical isomerism', 'optical isomerism', 'linkage isomerism', 'ionization isomerism'], orderIndex: 3 },
      { slug: 'bonding-theories-coordination', displayName: 'Bonding Theories', aliases: ['vbt', 'cft', 'crystal field theory', 'crystal field splitting'], orderIndex: 4 },
      { slug: 'applications-of-coordination-compounds', displayName: 'Applications', aliases: ['edta', 'chelation', 'biological importance'], orderIndex: 5 },
    ],
  },
  {
    chapterSlug: 'purification-characterisation-organic',
    chapterTitle: 'Purification and Characterisation of Organic Compounds',
    subject: 'Chemistry',
    topics: [
      { slug: 'purification-methods', displayName: 'Purification Methods', aliases: ['crystallization', 'distillation', 'steam distillation', 'chromatography', 'sublimation'], orderIndex: 1 },
      { slug: 'qualitative-analysis', displayName: 'Qualitative Analysis', aliases: ['lassaigne test', 'detection of elements', 'nitrogen', 'sulphur', 'halogens'], orderIndex: 2 },
      { slug: 'quantitative-analysis', displayName: 'Quantitative Analysis', aliases: ['kjeldahl method', 'dumas method', 'carius method'], orderIndex: 3 },
    ],
  },
  {
    chapterSlug: 'goc',
    chapterTitle: 'Some Basic Principles of Organic Chemistry',
    subject: 'Chemistry',
    topics: [
      { slug: 'classification-of-organic-compounds', displayName: 'Classification of Organic Compounds', aliases: ['functional groups', 'homologous series', 'nomenclature', 'iupac naming'], orderIndex: 1 },
      { slug: 'isomerism', displayName: 'Isomerism', aliases: ['structural isomerism', 'chain isomerism', 'position isomerism', 'functional group isomerism', 'metamerism', 'tautomerism', 'stereoisomerism'], orderIndex: 2 },
      { slug: 'electronic-effects', displayName: 'Electronic Effects', aliases: ['inductive effect', 'resonance effect', 'mesomeric effect', 'hyperconjugation', 'electromeric effect'], orderIndex: 3 },
      { slug: 'reactive-intermediates', displayName: 'Reactive Intermediates', aliases: ['carbocation', 'carbanion', 'free radical', 'carbene', 'stability order'], orderIndex: 4 },
      { slug: 'types-of-reactions', displayName: 'Types of Organic Reactions', aliases: ['substitution', 'addition', 'elimination', 'rearrangement', 'electrophilic', 'nucleophilic'], orderIndex: 5 },
      { slug: 'acidity-and-basicity', displayName: 'Acidity and Basicity', aliases: ['pka', 'acid strength', 'base strength', 'factors affecting acidity'], orderIndex: 6 },
    ],
  },
  {
    chapterSlug: 'hydrocarbons',
    chapterTitle: 'Hydrocarbons',
    subject: 'Chemistry',
    topics: [
      { slug: 'alkanes', displayName: 'Alkanes', aliases: ['methane', 'paraffins', 'combustion', 'halogenation', 'conformations'], orderIndex: 1 },
      { slug: 'alkenes', displayName: 'Alkenes', aliases: ['ethylene', 'markovnikov rule', 'anti-markovnikov', 'electrophilic addition', 'ozonolysis'], orderIndex: 2 },
      { slug: 'alkynes', displayName: 'Alkynes', aliases: ['acetylene', 'acidic hydrogen', 'addition reactions'], orderIndex: 3 },
      { slug: 'aromatic-hydrocarbons', displayName: 'Aromatic Hydrocarbons', aliases: ['benzene', 'aromaticity', 'huckel rule', 'electrophilic aromatic substitution', 'friedel-crafts', 'directive effects'], orderIndex: 4 },
    ],
  },
  {
    chapterSlug: 'haloalkanes-haloarenes',
    chapterTitle: 'Organic Compounds Containing Halogens',
    subject: 'Chemistry',
    topics: [
      { slug: 'classification-of-halides', displayName: 'Classification of Halides', aliases: ['alkyl halide', 'aryl halide', 'primary', 'secondary', 'tertiary'], orderIndex: 1 },
      { slug: 'nucleophilic-substitution', displayName: 'Nucleophilic Substitution', aliases: ['sn1', 'sn2', 'sn1 vs sn2', 'walden inversion', 'racemization'], orderIndex: 2 },
      { slug: 'elimination-reactions', displayName: 'Elimination Reactions', aliases: ['e1', 'e2', 'saytzeff rule', 'dehydrohalogenation'], orderIndex: 3 },
      { slug: 'grignard-reagent', displayName: 'Grignard Reagent', aliases: ['organometallic', 'grignard reactions'], orderIndex: 4 },
      { slug: 'polyhalogen-compounds', displayName: 'Polyhalogen Compounds', aliases: ['chloroform', 'iodoform', 'freons', 'ddt'], orderIndex: 5 },
    ],
  },
  {
    chapterSlug: 'oxygen-containing-compounds',
    chapterTitle: 'Organic Compounds Containing Oxygen',
    subject: 'Chemistry',
    topics: [
      { slug: 'alcohols', displayName: 'Alcohols', aliases: ['methanol', 'ethanol', 'dehydration', 'oxidation of alcohols'], orderIndex: 1 },
      { slug: 'phenols', displayName: 'Phenols', aliases: ['acidity of phenols', 'kolbe reaction', 'reimer tiemann'], orderIndex: 2 },
      { slug: 'ethers', displayName: 'Ethers', aliases: ['williamson synthesis', 'cleavage of ethers'], orderIndex: 3 },
      { slug: 'aldehydes-and-ketones', displayName: 'Aldehydes and Ketones', aliases: ['nucleophilic addition', 'aldol condensation', 'cannizzaro reaction', 'tollens test', 'fehling test', 'clemmensen reduction', 'wolff kishner'], orderIndex: 4 },
      { slug: 'carboxylic-acids', displayName: 'Carboxylic Acids', aliases: ['acidity of carboxylic acids', 'hell-volhard-zelinsky', 'ester formation', 'acyl chloride'], orderIndex: 5 },
    ],
  },
  {
    chapterSlug: 'nitrogen-containing-compounds',
    chapterTitle: 'Organic Compounds Containing Nitrogen',
    subject: 'Chemistry',
    topics: [
      { slug: 'amines', displayName: 'Amines', aliases: ['primary amine', 'secondary amine', 'tertiary amine', 'basicity of amines', 'hinsberg test', 'carbylamine reaction'], orderIndex: 1 },
      { slug: 'preparation-of-amines', displayName: 'Preparation of Amines', aliases: ['gabriel synthesis', 'hoffmann bromamide', 'reduction of nitro compounds'], orderIndex: 2 },
      { slug: 'diazonium-salts', displayName: 'Diazonium Salts', aliases: ['diazotization', 'sandmeyer reaction', 'coupling reaction', 'azo dyes'], orderIndex: 3 },
    ],
  },
  {
    chapterSlug: 'biomolecules',
    chapterTitle: 'Biomolecules',
    subject: 'Chemistry',
    topics: [
      { slug: 'carbohydrates', displayName: 'Carbohydrates', aliases: ['monosaccharides', 'disaccharides', 'polysaccharides', 'glucose', 'fructose', 'sucrose', 'starch', 'cellulose'], orderIndex: 1 },
      { slug: 'amino-acids-and-proteins', displayName: 'Amino Acids and Proteins', aliases: ['peptide bond', 'primary structure', 'secondary structure', 'denaturation', 'enzymes'], orderIndex: 2 },
      { slug: 'nucleic-acids', displayName: 'Nucleic Acids', aliases: ['dna', 'rna', 'nucleotides', 'double helix'], orderIndex: 3 },
      { slug: 'vitamins', displayName: 'Vitamins', aliases: ['water soluble vitamins', 'fat soluble vitamins', 'deficiency diseases'], orderIndex: 4 },
    ],
  },
  {
    chapterSlug: 'practical-chemistry',
    chapterTitle: 'Principles Related to Practical Chemistry',
    subject: 'Chemistry',
    topics: [
      { slug: 'salt-analysis', displayName: 'Salt Analysis', aliases: ['qualitative analysis', 'cation analysis', 'anion analysis', 'preliminary tests'], orderIndex: 1 },
      { slug: 'volumetric-analysis', displayName: 'Volumetric Analysis', aliases: ['titration', 'acid-base titration', 'redox titration', 'indicators'], orderIndex: 2 },
      { slug: 'organic-functional-group-tests', displayName: 'Organic Functional Group Tests', aliases: ['test for unsaturation', 'test for aldehyde', 'test for carboxylic acid', 'test for amine'], orderIndex: 3 },
    ],
  },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BIOLOGY (10 units, split into NCERT chapter sub-units)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const BIOLOGY_SKELETONS: ChapterSkeleton[] = [
  // Unit 1: Diversity in Living World
  {
    chapterSlug: 'diversity-in-living-world',
    chapterTitle: 'Diversity in Living World',
    subject: 'Biology',
    ncertChapter: 'The Living World',
    topics: [
      { slug: 'the-living-world', displayName: 'The Living World', aliases: ['what is living', 'biodiversity', 'taxonomic categories', 'taxonomic hierarchy'], orderIndex: 1 },
      { slug: 'biological-classification', displayName: 'Biological Classification', aliases: ['five kingdom classification', 'monera', 'protista', 'fungi', 'plantae', 'animalia', 'whittaker'], orderIndex: 2 },
      { slug: 'plant-kingdom', displayName: 'Plant Kingdom', aliases: ['algae', 'bryophytes', 'pteridophytes', 'gymnosperms', 'angiosperms', 'alternation of generations'], orderIndex: 3 },
      { slug: 'animal-kingdom', displayName: 'Animal Kingdom', aliases: ['basis of classification', 'phylum porifera', 'coelenterata', 'platyhelminthes', 'nematoda', 'annelida', 'arthropoda', 'mollusca', 'echinodermata', 'chordata'], orderIndex: 4 },
    ],
  },
  // Unit 2: Structural Organisation
  {
    chapterSlug: 'structural-organisation',
    chapterTitle: 'Structural Organisation in Animals and Plants',
    subject: 'Biology',
    topics: [
      { slug: 'morphology-of-flowering-plants', displayName: 'Morphology of Flowering Plants', aliases: ['root', 'stem', 'leaf', 'flower', 'fruit', 'seed', 'inflorescence', 'modification of roots', 'modification of stems', 'phyllotaxy'], orderIndex: 1 },
      { slug: 'anatomy-of-flowering-plants', displayName: 'Anatomy of Flowering Plants', aliases: ['plant tissues', 'meristematic tissue', 'permanent tissue', 'vascular bundle', 'secondary growth', 'dicot stem', 'monocot stem'], orderIndex: 2 },
      { slug: 'structural-organisation-in-animals', displayName: 'Structural Organisation in Animals', aliases: ['animal tissues', 'epithelial tissue', 'connective tissue', 'muscular tissue', 'nervous tissue', 'frog morphology', 'cockroach', 'earthworm'], orderIndex: 3 },
    ],
  },
  // Unit 3: Cell Structure and Function
  {
    chapterSlug: 'cell-structure-and-function',
    chapterTitle: 'Cell Structure and Function',
    subject: 'Biology',
    topics: [
      { slug: 'cell-the-unit-of-life', displayName: 'Cell: The Unit of Life', aliases: ['cell theory', 'prokaryotic cell', 'eukaryotic cell', 'cell organelles', 'nucleus', 'mitochondria', 'chloroplast', 'er', 'golgi', 'ribosome', 'lysosome', 'vacuole', 'cell membrane'], orderIndex: 1 },
      { slug: 'biomolecules-biology', displayName: 'Biomolecules', aliases: ['proteins', 'carbohydrates', 'lipids', 'nucleic acids', 'enzymes', 'enzyme kinetics', 'co-factors'], orderIndex: 2 },
      { slug: 'cell-cycle-and-cell-division', displayName: 'Cell Cycle and Cell Division', aliases: ['mitosis', 'meiosis', 'cell cycle phases', 'prophase', 'metaphase', 'anaphase', 'telophase', 'crossing over', 'significance of meiosis'], orderIndex: 3 },
    ],
  },
  // Unit 4: Plant Physiology
  {
    chapterSlug: 'plant-physiology',
    chapterTitle: 'Plant Physiology',
    subject: 'Biology',
    topics: [
      { slug: 'transport-in-plants', displayName: 'Transport in Plants', aliases: ['osmosis', 'diffusion', 'plasmolysis', 'imbibition', 'water potential', 'transpiration', 'ascent of sap', 'translocation'], orderIndex: 1 },
      { slug: 'mineral-nutrition', displayName: 'Mineral Nutrition', aliases: ['essential elements', 'macro nutrients', 'micro nutrients', 'nitrogen fixation', 'nitrogen cycle'], orderIndex: 2 },
      { slug: 'photosynthesis', displayName: 'Photosynthesis in Higher Plants', aliases: ['light reaction', 'dark reaction', 'calvin cycle', 'c3 pathway', 'c4 pathway', 'cam', 'photorespiration', 'photosystem', 'chlorophyll'], orderIndex: 3 },
      { slug: 'respiration-in-plants', displayName: 'Respiration in Plants', aliases: ['glycolysis', 'krebs cycle', 'tca cycle', 'electron transport chain', 'oxidative phosphorylation', 'fermentation', 'aerobic respiration', 'anaerobic respiration'], orderIndex: 4 },
      { slug: 'plant-growth-and-development', displayName: 'Plant Growth and Development', aliases: ['auxin', 'gibberellin', 'cytokinin', 'ethylene', 'abscisic acid', 'photoperiodism', 'vernalization', 'plant hormones'], orderIndex: 5 },
    ],
  },
  // Unit 5: Human Physiology — SPLIT into 6 NCERT chapters
  {
    chapterSlug: 'human-physiology-digestion',
    chapterTitle: 'Digestion and Absorption',
    subject: 'Biology',
    ncertChapter: 'Digestion and Absorption',
    topics: [
      { slug: 'digestive-system', displayName: 'Human Digestive System', aliases: ['alimentary canal', 'digestive glands', 'teeth', 'tongue', 'salivary glands', 'stomach', 'small intestine', 'large intestine'], orderIndex: 1 },
      { slug: 'digestion-of-food', displayName: 'Digestion of Food', aliases: ['enzymes of digestion', 'pepsin', 'trypsin', 'lipase', 'amylase', 'bile', 'absorption', 'assimilation'], orderIndex: 2 },
      { slug: 'absorption-and-assimilation', displayName: 'Absorption and Assimilation', aliases: ['absorption of digested food', 'villi', 'assimilation', 'egestion', 'disorders of digestion'], orderIndex: 3 },
    ]
  },
  {
    chapterSlug: 'human-physiology-breathing',
    chapterTitle: 'Breathing and Exchange of Gases',
    subject: 'Biology',
    ncertChapter: 'Breathing and Exchange of Gases',
    topics: [
      { slug: 'respiratory-system', displayName: 'Human Respiratory System', aliases: ['respiratory organs', 'nasal cavity', 'pharynx', 'larynx', 'trachea', 'bronchi', 'lungs', 'alveoli'], orderIndex: 1 },
      { slug: 'mechanism-of-breathing', displayName: 'Mechanism of Breathing', aliases: ['inspiration', 'expiration', 'breathing rate'], orderIndex: 2 },
      { slug: 'respiratory-volumes', displayName: 'Respiratory Volumes', aliases: ['tidal volume', 'inspiratory reserve', 'expiratory reserve', 'residual volume', 'vital capacity', 'lung capacities'], orderIndex: 3 },
      { slug: 'exchange-of-gases', displayName: 'Exchange of Gases', aliases: ['partial pressure', 'diffusion of gases', 'alveolar gas exchange'], orderIndex: 4 },
      { slug: 'transport-of-oxygen', displayName: 'Transport of Oxygen', aliases: ['oxyhaemoglobin', 'oxygen dissociation curve', 'bohr effect', 'haemoglobin'], orderIndex: 5 },
      { slug: 'transport-of-carbon-dioxide', displayName: 'Transport of Carbon Dioxide', aliases: ['carbamino-haemoglobin', 'bicarbonate', 'chloride shift'], orderIndex: 6 },
      { slug: 'regulation-of-respiration', displayName: 'Regulation of Respiration', aliases: ['respiratory centre', 'pneumotaxic centre', 'chemoreceptors'], orderIndex: 7 },
      { slug: 'respiratory-disorders', displayName: 'Respiratory Disorders', aliases: ['asthma', 'emphysema', 'occupational lung diseases'], orderIndex: 8 },
    ]
  },
  {
    chapterSlug: 'human-physiology-circulation',
    chapterTitle: 'Body Fluids and Circulation',
    subject: 'Biology',
    ncertChapter: 'Body Fluids and Circulation',
    topics: [
      { slug: 'blood-composition', displayName: 'Blood Composition', aliases: ['plasma', 'formed elements', 'rbc', 'wbc', 'platelets', 'erythrocytes', 'leucocytes', 'thrombocytes'], orderIndex: 1 },
      { slug: 'blood-groups', displayName: 'Blood Groups', aliases: ['abo grouping', 'rh factor', 'blood transfusion', 'erythroblastosis fetalis'], orderIndex: 2 },
      { slug: 'coagulation', displayName: 'Coagulation of Blood', aliases: ['clotting', 'thromboplastin', 'fibrinogen', 'fibrin'], orderIndex: 3 },
      { slug: 'lymph', displayName: 'Lymph', aliases: ['lymphatic system', 'tissue fluid'], orderIndex: 4 },
      { slug: 'human-heart', displayName: 'Human Heart', aliases: ['heart structure', 'chambers of heart', 'atria', 'ventricles', 'valves', 'bicuspid valve', 'tricuspid valve'], orderIndex: 5 },
      { slug: 'cardiac-cycle', displayName: 'Cardiac Cycle', aliases: ['systole', 'diastole', 'cardiac output', 'stroke volume'], orderIndex: 6 },
      { slug: 'ecg', displayName: 'ECG (Electrocardiograph)', aliases: ['electrocardiogram', 'p wave', 'qrs complex', 't wave', 'ecg interpretation'], orderIndex: 7 },
      { slug: 'double-circulation', displayName: 'Double Circulation', aliases: ['pulmonary circulation', 'systemic circulation', 'portal circulation'], orderIndex: 8 },
      { slug: 'regulation-of-cardiac-activity', displayName: 'Regulation of Cardiac Activity', aliases: ['nodal tissue', 'sa node', 'av node', 'pacemaker', 'autonomic regulation'], orderIndex: 9 },
      { slug: 'circulatory-disorders', displayName: 'Disorders of Circulatory System', aliases: ['hypertension', 'coronary artery disease', 'angina pectoris', 'heart failure', 'atherosclerosis'], orderIndex: 10 },
    ]
  },
  {
    chapterSlug: 'human-physiology-excretion',
    chapterTitle: 'Excretory Products and Their Elimination',
    subject: 'Biology',
    ncertChapter: 'Excretory Products and Their Elimination',
    topics: [
      { slug: 'excretory-system', displayName: 'Human Excretory System', aliases: ['kidney', 'ureter', 'urinary bladder', 'urethra'], orderIndex: 1 },
      { slug: 'nephron-structure', displayName: 'Structure of Nephron', aliases: ['bowmans capsule', 'glomerulus', 'pct', 'loop of henle', 'dct', 'collecting duct'], orderIndex: 2 },
      { slug: 'urine-formation', displayName: 'Urine Formation', aliases: ['glomerular filtration', 'tubular reabsorption', 'tubular secretion'], orderIndex: 3 },
      { slug: 'counter-current-mechanism', displayName: 'Counter-Current Mechanism', aliases: ['loop of henle', 'vasa recta', 'concentration of urine'], orderIndex: 4 },
      { slug: 'regulation-of-kidney-function', displayName: 'Regulation of Kidney Function', aliases: ['adh', 'aldosterone', 'anp', 'jga', 'renin angiotensin'], orderIndex: 5 },
      { slug: 'excretory-disorders', displayName: 'Excretory Disorders', aliases: ['uremia', 'renal failure', 'dialysis', 'kidney transplant'], orderIndex: 6 },
    ]
  },
  {
    chapterSlug: 'human-physiology-locomotion',
    chapterTitle: 'Locomotion and Movement',
    subject: 'Biology',
    ncertChapter: 'Locomotion and Movement',
    topics: [
      { slug: 'types-of-movement', displayName: 'Types of Movement', aliases: ['amoeboid movement', 'ciliary movement', 'muscular movement'], orderIndex: 1 },
      { slug: 'skeletal-muscle', displayName: 'Skeletal Muscle', aliases: ['structure of skeletal muscle', 'sarcomere', 'actin', 'myosin', 'muscle fibre'], orderIndex: 2 },
      { slug: 'muscle-contraction', displayName: 'Muscle Contraction', aliases: ['sliding filament theory', 'mechanism of contraction', 'calcium ions', 'troponin', 'tropomyosin'], orderIndex: 3 },
      { slug: 'skeletal-system', displayName: 'Skeletal System', aliases: ['axial skeleton', 'appendicular skeleton', 'types of joints', 'ball and socket', 'hinge joint'], orderIndex: 4 },
      { slug: 'musculoskeletal-disorders', displayName: 'Musculoskeletal Disorders', aliases: ['myasthenia gravis', 'muscular dystrophy', 'osteoporosis', 'arthritis', 'gout'], orderIndex: 5 },
    ]
  },
  {
    chapterSlug: 'human-physiology-neural',
    chapterTitle: 'Neural Control and Coordination',
    subject: 'Biology',
    ncertChapter: 'Neural Control and Coordination',
    topics: [
      { slug: 'neuron-structure', displayName: 'Structure of Neuron', aliases: ['nerve cell', 'dendrite', 'axon', 'myelin sheath', 'synapse'], orderIndex: 1 },
      { slug: 'nerve-impulse', displayName: 'Generation and Conduction of Nerve Impulse', aliases: ['resting potential', 'action potential', 'depolarization', 'repolarization', 'saltatory conduction'], orderIndex: 2 },
      { slug: 'synaptic-transmission', displayName: 'Synaptic Transmission', aliases: ['neurotransmitters', 'chemical synapse', 'electrical synapse'], orderIndex: 3 },
      { slug: 'central-nervous-system', displayName: 'Central Nervous System', aliases: ['brain', 'cerebrum', 'cerebellum', 'medulla', 'hypothalamus', 'spinal cord'], orderIndex: 4 },
      { slug: 'reflex-action', displayName: 'Reflex Action', aliases: ['reflex arc', 'conditioned reflex', 'unconditioned reflex'], orderIndex: 5 },
      { slug: 'sensory-organs', displayName: 'Sensory Organs', aliases: ['eye', 'ear', 'retina', 'cochlea', 'vestibular apparatus'], orderIndex: 6 },
    ]
  },
  {
    chapterSlug: 'human-physiology-chemical',
    chapterTitle: 'Chemical Coordination and Integration',
    subject: 'Biology',
    ncertChapter: 'Chemical Coordination and Integration',
    topics: [
      { slug: 'endocrine-glands', displayName: 'Endocrine Glands and Hormones', aliases: ['hypothalamus', 'pituitary', 'thyroid', 'parathyroid', 'adrenal', 'pancreas', 'pineal'], orderIndex: 1 },
      { slug: 'mechanism-of-hormone-action', displayName: 'Mechanism of Hormone Action', aliases: ['peptide hormones', 'steroid hormones', 'secondary messenger', 'camp'], orderIndex: 2 },
      { slug: 'endocrine-disorders', displayName: 'Endocrine Disorders', aliases: ['diabetes mellitus', 'hypothyroidism', 'hyperthyroidism', 'goitre', 'acromegaly', 'dwarfism', 'addison disease', 'cushing syndrome'], orderIndex: 3 },
    ]
  },
  // Unit 6: Reproduction
  {
    chapterSlug: 'reproduction',
    chapterTitle: 'Reproduction',
    subject: 'Biology',
    topics: [
      { slug: 'flower-structure', displayName: 'Flower Structure', aliases: ['microsporangium', 'megasporangium', 'stamen', 'pistil', 'anther', 'ovule'], orderIndex: 1 },
      { slug: 'pollination', displayName: 'Pollination', aliases: ['self pollination', 'cross pollination', 'agents of pollination', 'outbreeding devices'], orderIndex: 2 },
      { slug: 'double-fertilization', displayName: 'Double Fertilization', aliases: ['syngamy', 'triple fusion', 'endosperm', 'embryo development'], orderIndex: 3 },
      { slug: 'post-fertilization', displayName: 'Post-Fertilization Events', aliases: ['seed development', 'fruit development', 'apomixis', 'polyembryony'], orderIndex: 4 },
      { slug: 'male-reproductive-system', displayName: 'Male Reproductive System', aliases: ['testis', 'seminiferous tubules', 'spermatogenesis', 'sperm structure', 'accessory glands'], orderIndex: 5 },
      { slug: 'female-reproductive-system', displayName: 'Female Reproductive System', aliases: ['ovary', 'oogenesis', 'ovum', 'uterus', 'fallopian tube'], orderIndex: 6 },
      { slug: 'menstrual-cycle', displayName: 'Menstrual Cycle', aliases: ['ovulation', 'follicular phase', 'luteal phase', 'menstruation', 'hormonal control'], orderIndex: 7 },
      { slug: 'fertilization-and-implantation', displayName: 'Fertilization and Implantation', aliases: ['pregnancy', 'embryo development', 'placenta', 'parturition', 'lactation'], orderIndex: 8 },
      { slug: 'reproductive-health', displayName: 'Reproductive Health', aliases: ['birth control', 'contraception', 'iud', 'stds', 'infertility', 'ivf', 'art', 'amniocentesis'], orderIndex: 9 },
    ],
  },
  // Unit 7: Genetics and Evolution
  {
    chapterSlug: 'genetics-and-evolution',
    chapterTitle: 'Genetics and Evolution',
    subject: 'Biology',
    topics: [
      { slug: 'mendels-laws', displayName: "Mendel's Laws", aliases: ['law of dominance', 'law of segregation', 'law of independent assortment', 'monohybrid cross', 'dihybrid cross'], orderIndex: 1 },
      { slug: 'incomplete-dominance-codominance', displayName: 'Incomplete Dominance and Codominance', aliases: ['incomplete dominance', 'codominance', 'multiple alleles', 'blood group inheritance', 'pleiotropy'], orderIndex: 2 },
      { slug: 'sex-determination', displayName: 'Sex Determination', aliases: ['xx-xy', 'sex linked inheritance', 'colour blindness', 'haemophilia'], orderIndex: 3 },
      { slug: 'linkage-and-recombination', displayName: 'Linkage and Recombination', aliases: ['linkage', 'genetic recombination', 'morgan', 'chromosomal theory'], orderIndex: 4 },
      { slug: 'pedigree-analysis', displayName: 'Pedigree Analysis', aliases: ['autosomal dominant', 'autosomal recessive', 'x-linked'], orderIndex: 5 },
      { slug: 'dna-structure-and-replication', displayName: 'DNA Structure and Replication', aliases: ['double helix', 'watson and crick', 'dna replication', 'semi-conservative', 'meselson and stahl'], orderIndex: 6 },
      { slug: 'transcription', displayName: 'Transcription', aliases: ['rna polymerase', 'mrna', 'trna', 'rrna', 'central dogma', 'reverse transcription'], orderIndex: 7 },
      { slug: 'translation', displayName: 'Translation', aliases: ['genetic code', 'codon', 'anticodon', 'ribosome', 'protein synthesis'], orderIndex: 8 },
      { slug: 'gene-regulation', displayName: 'Gene Regulation', aliases: ['lac operon', 'operon model', 'inducible system', 'repressible system'], orderIndex: 9 },
      { slug: 'human-genome-project', displayName: 'Human Genome Project', aliases: ['hgp', 'dna fingerprinting', 'vntr', 'str'], orderIndex: 10 },
      { slug: 'origin-of-life', displayName: 'Origin of Life', aliases: ['abiogenesis', 'chemical evolution', 'oparin', 'haldane', 'miller experiment'], orderIndex: 11 },
      { slug: 'theories-of-evolution', displayName: 'Theories of Evolution', aliases: ['lamarck', 'darwin', 'natural selection', 'hugo de vries', 'mutation theory'], orderIndex: 12 },
      { slug: 'evidences-of-evolution', displayName: 'Evidences of Evolution', aliases: ['homologous organs', 'analogous organs', 'vestigial organs', 'fossils', 'embryological evidence'], orderIndex: 13 },
      { slug: 'hardy-weinberg-equilibrium', displayName: 'Hardy-Weinberg Equilibrium', aliases: ['allele frequency', 'genetic drift', 'gene flow', 'genetic equilibrium', 'founders effect', 'bottleneck effect'], orderIndex: 14 },
      { slug: 'adaptive-radiation', displayName: 'Adaptive Radiation', aliases: ['darwin finches', 'speciation', 'types of speciation'], orderIndex: 15 },
    ],
  },
  // Unit 8: Biology and Human Welfare
  {
    chapterSlug: 'biology-and-human-welfare',
    chapterTitle: 'Biology and Human Welfare',
    subject: 'Biology',
    topics: [
      { slug: 'common-diseases', displayName: 'Common Diseases', aliases: ['typhoid', 'pneumonia', 'malaria', 'amoebiasis', 'ascariasis', 'filariasis', 'ringworm', 'pathogens'], orderIndex: 1 },
      { slug: 'immunity', displayName: 'Immunity', aliases: ['innate immunity', 'acquired immunity', 'active immunity', 'passive immunity', 'humoral immunity', 'cell mediated immunity', 'antibodies', 'vaccination'], orderIndex: 2 },
      { slug: 'aids', displayName: 'AIDS', aliases: ['hiv', 'immunodeficiency', 'retrovirus'], orderIndex: 3 },
      { slug: 'cancer', displayName: 'Cancer', aliases: ['oncogene', 'tumour suppressor', 'metastasis', 'benign', 'malignant'], orderIndex: 4 },
      { slug: 'drugs-and-alcohol-abuse', displayName: 'Drugs and Alcohol Abuse', aliases: ['opioids', 'cannabinoids', 'cocaine', 'addiction', 'drug abuse prevention'], orderIndex: 5 },
      { slug: 'microbes-in-human-welfare', displayName: 'Microbes in Human Welfare', aliases: ['microbes in food', 'fermentation', 'antibiotics', 'biogas', 'sewage treatment', 'biocontrol agents', 'biofertilizers'], orderIndex: 6 },
    ],
  },
  // Unit 9: Biotechnology and Its Applications
  {
    chapterSlug: 'biotechnology',
    chapterTitle: 'Biotechnology and Its Applications',
    subject: 'Biology',
    topics: [
      { slug: 'principles-of-biotechnology', displayName: 'Principles of Biotechnology', aliases: ['genetic engineering', 'recombinant dna', 'rdna technology', 'restriction enzymes', 'ligase'], orderIndex: 1 },
      { slug: 'tools-of-rdna-technology', displayName: 'Tools of rDNA Technology', aliases: ['restriction enzymes', 'cloning vectors', 'plasmid', 'bacteriophage', 'cosmid', 'bac', 'yac'], orderIndex: 2 },
      { slug: 'pcr', displayName: 'PCR (Polymerase Chain Reaction)', aliases: ['amplification', 'taq polymerase', 'denaturation', 'annealing', 'extension'], orderIndex: 3 },
      { slug: 'gel-electrophoresis', displayName: 'Gel Electrophoresis', aliases: ['agarose gel', 'dna separation', 'southern blotting'], orderIndex: 4 },
      { slug: 'biotechnology-applications', displayName: 'Applications of Biotechnology', aliases: ['bt cotton', 'bt corn', 'rnai', 'gene therapy', 'genetically modified organisms', 'gmo', 'golden rice'], orderIndex: 5 },
      { slug: 'transgenic-animals', displayName: 'Transgenic Animals', aliases: ['transgenic', 'knock-out mice', 'pharmaceutical production'], orderIndex: 6 },
      { slug: 'bioethics', displayName: 'Bioethics', aliases: ['ethical issues', 'biopiracy', 'patent', 'gmo debate'], orderIndex: 7 },
    ],
  },
  // Unit 10: Ecology and Environment
  {
    chapterSlug: 'ecology-and-environment',
    chapterTitle: 'Ecology and Environment',
    subject: 'Biology',
    topics: [
      { slug: 'organisms-and-environment', displayName: 'Organisms and Environment', aliases: ['abiotic factors', 'biotic factors', 'temperature', 'light', 'water', 'eurythermal', 'stenothermal', 'adaptations'], orderIndex: 1 },
      { slug: 'population-ecology', displayName: 'Population Ecology', aliases: ['population attributes', 'population growth', 'exponential growth', 'logistic growth', 'carrying capacity', 'natality', 'mortality'], orderIndex: 2 },
      { slug: 'population-interactions', displayName: 'Population Interactions', aliases: ['predation', 'competition', 'parasitism', 'commensalism', 'mutualism', 'amensalism'], orderIndex: 3 },
      { slug: 'ecosystem-structure', displayName: 'Ecosystem Structure', aliases: ['producers', 'consumers', 'decomposers', 'food chain', 'food web', 'trophic levels'], orderIndex: 4 },
      { slug: 'ecosystem-function', displayName: 'Ecosystem Function', aliases: ['energy flow', 'primary productivity', 'npp', 'gpp', 'decomposition', 'nutrient cycling', 'carbon cycle', 'phosphorus cycle'], orderIndex: 5 },
      { slug: 'ecological-pyramids', displayName: 'Ecological Pyramids', aliases: ['pyramid of number', 'pyramid of biomass', 'pyramid of energy', 'inverted pyramid'], orderIndex: 6 },
      { slug: 'ecological-succession', displayName: 'Ecological Succession', aliases: ['primary succession', 'secondary succession', 'climax community', 'sere', 'pioneer species'], orderIndex: 7 },
      { slug: 'biodiversity', displayName: 'Biodiversity', aliases: ['species diversity', 'genetic diversity', 'ecosystem diversity', 'alpha diversity', 'beta diversity', 'species-area relationship', 'rivet popper hypothesis'], orderIndex: 8 },
      { slug: 'biodiversity-conservation', displayName: 'Biodiversity Conservation', aliases: ['in situ conservation', 'ex situ conservation', 'national parks', 'sanctuaries', 'biosphere reserves', 'hotspots', 'red data book'], orderIndex: 9 },
      { slug: 'environmental-issues', displayName: 'Environmental Issues', aliases: ['air pollution', 'water pollution', 'solid waste', 'ozone depletion', 'global warming', 'greenhouse effect', 'eutrophication', 'biomagnification'], orderIndex: 10 },
    ],
  },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXPORTS AND UTILITIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const ALL_CHAPTER_SKELETONS: ChapterSkeleton[] = [
  ...PHYSICS_SKELETONS,
  ...CHEMISTRY_SKELETONS,
  ...BIOLOGY_SKELETONS,
];

/** Get skeleton for a specific chapter slug */
export function getChapterSkeleton(chapterSlug: string): ChapterSkeleton | null {
  return ALL_CHAPTER_SKELETONS.find(s => s.chapterSlug === chapterSlug) ?? null;
}

/** Get all topics for a chapter (returns empty array if not found) */
export function getChapterTopicSlugs(chapterSlug: string): string[] {
  const skeleton = getChapterSkeleton(chapterSlug);
  return skeleton ? skeleton.topics.map(t => t.slug) : [];
}

/** Validate that a topic slug belongs to a specific chapter */
export function isTopicInChapter(topicSlug: string, chapterSlug: string): boolean {
  const skeleton = getChapterSkeleton(chapterSlug);
  if (!skeleton) return false;
  return skeleton.topics.some(t => t.slug === topicSlug);
}

export function getTopicSkeleton(chapterSlug: string, topicSlug: string): TopicSkeletonEntry | null {
  const skeleton = getChapterSkeleton(chapterSlug);
  if (!skeleton) return null;
  return skeleton.topics.find(t => t.slug === topicSlug) ?? null;
}

function normalizeSkeletonText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(value: string): Set<string> {
  return new Set(
    normalizeSkeletonText(value)
      .split(' ')
      .filter(token => token.length >= 3 && !['and', 'the', 'with', 'for', 'system'].includes(token))
  );
}

export function resolveTopicSkeletonForText(text: string, chapterSlug: string): TopicSkeletonEntry | null {
  const skeleton = getChapterSkeleton(chapterSlug);
  if (!skeleton) return null;

  const normalized = normalizeSkeletonText(text);
  const inputTokens = tokenSet(normalized);
  let best: { topic: TopicSkeletonEntry; score: number } | null = null;

  for (const topic of skeleton.topics) {
    const candidates = [topic.slug.replace(/-/g, ' '), topic.displayName, ...topic.aliases];
    let score = 0;

    for (const candidate of candidates) {
      const normalizedCandidate = normalizeSkeletonText(candidate);
      if (!normalizedCandidate) continue;
      if (normalized === normalizedCandidate) score = Math.max(score, 120);
      else if (normalized.includes(normalizedCandidate)) score = Math.max(score, 90);
      else if (normalizedCandidate.includes(normalized) && normalized.length >= 5) score = Math.max(score, 65);

      const candidateTokens = tokenSet(normalizedCandidate);
      let overlap = 0;
      for (const token of candidateTokens) {
        if (inputTokens.has(token)) overlap++;
      }
      if (overlap > 0) score = Math.max(score, overlap * 18);
    }

    if (!best || score > best.score || (score === best.score && topic.orderIndex < best.topic.orderIndex)) {
      best = { topic, score };
    }
  }

  return best && best.score >= 36 ? best.topic : null;
}

export function resolveFocusedTopicSlugsFromText(text: string, chapterSlug: string): string[] {
  const skeleton = getChapterSkeleton(chapterSlug);
  if (!skeleton) return [];

  const normalized = normalizeSkeletonText(text);
  if (chapterSlug === 'human-physiology') {
    const groups: Array<{ pattern: RegExp; slugs: string[] }> = [
      {
        pattern: /\b(circulat\w*|body fluids?|blood|plasma|formed elements?|rbc|wbc|platelets?|heart|cardiac|ecg|lymph|coagulat\w*|hypertension|coronary|angina)\b/i,
        slugs: ['blood-composition', 'blood-groups', 'coagulation', 'lymph', 'human-heart', 'cardiac-cycle', 'ecg', 'double-circulation', 'regulation-of-cardiac-activity', 'circulatory-disorders'],
      },
      {
        pattern: /\b(respirat\w*|breathing|lungs?|alveoli|oxygen|carbon dioxide|tidal volume|vital capacity|asthma|emphysema)\b/i,
        slugs: ['respiratory-system', 'mechanism-of-breathing', 'respiratory-volumes', 'exchange-of-gases', 'transport-of-oxygen', 'transport-of-carbon-dioxide', 'regulation-of-respiration', 'respiratory-disorders'],
      },
      {
        pattern: /\b(excret\w*|kidney|nephron|urine|glomerul\w*|henle|vasa recta|dialysis|renal)\b/i,
        slugs: ['excretory-system', 'nephron-structure', 'urine-formation', 'counter-current-mechanism', 'regulation-of-kidney-function', 'excretory-disorders'],
      },
      {
        pattern: /\b(locomotion|movement|muscle|skeletal|joint|sarcomere|actin|myosin|arthritis|gout)\b/i,
        slugs: ['types-of-movement', 'skeletal-muscle', 'muscle-contraction', 'skeletal-system', 'musculoskeletal-disorders'],
      },
      {
        pattern: /\b(neural|nervous|neuron|nerve|synapse|brain|spinal|reflex|eye|ear)\b/i,
        slugs: ['neuron-structure', 'nerve-impulse', 'synaptic-transmission', 'central-nervous-system', 'reflex-action', 'sensory-organs'],
      },
      {
        pattern: /\b(endocrine|hormone|pituitary|thyroid|adrenal|pancreas|diabetes|goitre)\b/i,
        slugs: ['endocrine-glands', 'mechanism-of-hormone-action', 'endocrine-disorders'],
      },
      {
        pattern: /\b(digest|alimentary|stomach|intestine|salivary|pepsin|trypsin|bile|absorption)\b/i,
        slugs: ['digestive-system', 'digestion-of-food'],
      },
    ];

    for (const group of groups) {
      if (group.pattern.test(normalized)) {
        return group.slugs.filter(slug => skeleton.topics.some(topic => topic.slug === slug));
      }
    }
  }

  const directMatch = resolveTopicSkeletonForText(normalized, chapterSlug);
  return directMatch ? [directMatch.slug] : [];
}

/** Find which chapter a topic belongs to (or null) */
export function findChapterForTopic(topicSlug: string): ChapterSkeleton | null {
  return ALL_CHAPTER_SKELETONS.find(s => s.topics.some(t => t.slug === topicSlug)) ?? null;
}

/** Resolve user text to matching chapter + topics using skeleton aliases */
export function resolveTopicsFromText(
  text: string,
  chapterSlug?: string
): { chapter: ChapterSkeleton; matchingTopics: TopicSkeletonEntry[] } | null {
  const normalized = normalizeSkeletonText(text);
  
  // If we know the chapter, find matching topics within it
  if (chapterSlug) {
    const skeleton = getChapterSkeleton(chapterSlug);
    if (!skeleton) return null;
    
    const matchingTopics = skeleton.topics.filter(t => {
      if (normalized.includes(t.slug.replace(/-/g, ' '))) return true;
      if (normalized.includes(t.displayName.toLowerCase())) return true;
      return t.aliases.some(a => normalized.includes(a.toLowerCase()));
    });
    
    return matchingTopics.length > 0 
      ? { chapter: skeleton, matchingTopics }
      : { chapter: skeleton, matchingTopics: skeleton.topics }; // Return all if no specific match
  }
  
  // Otherwise, search across all chapters
  for (const skeleton of ALL_CHAPTER_SKELETONS) {
    // Check chapter-level aliases (this is the main "circulatory system" → "human-physiology" case)
    // We don't have chapter aliases here — they're in the syllabus file. This function is for topic-level resolution.
    const matchingTopics = skeleton.topics.filter(t => {
      if (normalized.includes(t.slug.replace(/-/g, ' '))) return true;
      if (normalized.includes(t.displayName.toLowerCase())) return true;
      return t.aliases.some(a => normalized.includes(a.toLowerCase()));
    });
    
    if (matchingTopics.length >= 2) { // Need at least 2 topic matches to avoid false positives
      return { chapter: skeleton, matchingTopics };
    }
  }
  
  return null;
}

/**
 * Returns the count of topics per chapter for coverage reporting.
 */
export function getSkeletonCoverage(): { subject: string; chapterSlug: string; topicCount: number }[] {
  return ALL_CHAPTER_SKELETONS.map(s => ({
    subject: s.subject,
    chapterSlug: s.chapterSlug,
    topicCount: s.topics.length,
  }));
}

/**
 * Detect if a microtarget title is a placeholder (auto-generated garbage).
 * Matches patterns like:
 *   "Human Physiology Anatomical features 39"
 *   "Physics Laws of Motion Newton concepts 5"
 *   "What are the fundamental laws or mechanisms governing..."
 */
export function isPlaceholderTitle(title: string): boolean {
  // Pattern: "[Subject/Chapter] ... [Number]" at end
  if (/\b(features|concepts|principles|mechanisms|applications)\s+\d+\s*$/i.test(title)) return true;
  // Pattern: "Mastery Module N:"  with generic description
  if (/^Mastery Module \d+:.*and Related Concepts$/i.test(title)) return true;
  // Pattern: "Topic N of [slug]"
  if (/^Topic \d+ of .*/i.test(title)) return true;
  // Pattern: "Mastery Module: [slug]"
  if (/^Mastery Module: .*/i.test(title)) return true;
  return false;
}

export function isPlaceholderQuestion(question: string): boolean {
  if (/^What are the fundamental laws or mechanisms governing/i.test(question)) return true;
  if (/^Explain the key principles of.*\d+/i.test(question)) return true;
  if (/^Describe the core concepts of.*\d+/i.test(question)) return true;
  return false;
}
