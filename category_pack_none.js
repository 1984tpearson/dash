/**
 * The "none" (generic default) service pack's category/CPG mapping data.
 *
 * Same CATEGORIES/CATEGORY_TO_CPG/COND_TO_CPG_KEY/CPG_SUBTYPE_LABELS as
 * category_pack_av.js, deliberately — this taxonomy (which medical
 * conditions exist, how they're grouped) is standard, industry-wide EMS
 * categorization, not a distinctive AV creative arrangement, so there's
 * no reason for the generic pack to offer a reduced condition list. See
 * CLAUDE.md's service-pack Gotchas entry for the three-tier IP reasoning
 * this is built on.
 *
 * What's NOT copied is the clinical content itself — cpg_pack_none.js
 * currently only has generic entries for a handful of these keys (the
 * original placeholder set); any condition selected here that doesn't
 * yet have a matching cpg_pack_none.js entry just falls back to the AI's
 * general clinical knowledge at generation time (buildCPGContext returns
 * empty for it) rather than injected CPG text — not broken, just less
 * tightly grounded until more generic entries get written.
 *
 * CATEGORIES         -- Quick Build / Custom Build condition picker (category > subcategory > condition names)
 * CATEGORY_TO_CPG     -- category|subcategory -> CPG package keys (drives AI prompt content injection + browse-tree rows)
 * COND_TO_CPG_KEY     -- condition display name -> CPG package key
 * CPG_SUBTYPE_LABELS  -- CPG package key -> display label (used where only the key is known)
 */

const CATEGORIES = [
  {key:'Adult',icon:'🧑',color:'var(--navy)',subcats:{'Cardiac Arrest':['Medical Cardiac Arrest','Traumatic Cardiac Arrest','ROSC Management','Withholding or Ceasing Resuscitation'],'Airway Management':['Essential Airway Management','Endotracheal Intubation (RSI)','Difficult Airway Guideline','Choking'],'Cardiac':['ACS / STEMI','Bradycardia','Narrow Complex Tachycardia (SVT/AF)','Broad Complex Tachycardia (VT)','Cardiogenic Pulmonary Oedema','Inadequate Perfusion (Cardiogenic)','STEMI Management','Hypertension'],'Pain Relief':['Pain Relief','Headache'],'Respiratory':['Asthma','COPD Exacerbation','Upper Airway Obstruction','Undifferentiated Dyspnoea','Pulmonary Embolism'],'Medical':['Seizures / Status Epilepticus','Hypoglycaemia','Hyperglycaemia / DKA / HHS','Suspected Stroke / TIA','Anaphylaxis','Shock','Hyperkalaemia','Adrenal Insufficiency / Crisis','Nausea and Vomiting','Syncope','Acute Behavioural Disturbance'],'Infection':['Sepsis','Meningococcal Septicaemia'],'Mental Health':['Mental Health Conditions'],'Palliative Care':['Palliative Care'],'Trauma':['Major Trauma','Traumatic Head Injury','Chest Injury','Spinal Injury','Burns','Fracture/dislocation','Elderly/Frail non injury-fall'],'Environment':['Hypothermia','Heat Stress / Heat Stroke'],'Toxicology':['Opioid Toxicity','Tricyclic Antidepressant (TCA) Overdose','Beta-Blocker Toxicity','Calcium Channel Blocker Toxicity','Organophosphate / Pesticide Toxicity','Drug-Induced Hyperthermia / Stimulant Toxidrome','Quetiapine (Antipsychotic) Toxicity','Cyanide Toxicity','Acute Alcohol Intoxication','Alcohol Withdrawal Syndrome']}},
  {key:'Paediatric',icon:'🧒',color:'var(--blue)',subcats:{'Cardiac Arrest':['Medical Cardiac Arrest','Traumatic Cardiac Arrest','ROSC Management','Withholding or Ceasing Resuscitation'],'Airway Management':['Essential Airway Management','Endotracheal Intubation (RSI)','Difficult Airway Guideline'],'Pain Relief':['Pain Relief'],'Respiratory':['Asthma','Croup','Upper Airway Obstruction'],'Medical':['Seizures / Status Epilepticus','Hypoglycaemia','Anaphylaxis','Hyperglycaemia / DKA / HHS'],'Infection':['Sepsis'],'Trauma':['Major Trauma','Traumatic Head Injury','Chest Injury','Burns'],'Environment':['Hypothermia','Heat Stress / Heat Stroke'],'Toxicology':['Opioid Toxicity','Tricyclic Antidepressant (TCA) Overdose','Acute Alcohol Intoxication','Organophosphate / Pesticide Toxicity','Drug-Induced Hyperthermia / Stimulant Toxidrome']}},
  {key:'Maternity',icon:'🤰',color:'var(--purple)',subcats:{'Antepartum Haemorrhage':['Antepartum Haemorrhage'],'Pre-eclampsia / Eclampsia':['Pre-eclampsia / Eclampsia'],'Normal Birth':['Normal Birth'],'Breech / Compound':['Breech / Compound Presentation'],'Preterm Labour':['Preterm Labour'],'Cord Prolapse':['Cord Prolapse'],'Shoulder Dystocia':['Shoulder Dystocia'],'Primary Postpartum Haemorrhage':['Primary Postpartum Haemorrhage'],'Miscarriage':['Miscarriage']}},
  {key:'Newborn',icon:'👶',color:'var(--green)',subcats:{'Newborn Resuscitation':['Newborn Resuscitation','Newborn Assessment']}},
  {key:'Treat and Refer',icon:'🩹',color:'#6D4C41',subcats:{'Treat and Refer':['Epistaxis','Minor Burns']}},
];

const CATEGORY_TO_CPG = {
  // Adult
  'Adult|Cardiac Arrest': ['cardiac_arrest_medical', 'cardiac_arrest_traumatic', 'rosc_management', 'withholding_resuscitation'],
  'Adult|Airway Management': ['essential_airway', 'endotracheal_intubation', 'difficult_airway', 'choking', 'foreign_body_airway_obstruction', 'choking_a0308'],
  'Adult|Cardiac': ['acs', 'bradycardia', 'tachycardia_narrow', 'tachycardia_broad', 'pulmonary_oedema', 'inadequate_perfusion_cardiogenic', 'stemi_management', 'hypertension'],
  'Adult|Pain Relief': ['pain_relief', 'headache'],
  'Adult|Respiratory': ['asthma', 'copd', 'upper_airway_obstruction', 'dyspnoea', 'pulmonary_embolism'],
  'Adult|Medical': ['seizures', 'hypoglycaemia', 'stroke', 'anaphylaxis', 'hyperkalaemia', 'hyperglycaemia', 'adrenal_insufficiency', 'nausea_vomiting', 'shock', 'acute_behavioural_disturbance'],
  'Adult|Infection': ['sepsis', 'meningococcal'],
  'Adult|Mental Health': ['mental_health_conditions'],
  'Adult|Palliative Care': ['palliative_care'],
  'Adult|Syncope': ['syncope'],
  'Adult|Trauma': ['major_trauma', 'head_injury', 'chest_injury', 'spinal_injury', 'burns', 'fracture_dislocation_a0806', 'elderly_frail_non_injury_fall'],
  'Adult|Environment': ['hypothermia', 'hyperthermia_environmental'],
  'Adult|Toxicology': ['opioid_toxicity', 'tca_toxicity', 'beta_blocker_toxicity', 'ccb_toxicity', 'organophosphate_toxicity', 'drug_induced_hyperthermia', 'quetiapine_toxicity', 'alcohol_intoxication', 'alcohol_withdrawal', 'cyanide_toxicity'],
  // Paediatric
  'Paediatric|Cardiac Arrest': ['cardiac_arrest_medical', 'cardiac_arrest_traumatic', 'rosc_management', 'withholding_resuscitation'],
  'Paediatric|Airway Management': ['essential_airway', 'endotracheal_intubation', 'difficult_airway'],
  'Paediatric|Pain Relief': ['pain_relief'],
  'Paediatric|Respiratory': ['asthma', 'croup', 'upper_airway_obstruction'],
  'Paediatric|Medical': ['seizures', 'hypoglycaemia', 'anaphylaxis', 'hyperglycaemia'],
  'Paediatric|Infection': ['sepsis'],
  'Paediatric|Trauma': ['major_trauma', 'head_injury', 'chest_injury', 'burns'],
  'Paediatric|Environment': ['hypothermia', 'hyperthermia_environmental'],
  'Paediatric|Toxicology': ['opioid_toxicity', 'tca_toxicity', 'alcohol_intoxication', 'organophosphate_toxicity', 'drug_induced_hyperthermia'],
  // Maternity
  'Maternity|Antepartum Haemorrhage': ['shock', 'maternity_patient'],
  'Maternity|Pre-eclampsia / Eclampsia': ['preeclampsia_eclampsia', 'seizures'],
  'Maternity|Normal Birth': ['normal_birth', 'maternity_patient', 'the_newborn'],
  'Maternity|Breech / Compound': ['breech_birth', 'maternity_patient', 'the_newborn'],
  'Maternity|Preterm Labour': ['maternity_patient', 'the_newborn'],
  'Maternity|Cord Prolapse': ['cord_prolapse', 'maternity_patient'],
  'Maternity|Shoulder Dystocia': ['shoulder_dystocia', 'maternity_patient'],
  'Maternity|Primary Postpartum Haemorrhage': ['shock', 'maternity_patient'],
  'Maternity|Miscarriage': ['maternity_patient'],
  // Other
  'Newborn|Newborn Resuscitation': ['newborn_resuscitation', 'the_newborn'],
  'Treat and Refer|Treat and Refer': ['burns', 'epistaxis'],
  'Treat and Refer|Epistaxis': ['epistaxis'],
  'Treat and Refer|Minor Burns': ['minor_burns'],
};

const COND_TO_CPG_KEY = {
  // Cardiac Arrest
  'Medical Cardiac Arrest':              'cardiac_arrest_medical',
  'Traumatic Cardiac Arrest':            'cardiac_arrest_traumatic',
  'ROSC Management':                     'rosc_management',
  'Withholding or Ceasing Resuscitation':'withholding_resuscitation',
  // Airway
  'Essential Airway Management':         'essential_airway',
  'Endotracheal Intubation (RSI)':       'endotracheal_intubation',
  'Difficult Airway Guideline':          'difficult_airway',
  'Upper Airway Obstruction':            'upper_airway_obstruction',
  // Cardiac
  'ACS / STEMI':                         'acs',
  'Bradycardia':                         'bradycardia',
  'Narrow Complex Tachycardia (SVT/AF)': 'tachycardia_narrow',
  'Broad Complex Tachycardia (VT)':      'tachycardia_broad',
  'Cardiogenic Pulmonary Oedema':        'pulmonary_oedema',
  'Inadequate Perfusion (Cardiogenic)':  'inadequate_perfusion_cardiogenic',
  'STEMI Management':                    'stemi_management',
  'Hypertension':                        'hypertension',
  // Pain
  'Pain Relief':                         'pain_relief',
  'Headache':                            'headache',
  // Respiratory
  'Asthma':                              'asthma',
  'COPD Exacerbation':                   'copd',
  'Undifferentiated Dyspnoea':           'dyspnoea',
  'Pulmonary Embolism':                  'pulmonary_embolism',
  'Croup':                               'croup',
  // Medical
  'Seizures / Status Epilepticus':       'seizures',
  'Hypoglycaemia':                       'hypoglycaemia',
  'Hyperglycaemia / DKA / HHS':          'hyperglycaemia',
  'Suspected Stroke / TIA':              'stroke',
  'Anaphylaxis':                         'anaphylaxis',
  'Shock':                               'shock',
  'Hyperkalaemia':                       'hyperkalaemia',
  'Adrenal Insufficiency / Crisis':      'adrenal_insufficiency',
  'Nausea and Vomiting':                 'nausea_vomiting',
  'Syncope':                             'syncope',
  'Acute Behavioural Disturbance':       'acute_behavioural_disturbance',
  // Infection
  'Sepsis':                              'sepsis',
  'Meningococcal Septicaemia':           'meningococcal',
  // Mental Health — Acute Behavioural Disturbance is deliberately listed
  // under Medical above, not here: it is a medical presentation with a
  // behavioural manifestation (hypoxia, sepsis, hypoglycaemia, head injury,
  // intoxication, delirium), and filing it under Mental Health invites
  // exactly the wrong assessment approach. The CPG's own title is what
  // misleads. This lookup is flat, so only the grouping moved.
  'Mental Health Conditions':            'mental_health_conditions',
  // Palliative
  'Palliative Care':                     'palliative_care',
  // Trauma
  'Major Trauma':                        'major_trauma',
  'Traumatic Head Injury':               'head_injury',
  'Chest Injury':                        'chest_injury',
  'Spinal Injury':                       'spinal_injury',
  'Burns':                               'burns',
  // Environment
  'Hypothermia':                         'hypothermia',
  'Heat Stress / Heat Stroke':           'hyperthermia_environmental',
  // Toxicology
  'Opioid Toxicity':                     'opioid_toxicity',
  'Tricyclic Antidepressant (TCA) Overdose': 'tca_toxicity',
  'Beta-Blocker Toxicity':               'beta_blocker_toxicity',
  'Calcium Channel Blocker Toxicity':    'ccb_toxicity',
  'Organophosphate / Pesticide Toxicity':'organophosphate_toxicity',
  'Drug-Induced Hyperthermia / Stimulant Toxidrome': 'drug_induced_hyperthermia',
  'Quetiapine (Antipsychotic) Toxicity': 'quetiapine_toxicity',
  'Acute Alcohol Intoxication':          'alcohol_intoxication',
  'Alcohol Withdrawal Syndrome':         'alcohol_withdrawal',
  'Cyanide Toxicity':                    'cyanide_toxicity',
  // Maternity
  'Antepartum Haemorrhage':              'maternity_patient',
  'Pre-eclampsia / Eclampsia':           'preeclampsia_eclampsia',
  'Normal Birth':                        'normal_birth',
  'Breech / Compound Presentation':      'breech_birth',
  'Preterm Labour':                      'maternity_patient',
  'Cord Prolapse':                       'cord_prolapse',
  'Shoulder Dystocia':                   'shoulder_dystocia',
  'Primary Postpartum Haemorrhage':      'maternity_patient',
  'Miscarriage':                         'maternity_patient',
  // Newborn
  'Newborn Resuscitation':               'newborn_resuscitation',
  'Newborn Assessment':                  'the_newborn',
  // Treat & Refer
  'Epistaxis':                           'epistaxis',
  'Minor Burns':                         'minor_burns',

  'Fracture/dislocation': 'fracture_dislocation_a0806',

  'Elderly/Frail non injury-fall': 'elderly_frail_non_injury_fall',



  'Choking': 'choking_a0308',
};

const CPG_SUBTYPE_LABELS = {
  // Cardiac Arrest / Resuscitation
  cardiac_arrest_medical:   'Medical Cardiac Arrest',
  cardiac_arrest_traumatic: 'Traumatic Cardiac Arrest',
  rosc_management:          'ROSC Management',
  withholding_resuscitation:'Withholding or Ceasing Resuscitation',
  // Airway
  essential_airway:         'Essential Airway Management',
  endotracheal_intubation:  'Endotracheal Intubation (RSI)',
  difficult_airway:         'Difficult Airway Guideline',
  // Toxicology
  opioid_toxicity:          'Opioid Toxicity',
  tca_toxicity:             'Tricyclic Antidepressant (TCA) Overdose',
  beta_blocker_toxicity:    'Beta-Blocker Toxicity',
  ccb_toxicity:             'Calcium Channel Blocker Toxicity',
  organophosphate_toxicity: 'Organophosphate / Pesticide Toxicity',
  drug_induced_hyperthermia:'Drug-Induced Hyperthermia / Stimulant Toxidrome',
  quetiapine_toxicity:      'Quetiapine (Antipsychotic) Toxicity',
  alcohol_intoxication:     'Acute Alcohol Intoxication',
  alcohol_withdrawal:       'Alcohol Withdrawal Syndrome',
  cyanide_toxicity:         'Cyanide Toxicity',
  // Cardiac
  acs:                          'ACS / STEMI',
  bradycardia:                  'Bradycardia',
  tachycardia_narrow:           'Narrow Complex Tachycardia (SVT/AF)',
  tachycardia_broad:            'Broad Complex Tachycardia (VT)',
  pulmonary_oedema:             'Cardiogenic Pulmonary Oedema',
  inadequate_perfusion_cardiogenic: 'Inadequate Perfusion (Cardiogenic)',
  stemi_management:             'STEMI Management',
  hypertension:                 'Hypertension',
  // Medical
  seizures:                 'Seizures / Status Epilepticus',
  hypoglycaemia:            'Hypoglycaemia',
  stroke:                   'Suspected Stroke / TIA',
  anaphylaxis:              'Anaphylaxis',
  hyperkalaemia:            'Hyperkalaemia',
  adrenal_insufficiency:    'Adrenal Insufficiency / Crisis',
  hyperglycaemia:           'Hyperglycaemia / DKA / HHS',
  headache:                 'Headache',
  nausea_vomiting:          'Nausea and Vomiting',
  // Respiratory
  asthma:                   'Asthma',
  copd:                     'COPD Exacerbation',
  upper_airway_obstruction: 'Upper Airway Obstruction',
  croup:                    'Croup',
  dyspnoea:                 'Undifferentiated Dyspnoea',
  pulmonary_embolism:       'Pulmonary Embolism',
  // Mental Health
  acute_behavioural_disturbance: 'Acute Behavioural Disturbance',
  mental_health_conditions: 'Mental Health Conditions',
  // Trauma
  major_trauma:             'Major Trauma',
  head_injury:              'Traumatic Head Injury',
  chest_injury:             'Chest Injury',
  spinal_injury:            'Spinal Injury',
  burns:                    'Burns',
  minor_burns:              'Minor Burns',
  fracture_dislocation_a0806: 'Fracture/dislocation',
  shock:                    'Shock',
  // Environment
  hypothermia:              'Hypothermia',
  hyperthermia_environmental: 'Heat Stress / Heat Stroke',
  // Maternity
  maternity_patient:        'General Maternity Assessment',
  preeclampsia_eclampsia:   'Pre-eclampsia / Eclampsia',
  normal_birth:             'Normal Birth',
  breech_birth:             'Breech / Compound Presentation',
  cord_prolapse:            'Cord Prolapse',
  shoulder_dystocia:        'Shoulder Dystocia',
  // Newborn
  newborn_resuscitation:    'Newborn Resuscitation',
  the_newborn:              'Newborn Assessment',
  // Infection
  sepsis:                   'Sepsis',
  meningococcal:            'Meningococcal Septicaemia',
  // Palliative / Syncope
  palliative_care:          'Palliative Care',
  syncope:                  'Syncope',
  epistaxis:                'Epistaxis (Treat and Refer)',

  elderly_frail_non_injury_fall: 'Elderly/Frail non injury-fall',

  choking: 'Choking',

  choking_a0308: 'Choking',

  foreign_body_airway_obstruction: 'Choking',
};
