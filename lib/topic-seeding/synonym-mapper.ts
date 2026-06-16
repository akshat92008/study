const RULES: Array<{ topic: string; patterns: RegExp[] }> = [
  // Physics
  { topic: 'velocity-time graph area', patterns: [/\bgraph area\b/i, /\barea under\b/i, /\bv-t area\b/i, /\bvelocity-time area\b/i, /\barea of vt graph\b/i] },
  { topic: 'x-t/v-t graph slope', patterns: [/\bslope in graph\b/i, /\bgraph slope\b/i, /\bv-t slope\b/i, /\bx-t slope\b/i, /\bposition-time slope\b/i] },
  { topic: 'equations of motion', patterns: [/\bequations of motion\b/i, /\bkinematic equations\b/i, /\bv\s*=\s*u\s*\+\s*at\b/i] },
  { topic: 'projectile motion trajectory', patterns: [/\bprojectile\b/i, /\btrajectory\b/i, /\bparabola\b/i] },
  { topic: 'projectile range/time/height', patterns: [/\brange\b/i, /\btime of flight\b/i, /\bmaximum height\b/i] },
  { topic: 'relative velocity in 2D', patterns: [/\brelative velocity in 2d\b/i, /\briver-boat\b/i, /\brain-man\b/i, /\briver boat\b/i, /\brain man\b/i] },
  { topic: 'free body diagram/Newton laws', patterns: [/\bnewton\b/i, /\bfriction\b/i, /\bfree body diagram\b/i, /\bfbd\b/i, /\btension\b/i, /\bnormal reaction\b/i] },
  { topic: 'moment of inertia/torque', patterns: [/\btorque\b/i, /\bangular momentum\b/i, /\brolling\b/i, /\bmoment of inertia\b/i, /\brotational\b/i] },
  { topic: 'Gauss law applications', patterns: [/\bgauss\b/i, /\belectric flux\b/i] },
  { topic: 'electric potential and capacitance', patterns: [/\belectric potential\b/i, /\bcapacitor\b/i, /\bcapacitance\b/i] },
  { topic: 'Kirchhoff/Wheatstone', patterns: [/\bkirchhoff\b/i, /\bwheatstone\b/i, /\bpotentiometer\b/i, /\bkvl\b/i, /\bkcl\b/i, /\bbridge\b/i] },
  { topic: 'magnetic force on moving charge', patterns: [/\bmagnetic force\b/i, /\blorentz\b/i, /\bmoving charge\b/i] },
  { topic: 'electromagnetic induction (Lenz law)', patterns: [/\bemi\b/i, /\belectromagnetic induction\b/i, /\blenz\b/i, /\bfaraday\b/i] },
  { topic: 'AC resonance/LCR', patterns: [/\bac resonance\b/i, /\blcr\b/i, /\bquality factor\b/i, /\bimpedance\b/i] },
  { topic: 'Young\'s double slit experiment', patterns: [/\bydse\b/i, /\byoung's double slit\b/i, /\bfringe width\b/i, /\binterference\b/i] },
  { topic: 'photoelectric effect', patterns: [/\bphotoelectric\b/i, /\bwork function\b/i, /\bstopping potential\b/i] },
  { topic: 'Bohr model/hydrogen spectrum', patterns: [/\bbohr\b/i, /\brydberg\b/i, /\bhydrogen spectrum\b/i] },
  { topic: 'semiconductor diode/logic gates', patterns: [/\bsemiconductor\b/i, /\bdiode\b/i, /\blogic gate\b/i, /\bp-n junction\b/i] },

  // Chemistry
  { topic: 'limiting reagent', patterns: [/\blimiting reagent\b/i, /\bstoichiometry\b/i] },
  { topic: 'quantum numbers/electronic configuration', patterns: [/\bquantum number\b/i, /\belectronic configuration\b/i, /\borbital\b/i, /\baufbau\b/i, /\bhund\b/i] },
  { topic: 'VSEPR/hybridisation', patterns: [/\bvsepr\b/i, /\bhybridisation\b/i, /\bhybridization\b/i, /\bsp3\b/i, /\bsp2\b/i] },
  { topic: 'molecular orbital theory', patterns: [/\bmot\b/i, /\bmolecular orbital\b/i, /\bbond order\b/i] },
  { topic: 'thermodynamics signs/Gibbs free energy', patterns: [/\bthermodynamics\b/i, /\benthalpy\b/i, /\bentropy\b/i, /\bgibbs\b/i, /\bsign convention\b/i, /\bexothermic\b/i, /\bendothermic\b/i] },
  { topic: 'solubility product', patterns: [/\bksp\b/i, /\bsolubility product\b/i, /\bcommon ion\b/i] },
  { topic: 'Henderson-Hasselbalch/buffer action', patterns: [/\bbuffer ph\b/i, /\bhenderson\b/i, /\bhasselbalch\b/i, /\bbuffer action\b/i] },
  { topic: 'Le Chatelier principle', patterns: [/\ble chatelier\b/i, /\bequilibrium shift\b/i] },
  { topic: 'Nernst equation/electrochemistry', patterns: [/\bnernst\b/i, /\belectrochemistry\b/i, /\bcell potential\b/i] },
  { topic: 'periodic trends/p-block exceptions', patterns: [/\bperiodic trend\b/i, /\bp-block\b/i, /\bexception\b/i, /\bionization energy\b/i, /\belectron affinity\b/i, /\binert pair\b/i] },
  { topic: 'hyperconjugation and acidity', patterns: [/\bhyperconjugation\b/i, /\bacidity\b/i, /\bgoc\b/i, /\binductive\b/i, /\bresonance\b/i, /\bmesomeric\b/i, /\bbasicity\b/i] },
  { topic: 'SN1 mechanism', patterns: [/\bsn1\b/i, /\bcarbocation intermediate\b/i, /\bracemization\b/i] },
  { topic: 'SN2 mechanism', patterns: [/\bsn2\b/i, /\bsn2 backside\b/i, /\bbackside attack\b/i, /\binversion\b/i, /\bwalden\b/i] },
  { topic: 'anti-Markovnikov addition', patterns: [/\bperoxide effect\b/i, /\banti-markovnikov\b/i, /\banti markovnikov\b/i, /\bkharasch\b/i] },
  { topic: 'Markovnikov addition', patterns: [/\bmarkovnikov\b/i, /\belectrophilic addition\b/i] },
  { topic: 'named reactions/tests', patterns: [/\bnamed reaction\b/i, /\btollen\b/i, /\bfehling\b/i, /\biodoform\b/i, /\baldol\b/i, /\bcannizzaro\b/i, /\bhofmann\b/i] },

  // Biology
  { topic: 'taxonomy examples/classification', patterns: [/\btaxonomy\b/i, /\bbiological classification\b/i, /\bexample\b/i, /\bphylum\b/i, /\bgenus\b/i] },
  { topic: 'cell organelles', patterns: [/\bcell organelle\b/i, /\bmitochondria\b/i, /\bchloroplast\b/i, /\bribosome\b/i, /\blysosome\b/i] },
  { topic: 'cell cycle/meiosis', patterns: [/\bcell cycle\b/i, /\bmeiosis\b/i, /\bmitosis\b/i, /\bprophase\b/i, /\bcrossing over\b/i] },
  { topic: 'photosynthesis/Calvin cycle', patterns: [/\bphotosynthesis\b/i, /\bcalvin cycle\b/i, /\bc3\b/i, /\bc4\b/i] },
  { topic: 'respiration/Krebs cycle', patterns: [/\brespiration\b/i, /\bkrebs cycle\b/i, /\bglycolysis\b/i, /\bets\b/i] },
  { topic: 'plant hormones', patterns: [/\bplant hormone\b/i, /\bauxin\b/i, /\bgibberellin\b/i, /\bcytokinin\b/i, /\bethylene\b/i, /\baba\b/i] },
  { topic: 'breathing volumes', patterns: [/\bbreathing volume\b/i, /\btidal volume\b/i, /\bvital capacity\b/i, /\bresidual volume\b/i] },
  { topic: 'oxygen dissociation curve', patterns: [/\boxygen curve\b/i, /\boxygen dissociation\b/i, /\bbohr effect\b/i, /\bhaldaene\b/i] },
  { topic: 'cardiac cycle/ECG', patterns: [/\bcardiac cycle\b/i, /\becg\b/i, /\bsystole\b/i, /\bdiastole\b/i, /\bp wave\b/i, /\bqrs\b/i] },
  { topic: 'nephron counter-current mechanism', patterns: [/\bcounter current\b/i, /\bcounter-current\b/i, /\bnephron\b/i, /\bloop of henle\b/i, /\bvasa recta\b/i] },
  { topic: 'menstrual cycle/gametogenesis', patterns: [/\bmenstrual cycle\b/i, /\bgametogenesis\b/i, /\bspermatogenesis\b/i, /\boogenesis\b/i, /\bluteal\b/i, /\bovulation\b/i] },
  { topic: 'Mendelian inheritance/pedigree', patterns: [/\binheritance\b/i, /\bpedigree\b/i, /\bmendel\b/i] },
  { topic: 'genetic linkage and recombination', patterns: [/\blinkage\b/i, /\brecombination\b/i, /\bmorgan\b/i] },
  { topic: 'transcription and translation', patterns: [/\btranscription\b/i, /\btranslation\b/i, /\bcentral dogma\b/i, /\brna polymerase\b/i] },
  { topic: 'gene regulation', patterns: [/\blac operon\b/i, /\boperon\b/i, /\bgene regulation\b/i] },
  { topic: 'allele frequency equilibrium', patterns: [/\bhardy weinberg\b/i, /\bhardy-weinberg\b/i, /\ballele frequency\b/i] },
  { topic: 'evolution/natural selection', patterns: [/\bevolution\b/i, /\bnatural selection\b/i, /\bhomologous\b/i, /\banalogous\b/i] },
  { topic: 'immunity/antibodies', patterns: [/\bimmunity\b/i, /\bantibody\b/i, /\bantigen\b/i, /\bvaccine\b/i, /\bpathogen\b/i] },
  { topic: 'amplification cycle', patterns: [/\bpcr\b/i, /\bamplification\b/i, /\bpolymerase chain reaction\b/i] },
  { topic: 'biotech restriction enzymes/vectors', patterns: [/\brestriction enzyme\b/i, /\bvector\b/i, /\bplasmid\b/i, /\brecombinant\b/i] },
  { topic: 'ecological pyramids/succession', patterns: [/\becological pyramid\b/i, /\bsuccession\b/i, /\becology\b/i] },

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
