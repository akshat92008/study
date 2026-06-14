import type { DetailedMicrotarget, SeedTemplate, SeedTemplateTopic } from '../types';

function mt(
  title: string,
  conceptTags: string[],
  ncertFacts: string[],
  activeRecallQuestions: string[],
  commonTraps: string[] = [],
  masteryCriteria: string[] = [],
  estimatedMinutes = 15,
  difficulty: DetailedMicrotarget['difficulty'] = 'medium'
): DetailedMicrotarget {
  return {
    title,
    conceptTags,
    ncertFacts,
    activeRecallQuestions,
    commonTraps: commonTraps.length ? commonTraps : [`Do not confuse ${title.toLowerCase()} with a related process.`],
    masteryCriteria: masteryCriteria.length ? masteryCriteria : [`Can explain ${title.toLowerCase()} in one NCERT-accurate answer.`],
    estimatedMinutes,
    difficulty,
  };
}

function group(orderIndex: number, topic: string, microtargets: DetailedMicrotarget[]): SeedTemplateTopic {
  return {
    orderIndex,
    topic,
    microtarget: microtargets.map((item) => item.title).join(' | '),
    tags: Array.from(new Set(microtargets.flatMap((item) => item.conceptTags))),
    difficulty: microtargets.some((item) => item.difficulty === 'hard') ? 'hard' : 'medium',
    microtargets,
  };
}

const basics = [
  mt('Define biotechnology as per NCERT', ['biotechnology'], ['Biotechnology applies organisms, cells, or enzymes to make useful products and processes.'], ['How does NCERT define biotechnology?'], [], [], 10, 'easy'),
  mt('Genetic engineering and sterile ambience', ['genetic_engineering', 'sterile_ambience'], ['Modern biotechnology rests on genetic engineering and maintenance of sterile ambience in chemical engineering processes.'], ['What two core techniques enabled modern biotechnology?']),
  mt('Purpose of recombinant DNA technology', ['recombinant_dna'], ['Recombinant DNA technology combines DNA from different sources and introduces it into a host.'], ['What is the purpose of recombinant DNA technology?']),
  mt('Cohen and Boyer experiment', ['cohen_boyer', 'antibiotic_resistance', 'plasmid'], ['Stanley Cohen and Herbert Boyer linked an antibiotic resistance gene with a Salmonella typhimurium plasmid to construct recombinant DNA.'], ['What was the contribution of Stanley Cohen and Herbert Boyer?'], ['Forgetting the antibiotic resistance gene or plasmid.']),
];

const tools = [
  mt('Restriction enzymes', ['restriction_enzyme'], ['Restriction endonucleases cut DNA at specific recognition sequences.'], ['What is a restriction enzyme?'], ['Saying restriction enzymes cut DNA randomly.'], [], 15, 'easy'),
  mt('Exonuclease versus endonuclease', ['exonuclease', 'endonuclease'], ['Exonucleases remove nucleotides from DNA ends; endonucleases cut within DNA.'], ['How do exonucleases differ from endonucleases?'], ['Reversing ends and internal sites.'], [], 10, 'easy'),
  mt('Recognition sequence', ['recognition_sequence'], ['A recognition sequence is the specific DNA sequence recognized by a restriction enzyme.'], ['What is a restriction-enzyme recognition sequence?']),
  mt('Palindromic DNA', ['palindromic_dna'], ["A DNA palindrome reads the same on both strands in the 5' to 3' direction."], ['What is a palindromic DNA sequence?'], ['Reading only one strand in both directions.']),
  mt('Sticky ends', ['sticky_ends'], ['Staggered restriction cuts create complementary single-stranded overhangs called sticky ends.'], ['Why do sticky ends help recombinant DNA formation?'], ['Forgetting complementary hydrogen bonding.']),
  mt('DNA ligase', ['dna_ligase'], ['DNA ligase joins DNA fragments and seals the phosphodiester backbone.'], ['What is the role of DNA ligase?'], ['Confusing ligase with a restriction enzyme.'], [], 10, 'easy'),
  mt('Cloning vectors', ['cloning_vector', 'plasmid'], ['A cloning vector carries foreign DNA into a host; plasmids and bacteriophages are examples.'], ['What is a cloning vector?']),
  mt('Role of ori', ['ori', 'copy_number'], ['ori is the origin of replication and controls the copy number of linked DNA.'], ['What is the role of ori?'], ['Saying ori only starts replication without mentioning copy number.']),
  mt('Selectable marker', ['selectable_marker', 'transformants'], ['Selectable markers identify transformants and eliminate non-transformants; antibiotic resistance genes are common examples.'], ['Why is a selectable marker needed?'], ['Confusing transformants and recombinants.']),
  mt('Cloning site', ['cloning_site'], ['A cloning site is a preferably unique restriction site where foreign DNA is inserted.'], ['Why should a vector have a suitable cloning site?']),
  mt('Insertional inactivation', ['insertional_inactivation', 'recombinants'], ['Foreign DNA inserted into a marker gene inactivates it and helps identify recombinants.'], ['What is insertional inactivation?'], ['Calling every transformant a recombinant.']),
];

const pcrAndGel = [
  mt('PCR denaturation', ['pcr', 'denaturation'], ['Denaturation separates template DNA strands at high temperature.'], ['What happens during PCR denaturation?']),
  mt('PCR annealing', ['pcr', 'annealing'], ['During annealing, primers bind complementary target sequences.'], ['What happens during PCR annealing?']),
  mt('PCR extension', ['pcr', 'extension'], ['During extension, DNA polymerase extends primers to synthesize new DNA.'], ['What happens during PCR extension?']),
  mt('Taq polymerase', ['taq_polymerase', 'thermostable'], ['Taq polymerase is thermostable, survives denaturation temperatures, and extends primers.'], ['Why is Taq polymerase used in PCR?'], ['Saying only that Taq is fast.']),
  mt('DNA amplification', ['pcr', 'amplification'], ['Repeated PCR cycles exponentially amplify the target DNA segment.'], ['How does PCR amplify DNA?']),
  mt('Agarose gel electrophoresis', ['agarose_gel', 'gel_electrophoresis'], ['Agarose gel separates DNA fragments mainly according to size.'], ['What does agarose gel electrophoresis separate?']),
  mt('DNA movement towards anode', ['anode', 'dna_charge'], ['DNA is negatively charged due to its phosphate backbone and moves towards the positive electrode, the anode.'], ['Why does DNA move towards the anode?'], ['Calling DNA positive or the anode negative.']),
  mt('Ethidium bromide and UV visualization', ['ethidium_bromide', 'uv_visualization'], ['Ethidium bromide-stained DNA bands are visible under UV light.'], ['How are DNA bands visualized after electrophoresis?']),
  mt('Elution', ['elution'], ['Elution is cutting the desired DNA band from the gel and extracting the DNA fragment.'], ['What is elution?'], ['Calling DNA migration itself elution.']),
];

const hosts = [
  mt('Competent host', ['competent_host'], ['A competent host can take up recombinant DNA.'], ['What does competent host mean?']),
  mt('Calcium ion treatment', ['calcium_ions', 'competence'], ['Divalent calcium ions increase bacterial cell permeability to DNA.'], ['Why are calcium ions used during transformation?']),
  mt('Heat shock', ['heat_shock', 'transformation'], ['Brief heat shock helps recombinant DNA enter competent bacterial cells.'], ['What is the role of heat shock?']),
  mt('Microinjection', ['microinjection'], ['Microinjection delivers recombinant DNA directly into an animal-cell nucleus.'], ['How does microinjection transfer DNA?']),
  mt('Biolistics or gene gun', ['biolistics', 'gene_gun'], ['Biolistics bombards cells with DNA-coated particles and is useful for plant cells.'], ['How does a gene gun transfer DNA?']),
  mt('Disarmed pathogen vectors', ['disarmed_pathogen_vector'], ['Disarmed pathogens transfer recombinant DNA without causing disease.'], ['Why are pathogen vectors disarmed?']),
];

const production = [
  mt('Large-scale production', ['large_scale_production'], ['Bioreactors enable large-scale growth and product formation under controlled conditions.'], ['Why are bioreactors needed for large-scale production?']),
  mt('Stirred-tank bioreactor', ['stirred_tank_bioreactor', 'agitator'], ['A stirred-tank bioreactor uses an agitator for mixing.'], ['What is the role of the agitator system?']),
  mt('Sparged stirred-tank bioreactor', ['sparged_bioreactor', 'oxygen_delivery'], ['A sparged stirred-tank bioreactor bubbles sterile air to improve oxygen delivery.'], ['How does a sparged bioreactor improve oxygen delivery?']),
  mt('Foam, temperature, and pH control', ['foam_control', 'temperature_control', 'ph_control'], ['Bioreactors monitor and control foam, temperature, pH, mixing, and oxygen.'], ['Which conditions must a bioreactor control?']),
  mt('Downstream processing', ['downstream_processing', 'separation', 'purification'], ['Downstream processing includes separation and purification of the product.'], ['What does downstream processing include?'], ['Including fermentation itself as downstream processing.']),
  mt('Quality control, clinical trials, and patents', ['quality_control', 'clinical_trials', 'patent'], ['Products undergo quality control and, where required, clinical trials before marketing; patents protect inventions.'], ['What follows separation and purification before a biotechnology product reaches users?']),
];

const applications = [
  mt('Genetically modified organisms', ['gmo'], ['Genetically modified organisms carry altered genetic material for a desired trait.'], ['What is a genetically modified organism?']),
  mt('Bt cotton and cry genes', ['bt_cotton', 'cry_genes'], ['Bt cotton carries cry genes from Bacillus thuringiensis for insect resistance.'], ['What makes Bt cotton insect resistant?']),
  mt('Inactive protoxin and alkaline gut activation', ['inactive_protoxin', 'alkaline_insect_gut', 'bt_toxin'], ['Bt toxin is produced as an inactive protoxin.', 'Alkaline insect-gut pH activates it; the toxin binds epithelial cells, forms pores, and causes lysis.'], ['Why is Bt toxin inactive inside Bacillus?', 'How does Bt toxin become active in the insect gut?'], ['Saying acidic pH activates Bt toxin.'], [], 20, 'hard'),
  mt('RNA interference', ['rna_interference', 'gene_silencing'], ['RNA interference is gene silencing in which complementary double-stranded RNA prevents expression of specific mRNA.'], ['What is RNA interference?']),
  mt('Meloidogyne incognita', ['meloidogyne_incognita', 'rna_interference'], ['RNAi was used to protect tobacco against the nematode Meloidogyne incognita.'], ['Which nematode is controlled by RNAi in tobacco?']),
  mt('Gene therapy for ADA deficiency', ['gene_therapy', 'ada_deficiency'], ['Patient lymphocytes receive functional ADA cDNA and require periodic infusion unless long-lived bone marrow cells are corrected early.'], ['How is ADA deficiency treated using gene therapy?'], ['Claiming one lymphocyte infusion is permanently curative.'], [], 20, 'hard'),
  mt('ELISA and molecular diagnosis', ['elisa', 'antigen_antibody', 'molecular_diagnosis'], ['ELISA is based on antigen-antibody interaction.', 'PCR and molecular probes support early molecular diagnosis.'], ['What is ELISA based on?', 'How does molecular diagnosis support early detection?'], ['Confusing ELISA with DNA amplification.']),
];

export const NEET_BIOLOGY_BIOTECHNOLOGY_TEMPLATE: SeedTemplate = {
  templateKey: 'neet-biology-biotechnology',
  subject: 'Biology',
  chapter: 'Biotechnology',
  displayName: 'Biotechnology',
  aliases: ['biotechnology', 'biotech', 'rdna', 'recombinant dna', 'genetic engineering', 'bt cotton', 'pcr', 'cloning vector', 'plasmid', 'biotechnology principles', 'biotechnology applications', 'biotech ncert'],
  topics: [
    group(1, 'Biotechnology Basics', basics),
    group(2, 'Tools of Recombinant DNA Technology', tools),
    group(3, 'PCR and Gel Electrophoresis', pcrAndGel),
    group(4, 'Competent Host and Gene Transfer', hosts),
    group(5, 'Bioreactors and Downstream Processing', production),
    group(6, 'Biotechnology Applications', applications),
  ],
};
