/**
 * dash — Generic Default Category / CPG mapping data (PLACEHOLDER)
 *
 * Companion to cpg_pack_none.js — same shape as category_pack_av.js
 * (CATEGORIES / CATEGORY_TO_CPG / COND_TO_CPG_KEY / CPG_SUBTYPE_LABELS)
 * but covering only the six generic conditions cpg_pack_none.js defines.
 * These two files are always loaded together as one atomic pack by
 * cpg_pack_loader.js — never load one without the other, since
 * CATEGORY_TO_CPG / COND_TO_CPG_KEY entries reference CPG_PACKAGES keys
 * that must actually exist in whichever cpg_pack_*.js is active.
 *
 * PLACEHOLDER — deliberately minimal (one category, six conditions), see
 * cpg_pack_none.js's own header for why.
 */

const CATEGORIES = [
  {key:'General',icon:'🩺',color:'var(--navy)',subcats:{
    'Cardiac Arrest':['Medical Cardiac Arrest'],
    'Cardiac':['Chest Pain / Suspected ACS'],
    'Respiratory':['Asthma'],
    'Medical':['Anaphylaxis','Hypoglycaemia','Seizures / Status Epilepticus'],
    'Trauma':['Major Trauma']
  }},
];

const CATEGORY_TO_CPG = {
  'General|Cardiac Arrest': ['cardiac_arrest_medical'],
  'General|Cardiac': ['acs'],
  'General|Respiratory': ['asthma'],
  'General|Medical': ['anaphylaxis', 'hypoglycaemia', 'seizures'],
  'General|Trauma': ['major_trauma'],
};

const COND_TO_CPG_KEY = {
  'Medical Cardiac Arrest':        'cardiac_arrest_medical',
  'Chest Pain / Suspected ACS':    'acs',
  'Asthma':                        'asthma',
  'Anaphylaxis':                   'anaphylaxis',
  'Hypoglycaemia':                 'hypoglycaemia',
  'Seizures / Status Epilepticus': 'seizures',
  'Major Trauma':                  'major_trauma',
};

const CPG_SUBTYPE_LABELS = {
  cardiac_arrest_medical: 'Medical Cardiac Arrest',
  acs:                    'Chest Pain / Suspected ACS',
  asthma:                 'Asthma',
  anaphylaxis:            'Anaphylaxis',
  hypoglycaemia:          'Hypoglycaemia',
  seizures:               'Seizures / Status Epilepticus',
  major_trauma:           'Major Trauma',
};
