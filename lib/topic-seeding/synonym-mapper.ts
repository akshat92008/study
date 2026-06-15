const RULES: Array<{ topic: string; patterns: RegExp[] }> = [
  // Physics
  { topic: 'Motion graphs', patterns: [/\bv\s*[- ]?\s*t\b/i, /\bvelocity\s*time\b/i, /\bx\s*[- ]?\s*t\b/i, /\bdisplacement\s*time\b/i, /\bposition\s*time\b/i, /\bgraph\b/i, /\bslope\b/i, /\barea under\b/i, /\bmotion graphs\b/i] },
  { topic: 'Sign convention mistakes', patterns: [/\bsign convention\b/i, /\bsign error\b/i, /\bnegative sign\b/i, /\bdirection error\b/i, /\bwrong sign\b/i] },
  { topic: 'Projectile motion', patterns: [/\bprojectile\b/i, /\brange\b/i, /\btime of flight\b/i, /\bmaximum height\b/i, /\btrajectory\b/i, /\bhorizontal component\b/i, /\bvertical component\b/i, /\bprojectile range\/time\/height\b/i] },
  { topic: 'Relative velocity', patterns: [/\brelative velocity\b/i, /\briver-boat\b/i, /\brain-man\b/i, /\brelative motion\b/i] },
  { topic: 'Newton’s laws/friction/free body diagram', patterns: [/\bnewton\b/i, /\bfriction\b/i, /\bfree body diagram\b/i, /\bfbd\b/i, /\btension\b/i, /\bnormal reaction\b/i] },
  { topic: 'Torque/angular momentum/rolling', patterns: [/\btorque\b/i, /\bangular momentum\b/i, /\brolling\b/i, /\bmoment of inertia\b/i, /\brotational\b/i] },
  { topic: 'Gauss law/electric potential/capacitors', patterns: [/\bgauss\b/i, /\belectric potential\b/i, /\bcapacitor\b/i, /\bcapacitance\b/i, /\bflux\b/i] },
  { topic: 'Kirchhoff/Wheatstone/potentiometer', patterns: [/\bkirchhoff\b/i, /\bwheatstone\b/i, /\bpotentiometer\b/i, /\bkvl\b/i, /\bkcl\b/i, /\bbridge\b/i] },
  { topic: 'Magnetic force/EMI/AC resonance', patterns: [/\bmagnetic force\b/i, /\bemi\b/i, /\belectromagnetic induction\b/i, /\bac resonance\b/i, /\blenz\b/i, /\blcr\b/i] },
  { topic: 'Ray optics/YDSE/photoelectric/Bohr/semiconductors', patterns: [/\bray optics\b/i, /\bydse\b/i, /\byoung's double slit\b/i, /\bphotoelectric\b/i, /\bbohr\b/i, /\bsemiconductor\b/i, /\bdiode\b/i, /\blogic gate\b/i] },

  // Chemistry
  { topic: 'Mole concept/limiting reagent', patterns: [/\bmole concept\b/i, /\blimiting reagent\b/i, /\bstoichiometry\b/i, /\bmolarity\b/i] },
  { topic: 'Quantum numbers/electronic configuration', patterns: [/\bquantum number\b/i, /\belectronic configuration\b/i, /\borbital\b/i, /\baufbau\b/i, /\bhund\b/i] },
  { topic: 'VSEPR/hybridisation/MOT', patterns: [/\bvsepr\b/i, /\bhybridisation\b/i, /\bhybridization\b/i, /\bsp3\b/i, /\bsp2\b/i, /\bmot\b/i, /\bmolecular orbital\b/i] },
  { topic: 'Thermodynamics signs', patterns: [/\bthermodynamics\b/i, /\benthalpy\b/i, /\bentropy\b/i, /\bgibbs\b/i, /\bsign convention\b/i, /\bexothermic\b/i, /\bendothermic\b/i] },
  { topic: 'Equilibrium/Kp/Kc/pH/buffer/Ksp', patterns: [/\bequilibrium\b/i, /\bkp\b/i, /\bkc\b/i, /\bph\b/i, /\bbuffer\b/i, /\bksp\b/i, /\ble chatelier\b/i] },
  { topic: 'Redox/electrochemistry/Nernst', patterns: [/\bredox\b/i, /\belectrochemistry\b/i, /\bnernst\b/i, /\boxidation state\b/i, /\banode\b/i, /\bcathode\b/i] },
  { topic: 'Periodic trends/p-block exceptions', patterns: [/\bperiodic trend\b/i, /\bp-block\b/i, /\bexception\b/i, /\bionization energy\b/i, /\belectron affinity\b/i, /\binert pair\b/i] },
  { topic: 'GOC effects/acidity/basicity', patterns: [/\bgoc\b/i, /\binductive\b/i, /\bresonance\b/i, /\bmesomeric\b/i, /\bacidity\b/i, /\bbasicity\b/i, /\bcarbocation\b/i] },
  { topic: 'SN1/SN2/E1/E2', patterns: [/\bsn1\b/i, /\bsn2\b/i, /\be1\b/i, /\be2\b/i, /\bnucleophilic substitution\b/i, /\belimination\b/i] },
  { topic: 'Named reactions/tests/conversions', patterns: [/\bnamed reaction\b/i, /\btollen\b/i, /\bfehling\b/i, /\biodoform\b/i, /\bconversion\b/i, /\baldol\b/i, /\bcannizzaro\b/i] },

  // Biology
  { topic: 'Taxonomy examples', patterns: [/\btaxonomy\b/i, /\bbiological classification\b/i, /\bexample\b/i, /\bphylum\b/i, /\bgenus\b/i] },
  { topic: 'Cell organelles', patterns: [/\bcell organelle\b/i, /\bmitochondria\b/i, /\bchloroplast\b/i, /\bribosome\b/i, /\blysosome\b/i] },
  { topic: 'Cell cycle/meiosis', patterns: [/\bcell cycle\b/i, /\bmeiosis\b/i, /\bmitosis\b/i, /\bprophase\b/i, /\bcrossing over\b/i] },
  { topic: 'Photosynthesis/respiration hormones', patterns: [/\bphotosynthesis\b/i, /\brespiration\b/i, /\bplant hormone\b/i, /\bauxin\b/i, /\bgibberellin\b/i, /\bcalvin cycle\b/i, /\bkrebs cycle\b/i] },
  { topic: 'Breathing volumes', patterns: [/\bbreathing volume\b/i, /\btidal volume\b/i, /\bvital capacity\b/i, /\bresidual volume\b/i] },
  { topic: 'Cardiac cycle/ECG', patterns: [/\bcardiac cycle\b/i, /\becg\b/i, /\bsystole\b/i, /\bdiastole\b/i, /\bp wave\b/i, /\bqrs\b/i] },
  { topic: 'Nephron/countercurrent', patterns: [/\bnephron\b/i, /\bcountercurrent\b/i, /\bloop of henle\b/i, /\bglomerulus\b/i] },
  { topic: 'Menstrual cycle/gametogenesis', patterns: [/\bmenstrual cycle\b/i, /\bgametogenesis\b/i, /\bspermatogenesis\b/i, /\boogenesis\b/i, /\bluteal\b/i, /\bovulation\b/i] },
  { topic: 'Inheritance pedigree/linkage', patterns: [/\binheritance\b/i, /\bpedigree\b/i, /\blinkage\b/i, /\bgenetics\b/i, /\bmendel\b/i, /\brecombination\b/i] },
  { topic: 'Transcription/translation/lac operon', patterns: [/\btranscription\b/i, /\btranslation\b/i, /\blac operon\b/i, /\bcentral dogma\b/i, /\brna polymerase\b/i] },
  { topic: 'Evolution/Hardy-Weinberg', patterns: [/\bevolution\b/i, /\bhardy-weinberg\b/i, /\bhardy weinberg\b/i, /\bnatural selection\b/i, /\bhomologous\b/i, /\banalogous\b/i] },
  { topic: 'Immunity/diseases', patterns: [/\bimmunity\b/i, /\bdisease\b/i, /\bantibody\b/i, /\bantigen\b/i, /\bvaccine\b/i, /\bpathogen\b/i] },
  { topic: 'Biotech tools/PCR/vectors', patterns: [/\bbiotech\b/i, /\bpcr\b/i, /\bvector\b/i, /\bplasmid\b/i, /\brestriction enzyme\b/i, /\brecombinant\b/i] },
  { topic: 'Ecology population interactions/ecological pyramids/succession', patterns: [/\becology\b/i, /\bpopulation interaction\b/i, /\becological pyramid\b/i, /\bsuccession\b/i, /\bmutualism\b/i, /\bpredation\b/i] },

  // Coding fallbacks
  { topic: 'JavaScript Basics', patterns: [/\bjavascript\b/i, /\bjs\b/i] },
  { topic: 'Python Basics', patterns: [/\bpython\b/i] },
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
