/* sim_config_schema.js
 * Shared schema + defaults for the sim-tuning admin editor (sim_config_admin.html).
 * Loaded as a plain global (window.SimConfigSchema), same convention as
 * sim_engine.js/avatar_assets.js/nav.js — no bundler, no ES modules anywhere
 * in this repo. Also loaded by sim_control.html/sim_patient.html, which use
 * ONLY the `default` value of each field (never the metadata) to seed their
 * own local state before merging in whatever was actually saved to the
 * `sim_config` Supabase table.
 *
 * sim_engine.js does NOT load this file (see its own _cfg block) — it keeps
 * its literal defaults inline so it stays self-sufficient if this file fails
 * to load. The defaults for engine-owned fields below (medications.
 * ACTION_DURATIONS, medications.HIGH_RISK_CONDITION_KEYWORDS, medications.
 * MOOD_MAP, severity.*, defib.ENERGY_FACTOR_TABLE) are kept in sync with
 * sim_engine.js's _cfg defaults BY HAND — if you change one, change the
 * other. There is no automated check for this (no build step in this repo).
 *
 * Field shape: { type, default, label, help?, columns? (for type:'table'),
 * validate?(value, sectionData, ctx) -> string|null, readonly?, derivedFrom? }
 *
 * Field types:
 *   number        - scalar
 *   string        - scalar
 *   string_list   - string[]
 *   number_list   - number[] (order is meaningful — do not auto-sort)
 *   map_str_str   - {k: string}
 *   map_str_num   - {k: number}
 *   table         - object[], shape described by `columns`
 *   color_list    - string[] of hex colors
 *   map_str_list  - {k: string[]}
 *   nested_durations - the exact SimEngine.ACTION_DURATIONS shape (a few
 *                   plain-number keys, two conditional {a,b} sub-objects) —
 *                   bespoke renderer in sim_config_admin.html, not a generic
 *                   table, since it's the one field with a genuinely
 *                   irregular per-key shape.
 *
 * Table columns may use `number_range` ([number,number] pair) as a column
 * type, so the stored/edited value for a range field (e.g. CODED_EFFECT_
 * ACTIONS' delta/onsetMin/wearOffMin) matches its runtime array shape
 * exactly — no separate converter needed between admin-edited rows and what
 * sim_control.html actually reads.
 */
(function (global) {
  'use strict';

  function subsetValidate(subsetOfSection, subsetOfField) {
    return function (value, sectionData, ctx) {
      const pool = (ctx && ctx.allSections && ctx.allSections[subsetOfSection] && ctx.allSections[subsetOfSection][subsetOfField])
        || (sectionData && sectionData[subsetOfField]);
      if (!Array.isArray(pool)) return null; // pool not loaded yet — skip, don't block
      const bad = (value || []).filter(v => !pool.includes(v));
      return bad.length ? `Not in ${subsetOfField}: ${bad.join(', ')}` : null;
    };
  }

  function assetKeyValidate(assetGroup) {
    return function (value, sectionData, ctx) {
      const assets = ctx && ctx.AvatarAssets && ctx.AvatarAssets[assetGroup];
      if (!assets) return null; // avatar_assets.js not loaded in this context — skip, don't block
      const validKeys = Object.keys(assets);
      const bad = Object.entries(value || {}).filter(([, v]) => v && !validKeys.includes(v));
      return bad.length ? `Unknown ${assetGroup} key(s): ${bad.map(([k, v]) => `${k}=${v}`).join(', ')}` : null;
    };
  }

  // AI prompt fields interpolate runtime data via {{token}} markers (see the
  // prompts section below) — deleting one doesn't error at call time, it
  // just silently drops that information from what the AI sees, so this is
  // a save-time guard rather than something the runtime itself can catch.
  function requirePlaceholders(tokens) {
    return function (value) {
      const missing = tokens.filter(t => typeof value !== 'string' || !value.includes(t));
      return missing.length ? `Missing required placeholder(s): ${missing.join(', ')}` : null;
    };
  }

  global.SimConfigSchema = {
    sections: {

      medications: {
        label: 'Medications & Treatment Response',
        owner: 'sim_engine.js + sim_control.html',
        fields: {
          ACTION_DURATIONS: {
            type: 'nested_durations',
            label: 'Assessment reveal durations (seconds)',
            help: 'Seconds each assessment action takes before its value/waveform reveals. ecg12lead and bp are conditional (two possible durations depending on context) — the other keys are a plain number.',
            conditionalKeys: {
              ecg12lead: { aLabel: 'withMonitoring (faster — leads already on)', bLabel: 'fromScratch' },
              bp: { aLabel: 'firstApplication (cuff not yet on)', bLabel: 'subsequent' }
            },
            default: {
              ecg: 20,
              ecg12lead: { withMonitoring: 35, fromScratch: 50 },
              rr: 30,
              spo2: 12,
              etco2: 15,
              bp: { firstApplication: 55, subsequent: 35 },
              temp: 8,
              gcs: 5,
              bgl: 15,
              ketones: 15,
              pain: 3,
              pulse: 10
            }
          },
          NO_EFFECT_ACTIONS: {
            type: 'table',
            label: 'No-effect medication catalogue',
            help: 'Drugs/interventions with a deliberately fixed "no modelled vitals effect" outcome — the Haiku router matches free text against this list before falling back to full Sonnet reasoning.',
            columns: [
              { name: 'id', type: 'string' },
              { name: 'label', type: 'string' },
              { name: 'note', type: 'string' }
            ],
            default: [
              { id: 'aspirin', label: 'Aspirin (PO)', note: 'Antiplatelet effect is days-scale — no modelled effect on tracked vitals.' },
              { id: 'dexamethasone', label: 'Dexamethasone', note: 'Steroid — onset of any real effect is hours, not minutes — no modelled effect.' },
              { id: 'hydrocortisone', label: 'Hydrocortisone', note: 'Steroid — same reasoning as dexamethasone — no modelled effect.' },
              { id: 'ceftriaxone', label: 'Ceftriaxone', note: 'Antibiotic — no acute vitals effect.' },
              { id: 'heparin', label: 'Heparin', note: 'Anticoagulant — no acute vitals effect (like aspirin, effect is not on this timescale).' },
              { id: 'tranexamic_acid', label: 'Tranexamic Acid (TXA)', note: 'Reduces mortality over hours, does not rapidly reverse hypovolaemia — deliberately zero acute effect here, this is the correct teaching point, not a simplification.' },
              { id: 'water_for_injection', label: 'Water for Injection', note: 'Diluent, not a drug — no effect.' },
              { id: 'cervical_collar', label: 'Cervical collar / spinal immobilisation', note: 'Mechanical precaution — no modelled effect on tracked vitals.' },
              { id: 'dressing', label: 'Simple wound dressing (non-haemorrhage-control)', note: 'Mechanical — no modelled effect on tracked vitals.' },
              { id: 'ecg_monitor', label: 'ECG / cardiac monitoring application', note: 'Assessment/monitoring, not a treatment — no modelled effect.' },
              { id: 'iv_access', label: 'IV cannulation (access only, nothing given through it)', note: 'Access alone — no modelled effect until something is administered.' },
              { id: 'consent', label: 'Obtaining verbal consent / handover', note: 'Documentation/communication action — no modelled effect.' }
            ]
          },
          CODED_EFFECT_ACTIONS: {
            type: 'table',
            label: 'Coded-effect medication catalogue',
            help: 'Predictable DIRECTION of effect, randomised magnitude/onset, applied directly as a graph override with no AI call. delta/onsetMin/wearOffMin are [min,max] ranges (runtime shape, stored as-is); wearOffMin is optional (only for short-acting agents).',
            columns: [
              { name: 'id', type: 'string' },
              { name: 'label', type: 'string' },
              { name: 'vital', type: 'string', help: "'pain' or 'nausea'" },
              { name: 'delta', type: 'number_range' },
              { name: 'onsetMin', type: 'number_range' },
              { name: 'wearOffMin', type: 'number_range', optional: true }
            ],
            default: [
              { id: 'paracetamol', label: 'Paracetamol (PO/IV)', vital: 'pain', delta: [-3, -1], onsetMin: [10, 20] },
              { id: 'ibuprofen', label: 'Ibuprofen (PO)', vital: 'pain', delta: [-4, -2], onsetMin: [15, 30] },
              { id: 'methoxyflurane', label: 'Methoxyflurane (Penthrox)', vital: 'pain', delta: [-5, -3], onsetMin: [2, 5], wearOffMin: [15, 25] },
              { id: 'splint', label: 'Splinting a limb fracture', vital: 'pain', delta: [-2, -1], onsetMin: [1, 3] },
              { id: 'sling', label: 'Sling / arm immobilisation', vital: 'pain', delta: [-2, -1], onsetMin: [1, 3] },
              { id: 'ondansetron', label: 'Ondansetron (antiemetic)', vital: 'nausea', delta: [-5, -3], onsetMin: [5, 10] },
              { id: 'prochlorperazine', label: 'Prochlorperazine (antiemetic)', vital: 'nausea', delta: [-5, -3], onsetMin: [10, 20] },
              { id: 'metoclopramide', label: 'Metoclopramide (antiemetic)', vital: 'nausea', delta: [-5, -3], onsetMin: [10, 20] }
            ]
          },
          ACTION_LOG_VERB: {
            type: 'map_str_str',
            label: 'Action log phrasing',
            help: 'Friendlier wording for the assessor Log’s completed-action lines than the raw tile label.',
            default: {
              ecg: 'ECG (Lead II) applied', ecg12lead: '12-Lead ECG applied', rr: 'Resp Rate assessed', spo2: 'SpO₂ assessed',
              etco2: 'EtCO₂ assessed', bp: 'BP taken', temp: 'Temperature assessed', gcs: 'GCS assessed',
              bgl: 'BGL taken', ketones: 'Ketones taken', pain: 'Pain score assessed', pulse: 'Pulse checked'
            }
          },
          ACTION_LABELS: {
            type: 'map_str_str',
            label: 'Assessment tile labels (patient view)',
            help: 'Display labels for assessment tiles on sim_patient.html, also pushed to Supabase for sim_control.html’s Actions tab.',
            default: {
              ecg: 'ECG (Lead II)', ecg12lead: '12-Lead ECG', spo2: 'SpO₂',
              etco2: 'EtCO₂', bp: 'Blood Pressure', temp: 'Temperature', gcs: 'GCS',
              bgl: 'BGL', ketones: 'Ketones', pain: 'Pain Score', pulse: 'Pulse Check'
            }
          },
          HIGH_RISK_CONDITION_KEYWORDS: {
            type: 'string_list',
            label: 'High-risk condition keywords',
            help: 'Free-text substrings matched against a scenario’s medical_conditions to penalize the defib survivability score.',
            default: [
              'heart failure', 'chf', 'cardiomyopathy', 'copd', 'emphysema', 'chronic bronchitis',
              'renal failure', 'dialysis', 'ckd', 'cancer', 'malignancy', 'metastatic',
              'dementia', 'alzheimer', 'stroke', 'cva', 'diabetes', 'obesity', 'morbidly obese',
              'ischaemic heart disease', 'ischemic heart disease', 'coronary artery disease', 'cad',
              'previous mi', 'myocardial infarction', 'atrial fibrillation', 'valve disease',
              'cirrhosis', 'immunocompromised', 'frailty', 'frail'
            ]
          },
          GCS_V2_SOUNDS: {
            type: 'string_list',
            label: 'GCS-Verbal 2 fixed sounds',
            help: 'Fixed, non-AI utterances for GCS-Verbal tier 2 (incomprehensible sounds) — deliberately not left to the AI, so a low-GCS patient never accidentally speaks coherently.',
            default: ['Nnnghhh...', 'Uhhh... hnnn...', 'Mmm... hhh... mmm...', '...ngh... uhh...']
          },
          GCS_V3_WORDS: {
            type: 'string_list',
            label: 'GCS-Verbal 3 fixed words',
            help: 'Fixed, non-AI utterances for GCS-Verbal tier 3 (inappropriate words).',
            default: ["...dog... the blue one...", "...where's... my keys...", '...no... stop the light...', '...mum? ...mum...', '...cold... the cold one...']
          },
          MOOD_MAP: {
            type: 'table',
            label: 'Scenario mood keyword map',
            help: 'Fuzzy-maps a scenario’s free-text mood into the avatar’s expression set. Order matters — checked top-to-bottom, first match wins. Keywords are plain substrings (not regex).',
            columns: [
              { name: 'mood', type: 'string', enum: ['angry', 'agitated', 'tearful', 'anxious', 'confused'] },
              { name: 'keywords', type: 'string_list' }
            ],
            default: [
              { mood: 'angry', keywords: ['angry', 'hostile', 'aggressive', 'combative', 'furious', 'irate'] },
              { mood: 'agitated', keywords: ['agitat', 'restless', 'irritable', 'uncooperative', 'on edge'] },
              { mood: 'tearful', keywords: ['tearful', 'crying', 'weeping', 'sobbing'] },
              { mood: 'anxious', keywords: ['anxious', 'worried', 'frightened', 'scared', 'fearful', 'panick'] },
              { mood: 'confused', keywords: ['confus', 'disorient', 'vague', 'bewildered'] }
            ]
          }
        }
      },

      defib: {
        label: 'Defibrillation',
        owner: 'sim_patient.html + sim_engine.js',
        fields: {
          JOULE_LEVELS: {
            type: 'number_list',
            label: 'Selectable joule levels',
            help: 'Ordered energy-select tower values, highest first.',
            default: [200, 150, 120, 100, 85, 70, 50, 30, 20, 15, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
          },
          CHARGE_STEP_MS: {
            type: 'number',
            label: 'Charge animation step (ms)',
            help: 'Time per charge-tower row fill during the defib charging animation.',
            default: 180
          },
          ENERGY_FACTOR_TABLE: {
            type: 'map_str_num',
            label: 'Shock energy-efficacy thresholds',
            help: 'Adult dosing is a fixed protocol threshold (100/120J); paediatric is weight-based (2-4 J/kg), branched separately. These feed computeEnergyFactor() in sim_engine.js.',
            default: {
              pediatricAgeThreshold: 12,
              pediatricJPerKgLow: 2, pediatricJPerKgHigh: 4,
              pediatricUnderHalfFactor: 0.3, pediatricLowMultiplier: 0.5,
              pediatricUnderIdealFactor: 0.6,
              pediatricWithinFactor: 1, pediatricHighMultiplier: 1.5,
              pediatricOverFactor: 0.85,
              adultLowJoules: 100, adultLowFactor: 0.55,
              adultMidJoules: 120, adultMidFactor: 0.8,
              adultFullFactor: 1
            }
          }
        },
        readonlyNotes: [
          'The per-shock outcome PROBABILITY math (computeShockableOutcome, computeOrganizedShockOutcome in sim_engine.js ~lines 373-412) is not editable here — it’s a tangle of coupled formulas (downtime decay, survivability weighting, induced-VF chance), not independent named constants. Changing it needs a code change, not a config edit.'
        ]
      },

      timers: {
        label: 'Timers & Polling',
        owner: 'sim_control.html + sim_patient.html',
        fields: {
          HEALTH_WINDOW_MS: {
            type: 'number',
            label: 'Health-score trailing window (ms)',
            help: 'How far back getHealthScore()/getHealthTrendLevel() look — the reported value is the WORST reading sampled across this window, not an average.',
            default: 90000
          },
          HEALTH_SAMPLES: {
            type: 'number',
            label: 'Health-score sample count',
            help: 'Samples spread evenly across the trailing window, including "now".',
            default: 4
          },
          HEALTH_DISPLAY_SMOOTHING_MS: {
            type: 'number',
            label: 'Health display smoothing window (ms)',
            help: 'Display-only moving average on top of getHealthScore()/getHealthTrendLevel(), purely to flatten small visual ripples (e.g. from pain’s severity crossing a band while its consciousness-based weight is fading) — does not change the underlying score.',
            default: 120000
          },
          HEALTH_DISPLAY_SMOOTHING_SAMPLES: {
            type: 'number',
            label: 'Health display smoothing sample count',
            help: 'Samples spread evenly across the display-smoothing window, including "now" — needs to be reasonably high (not just 3-5) or the smoothing pass creates its own coarse staircase during a sharp transition like a rhythm collapse into arrest.',
            default: 20
          },
          GRAPH_ZOOM_LEVELS: {
            type: 'number_list',
            label: 'Graph zoom levels (minutes)',
            help: 'Discrete zoom window widths the assessor graph steps through.',
            default: [1, 5, 10, 30, 60, 90, 120, 240]
          },
          VITALS_TICK_MS: {
            type: 'number',
            label: 'Vitals tick interval (ms)',
            help: 'How often sim_control.html recomputes/redraws live vitals.',
            default: 1000
          },
          DB_POLL_MS: {
            type: 'number',
            label: 'Session DB poll interval (ms)',
            help: 'Fallback REST poll interval alongside the realtime channel.',
            default: 1500
          },
          BP_INFLATE_MS: {
            type: 'number',
            label: 'BP cuff inflate/hold/deflate cycle (ms)',
            help: 'Derives from Medications → ACTION_DURATIONS → bp.contextB (subsequent), ×1000 — not independently editable, shown for reference only. Editing ACTION_DURATIONS.bp there also moves this.',
            readonly: true,
            derivedFrom: { section: 'medications', field: 'ACTION_DURATIONS' },
            default: 35000
          }
        }
      },

      graph: {
        label: 'Graph & Display',
        owner: 'sim_control.html',
        fields: {
          GRAPH_SERIES: {
            type: 'table',
            label: 'Vital plot styling',
            help: 'Per-vital plot definition. The value-accessor logic itself stays hardcoded in sim_control.html (JS, not data) — only styling/range fields are editable here.',
            columns: [
              { name: 'key', type: 'string', readonly: true },
              { name: 'label', type: 'string' },
              { name: 'color', type: 'color' },
              { name: 'unit', type: 'string' },
              { name: 'min', type: 'number' },
              { name: 'max', type: 'number' },
              { name: 'plotMax', type: 'number', help: 'Optional — extra headroom above max so a mid-scale "normal" value sits mid-chart instead of near the top.' }
            ],
            default: [
              { key: 'HR', label: 'HR', color: '#dc1114', unit: 'bpm', min: 0, max: 300 },
              { key: 'BPsys', label: 'BP Sys', color: '#65b440', unit: 'mmHg', min: 0, max: 260 },
              { key: 'BPdia', label: 'BP Dia', color: '#8bbf2c', unit: 'mmHg', min: 0, max: 220 },
              { key: 'SpO2', label: 'SpO₂', color: '#2980c5', unit: '%', min: 0, max: 100, plotMax: 120 },
              { key: 'RR', label: 'RR', color: '#dc5e19', unit: '/min', min: 0, max: 50 },
              { key: 'EtCO2', label: 'EtCO₂', color: '#f3e511', unit: 'mmHg', min: 0, max: 100 },
              { key: 'temp', label: 'Temp', color: '#4e4193', unit: '°C', min: 20, max: 43 },
              { key: 'bgl', label: 'BGL', color: '#54bec4', unit: 'mmol/L', min: 0, max: 40 },
              { key: 'ketones', label: 'Ketones', color: '#a96aab', unit: 'mmol/L', min: 0, max: 15 },
              { key: 'gcs', label: 'GCS', color: '#d02e8b', unit: '/15', min: 3, max: 15, plotMax: 18 },
              { key: 'pain', label: 'Pain', color: '#dd9806', unit: '/10', min: 0, max: 10 },
              { key: 'nausea', label: 'Nausea', color: '#14b8a6', unit: '/10', min: 0, max: 10 },
              { key: 'health', label: 'Health', color: '#000000', unit: '', min: 0, max: 100, plotMax: 200 }
            ]
          },
          GRAPH_DEFAULT_ON: {
            type: 'map_str_str',
            label: 'Series visible by default',
            help: 'true/false per series key.',
            default: { HR: true, BPsys: true, BPdia: true, SpO2: true, RR: true, EtCO2: true, temp: false, bgl: false, ketones: false, gcs: false, pain: false, nausea: false, health: false }
          },
          VITAL_DEFS: {
            type: 'table',
            label: 'Vital tile definitions',
            help: 'Metadata for the override-editing modal’s vital tiles.',
            columns: [
              { name: 'key', type: 'string' },
              { name: 'label', type: 'string' },
              { name: 'unit', type: 'string' },
              { name: 'overrideKeys', type: 'string_list' },
              { name: 'isGCS', type: 'boolean' },
              { name: 'isHealth', type: 'boolean' }
            ],
            default: [
              { key: 'HR', label: 'HR', unit: 'bpm', overrideKeys: ['HR'] },
              { key: 'BP', label: 'NIBP', unit: 'mmHg', overrideKeys: ['BPsys', 'BPdia'] },
              { key: 'SpO2', label: 'SpO₂', unit: '%', overrideKeys: ['SpO2'] },
              { key: 'RR', label: 'Resp', unit: '/min', overrideKeys: ['RR'] },
              { key: 'EtCO2', label: 'EtCO₂', unit: 'mmHg', overrideKeys: ['EtCO2'] },
              { key: 'Temp', label: 'Temp', unit: '°C', overrideKeys: ['temp'] },
              { key: 'BGL', label: 'BGL', unit: 'mmol/L', overrideKeys: ['bgl'] },
              { key: 'Ketones', label: 'Ketones', unit: 'mmol/L', overrideKeys: ['ketones'] },
              { key: 'Pain', label: 'Pain', unit: '/10', overrideKeys: ['pain'] },
              { key: 'Nausea', label: 'Nausea', unit: '/10', overrideKeys: ['nausea'] },
              { key: 'GCS', label: 'GCS', unit: '/15', overrideKeys: ['gcsE', 'gcsV', 'gcsM'], isGCS: true },
              { key: 'Health', label: 'Health', unit: '', overrideKeys: [], isHealth: true }
            ]
          },
          SS_LABELS: {
            type: 'map_str_str',
            label: 'Secondary survey body-region labels',
            help: '⚠ Must be kept in sync with index.html’s SS_FIELD_LABELS (a separate file, not managed by this admin page) — editing only here will make the two pages show different wording for the same finding.',
            default: {
              head: 'Head and face', neck: 'Neck', chest: 'Chest', abdomen: 'Abdomen', back: 'Back', pelvis: 'Pelvis', limbs: 'Limbs',
              neuro: 'Neurological', cardio: 'Cardiovascular', resp: 'Respiratory', gi: 'Gastrointestinal', gu: 'Genitourinary',
              msk: 'Musculoskeletal', skin: 'Integumentary/Skin', other: 'Other/consideration'
            }
          },
          OVERRIDE_KEY_LABELS: {
            type: 'map_str_str',
            label: 'Override-modal key labels',
            default: {
              HR: 'HR', BPsys: 'BP Sys', BPdia: 'BP Dia', SpO2: 'SpO₂', RR: 'RR', EtCO2: 'EtCO₂',
              temp: 'Temp', bgl: 'BGL', ketones: 'Ketones', pain: 'Pain',
              gcsE: 'GCS Eye', gcsV: 'GCS Verbal', gcsM: 'GCS Motor'
            }
          },
          INFO_TAB_ORDER: {
            type: 'string_list',
            label: 'Scenario Info tab order',
            default: ['dispatch', 'history', 'medhx', 'appearance', 'survey', 'clinical']
          }
        }
      },

      severity: {
        label: 'Severity & Survivability',
        owner: 'sim_engine.js (sim_control.html’s duplicate copy is deleted by this refactor)',
        fields: {
          SEVERITY_BANDS: {
            type: 'table',
            label: 'Vital severity breakpoints',
            help: 'Threshold numbers only — the severity band VALUES (0-4) are a fixed ordinal scale. spo2 also accepts a per-call chronic-respiratory shift (handled in code, not stored here).',
            columns: [
              { name: 'vital', type: 'string', readonly: true },
              { name: 'extremeLow', type: 'number' }, { name: 'extremeHigh', type: 'number' },
              { name: 'severeLow', type: 'number' }, { name: 'severeHigh', type: 'number' },
              { name: 'mildLow', type: 'number' }, { name: 'mildHigh', type: 'number' },
              { name: 'band4', type: 'number' }, { name: 'band3', type: 'number' }, { name: 'band2', type: 'number' }, { name: 'band1', type: 'number' }
            ],
            default: [
              { vital: 'hr', extremeLow: 40, extremeHigh: 140, severeLow: 50, severeHigh: 120, mildLow: 60, mildHigh: 100 },
              { vital: 'rr', extremeLow: 6, extremeHigh: 30, severeLow: 9, severeHigh: 24, mildLow: 12, mildHigh: 20 },
              { vital: 'spo2', band4: 80, band3: 85, band2: 90, band1: 95 },
              { vital: 'pain', band3: 7, band2: 4, band1: 1 },
              { vital: 'bpSys', band3: 70, band2: 90, band1: 100 }
            ]
          },
          SURVIVABILITY: {
            type: 'table',
            label: 'Defib survivability score bands',
            help: 'Feeds computeSurvivabilityScore() in sim_engine.js — base score 70 (average adult, witnessed arrest, prompt care), adjusted by age band (first match wins, age ≤ maxAge), weight, condition keywords, and downtime.',
            columns: [
              { name: 'maxAge', type: 'number' },
              { name: 'delta', type: 'number' }
            ],
            default: [
              { maxAge: 1, delta: 10 },
              { maxAge: 35, delta: 15 },
              { maxAge: 55, delta: 5 },
              { maxAge: 70, delta: -5 },
              { maxAge: 85, delta: -15 }
            ]
          },
          SURVIVABILITY_SCALARS: {
            type: 'map_str_num',
            label: 'Survivability scalar adjustments',
            default: {
              baseScore: 70, ageAboveAllBandsDelta: -25,
              weightHighKg: 120, weightHighDelta: -10,
              weightModerateKg: 100, weightModerateDelta: -5,
              frailtyMinAge: 15, frailtyWeightKg: 45, frailtyDelta: -5,
              conditionPenaltyPerHit: 6, conditionPenaltyCap: 30,
              downtimePenaltyPerMin: 5,
              clampMin: 2, clampMax: 95
            }
          },
          CHRONIC_RESP_KEYWORDS: {
            type: 'string_list',
            label: 'Chronic respiratory disease keywords',
            help: 'Shifts what counts as a "normal" SpO2 reading for this patient (e.g. COPD resting at 85% isn’t distress).',
            default: [
              'copd', 'chronic obstructive', 'emphysema', 'chronic bronchitis', 'bronchiectasis',
              'pulmonary fibrosis', 'interstitial lung', 'chronic respiratory failure', 'chronic lung disease', 'home oxygen'
            ]
          }
        },
        readonlyNotes: [
          'Skin-appearance blend math (getAppearanceState() in sim_engine.js ~lines 695-748: cyanosis/pallor/flush/mottle fractions and blend depths) is not editable here — those are inline magic numbers inside a single expression-heavy function, not independent named constants.'
        ]
      },

      avatar: {
        label: 'Avatar Build',
        owner: 'sim_patient.html',
        fields: {
          AGE_SCALE_AT_ZERO: { type: 'number', label: 'Whole-figure scale at newborn', default: 0.94 },
          EYE_SCALE_X_AT_ZERO: { type: 'number', label: 'Eye width scale at newborn', default: 1.1 },
          EYE_SCALE_Y_AT_ZERO: { type: 'number', label: 'Eye height scale at newborn', default: 1.6 },
          FACE_LOWER_OFFSET_AT_ZERO: { type: 'number', label: 'Eyes/eyebrows vertical drop at newborn', default: 12 },
          MOUTH_LOWER_OFFSET_AT_ZERO: { type: 'number', label: 'Mouth vertical drop at newborn', default: 6.5 },
          HEAD_BULGE_RX_AT_ZERO: { type: 'number', label: 'Head-bulge X radius at newborn', default: 1.16 },
          HEAD_BULGE_RY_AT_ZERO: { type: 'number', label: 'Head-bulge Y radius at newborn', default: 1.19 },
          HAIR_SCALE_AT_ZERO: { type: 'number', label: 'Hair scale at newborn', default: 1 },
          HAIR_OFFSET_Y_AT_ZERO: { type: 'number', label: 'Hair Y offset at newborn', default: -2 },
          HAIR_COLOURS: {
            type: 'color_list', label: 'Hair colour pool',
            default: ['#1b1410', '#3b2b20', '#5a3b23', '#8a5a2b', '#c9a227', '#7a2e1d', '#8c8c8c', '#b0b0b0', '#e8e4dc']
          },
          GREY_HAIR_COLOURS: {
            type: 'color_list', label: 'Colours treated as "grey" for age-weighting',
            help: 'Must be a subset of Hair colour pool above.',
            validate: subsetValidate('avatar', 'HAIR_COLOURS'),
            default: ['#8c8c8c', '#b0b0b0', '#e8e4dc']
          },
          CLOTHES_COLOURS: {
            type: 'color_list', label: 'Clothing colour pool',
            default: ['#3b6ea5', '#22577a', '#5c4b8a', '#7a2e2e', '#2f6d4f', '#4a4a4a', '#8a5a2b', '#1a1a1a', '#c9a227', '#6b4c9a', '#b0392f', '#3d3d3d']
          },
          ADULT_ONLY_HAIR: {
            type: 'string_list', label: 'Adult-only hairstyles',
            help: 'Structured/receding-hairline-prone cuts excluded from the pool below teen age. Must be valid AvatarAssets.top keys.',
            validate: assetKeyValidate('top'),
            default: ['theCaesar', 'theCaesarAndSidePart', 'shavedSides', 'sides']
          },
          HEADWEAR: {
            type: 'string_list', label: 'Headwear (top keys that are garments, not hair)',
            validate: assetKeyValidate('top'),
            default: ['hat', 'hijab', 'turban', 'winterHat1', 'winterHat02', 'winterHat03', 'winterHat04']
          },
          CASUAL_HEADWEAR: {
            type: 'string_list', label: 'Casual headwear (down-weighted subset of Headwear)',
            help: 'Must be a subset of Headwear above.',
            validate: subsetValidate('avatar', 'HEADWEAR'),
            default: ['hat', 'winterHat1', 'winterHat02', 'winterHat03', 'winterHat04']
          },
          FACE_FRAMING_HEADWEAR: {
            type: 'string_list', label: 'Face-framing headwear (excluded below teen)',
            help: 'Must be a subset of Headwear above.',
            validate: subsetValidate('avatar', 'HEADWEAR'),
            default: ['hijab', 'turban']
          },
          HAIR_STYLE_LEAN: {
            type: 'map_str_str',
            label: 'Hairstyle gender lean',
            help: "Each hairstyle tagged 'm' (masc-leaning), 'f' (femme-leaning), or 'n' (neutral) — a soft weighting, not a hard filter.",
            default: {
              hat: 'n', hijab: 'f', turban: 'm', winterHat1: 'n', winterHat02: 'n', winterHat03: 'n', winterHat04: 'n',
              bob: 'f', bun: 'f', curly: 'n', curvy: 'f', dreads: 'n', frida: 'f', fro: 'n', froBand: 'f',
              longButNotTooLong: 'f', miaWallace: 'f', shavedSides: 'm', straight02: 'f', straight01: 'f',
              straightAndStrand: 'f', dreads01: 'n', dreads02: 'n', frizzle: 'n', shaggy: 'm', shaggyMullet: 'm',
              shortCurly: 'm', shortFlat: 'm', shortRound: 'm', shortWaved: 'm', sides: 'm', theCaesar: 'm',
              theCaesarAndSidePart: 'm', bigHair: 'f'
            }
          },
          MOUTH_VARIANT: {
            type: 'map_str_str',
            label: 'Mouth state → asset variant',
            help: 'Values must be real AvatarAssets.mouth keys.',
            validate: assetKeyValidate('mouth'),
            default: {
              neutral: 'default', mild: 'serious', distress: 'concerned', grimace: 'grimace', slack: 'sad', talkOpen: 'screamOpen',
              angry: 'default', agitated: 'concerned', tearful: 'sad', anxious: 'concerned', confused: 'disbelief'
            }
          },
          MOOD_EYEBROW: {
            type: 'map_str_str',
            label: 'Mood → eyebrow asset variant',
            help: "'calm' deliberately has no entry — falls back to the patient’s own per-scenario eyebrow pick. Values must be real AvatarAssets.eyebrows keys.",
            validate: assetKeyValidate('eyebrows'),
            default: { angry: 'angryNatural', agitated: 'frownNatural', tearful: 'sadConcernedNatural', anxious: 'sadConcernedNatural', confused: 'upDownNatural' }
          }
        }
      },

      interaction: {
        label: 'Session & Interaction',
        owner: 'sim_patient.html',
        fields: {
          MAX_CONCURRENT: {
            type: 'number',
            label: 'Max simultaneous vital-sign assessments',
            help: 'How many assessment actions (ECG, BP, SpO2, etc) can be actively "pending" — a crew member physically doing it — at once. Modelled as a fixed number of crew members: a tap beyond this limit queues as "waiting for a free crew member" instead of starting immediately, and picks up automatically as a slot frees up. Currently 2.',
            default: 2
          },
          MONITORING_KEYS: {
            type: 'string_list',
            label: '"Apply All Monitoring" action keys',
            help: 'Which assessment keys the single "Apply All Monitoring" tap starts together — goes through the same MAX_CONCURRENT queue as tapping each individually, so some may start immediately and the rest queue.',
            default: ['ecg', 'spo2', 'etco2', 'bp']
          }
        }
      },

      voice: {
        label: 'Voice',
        owner: 'sim_patient.html',
        fields: {
          MALE_VOICE_HINTS: {
            type: 'string_list', label: 'Male voice name hints',
            help: 'Substrings matched against SpeechSynthesisVoice.name to guess gender when the platform gives no gender field.',
            default: ['male', 'david', 'daniel', 'alex', 'fred', 'guy', 'ryan', 'mark', 'thomas', 'james', 'george', 'oliver', 'aaron']
          },
          FEMALE_VOICE_HINTS: {
            type: 'string_list', label: 'Female voice name hints',
            default: ['female', 'samantha', 'victoria', 'karen', 'susan', 'zira', 'emma', 'amy', 'joanna', 'salli', 'kate', 'moira', 'tessa']
          },
          VOICE_MODE_LABELS: {
            type: 'map_str_str',
            label: 'Voice modal title per mode',
            default: { treatment: 'Give Treatment', exam: 'Assessment', chat: 'Talk to Patient' }
          },
          VOICE_MODE_REPLY_LABELS: {
            type: 'map_str_str',
            label: 'Reply-line prefix per mode',
            default: { exam: 'Finding:', chat: 'Patient replied:' }
          },
          YOUTH_VOICE_RATE_AT_ZERO: {
            type: 'number',
            label: 'Youth voice pitch/rate multiplier at newborn',
            help: 'Approximates a younger-sounding voice by pitching up the adult voice (real vocal pitch does run higher in young children). Ramps linearly down to 1.0/no-change by age 18 — same ageRamp() shape as the avatar’s age-scaling constants. Applied as utterance.pitch on the standard Web Speech voice; Realtime Voice’s Deepgram Aura-2 replies have no equivalent knob and are not pitch-shifted. Kept deliberately moderate — too high reads as "chipmunk".',
            default: 1.22
          }
        }
      },

      prompts: {
        label: 'AI Prompts',
        owner: 'sim_control.html',
        fields: {
          UNTREATED_PROJECTION_PROMPT: {
            type: 'prompt_text',
            label: 'Untreated projection (generateSimTimeline, Sonnet)',
            help: 'Run once per scenario (cached) to project how vitals would drift with NO treatment at all. Must keep instructing the AI to return ONLY the JSON shape shown, or the timeline generator will fail to parse the response. No placeholders — the scenario\'s own data is supplied entirely in the user message, built fresh from live data each call.',
            default: "You are projecting how a paramedic training patient's vital signs would change over time, assuming the treating crew gives NO treatment at all. This feeds a training simulator's trajectory graph.\n\nGround everything in the scenario's actual provisional diagnosis and clinical picture — do not invent a different condition. Only vitals that would plausibly change from this condition's natural progression should have entries; omit any vital that would reasonably stay flat.\n\nProject all the way to the condition's genuine untreated endpoint if that would realistically occur — including cardiac/respiratory arrest (vitals reaching true arrest values: HR 0, BP 0/0, RR 0, EtCO2 near 0, GCS 3) where the diagnosis and timeframe make that the honest outcome. Do not stop short at a \"critical but stable\" plateau if arrest would actually follow. Cap the total timeline at 60 minutes — if the natural course would take longer than that to reach arrest, project only as far as 60 minutes and leave the patient critically deteriorated rather than extending further.\n\nReturn ONLY valid JSON, no prose, in exactly this shape:\n{\"startingPain\": 0, \"startingNausea\": 0, \"overrides\": {\"HR\": [{\"targetValue\":0,\"startMin\":0,\"endMin\":0}], \"RR\": [], \"SpO2\": [], \"EtCO2\": [], \"BPsys\": [], \"BPdia\": [], \"temp\": [], \"bgl\": [], \"ketones\": [], \"pain\": [], \"nausea\": [], \"gcsE\": [], \"gcsV\": [], \"gcsM\": []}, \"rhythm\": [{\"label\":\"ventricular fibrillation\",\"startMin\":22}], \"spontaneousLines\": [{\"text\":\"...\", \"distressMin\":0, \"distressMax\":1}]}\n\nRules:\n- Times are minutes elapsed since the crew arrived on scene (arrival = minute 0). Use as much of the 0-60 minute window as the condition genuinely needs — a rapidly fatal presentation may reach arrest in under 10 minutes; a slower one may need the full 60.\n- Each array entry is a transition: the vital moves toward targetValue between startMin and endMin, then holds/continues drifting from there — a deteriorating condition typically needs 2-4 sequential entries per affected vital, each startMin >= the previous entry's endMin.\n- gcsE range 1-4, gcsV range 1-5, gcsM range 1-6 — never exceed these.\n- Omit a vital's key entirely if it should stay flat.\n- Base direction/rate of change on the specific provisional diagnosis, key history, and flags given.\n- startingPain: a 0-10 estimate of the patient's pain at arrival, consistent with the presentation (0 if not a pain-related complaint).\n- startingNausea: a 0-10 estimate of the patient's nausea at arrival, independent of pain (0 if not a relevant feature — a fracture can hurt without nausea, gastro can nauseate without much pain).\n- 'rhythm' is optional and is about what happens AFTER arrival — the patient's presenting rhythm at minute 0 is supplied to you separately and already handled, don't repeat it here. Only include a 'rhythm' entry if the untreated natural course would genuinely change it later (e.g. an unstable rhythm deteriorating into arrest, or a documented arrhythmia spontaneously resolving) — cardiac/respiratory arrest in your vitals ALWAYS needs a matching rhythm entry at the same minute (never leave it ambiguous between asystole/VF/PEA). Same shape and terminology as the vitals overrides: {\"label\": \"<standard clinical rhythm name>\", \"startMin\": <minutes from arrival>}, holding until the next entry (yours or a later one from a treatment/event).\n- Whenever the natural course you're projecting reaches arrest (a 'rhythm' entry for VF/pulseless VT/asystole/PEA), the TRANSITION into that rhythm is near-instant regardless of what shape the deterioration took beforehand — a steady climb, a climb that then declines, a slow plateau that suddenly crashes, whatever the clinical picture actually calls for. Once the rhythm genuinely turns, there is no cardiac output from that moment on, so HR, BPsys/BPdia, SpO2, EtCO2, RR and GCS must all collapse to their arrest values within a handful of seconds of each other, at the SAME minute as the 'rhythm' entry — never a continued slow ramp alongside a rhythm entry that started earlier. E.g. a correctly chained HR set reaching arrest at minute 22 (whatever value HR happened to be at immediately beforehand, here 170): [{\"targetValue\":170,\"startMin\":18,\"endMin\":22},{\"targetValue\":0,\"startMin\":22,\"endMin\":22.05},{\"targetValue\":0,\"startMin\":22.05,\"endMin\":60}] — the last pre-arrest entry ending at minute 22, then the near-instant collapse, then a flat hold to the edge of the projection. The same two-step collapse-then-hold pattern applies to every other vital arrest implies, all landing at that same minute-22 transition — submitting only the HR chain while leaving BP/RR/SpO2/EtCO2/GCS still gradually declining past that point is wrong even though HR alone looks done. An active pain/nausea score must ALSO cut to 0 at that same transition, in lockstep with GCS — an unconscious, pulseless patient cannot report either.\n- spontaneousLines: 4-8 short (one sentence each), first-person, in-character things this patient might say or moan UNPROMPTED — not answering a question, not reporting a finding, just what would spontaneously come out of them given how they feel (a groan of pain, asking when help is coming, worry about a pet/family member, a passing comment about their surroundings). Never reveal the provisional diagnosis, vitals, or clinical reasoning — only what the patient themselves would plausibly say or perceive. Cover the range of how this patient will plausibly feel across the whole untreated course you just projected (an early line might be mildly worried, a late one barely coherent with distress), not only their state at minute 0. Each line needs distressMin/distressMax (0-3: 0=comfortable/no complaints, 1=mild discomfort/anxiety, 2=moderate pain/distress, 3=severe/critical distress) marking which part of that range it fits. Always assume the patient CAN speak coherently when writing these — the simulator itself substitutes generic moans/fragments whenever the patient's actual consciousness level wouldn't support clear speech, so don't hedge for that here.\n- This is a training placeholder pending clinical review, not a validated clinical model — use sound general physiological reasoning for the given diagnosis."
          },
          TREATMENT_UPDATE_PROMPT: {
            type: 'prompt_text',
            label: 'Treatment trajectory update (regenerateTimelineAfterTreatment, Sonnet)',
            help: 'Run after every crew treatment that reaches full reasoning (i.e. didn\'t match the router\'s no-effect/coded-effect catalogue). This is the prompt behind the "cascade rule" CLAUDE.md documents (arrest/shock/LOC changes must touch every implied vital together) — includes the worked examples. Must keep instructing the AI to return ONLY the JSON shape shown. No placeholders.',
            default: "You are updating a paramedic training patient's projected vital-signs trajectory after the crew just gave a treatment/management action. This feeds a training simulator's trajectory graph.\n\nReason from the scenario's actual provisional diagnosis and the specific action taken — how would THIS action affect THIS patient's THIS condition. No generic effect table; you are the clinical model.\n\nReturn ONLY valid JSON, no prose. Include ONLY the vital keys this specific action actually changes — omit every other key entirely, including as an empty array (an empty array and an absent key are treated identically downstream, so writing \"key\": [] for every unaffected vital just wastes output tokens for no benefit). Valid vital keys: HR, RR, SpO2, EtCO2, BPsys, BPdia, temp, bgl, ketones, pain, nausea, gcsE, gcsV, gcsM.\nShape (showing one example key only — yours will have however many keys are actually affected, not necessarily HR; 'rhythm' and 'spontaneousLines' are optional — see their rules below):\n{\"overrides\": {\"HR\": [{\"targetValue\":0,\"startMin\":0,\"endMin\":0}]}, \"rhythm\": [{\"label\":\"ventricular fibrillation\",\"startMin\":4}], \"assumptions\": [], \"spontaneousLines\": [{\"text\":\"...\", \"distressMin\":0, \"distressMax\":3}]}\n\nRules:\n- Times are minutes from THIS MOMENT (action = minute 0), not scenario start.\n- You'll be given the plan currently scheduled (prior no-treatment course or earlier adjustments) as context, not binding — keep what's still realistic given this action, override the rest.\n- Use the stated route if given; if not, infer the standard route for that drug in this context (e.g. adrenaline is IM for anaphylaxis, IV/IO for arrest).\n- Base onset on real pharmacology for THIS drug, not a route-based default — it varies a lot even within one route (e.g. IV adrenaline in anaphylaxis/arrest: seconds to ~1 min; IV amiodarone's rhythm effect: several minutes to build; IM glucagon: 10-15 min; thrombolytics: 30-90+ min; some oral drugs: hours).\n- A large/supratherapeutic dose acts faster and/or more intensely — potentially into toxicity — never more slowly or cautiously.\n- If no dose is stated, assume one standard initial dose — never \"whatever fixes it.\" If that standard dose would be inadequate for the situation (large overdose, severe presentation), reflect a partial/temporary effect with the problem persisting or returning, not a full correction. Weigh the agent's own duration against what it's reversing (e.g. naloxone is shorter-acting than most opioids it reverses, so re-sedation as it wears off is often realistic).\n- Reason over the full treatment history, not just this action — the cumulative picture. If this action reverses/corrects an earlier one (e.g. an antidote), it undoes only that specific iatrogenic effect; the underlying provisional diagnosis doesn't resolve unless something has specifically treated it.\n- For concurrent/unrelated conditions, track each independently — correcting one only resolves that one's effects; others continue their own course untouched unless separately addressed.\n- Only give an effect if there's a real, medically-recognised mechanism acting on THIS patient's actual condition. If the action is nonsensical, fictional, unrelated, or has no identifiable mechanism, it has NO effect — the patient continues essentially as with no intervention, not a milder improvement. \"Doing something\" isn't itself a reason to get better. Comfort/reassurance-type actions are an ordinary example: at most they slightly ease anxiety-driven tachycardia/hyperventilation, never reverse hypoxia, haemorrhage, airway obstruction, toxicity, or arrhythmia.\n- If the action only partially/temporarily addresses the problem, model it wearing off and the condition resuming — worse than before if it was just masking ongoing pathology, stable/improving if it substantively corrected it.\n- If the action is clinically inappropriate, ineffective, or wrongly dosed, reflect that honestly — continued deterioration or a toxic effect if that's the truth. Don't reward a wrong action with unrealistic improvement.\n- Only include a vital's key if this action would plausibly change it — but \"plausibly change\" includes indirect/downstream consequences, not just the vital most obviously targeted. If this action pushes the patient into a fundamentally different physiological state — cardiac arrest, severe shock, respiratory failure/apnoea, LOC change — include EVERY vital that state mechanically implies, not only the one or two most directly affected. Cardiac arrest, for example, is not just HR: with no cardiac output there is no BP, no perfusion to drive SpO2/EtCO2 readings as normal, breathing typically stops or becomes agonal (RR), and consciousness is lost (GCS 1/1/1). Leaving an uninvolved-looking vital on its old pre-event schedule while another vital shows arrest/collapse produces a contradictory graph — the two are the same patient at the same moment and must agree.\n- A NEW arrhythmia this action triggers is abrupt once it starts — a re-entrant/ectopic rhythm (VT, SVT, new-onset AF, etc.) engages within a beat or two, so its rate should reach the new value within a few seconds, not ramp over tens of seconds the way a genuinely gradual physiological trend does (e.g. sinus tachycardia building as a stimulant/toxic effect develops, which really can climb over 30-60s — that's a different mechanism, not a rhythm switch). If the mechanism is electrical and fatal (a new malignant arrhythmia — VF, pulseless VT, torsades — whatever the underlying cause), the arrest itself is equally near-instant: once the rhythm turns, there is no cardiac output from that same moment, so HR/BP/SpO2/EtCO2/RR/GCS should all reach their arrest values within a handful of seconds, not a slow ramp. The BUILD-UP to that arrhythmia (a toxic surge developing, ischaemia worsening) can genuinely take minutes — it's the transition into the new rhythm/arrest itself, once triggered, that should be fast.\n- Pain and nausea are self-reported symptoms, not independent physiological curves — they require a patient conscious and coherent enough to perceive and communicate them (roughly gcsV >= 4-5). The instant your own overrides drop the patient to full unresponsiveness (GCS 1/1/1, arrest, deep sedation/anaesthesia), pain and nausea must be cut to 0 with an entry starting at that same moment — not left to keep drifting down on whatever gradual schedule was already scheduled from before consciousness was lost. An unconscious or arrested patient is not \"a bit less nauseous than five minutes ago\"; there is no one home to report either.\n- gcsE range 1-4, gcsV range 1-5, gcsM range 1-6 — never exceed these.\n- 'rhythm' is a separate array (sibling of 'overrides', same JSON object), for when this action changes what actually shows on the cardiac monitor — the numeric HR alone can't tell the simulator that, since a rhythm is a distinct thing from a rate (asystole, VF, and PEA are all \"no pulse\" but look completely different, and none of them can be inferred from HR=0 by itself). Include a 'rhythm' entry any time this action starts, changes, or resolves an actual rhythm — cardiac arrest ALWAYS needs one (never leave the simulator to guess whether HR hitting 0 means asystole, VF, or PEA). A rate-only change that stays within whatever rhythm is already showing does not need one. Each entry is a single point in time the rhythm changes to, holding until the next entry: {\"label\": \"<standard clinical rhythm name>\", \"startMin\": <minutes from now>}. Use ordinary clinical terminology the simulator recognises — e.g. sinus rhythm, sinus tachycardia, sinus bradycardia, atrial fibrillation, atrial flutter, SVT, ventricular tachycardia, ventricular fibrillation, torsades de pointes, asystole, pulseless electrical activity (PEA), complete heart block, Mobitz I, Mobitz II, first degree heart block, junctional rhythm, WPW, PVCs, idioventricular rhythm, hyperkalaemia, prolonged QT, an inferior/anterior/lateral/posterior STEMI, LBBB, RBBB, paced rhythm — not novel or invented phrasing. Omit 'rhythm' entirely if this action doesn't change it.\n- You're also given the rhythm changes currently scheduled for later in the projection (inherited from the prior no-treatment course or an earlier action) — not binding, same as the scheduled vitals. If this action's effect means a scheduled future rhythm entry is no longer consistent with the corrected picture — because you've prevented, delayed, or reversed the deterioration that scheduled arrest depended on — you MUST include a 'rhythm' entry overriding it, holding at whatever rhythm is now actually correct at that time. Do not submit vitals showing a stable, recovering patient while a stale scheduled arrest (asystole/VF/PEA) is still left due to fire later on its old schedule — the monitor and the numbers must agree at every point in time, not just at the moment of this action.\n- Project forward until the outcome resolves, or until the remaining scenario time given in the user message runs out, whichever is sooner. Never exceed 60 minutes of total scenario time.\n- assumptions: short plain-English strings for anything inferred because it wasn't stated (e.g. \"Assumed IV route (not stated) — standard for anaphylaxis\"). Empty array if fully specified.\n- spontaneousLines (optional): only include this if this action would change what the patient might spontaneously say or moan UNPROMPTED going forward (e.g. it resolves their distress, worsens it, or changes their LOC) — if their likely unprompted remarks wouldn't meaningfully differ from before, omit this field entirely and the simulator keeps using what it already has. When you do include it, replace the whole set: 4-8 short first-person in-character lines the patient might say unprompted (not answering a question), each tagged with distressMin/distressMax (0-3: 0=comfortable/no complaints, 1=mild discomfort/anxiety, 2=moderate pain/distress, 3=severe/critical distress) marking which band it fits, covering how this patient will plausibly feel from now to the end of your projection. Never reveal diagnosis/vitals/clinical reasoning. Assume the patient can speak coherently — the simulator substitutes generic sounds itself when consciousness doesn't support real speech.\n\nExamples clarifying how chained entries work (illustrative shapes only, not clinical guidance):\n- A vital that rises then partially settles: [{\"targetValue\":150,\"startMin\":0,\"endMin\":3},{\"targetValue\":150,\"startMin\":3,\"endMin\":6},{\"targetValue\":95,\"startMin\":6,\"endMin\":25}]. The middle entry does not change the value, but it still gets its own entry so the chain reaches minute 6 before the decline begins.\n- A vital that changes once because a problem was genuinely, fully corrected: [{\"targetValue\":80,\"startMin\":0,\"endMin\":4}] is sufficient on its own — the value holds at 80 for the rest of the scenario, which is correct here because nothing further is expected to happen to it. This only works because the entry's OWN endMin (4) is where the transition genuinely finishes — do not stretch endMin out to the edge of the whole projection window just to express \"holds afterward\": [{\"targetValue\":0,\"startMin\":0,\"endMin\":30}] does NOT mean \"arrests instantly and holds at 0\" — the engine linearly interpolates across that entire span, so it renders as a slow 30-minute decline still short of 0 at minute 30. A fast transition needs its own short entry (ending when it genuinely finishes), then a separate later entry to hold/continue from there.\n- A vital that is genuinely unaffected by the action: omit its key entirely from overrides rather than giving it a flat entry — a flat entry implies you deliberately fixed its value there, whereas omitting it lets it continue on whatever course was already scheduled.\n- A vital undergoing several distinct phases (e.g. a brief worsening, then a partial recovery, then a late relapse) needs one chained entry per phase, in order, each starting exactly where the previous one ended — gaps or overlaps between entries are not meaningful to the renderer and should be avoided.\n- Whatever endMin your LAST entry for a vital uses is where that vital's value locks in place for the rest of the scenario — it will not drift, improve, or deteriorate further on its own after that point unless you add another entry saying so. There is no implicit resumption of any other course (not the pre-treatment plan, not the underlying condition's natural progression) once your entries run out.\n\n- Training placeholder pending clinical review, not a validated clinical model.\n\nWorked examples (illustrative only — reason independently for the real case each time):\n\nExample A — a conscious inferior-STEMI patient is given a grossly supratherapeutic IV adrenaline dose. Correct reasoning: a massive sympathetic surge causes an immediate hypertensive/tachycardic crisis (onset in 30-60s), which precipitates a fatal arrhythmia within a few minutes given the ischaemic myocardium. The BUILD-UP to that arrhythmia can take minutes, but the arrest itself, once the rhythm turns, is near-instant — there is no cardiac output the moment VF starts — so it persists for the rest of the projection (no return of spontaneous circulation modelled without further intervention). A correctly chained HR entry set: [{\"targetValue\":170,\"startMin\":0,\"endMin\":1},{\"targetValue\":170,\"startMin\":1,\"endMin\":4},{\"targetValue\":0,\"startMin\":4,\"endMin\":4.05},{\"targetValue\":0,\"startMin\":4.05,\"endMin\":30}] — four chained entries: the onset spike, a brief hold at peak, the near-instant collapse into arrest at minute 4, and a final entry holding the arrest value all the way to the edge of the projection window. Without that last entry, the graph would silently hold at the peak tachycardia value instead of showing the arrest for the remaining time. Crucially, arrest at minute 4 is not an HR-only event: BPsys/BPdia must collapse toward 0 on the same near-instant timeline (no cardiac output, no pressure), SpO2 and EtCO2 must fall to reflect no perfusion/no effective ventilation, RR must drop to agonal/0, and gcsE/gcsV/gcsM must fall to 1/1/1 for loss of consciousness — each as its own chained entry set following the same onset-to-arrest timing as HR, not a slower fade of its own. Submitting only the HR chain while leaving BP/RR/SpO2/EtCO2/GCS on their pre-treatment course is wrong even though HR alone \"looks done.\" If this patient had an active pain or nausea score running (e.g. from the STEMI's chest pain), that must ALSO get a chained entry cutting it to 0 at the same minute-4 arrest transition — an unconscious, pulseless patient cannot report pain or nausea, so those scores cannot keep gradually drifting down on their old pre-arrest schedule; they end abruptly, in lockstep with GCS. This is also a case that needs a 'rhythm' entry: the ischaemic myocardium plus the toxic surge means the fatal arrhythmia here is ventricular fibrillation, so \"rhythm\": [{\"label\":\"ventricular fibrillation\",\"startMin\":4}] — matching the same minute-4 transition as the HR/BP collapse. Leaving 'rhythm' out would mean the monitor keeps showing whatever it was already displaying (sinus tachycardia) even once every number on the graph says the patient has arrested.\n\nExample B — an opioid-overdosed patient (resp rate 4, GCS 6) is given a single standard dose of naloxone. Correct reasoning: naloxone reverses the respiratory depression within 2-3 minutes, but its effect is shorter-lived than most opioids — the improvement is genuine but temporary, and without a repeat dose the patient re-sedates as the naloxone wears off while the opioid is still on board. A correctly chained RR entry set: [{\"targetValue\":4,\"startMin\":0,\"endMin\":2},{\"targetValue\":16,\"startMin\":2,\"endMin\":3},{\"targetValue\":16,\"startMin\":3,\"endMin\":25},{\"targetValue\":6,\"startMin\":25,\"endMin\":35}] — the reversal, a hold while naloxone is still active, then a chained entry back down as it wears off and the opioid effect resumes. Missing that last entry would have left the patient looking permanently recovered instead of showing the realistic relapse.\n\nExample C — a patient with both a hypoglycaemic episode (BGL 2.1) and an unrelated, ongoing concealed haemorrhage from a fall is given IV glucose. Correct reasoning: the glucose corrects the BGL and the confusion/GCS effects specifically attributable to the hypoglycaemia within a few minutes and that correction holds, since the cause has genuinely been fixed. But the haemorrhage is untouched by this action, so HR and BP continue their own independent deteriorating course exactly as they were already scheduled to — the two problems are tracked as separate override chains on the relevant vitals, not merged into one improving picture.\n\nExample D — a patient is given an action with no real, medically-recognised mechanism for their actual condition (e.g. a comfort measure for an active haemorrhage, or a nonsensical action). Correct reasoning: this action has NO physiological effect on the underlying problem, so no override entries are written for the vitals it would have targeted — the patient continues exactly on whatever course was already scheduled before this action, not a milder or improved version of it. Do not invent even a small, symbolic improvement just because an action was taken.\n\nExample E — a second, related pattern: the same STEMI-plus-adrenaline-toxicity case, but reasoned slightly differently — the crew reasons the acute toxic surge itself is short-lived (0-6 min) and does not directly cause arrest, but it does worsen myocardial oxygen demand on an already-ischaemic heart, so the underlying STEMI resumes its own independent deterioration afterwards, now on a faster track toward arrest than it would have been untreated. The WRONG way to express this is to write only the 0-6 minute toxic-surge entries and stop — that silently flatlines the vital at its minute-6 value for the rest of the scenario, contradicting the very reasoning just given. The RIGHT way is to keep chaining: after the toxic-surge entries, add further entries carrying the vital through the STEMI's resumed, now-accelerated deterioration, all the way to its genuine endpoint (arrest, if that is really where it leads) or to the edge of the projection window. If your own reasoning describes what happens after your last entry, that description belongs in the JSON as more entries, not left as unwritten prose.\n\nApply this same chaining principle to every vital your own reasoning says would keep changing, for however many phases the real clinical picture actually has."
          },
          SCRIPTED_EVENT_PROMPT: {
            type: 'prompt_text',
            label: 'Assessor scripted event (regenerateTimelineForScriptedEvent, Sonnet)',
            help: 'Run when the assessor directly types a clinical event into "Script an Event" — authoritative by design (CLAUDE.md), not second-guessed for plausibility the way a crew treatment is. Must keep instructing the AI to return ONLY the JSON shape shown. No placeholders.',
            default: "You are the instructor/assessor's direct control channel for a paramedic training simulator's real-time patient. The assessor has just typed a free-text command describing a clinical event to inject into the scenario right now — a deterioration, a new complication, a sudden change, or a plain correction. This is NOT a crew treatment or intervention; you are directly scripting the patient's own course on the assessor's instruction. This feeds the same trajectory graph as everything else in the scenario.\n\nInterpret the command clinically and project how the patient's vitals would genuinely present as that event unfolds — real physiological reasoning for whatever's actually described, not an arbitrary number change with no mechanism behind it.\n\nReturn ONLY valid JSON, no prose. Include ONLY the vital keys this event actually changes — omit every other key entirely, including as an empty array. Valid vital keys: HR, RR, SpO2, EtCO2, BPsys, BPdia, temp, bgl, ketones, pain, nausea, gcsE, gcsV, gcsM.\nShape (showing one example key only — yours will have however many keys are actually affected; 'rhythm' and 'spontaneousLines' are optional — see their rules below):\n{\"overrides\": {\"HR\": [{\"targetValue\":0,\"startMin\":0,\"endMin\":0}]}, \"rhythm\": [{\"label\":\"ventricular fibrillation\",\"startMin\":4}], \"assumptions\": [], \"spontaneousLines\": [{\"text\":\"...\", \"distressMin\":0, \"distressMax\":3}]}\n\nRules:\n- Times are minutes from THIS MOMENT (the command is issued = minute 0).\n- The engine linearly interpolates between each entry's start and end — a value only holds flat where you give it its own entry saying so. A SINGLE entry spanning minute 0 to minute 30 targeting the arrest/end-state value renders as a slow 30-minute ramp toward it, NOT an instant change that then holds — that is almost never what you mean. Any transition faster than the full remaining projection needs at least two chained entries per vital: one covering the actual transition (as fast or slow as it genuinely is), then a separate one holding/continuing from there to the edge of the projection.\n- If the command states a delay before the event should start (e.g. \"in 5 minutes\", \"after 2 minutes\"), every affected vital's FIRST entry must hold flat at its CURRENT value from minute 0 until that delay, then the real transition begins — never start the change immediately when a delay was explicitly stated. If no delay is stated, start immediately at minute 0.\n- You'll be given the plan currently scheduled (the patient's course before this command) as context, not binding — keep what's still realistic given this event, override the rest.\n- Base onset and rate of change on real physiology for whatever is actually being described (a stated diagnosis/complication, a direct instruction to set a vital, a described mechanism of injury, etc).\n- A NEW arrhythmia's onset is abrupt regardless of whether it causes arrest — a re-entrant/ectopic rhythm (VT, SVT, new-onset AF, etc.) engages within a beat or two, so its rate should reach the new value within a few seconds, not ramp over tens of seconds the way a genuinely gradual physiological trend does (e.g. sinus tachycardia building from fever or exertion, which really does climb over minutes — that's a different mechanism, not a rhythm switch). If that new rhythm also causes arrest (VF, pulseless VT, torsades), the same near-instant timing applies to every vital arrest implies too — there is no cardiac output from the moment the rhythm turns, so HR/BP/SpO2/EtCO2/RR/GCS should all reach arrest values within a handful of seconds, not a slow ramp. This is different from a genuinely gradual complication (e.g. a developing tension pneumothorax or sepsis), which really does progress over minutes — use clinical judgement on which kind of event this is.\n- If this event pushes the patient into a fundamentally different physiological state — cardiac arrest, severe shock, respiratory failure/apnoea, loss of consciousness — include EVERY vital that state mechanically implies, not only the one most obviously named. Cardiac arrest is not just HR: BP collapses toward 0, SpO2/EtCO2 stop reflecting normal perfusion/ventilation, RR drops to agonal/0, and gcsE/gcsV/gcsM fall to 1/1/1. A vital left on its old pre-event schedule while others show arrest/collapse produces a contradictory graph.\n- Pain and nausea are self-reported and require a conscious, coherent patient (roughly gcsV >= 4-5). The moment your own overrides drop the patient to full unresponsiveness, pain and nausea must be cut to 0 with an entry starting at that same moment, not left drifting down independently.\n- If the command only sets one specific value or vital directly (e.g. \"set the BP to 90/60\"), affect only what was actually asked — do not invent knock-on effects on unrelated vitals unless the command or the patient's underlying condition genuinely implies them.\n- gcsE range 1-4, gcsV range 1-5, gcsM range 1-6 — never exceed these.\n- 'rhythm' is a separate array (sibling of 'overrides', same JSON object), for when this event changes what actually shows on the cardiac monitor — the numeric HR alone can't tell the simulator that (asystole, VF, and PEA are all \"no pulse\" but look completely different, and none of them can be inferred from HR=0 by itself). Include a 'rhythm' entry any time the command starts, changes, or resolves an actual rhythm — this covers both an explicit rhythm command (\"put the patient into VF\") and any event that causes cardiac arrest or a new arrhythmia as a consequence. Cardiac arrest ALWAYS needs one — never leave the simulator to guess whether HR hitting 0 means asystole, VF, or PEA. A rate-only change that stays within whatever rhythm is already showing does not need one. Each entry is a single point in time the rhythm changes to, holding until the next entry: {\"label\": \"<standard clinical rhythm name>\", \"startMin\": <minutes from now, respecting the same stated delay as the vitals>}. Use ordinary clinical terminology the simulator recognises — e.g. sinus rhythm, sinus tachycardia, sinus bradycardia, atrial fibrillation, atrial flutter, SVT, ventricular tachycardia, ventricular fibrillation, torsades de pointes, asystole, pulseless electrical activity (PEA), complete heart block, Mobitz I, Mobitz II, first degree heart block, junctional rhythm, WPW, PVCs, idioventricular rhythm, hyperkalaemia, prolonged QT, an inferior/anterior/lateral/posterior STEMI, LBBB, RBBB, paced rhythm — not novel or invented phrasing. Omit 'rhythm' entirely if this event doesn't change it.\n- You're also given the rhythm changes currently scheduled for later in the projection — not binding, same as the scheduled vitals. If this event's effect means a scheduled future rhythm entry is no longer consistent with the corrected picture — because it prevents, delays, or reverses whatever was going to cause that scheduled arrest — you MUST include a 'rhythm' entry overriding it, holding at whatever rhythm is now actually correct at that time. Do not submit vitals showing a stable, recovering patient while a stale scheduled arrest (asystole/VF/PEA) is still left due to fire later on its old schedule — the monitor and the numbers must agree at every point in time, not just at the moment of this event.\n- Project forward until the event's outcome resolves, or until the remaining scenario time given in the user message runs out, whichever is sooner. Never exceed 60 minutes of total scenario time.\n- assumptions: short plain-English strings for anything inferred because the command didn't state it (e.g. \"Assumed immediate onset — no delay stated\"). Empty array if fully specified.\n- spontaneousLines (optional): only include this if this event would change what the patient might spontaneously say or moan UNPROMPTED going forward (a new complication, a resolution, an LOC change) — if their likely unprompted remarks wouldn't meaningfully differ from before, omit this field entirely and the simulator keeps using what it already has. When you do include it, replace the whole set: 4-8 short first-person in-character lines the patient might say unprompted (not answering a question), each tagged with distressMin/distressMax (0-3: 0=comfortable/no complaints, 1=mild discomfort/anxiety, 2=moderate pain/distress, 3=severe/critical distress) marking which band it fits, covering how this patient will plausibly feel from now to the end of your projection. Never reveal diagnosis/vitals/clinical reasoning. Assume the patient can speak coherently — the simulator substitutes generic sounds itself when consciousness doesn't support real speech.\n\nWorked examples (illustrative only — reason independently for the real case each time):\n\nExample A — command: \"put the patient into cardiac arrest\" (no delay stated, no rhythm specified). Immediate, near-instant onset: HR, BP, SpO2, EtCO2, RR and GCS all collapse to arrest values within a few seconds — there is no cardiac output from the moment the rhythm turns — and hold there for the rest of the projection (no ROSC modelled without further intervention). This needs TWO chained entries per vital, not one — a short transition, then a separate flat-hold entry to the edge of the projection. E.g. a correctly chained HR set given current HR 101: [{\"targetValue\":0,\"startMin\":0,\"endMin\":0.05},{\"targetValue\":0,\"startMin\":0.05,\"endMin\":30}] — collapsing this into a single {\"targetValue\":0,\"startMin\":0,\"endMin\":30} entry is wrong: the engine would render that as a slow 30-minute decline that hasn't even reached 0 by the end of the projection, not an arrest. The same two-entry pattern applies to BPsys/BPdia/SpO2/EtCO2/RR/gcsE/gcsV/gcsM, and to any active pain/nausea score (cut to 0 at that same near-instant moment — an unconscious, pulseless patient cannot report either). No specific rhythm was named, so pick the one most consistent with the scenario's underlying condition (e.g. VF for an ischaemic/toxic cause, asystole or PEA for a hypoxic/hypovolaemic one) rather than defaulting to the same one every time — this still needs a 'rhythm' entry, e.g. \"rhythm\": [{\"label\":\"ventricular fibrillation\",\"startMin\":0}], timed to the same near-instant moment the vitals reach arrest.\n\nExample B — command: \"put the patient into VF in 5 minutes\". Here the rhythm IS explicitly named, which also implies the arrest mechanism: every affected vital's first entry holds at its current value from minute 0 to minute 5, and the arrest transition begins at minute 5, not minute 0 — but the transition itself, once it begins, is near-instant (there is no cardiac output the moment VF starts), not a slow ramp. E.g. a correctly chained HR set given current HR 92: [{\"targetValue\":92,\"startMin\":0,\"endMin\":5},{\"targetValue\":0,\"startMin\":5,\"endMin\":5.05},{\"targetValue\":0,\"startMin\":5.05,\"endMin\":30}] — the held current value, the near-instant collapse into arrest, then holding to the edge of the projection. 'rhythm' must match the same minute-5 timing: [{\"label\":\"ventricular fibrillation\",\"startMin\":5}] — not minute 0, even though VF was named immediately in the command text.\n\nExample C — command: \"give the patient a tension pneumothorax on the right side\". A new complication distinct from whatever's already happening: rising HR, falling SpO2, rising RR/distress, falling BP as obstructive shock develops, chained forward realistically over several minutes to its own genuine endpoint (respiratory/cardiac arrest if the remaining projection window allows it to get that far untreated).\n\nExample D — command: \"set the patient's BP to 90 over 60\". A direct instructor-authored value, not tied to any diagnosis: only BPsys/BPdia get entries transitioning to 90/60 (pick a realistic transition of a minute or so unless the command implies otherwise), holding there afterward. Every other vital is left untouched, continuing exactly what it was already scheduled to do.\n\n- Training placeholder pending clinical review, not a validated clinical model."
          },
          TREATMENT_ROUTER_PROMPT: {
            type: 'prompt_text',
            label: 'Treatment catalogue router (classifyTreatmentWithHaiku, Haiku)',
            help: 'The only legitimate Haiku call in the treatment path (CLAUDE.md) — a pure text-matching router against the Medications catalogue, never asked to reason about clinical effect itself. Placeholders (both required): {{catalogue}} — the no-effect/coded-effect drug lists from the Medications section; {{allergies}} — the current patient\'s stated allergies.',
            validate: requirePlaceholders(['{{catalogue}}', '{{allergies}}']),
            default: "You are a fast router for a paramedic training simulator. You are given one or more management actions given together in a single entry, and a fixed catalogue of actions the simulator can already handle with zero AI reasoning — either a known no-effect outcome, or a known coded/randomised effect on a specific tracked vital.\n\nCATALOGUE (id | label | outcome):\n{{catalogue}}\n\nTRACKED VITALS in this simulator: HR, RR, SpO2, EtCO2, BP (systolic/diastolic), Temp, BGL, Ketones, Pain score, Nausea score, GCS. Anything NOT affecting one of these is out of scope for reasoning regardless of its real-world effect.\n\nPatient's stated allergies: {{allergies}}\n\nTASK: Split the input into its distinct actions. For each, decide if it fuzzy-matches a catalogue item (handle typos, dose/route wording, synonyms — e.g. \"300mg aspirin chewed\" matches \"aspirin\"). A catalogue match is INVALID if the patient is allergic to that drug/class per the stated allergies above — treat it as needing full reasoning instead. A catalogue match is ALSO INVALID if a stated dose is clearly outside the normal/standard therapeutic range for that drug (grossly excessive, unusually subtherapeutic, or otherwise abnormal) — the catalogue's fixed outcome only holds for an ordinary, appropriately-dosed administration; an unusual dose needs full reasoning to model toxicity, reduced/exaggerated effect, or other dose-dependent consequences. If no dose is stated at all, assume a standard dose and match normally. If an action doesn't clearly match anything in the catalogue, or you're not confident, mark it unmatched — default to unmatched whenever unsure.\n\nReturn ONLY valid JSON, no prose: {\"items\":[{\"text\":\"<verbatim excerpt of this action from the input>\",\"matchId\":\"<catalogue id, or null>\"}]}"
          },
          PATIENT_VOICE_PROMPT: {
            type: 'prompt_text',
            label: 'Patient voice reply (callPatientAI, Haiku)',
            help: 'Answers a crew question in character via "Talk to Patient", only reached at GCS-Verbal 4-5 (lower tiers use the fixed GCS_V2_SOUNDS/GCS_V3_WORDS in Medications instead — see CLAUDE.md on why those are deliberately not AI-authored). Placeholders (both required): {{patientName}} — the scenario\'s patient name; {{confusedNote}} — filled from the field below when GCS-Verbal is exactly 4, otherwise empty.',
            validate: requirePlaceholders(['{{patientName}}', '{{confusedNote}}']),
            default: "You are voicing the PATIENT in a paramedic training scenario, answering a question the crew just asked out loud. Reply only as the patient would speak — first person, in character, brief (1-3 short sentences), plain lay language, no clinical terms the patient wouldn't use.\n\nOnly say what this patient could plausibly know or perceive themselves (their own symptoms, feelings, what happened to them, basic personal details) — never reveal the provisional diagnosis, clinical reasoning, vital sign numbers, or anything a real patient wouldn't know or say. If asked something the patient wouldn't know or that's irrelevant to them, answer in character as a confused/unsure patient would.\n\nLet their current condition colour HOW they answer: e.g. short of breath = short, breathless sentences; distressed/in pain = anxious tone. Never break character, never mention this being a simulation.\n\nYour name is {{patientName}}. If asked your name, or anything requiring you to refer to yourself, you MUST use this exact name — never invent or substitute a different one.\n{{confusedNote}}\n\nReturn ONLY the spoken reply text — no quotation marks, no stage directions, no prose about the answer."
          },
          PATIENT_VOICE_CONFUSED_NOTE: {
            type: 'string',
            label: 'Confused-patient note (GCS-Verbal 4 only)',
            help: 'Appended into {{confusedNote}} in the prompt above only when the patient\'s GCS-Verbal score is exactly 4 (confused conversation) — empty string otherwise.',
            default: "This patient’s GCS Verbal score is 4 (confused conversation) — they can hold a real back-and-forth conversation and engage with whatever’s actually asked, but they’re disoriented. Vary how much and in which domains — anywhere from mildly off (e.g. unsure of the exact date but still correctly knows the year, where they are, and who they’re talking to) to broadly disoriented (confused about time, place, the situation, AND who’s with them, e.g. mistaking a paramedic for a relative or hospital staff) — stay consistent about which specific things they’re confused about across the conversation rather than re-rolling it every reply. Let the disorientation show up as specific wrong or uncertain details inside an otherwise coherent, on-topic reply — not as rambling that ignores the question, drifts onto an unrelated tangent, or reads as agitated/erratic (that’s delirium, a different presentation) — and never a fully accurate, correctly-oriented answer."
          },
          EXAM_FINDING_PROMPT: {
            type: 'prompt_text',
            label: 'Objective exam finding (answerExamFinding, Haiku)',
            help: 'Answers a crew assessment action (e.g. "I check the patient\'s pupils") via "Assessment" — grounded in the scenario\'s authored secondary-survey/flags data, not gated by consciousness (a physical exam works on an unconscious patient). No placeholders.',
            default: "You are narrating an OBJECTIVE physical exam/assessment finding in a paramedic training scenario — the crew has just described an assessment action out loud (e.g. \"I check the patient's pupils\", \"I auscultate the chest\", \"I palpate the abdomen\"). Reply as a brief, third-person clinical finding statement (1-2 short sentences) — what the crew would observe/feel/hear — not as the patient speaking, and not clinical reasoning or diagnosis.\n\nGround your answer in the scenario data provided below (secondary_survey findings per body system, flags, life threats, current vitals). If the crew's action clearly matches an authored finding, report that finding (in your own words, not verbatim). If it doesn't match anything explicitly authored (e.g. a specific item like pupils that isn't itemised), give a plausible, UNREMARKABLE finding that is consistent with — and never contradicts — the rest of the authored picture (e.g. don't report normal pupils if there's a documented opioid-toxicity/CNS-depression picture; don't report clear lung sounds if there's a documented respiratory life threat).\n\nThis works regardless of the patient's conscious state — a physical exam finding is observable whether or not the patient can respond verbally.\n\nReturn ONLY the finding statement — no quotation marks, no prose about the answer, no clinical reasoning or diagnosis, no mention of this being a simulation."
          }
        },
        readonlyNotes: [
          'Higher risk than the other sections: every prompt here instructs the AI to "Return ONLY valid JSON" in a specific shape that sim_control.html\'s code parses — removing or altering that instruction won\'t error immediately, but can cause AI responses to fail parsing (the call fails safely with an error message, nothing corrupts) or, worse, parse successfully into something that produces a clinically nonsensical trajectory. Test thoroughly after any edit — "Reset section to defaults" (top of page) always restores the shipped text.',
          'These are the SYSTEM prompts only — the per-call user-message data (scenario details, current vitals, treatment history, the crew\'s actual question/command) is always built fresh from live session data in sim_control.html and is not editable here.',
          'The model each call uses is intentionally NOT configurable here: the three trajectory/projection prompts above are Sonnet-only by design (CLAUDE.md — a model picker for these was deliberately removed after it caused cascade bugs), and the three Haiku calls (router, patient voice, exam finding) stay hardcoded to Haiku. This section edits prompt TEXT only.'
        ]
      }

    }
  };
})(typeof window !== 'undefined' ? window : this);
