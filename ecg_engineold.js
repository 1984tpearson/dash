/**
 * ECG Engine — ecg_engine.js
 * Realistic animated ECG for Ambulance Victoria scenario tool
 * Provides ECGEngine class for embedding 12-lead or Lead II strips
 * 
 * Usage:
 *   const ecg = new ECGEngine(containerElement, { mode: '12lead' | 'strip', theme: 'monitor' | 'paper' });
 *   ecg.setRhythm('af', 110, 'none');   // or use mapRhythm()
 *   ecg.setTheme('paper');
 *   ecg.capture();
 *   ecg.resume();
 *   const { key, bpm, bbbMode } = ECGEngine.mapRhythm('Atrial Fibrillation', 126);
 */


// =============================================================
// RHYTHM MAP — converts scenario text strings to engine keys
// =============================================================
const RHYTHM_MAP = [
  // [matchSubstring, engineKey, defaultBpm, bbbMode]
  ['sinus tachycardia',          'stach',   130, 'none'],
  ['sinus bradycardia',          'sbrad',    48, 'none'],
  ['normal sinus',               'nsr',      72, 'none'],
  ['sinus rhythm',               'nsr',      72, 'none'],
  ['sinus arrhythmia',           'nsr',      72, 'none'],
  ['atrial fibrillation',        'af',      110, 'none'],
  ['atrial flutter',             'aflut',    75, 'none'],
  ['supraventricular',           'svt',     190, 'none'],
  ['avnrt',                      'svt',     190, 'none'],
  ['\bsvt\b',                  'svt',     190, 'none'],
  ['ventricular tachycardia',    'vt',      175, 'none'],
  ['ventricular fibrillation',   'vf',        0, 'none'],
  ['\bvf\b',                   'vf',        0, 'none'],
  ['torsades',                   'vt',      175, 'none'],
  ['polymorphic',                'vt',      175, 'none'],
  ['asystole',                   'asys',      0, 'none'],
  ['complete heart block',       'chb',      38, 'none'],
  ['3rd degree',                 'chb',      38, 'none'],
  ['third degree',               'chb',      38, 'none'],
  ['\bchb\b',                  'chb',      38, 'none'],
  ['wenckebach',                 'mob1',     60, 'none'],
  ['mobitz i',                   'mob1',     60, 'none'],
  ['mobitz ii',                  'mob2',     50, 'none'],
  ['2nd degree',                 'mob1',     60, 'none'],
  ['first degree',               'deg1',     70, 'none'],
  ['1st degree',                 'deg1',     70, 'none'],
  ['junctional',                 'junct',    50, 'none'],
  ['\bwpw\b',                  'wpw',      72, 'none'],
  ['wolff',                      'wpw',      72, 'none'],
  ['pvc',                        'pvc',      70, 'none'],
  ['premature ventricular',      'pvc',      70, 'none'],
  ['bigeminy',                   'pvc',      70, 'none'],
  ['idioventricular',            'aivr',     35, 'none'],
  ['hyperkalaemia',              'hyperK',   65, 'none'],
  ['hyperkalemia',               'hyperK',   65, 'none'],
  ['hypokalaemia',               'hypoK',    72, 'none'],
  ['hypokalemia',                'hypoK',    72, 'none'],
  ['prolonged qt',               'longQT',   65, 'none'],
  ['long qt',                    'longQT',   65, 'none'],
  ['pericarditis',               'peri',     90, 'none'],
  ['\bnstemi\b',               'nstemi',   85, 'none'],
  ['pulmonary embolism',         'pe',      110, 'none'],
  ['brugada',                    'brugada',  72, 'none'],
  ['inferior stemi',             'stemi-inf',72, 'none'],
  ['anterior stemi',             'stemi-ant',72, 'none'],
  ['lateral stemi',              'stemi-lat',72, 'none'],
  ['posterior stemi',            'stemi-post',72,'none'],
  ['\bstemi\b',                'stemi-ant',72, 'none'],
  ['st elevation',               'stemi-ant',72, 'none'],
  ['left bundle',                'nsr',      72, 'lbbb'],
  ['\blbbb\b',                 'nsr',      72, 'lbbb'],
  ['right bundle',               'nsr',      72, 'rbbb'],
  ['\brbbb\b',                 'nsr',      72, 'rbbb'],
  ['pulseless electrical',       'sbrad',    50, 'none'],
  ['\bpea\b',                  'sbrad',    50, 'none'],
  ['hypothermia',                'sbrad',    40, 'none'],
  ['vvi',                        'vvipace',  72, 'none'],
  ['aai',                        'aaipace',  72, 'none'],
  ['ddd',                        'dddpace',  72, 'none'],
  ['paced',                      'vvipace',  72, 'none'],
];

function mapRhythm(rhythmStr, hrOverride) {
  if (!rhythmStr) return { key: 'nsr', bpm: hrOverride || 72, bbbMode: 'none' };
  const r = rhythmStr.toLowerCase();
  for (const [match, key, defaultBpm, bbb] of RHYTHM_MAP) {
    if (new RegExp(match).test(r)) {
      return { key, bpm: hrOverride || defaultBpm, bbbMode: bbb };
    }
  }
  return { key: 'nsr', bpm: hrOverride || 72, bbbMode: 'none' };
}



class ECGEngine {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.getElementById(container) : container;
    this.options = Object.assign({ mode:'12lead', theme:'monitor', showCapture:true, showControls:false }, options);
    this._frozen = false;
    this._leadsFrozen = false;
    this._captureMode = false;
    this._onCapture = options.onCapture || null;
    this._lastMs = 0;
    this._running = false;
    this._initCore();
  }

  // ── Public API ───────────────────────────────────────────────────────

  static mapRhythm(rhythmStr, hrOverride) { return mapRhythm(rhythmStr, hrOverride); }

  setRhythm(key, bpm, bbbOverride) {
    // Accept natural string or engine key
    if (!this._rhythms || !this._rhythms[key]) {
      const mapped = mapRhythm(key, bpm);
      key = mapped.key;
      bpm = bpm || mapped.bpm;
      bbbOverride = bbbOverride || mapped.bbbMode;
    }
    bpm = bpm || (this._rhythms && this._rhythms[key] ? this._rhythms[key].defaultBpm : 72);
    this._setRhythm(key, bpm, bbbOverride || 'none');
  }

  setTheme(name) { if (this._applyTheme) this._applyTheme(name); }
  capture()      { this._captureMode = true; }
  resume()       { this._frozen = false; this._leadsFrozen = false; this._captureMode = false; this._lastMs = 0; if (!this._running) { this._running = true; requestAnimationFrame(ts => this._drawFrame(ts)); } }
  destroy()      { this._frozen = true; this._running = false; if (this.container) this.container.innerHTML = ''; }

  _initCore() {
    const self = this;
    const container = this.container;
    const mode = this.options.mode;

    // ── Timing constants ─────────────────────────────────────────────
    const LEAD_LAYOUT = ['I','aVR','V1','V4','II','aVL','V2','V5','III','aVF','V3','V6'];
    const LEAD_H = mode === 'strip' ? 0 : 110;
    const STRIP_H = mode === 'strip' ? 140 : 140;
    const MONITOR_W = container.clientWidth || 856;
    const LEAD_W = Math.floor(MONITOR_W / 4);
    const STRIP_W = MONITOR_W;
    const PX_PER_MS = STRIP_W / 6000;
    const SMALL_SQ_MS = 40;
    const SMALL_SQ_PX = SMALL_SQ_MS * PX_PER_MS;
    const BIG_SQ_PX = SMALL_SQ_PX * 5;

    // ── Build DOM ────────────────────────────────────────────────────
    container.style.position = 'relative';
    container.style.display = 'block';
    container.innerHTML = '';

    const bgCanvas = document.createElement('canvas');
    bgCanvas.style.cssText = 'position:absolute;top:0;left:0;z-index:1;pointer-events:none;';
    container.appendChild(bgCanvas);
    const bgCtx = bgCanvas.getContext('2d');

    let leadsGrid = null;
    const leadCanvases = {};
    const LEAD_COL = {I:0,aVR:1,V1:2,V4:3,II:0,aVL:1,V2:2,V5:3,III:0,aVF:1,V3:2,V6:3};

    if (mode !== 'strip') {
      leadsGrid = document.createElement('div');
      leadsGrid.style.cssText = `display:grid;grid-template-columns:repeat(4,1fr);gap:0;background:transparent;position:relative;z-index:2;`;
      container.appendChild(leadsGrid);

      LEAD_LAYOUT.forEach(name => {
        const cell = document.createElement('div');
        cell.style.cssText = `position:relative;width:${LEAD_W}px;height:${LEAD_H}px;background:transparent;`;
        const tag = document.createElement('span');
        tag.style.cssText = 'position:absolute;top:3px;left:5px;font-size:12px;font-weight:bold;letter-spacing:1px;z-index:5;pointer-events:none;';
        tag.className = 'ecg-lead-label';
        tag.textContent = name;
        const tc = document.createElement('canvas');
        tc.style.cssText = 'position:absolute;top:0;left:0;z-index:3;background:transparent;width:100%;height:100%;';
        tc.width = LEAD_W; tc.height = LEAD_H;
        cell.appendChild(tc); cell.appendChild(tag);
        leadsGrid.appendChild(cell);
        leadCanvases[name] = { trace: tc };
      });
    }

    const stripWrapper = document.createElement('div');
    stripWrapper.style.cssText = `position:relative;z-index:2;background:transparent;width:${STRIP_W}px;height:${STRIP_H}px;`;
    const stripLabel = document.createElement('span');
    stripLabel.style.cssText = 'position:absolute;top:3px;left:5px;font-size:9px;letter-spacing:1px;z-index:5;pointer-events:none;';
    stripLabel.className = 'ecg-strip-label';
    stripLabel.textContent = mode === 'strip' ? 'LEAD II' : 'LEAD II — RHYTHM STRIP';
    stripWrapper.appendChild(stripLabel);

    const stripTraceC = document.createElement('canvas');
    stripTraceC.style.cssText = 'position:absolute;top:0;left:0;z-index:3;background:transparent;';
    stripTraceC.width = STRIP_W; stripTraceC.height = STRIP_H;
    stripWrapper.appendChild(stripTraceC);
    container.appendChild(stripWrapper);

    // Size background canvas
    const TOTAL_H = mode === 'strip' ? STRIP_H : (LEAD_H * 3 + STRIP_H);
    bgCanvas.width = MONITOR_W; bgCanvas.height = TOTAL_H;
    bgCanvas.style.width = MONITOR_W + 'px'; bgCanvas.style.height = TOTAL_H + 'px';
    container.style.height = TOTAL_H + 'px';

    // ── Theme state ──────────────────────────────────────────────────
    let _traceColour = '#00ff88';
    let _traceGlow   = 'rgba(0,255,136,0.20)';
    let _traceWidth  = 1.5;
    let _themeBg     = '#020a04';
    let _themeGridS  = 'rgba(0,110,50,0.30)';
    let _themeGridL  = 'rgba(0,160,70,0.55)';

// Patient profile + noise + BBB
let patient=generatePatient();
function generatePatient(){
  const r=()=>Math.random();
  return{ampScale:.82+r()*.36,pAmp:.75+r()*.50,tAmp:.70+r()*.60,
         rAmp:.85+r()*.30,prOffset:Math.round((r()-.5)*40),
         qrsWidth:.88+r()*.24,noiseAmp:1.0+r()*1.2};
}
let _nY=0,_nV=0;
function sampleNoise(){
  _nV+=(Math.random()-.5)*.5;_nV*=.72;_nY+=_nV;_nY*=.88;
  return _nY*patient.noiseAmp;
}
let bbbMode='none';
function applyBBB(raw,t,lead){
  if(bbbMode==='none') return raw;
  const l=lead||'II';
  if(bbbMode==='lbbb'){
    const lat=['I','V5','V6','aVL'].includes(l);
    const sep=['V1','V2'].includes(l);
    if(t>105&&t<200){
      if(lat) raw+=gauss(t,148,8,-18);
      if(sep) raw=-gauss(t,145,35,35);
    }
    if(t>280&&t<420&&lat) raw*=-0.9;
    return raw;
  }
  if(bbbMode==='rbbb'){
    if(['V1','V2'].includes(l)){
      raw+=gauss(t,195,18,28);
      if(t>280&&t<420) raw*=-.85;
    }
    if(['I','V5','V6','aVL'].includes(l)) raw+=gauss(t,185,22,-20);
    return raw;
  }
  return raw;
}

// =====================================================================
// PER-LEAD MORPHOLOGY TABLES
// Each entry is a function(ph) -> amplitude in normalised px units
// Calibrated so Lead II matches the single-lead version (MID baseline)
//
// Organisation: for each rhythm we define a morph table keyed by lead name.
// The table stores either a function or {fn, scale} where scale adjusts amplitude.
// Leads not explicitly listed fall back to a sensible default.
// =====================================================================

// --- Shared building blocks ---

// Standard sinus beat Lead II reference
// Fixed timing constants (ms) — same as poc file
const P_PEAK=40,P_WIDTH=22,P_AMP=11;
const Q_ONSET=110,Q_WIDTH=7,Q_AMP=8;
const R_PEAK=130,R_WIDTH=10,R_AMP=68;
const S_TROUGH=155,S_WIDTH=7,S_AMP=12;
const T_PEAK=310,T_WIDTH=55,T_AMP=22;

function sinusII(t){
  const pr=patient.prOffset;
  return gauss(t,P_PEAK,P_WIDTH,P_AMP*patient.pAmp)
        -gauss(t+pr,Q_ONSET,Q_WIDTH,Q_AMP*patient.rAmp)
        +gauss(t+pr,R_PEAK,R_WIDTH,R_AMP*patient.rAmp)
        -gauss(t+pr,S_TROUGH,S_WIDTH,S_AMP*patient.rAmp)
        +gauss(t,T_PEAK,T_WIDTH,T_AMP);
}
// Invert and/or scale for other leads
function makeSinus(pAmp,rAmp,sAmp,tAmp,tInvert){
  return function(ms){
    let y=gauss(ms,P_PEAK, P_WIDTH, pAmp);
    y-=gauss(ms,Q_ONSET,Q_WIDTH, rAmp*0.12);
    y+=gauss(ms,R_PEAK, R_WIDTH, rAmp);
    y-=gauss(ms,S_TROUGH,S_WIDTH,sAmp);
    y+=(tInvert?-1:1)*gauss(ms,T_PEAK,T_WIDTH,tAmp);
    return y;
  };
}
function avrSinus(ms){return -sinusII(ms)*0.7;}

// =============================================================
// VT COMPLEX GENERATOR — asymmetric path-based morphology
// Each patient gets independent rise/plateau/fall/negative parameters
// producing genuinely different shapes rather than variations of one template
// =============================================================
let vtMorph = generateVTMorph();
function generateVTMorph() {
  const r = Math.random;
  // Rise time: how much of the cycle spent rising to peak (fast=steep, slow=gradual)
  const riseTime  = 0.15 + r() * 0.25;   // 15-40% of cycle
  // Peak plateau: flat top vs sharp (0=sharp point, up to 12% flat)
  const peakPlat  = r() < 0.35 ? r() * 0.12 : 0;
  // Fall time: downstroke from peak to zero crossing
  const fallTime  = 0.12 + r() * 0.28;   // 12-40%
  // Zero crossing position (sum of above — clamped so negative gets at least 20%)
  const zc        = Math.min(riseTime + peakPlat + fallTime, 0.78);
  // Amplitudes
  const peakAmp   = 55 + r() * 20;       // 55-75px positive
  const negAmp    = 42 + r() * 30;       // 42-72px negative
  // Shape of each portion
  const peakShape = r();                  // 0=plateau-ish, 1=sharp
  const negShape  = r();                  // 0=broad flat, 1=sharp trough
  // Width scale
  const widthScale = 0.82 + r() * 0.38;
  // M-shape notch (25% chance)
  const mNotch    = r() < 0.25 ? { t: riseTime * 0.65, amp: 8 + r() * 14 } : null;

  return { riseTime, peakPlat, fallTime, zc, peakAmp, negAmp,
           peakShape, negShape, widthScale, mNotch };
}

function vtComplex(t, beatVar) {
  const v  = beatVar || 0;
  const m  = vtMorph;
  const period = 290 * m.widthScale;
  if (t <= 0 || t >= period) return 0;
  const ph = t / period;
  const ampScale = 1.0 + v * 0.14;

  const { riseTime: rise, peakPlat: plat, fallTime: fall,
          zc, peakAmp, negAmp, peakShape, negShape } = m;
  const pA = peakAmp * ampScale;
  const nA = negAmp  * ampScale;

  let y = 0;
  if (ph < rise) {
    // Rising phase — power curve controls shape
    const frac = ph / rise;
    y = pA * Math.pow(frac, 1.0 - peakShape * 0.6);
  } else if (ph < rise + plat) {
    // Plateau at peak
    y = pA * (0.92 + 0.08 * Math.cos((ph - rise) / Math.max(plat, 0.001) * Math.PI));
  } else if (ph < zc) {
    // Falling phase
    const frac = (ph - rise - plat) / fall;
    y = pA * Math.pow(Math.max(1.0 - frac, 0), 1.0 + peakShape * 0.4);
  } else {
    // Negative territory
    const neg = 1.0 - zc;
    const frac = (ph - zc) / neg;
    y = -nA * Math.pow(Math.sin(frac * Math.PI), 1.0 - negShape * 0.5);
  }

  // Optional M-notch on upstroke
  if (m.mNotch && ph < rise + plat) {
    const notchPh = m.mNotch.t;
    const notchW  = rise * 0.18;
    const d = (ph - notchPh) / notchW;
    y -= m.mNotch.amp * Math.exp(-d * d * 4);
  }

  return y;
}

function escapeQRSMs(t){
  return gauss(t,75,30,55)-gauss(t,148,22,30)+gauss(t,270,52,20);
}
// wideII: thin wrapper so lead morphology tables keep working
function wideII(t,beatVar){ return vtComplex(t,beatVar||0); }
// Narrow QRS (SVT) Lead II reference
function narrowII(t){
  // SVT: narrow QRS ms-based, T fixed at ~260ms
  return -gauss(t,110,6,5)+gauss(t,130,9,72)-gauss(t,155,8,18)+gauss(t,260,45,14);
}

// VF sample (used identically across all leads, just scaled)
// AF noise
// Asystole

// =====================================================================
// MORPHOLOGY DEFINITIONS PER RHYTHM PER LEAD
// Format: MORPH[rhythmKey][leadName] = function(ph) -> px deflection
// Missing leads get a default of 0.5× Lead II
// =====================================================================
const MORPH = {};

// --- Helper: build a full 12-lead sinus table ---
// Params: [I, II, III, aVR, aVL, aVF, V1, V2, V3, V4, V5, V6]
// Each entry: [pAmp, rAmp, sAmp, tAmp, tPolarity (+1 or -1)]
function buildSinus(params){
  const leads = ['I','II','III','aVR','aVL','aVF','V1','V2','V3','V4','V5','V6'];
  const tbl = {};
  leads.forEach((name,i)=>{
    const [pA,rA,sA,tA,tP]=params[i];
    tbl[name]=(t)=>{
      // t = ms since beat start; all positions fixed in ms
      let y=gauss(t,P_PEAK, P_WIDTH, pA);
      y-=gauss(t,Q_ONSET,Q_WIDTH, rA*.12);
      y+=gauss(t,R_PEAK, R_WIDTH, rA);
      y-=gauss(t,S_TROUGH,S_WIDTH,sA);
      y+=tP*gauss(t,T_PEAK,T_WIDTH,tA);
      return y;
    };
  });
  return tbl;
}

// Normal sinus rhythm / sinus tachy / sinus brady / PEA — same morphology, different rate
// Lead morphology reference (normal axis ~60°):
// I: upright P,R,T  II: tall upright (reference)  III: smaller upright
// aVR: inverted everything  aVL: small/biphasic  aVF: upright like II but smaller
// V1: rS pattern (small r, big S, biphasic/inverted P)
// V2: rS (bigger r than V1)  V3: RS transition  V4: Rs (R>S)
// V5: qRs (tallest R)  V6: qR (smaller R, small s)
const sinusParams=[
 //pA  rA   sA   tA   tP
  [8,  50,  6,   16,  1],  // I
  [11, 68,  12,  22,  1],  // II (reference)
  [6,  30,  4,   12,  1],  // III
  [-8,-48, -5,  -16, -1],  // aVR (inverted: use negative P and negative T flip via tP=-1 but note sign)
  [4,  20,  3,   8,   1],  // aVL (small)
  [8,  45,  8,   18,  1],  // aVF
  [-4, -8,  30,  -6, -1],  // V1: small r, deep S, inverted T (rS pattern, biphasic P → neg component)
  [3,  12,  35,  4,   1],  // V2: small r, still deep S, upright T
  [5,  32,  28,  12,  1],  // V3: transition (RS ≈ equal)
  [6,  58,  18,  18,  1],  // V4: R>S
  [5,  65,  10,  20,  1],  // V5: tallest R, small S
  [5,  52,  6,   18,  1],  // V6: tall R, tiny S, small septal q
];

// aVR special: whole thing inverted
function buildSinusWithAVR(params){
  const t = buildSinus(params);
  const [pA,rA,sA,tA] = params[3];
  t['aVR']=(ms)=>{
    let y=gauss(ms,P_PEAK, P_WIDTH, pA);
    y-=gauss(ms,Q_ONSET,Q_WIDTH, Math.abs(rA)*.12*Math.sign(rA));
    y+=gauss(ms,R_PEAK, R_WIDTH, rA);
    y-=gauss(ms,S_TROUGH,S_WIDTH,sA);
    y+=gauss(ms,T_PEAK, T_WIDTH, tA);
    return y;
  };
  return t;
}
MORPH.nsr   = buildSinusWithAVR(sinusParams);
MORPH.stach = MORPH.nsr;
MORPH.sbrad = MORPH.nsr;

// ---- SVT: narrow QRS, no visible P, retrograde P pseudo-S, rate compressed T ----
function buildSVT(){
  const t={};
  // SVT: narrow QRS, all positions fixed in ms. Scale factors per lead for polarity/amplitude.
  // narrowQRS(ms): Q@110ms, R@130ms, S@155ms, T@260ms — fixed widths
  function svtLead(qA,rA,sA,tA){
    return (ms)=>-gauss(ms,110,6,qA)+gauss(ms,130,9,rA)-gauss(ms,155,8,sA)+gauss(ms,260,45,tA);
  }
  t['I']  =svtLead(4, 52, 8,  13);
  t['II'] =(ms)=>narrowII(ms); // reference
  t['III']=svtLead(3, 28, 5,  9);
  t['aVR']=svtLead(-4,-55,-10,-11); // inverted
  t['aVL']=svtLead(3, 22, 4,  7);
  t['aVF']=svtLead(4, 48, 7,  12);
  t['V1'] =svtLead(3, -10,18, -5); // rS in V1
  t['V2'] =svtLead(2, 15, 28, 3);
  t['V3'] =svtLead(3, 34, 20, 10);
  t['V4'] =svtLead(4, 55, 13, 14);
  t['V5'] =svtLead(4, 62, 8,  16);
  t['V6'] =svtLead(3, 48, 5,  14);
  return t;
}
MORPH.svt = buildSVT();

// ---- VT: wide bizarre, positive concordance V1-V6 (RBBB-like from LV origin), AV dissociation P ----
// aVR: tall monophasic R (VT hallmark), V1 tall R > S, V6 rS (small r deep S)
function buildVT(){
  const t={};
  // P wave for AV dissociation (independent ~72bpm, handled in rhythm engine)
  // Wide QRS morphology per lead:
  // I: broad QS (negative)   II: broad slurred upright  III: upright  
  // aVR: tall monophasic R (positive, diagnostic of VT)  aVL: QS  aVF: upright wide
  // V1: tall R (RBBB-like)   V2-V4: positive concordance (all upright)
  // V5: upright  V6: rS (small r, deep S — key VT sign)
  function wideUp(rA,sA,tA){
    const scale=rA/65;
    return (ms,v)=>scale*wideII(ms,v||0);
  }
  function wideDown(rA,sA,tA){
    const scale=rA/65;
    return (ms,v)=>-scale*wideII(ms,v||0);
  }
  // VT leads — all positions fixed in ms (same as wideII)
  // I: QS (inverted), aVR: tall monophasic R, V6: rS
  t['I']  = (ms,v)=>-wideII(ms,v)*0.75; // QS — inverted
  t['II'] = wideUp(58,22,30);
  t['III']= wideUp(38,14,18);
  t['aVR']= (ms,v)=>wideII(ms,v)*0.85+gauss(ms,80,40,5); // tall R in aVR
  t['aVL']= (ms,v)=>-wideII(ms,v)*0.65; // QS
  t['aVF']= wideUp(44,16,22);
  t['V1'] = (ms,v)=>wideII(ms,v)*0.78; // tall R in V1
  t['V2'] = wideUp(55,18,25);
  t['V3'] = wideUp(50,16,22);
  t['V4'] = wideUp(45,14,20);
  t['V5'] = wideUp(40,12,18);
  t['V6'] = (ms,v)=>gauss(ms,28,16,5)-wideII(ms,v)*0.60; // rS
  return t;
}
MORPH.vt = buildVT();
// AIVR same morphology as VT (both ventricular)
MORPH.aivr = MORPH.vt;

// ---- CHB: independent P waves + wide ventricular escape (same VT morph but slower) ----
MORPH.chb = MORPH.vt; // morphology same, rate different — handled in engine

// ---- AF: QRS morphology normal (same direction as sinus), no P, fibrillatory baseline ----
// We reuse sinus QRS shape scaled per lead
MORPH.af = (()=>{
  const t={};
  // Same QRS polarity/amplitude as sinus but no P wave, add noise externally
  const afQRS=(rA,sA,tA,tP)=>(ms)=>{
    let y=-gauss(ms,110,6,rA*.10)+gauss(ms,130,10,rA)-gauss(ms,155,6,sA)+tP*gauss(ms,290,50,tA);
    return y;
  };
  t['I']  =afQRS(50, 6,16, 1);
  t['II'] =afQRS(56, 9,16, 1);
  t['III']=afQRS(30, 4,10, 1);
  t['aVR']=afQRS(-48,-5,-14,-1);
  t['aVL']=afQRS(20, 3, 7, 1);
  t['aVF']=afQRS(44, 7,14, 1);
  t['V1'] =afQRS(-8,28,-5,-1);
  t['V2'] =afQRS(12,32, 4, 1);
  t['V3'] =afQRS(32,25,10, 1);
  t['V4'] =afQRS(55,16,16, 1);
  t['V5'] =afQRS(62, 9,18, 1);
  t['V6'] =afQRS(50, 5,16, 1);
  return t;
})();

// ---- Atrial flutter: F-waves most prominent in inferior leads (II,III,aVF) ----
// In V1: positive flutter waves (opposite to inferior leads for typical AFL)
// QRS morphology: narrow, normal axis
MORPH.aflut = (()=>{
  const t={};
  // fScale: how prominent flutter waves are in each lead
  // Negative in inferior (II,III,aVF), positive in V1
  const fScales={I:0.2,II:1.0,III:0.8,aVR:-0.3,aVL:-0.1,aVF:0.9,V1:-0.4,V2:0.1,V3:0.1,V4:0.1,V5:0.1,V6:0.1};
  const qrsScales={I:0.7,II:1.0,III:0.4,aVR:-0.7,aVL:0.3,aVF:0.6,V1:-0.2,V2:0.2,V3:0.5,V4:0.85,V5:0.9,V6:0.75};
  const leads=['I','II','III','aVR','aVL','aVF','V1','V2','V3','V4','V5','V6'];
  leads.forEach(name=>{
    const fs=fScales[name]||0;
    const qs=qrsScales[name]||0;
    t[name]=(ms,flutPh)=>{
      const fp=flutPh;
      const fWave=fs*(fp<0.70 ? 8-fp*22 : -7.4+(fp-0.70)*38);
      // QRS fixed in ms
      const qrs=qs*(-gauss(ms,110,6,6)+gauss(ms,130,9,60)-gauss(ms,155,6,9)+gauss(ms,290,45,9));
      return fWave+qrs;
    };
  });
  return t;
})();

// ---- Mobitz I & II: normal QRS morphology, P waves with progressive/fixed PR ----
// Morphology same as sinus, handled externally for P/QRS relationship
MORPH.mob1 = MORPH.nsr;
MORPH.mob2 = MORPH.nsr;

// ---- VF & Asystole: rhythm-level, no per-lead morphology needed (all leads get same chaotic/flat signal) ----
MORPH.vf   = null; // handled at engine level
MORPH.asys = null;

// =====================================================================
// STEMI MORPHOLOGY
// All STEMIs run on NSR baseline (72bpm) with territory-specific ST changes.
// ST elevation modelled as a raised J-point + sloped ST segment blending into T.
// ST depression (reciprocal) modelled as J-point depression.
//
// steOffset(ph, jPoint, mag, slope, tAmp, tPol):
//   jPoint = phase at end of QRS (~0.36)
//   mag    = J-point elevation (+) or depression (-) in px
//   slope  = ST slope (0=flat, +ve=upsloping, -ve=downsloping)
//   tAmp   = T wave amplitude
//   tPol   = T wave polarity (+1 upright, -1 inverted)
// =====================================================================
function stBase(rA,sA){
  return (ms)=>{
    let y=gauss(ms,P_PEAK, P_WIDTH,rA*.16);
    y-=gauss(ms,Q_ONSET,Q_WIDTH, rA*.12);
    y+=gauss(ms,R_PEAK, R_WIDTH, rA);
    y-=gauss(ms,S_TROUGH,S_WIDTH,sA);
    return y;
  };
}
// ST+T segment overlay: elevation or depression on top of QRS baseline
function stSeg(mag, tAmp, tPol){
  // ms-based: J-point ~175ms, T peak ~340ms (elevated or depressed)
  return (ms)=>{
    if(ms<160) return 0;
    const st = mag * Math.exp(-Math.pow((ms-240)/60,2)*2);
    const t  = tPol * tAmp * gauss(ms, 340, 85, 1);
    const plateau = (ms>=175 && ms<=480) ? mag*(1-Math.pow((ms-175)/310,2))*0.8 : 0;
    return st + t + plateau;
  };
}

// Build a full STEMI morph table given per-lead [rAmp, sAmp, steMag, tAmp, tPol]
// steSign: +1=elevation, -1=depression (reciprocal)
function buildSTEMI(perLead){
  const t={};
  const leads=['I','II','III','aVR','aVL','aVF','V1','V2','V3','V4','V5','V6'];
  leads.forEach(n=>{
    const [rA,sA,stMag,tA,tPol]=perLead[n]||[40,8,0,18,1];
    const base=stBase(rA,sA);
    const st=stSeg(stMag,tA,tPol);
    t[n]=(ph)=>base(ph)+st(ph);
  });
  return t;
}

// ── INFERIOR STEMI (RCA) ──────────────────────────────────────────────
// STE in II, III, aVF. Reciprocal STD in I, aVL.
// Often ST changes in V1 (RV involvement). V leads relatively normal.
MORPH['stemi-inf'] = buildSTEMI({
  'I':   [50,  6, -8,  10, -1],  // reciprocal depression
  'II':  [68, 12, 14,  28,  1],  // STE — tombstone T
  'III': [38,  8, 16,  24,  1],  // STE — often largest here
  'aVR': [-48,-5,  4, -14, -1],  // slight reciprocal
  'aVL': [20,  3,-10,   8, -1],  // reciprocal depression
  'aVF': [52,  9, 13,  26,  1],  // STE
  'V1':  [-8, 28,  5,  -4, -1],  // may show STE if RV involved
  'V2':  [12, 32,  0,   5,  1],  // normal
  'V3':  [32, 25,  0,  12,  1],  // normal
  'V4':  [58, 16,  0,  18,  1],  // normal
  'V5':  [65, 10,  0,  20,  1],  // normal
  'V6':  [52,  6,  0,  18,  1],  // normal
});

// ── ANTERIOR STEMI (LAD) ─────────────────────────────────────────────
// STE in V1-V4 (sometimes V5). Reciprocal STD in inferior leads II, III, aVF.
// aVR often shows STE (proximal LAD occlusion sign).
MORPH['stemi-ant'] = buildSTEMI({
  'I':   [50,  6,  4,  18,  1],  // slight STE (septal involvement)
  'II':  [68, 12, -6,  10, -1],  // reciprocal depression
  'III': [38,  8, -8,   8, -1],  // reciprocal depression
  'aVR': [-48,-5,  8, -18, -1],  // STE in aVR = proximal LAD sign
  'aVL': [20,  3,  5,  10,  1],  // STE (lateral extension)
  'aVF': [52,  9, -5,  10, -1],  // reciprocal depression
  'V1':  [-8, 28, 12,  -8, -1],  // STE + Q wave forming (loss of r)
  'V2':  [10, 35, 18,  22,  1],  // STE — hyperacute T
  'V3':  [28, 28, 20,  26,  1],  // STE — often tallest
  'V4':  [52, 18, 16,  24,  1],  // STE
  'V5':  [62, 10,  6,  18,  1],  // lesser STE
  'V6':  [50,  6,  2,  16,  1],  // normal/minimal
});

// ── LATERAL STEMI (Circumflex) ────────────────────────────────────────
// STE in I, aVL, V5, V6. Reciprocal STD in inferior leads (II, III, aVF).
MORPH['stemi-lat'] = buildSTEMI({
  'I':   [50,  6, 14,  22,  1],  // STE
  'II':  [68, 12, -6,  10, -1],  // reciprocal depression
  'III': [38,  8,-10,   7, -1],  // reciprocal depression
  'aVR': [-48,-5, -6, -10, -1],  // reciprocal (inverted lead)
  'aVL': [20,  3, 14,  18,  1],  // STE — often most prominent
  'aVF': [52,  9, -5,   9, -1],  // reciprocal depression
  'V1':  [-8, 28,  0,  -4, -1],  // normal/slightly depressed
  'V2':  [12, 32, -2,   4,  1],  // normal
  'V3':  [32, 25,  0,  12,  1],  // normal
  'V4':  [58, 16,  2,  16,  1],  // minimal
  'V5':  [65, 10, 12,  20,  1],  // STE
  'V6':  [52,  6, 14,  18,  1],  // STE
});

// ── POSTERIOR STEMI (RCA/Cx posterior branch) ─────────────────────────
// No direct STE visible. Mirror-image changes in V1-V3:
//   - ST DEPRESSION (not elevation)
//   - Tall broad R wave (= posterior Q wave mirrored)
//   - Tall upright T wave (= posterior inverted T mirrored)
// V7-V9 would show STE but we don't have those leads.
// Inferior leads may show co-existing inferior STE (posterior often with inferior).
MORPH['stemi-post'] = buildSTEMI({
  'I':   [50,  6,  0,  16,  1],  // normal
  'II':  [68, 12,  6,  22,  1],  // subtle inferior STE (common co-pattern)
  'III': [38,  8,  8,  18,  1],  // subtle inferior STE
  'aVR': [-48,-5,  2, -14, -1],  // normal
  'aVL': [20,  3, -4,   8, -1],  // slight reciprocal
  'aVF': [52,  9,  6,  20,  1],  // subtle inferior STE
  'V1':  [28, 10,-14,  28,  1],  // tall R + STD + tall upright T (mirror image)
  'V2':  [38,  8,-16,  30,  1],  // tallest reciprocal changes
  'V3':  [42, 10,-12,  26,  1],  // STD + tall T
  'V4':  [58, 16,  0,  18,  1],  // normal
  'V5':  [65, 10,  0,  20,  1],  // normal
  'V6':  [52,  6,  0,  18,  1],  // normal
});

// =====================================================================
// RHYTHM STATE & ENGINES
// One global state shared (all leads advance in lockstep)
// =====================================================================
function makeState(){
  return {ms:0,beat:0,pMs:0,vfT:0,flutMs:0,afRR:550,noiseY:0,noiseV:0,
          // per-lead independent noise for AF/asystole
          noise:{},
  };
}
let state=makeState();

const RHYTHMS={
  nsr:  {label:'SINUS RHYTHM',        defaultBpm:72,  sliderMin:60,  sliderMax:100, sliderNote:''},
  stach:{label:'SINUS TACHYCARDIA',   defaultBpm:130, sliderMin:101, sliderMax:220, sliderNote:''},
  sbrad:{label:'SINUS BRADYCARDIA',   defaultBpm:48,  sliderMin:40,  sliderMax:59,  sliderNote:''},
  svt:  {label:'SVT',                 defaultBpm:190, sliderMin:150, sliderMax:220, sliderNote:''},
  vt:   {label:'VENTRICULAR TACHYCARDIA',defaultBpm:175,sliderMin:100,sliderMax:220,sliderNote:''},
  aivr: {label:'IDIOVENTRICULAR',     defaultBpm:35,  sliderMin:20,  sliderMax:50,  sliderNote:'ESCAPE RANGE'},
  chb:  {label:'3° HEART BLOCK',      defaultBpm:38,  sliderMin:25,  sliderMax:55,  sliderNote:'VENTRICULAR RATE'},
  af:   {label:'ATRIAL FIBRILLATION', defaultBpm:110, sliderMin:60,  sliderMax:180, sliderNote:'MEDIAN VENTRICULAR RATE'},
  aflut:{label:'ATRIAL FLUTTER',      defaultBpm:0,   sliderMin:null,sliderMax:null,sliderNote:'4:1 — 75 VPM'},
  mob1: {label:'MOBITZ I — WENCKEBACH',defaultBpm:0,  sliderMin:null,sliderMax:null,sliderNote:'3:2 WENCKEBACH'},
  mob2: {label:'MOBITZ II',           defaultBpm:0,   sliderMin:null,sliderMax:null,sliderNote:'3:2 CONDUCTION'},
  vf:   {label:'VENTRICULAR FIBRILLATION',defaultBpm:0,   sliderMin:null,sliderMax:null,sliderNote:'NO ORGANISED RHYTHM'},
  deg1:   {label:'1ST DEGREE AV BLOCK',   defaultBpm:70, sliderMin:50,  sliderMax:100, sliderNote:'PR > 200ms'},
  junct:  {label:'JUNCTIONAL RHYTHM',     defaultBpm:50, sliderMin:40,  sliderMax:60,  sliderNote:'AV JUNCTIONAL PACEMAKER'},
  wpw:    {label:'WPW SYNDROME',          defaultBpm:72, sliderMin:60,  sliderMax:100, sliderNote:'PRE-EXCITATION'},
  pvc:    {label:'PVC BIGEMINY',          defaultBpm:70, sliderMin:50,  sliderMax:100, sliderNote:'EVERY OTHER BEAT'},
  hyperK: {label:'HYPERKALAEMIA',         defaultBpm:65, sliderMin:40,  sliderMax:80,  sliderNote:'PEAKED T WAVES / WIDE QRS'},
  hypoK:  {label:'HYPOKALAEMIA',          defaultBpm:72, sliderMin:50,  sliderMax:100, sliderNote:'U WAVES / FLAT T WAVES'},
  longQT: {label:'PROLONGED QT',          defaultBpm:65, sliderMin:50,  sliderMax:90,  sliderNote:'QTc > 500ms'},
  peri:   {label:'PERICARDITIS',          defaultBpm:90, sliderMin:60,  sliderMax:120, sliderNote:'SADDLE ST / PR DEPRESSION'},
  nstemi: {label:'NSTEMI',                defaultBpm:85, sliderMin:60,  sliderMax:120, sliderNote:'ST DEPRESSION / T CHANGES'},
  pe:     {label:'PULMONARY EMBOLISM',    defaultBpm:110,sliderMin:90,  sliderMax:150, sliderNote:'S1Q3T3 / SINUS TACHYCARDIA'},
  brugada:{label:'BRUGADA SYNDROME',      defaultBpm:72, sliderMin:50,  sliderMax:100, sliderNote:'TYPE 1 — V1-V3 COVED STE'},
  asys:    {label:'ASYSTOLE',              defaultBpm:0,  sliderMin:null,sliderMax:null, sliderNote:'NO CARDIAC ACTIVITY'},
  vvipace: {label:'VENTRICULAR PACING (VVI)',defaultBpm:72, sliderMin:40, sliderMax:120, sliderNote:'VENTRICULAR PACED'},
  aaipace: {label:'ATRIAL PACING (AAI)',      defaultBpm:72, sliderMin:40, sliderMax:120, sliderNote:'ATRIAL PACED'},
  dddpace: {label:'AV SEQUENTIAL (DDD)',      defaultBpm:72, sliderMin:40, sliderMax:120, sliderNote:'AV SEQUENTIAL'},
  'stemi-inf': {label:'INFERIOR STEMI',     defaultBpm:72, sliderMin:50, sliderMax:100, sliderNote:'RCA — II · III · aVF'},
  'stemi-ant': {label:'ANTERIOR STEMI',     defaultBpm:72, sliderMin:50, sliderMax:100, sliderNote:'LAD — V1–V4'},
  'stemi-lat': {label:'LATERAL STEMI',      defaultBpm:72, sliderMin:50, sliderMax:100, sliderNote:'Cx — I · aVL · V5–V6'},
  'stemi-post':{label:'POSTERIOR STEMI',    defaultBpm:72, sliderMin:50, sliderMax:100, sliderNote:'STD V1–V3 (mirror image)'},
};

let currentKey='nsr';
let currentBpm=72;

// =====================================================================
// SAMPLE COMPUTATION
// Returns an object {leadName: sampleValue} for one time step
// =====================================================================
function computeSamples(s, dtMs, bpm, key){
  const out={};
  const leads=['I','II','III','aVR','aVL','aVF','V1','V2','V3','V4','V5','V6'];

  if(key==='vf'){
    s.vfT+=dtMs;
    const t=s.vfT/1000;
    const base=Math.sin(2*Math.PI*4.2*t)*30+Math.sin(2*Math.PI*5.8*t+.7)*19+Math.sin(2*Math.PI*3.1*t+1.4)*14+Math.sin(2*Math.PI*7.3*t+2.1)*8;
    const noise=(Math.random()-.5)*18;
    const amp=.82+Math.sin(2*Math.PI*.9*t)*.18;
    const base_v=(base+noise)*amp;
    // Vary amplitude slightly per lead (VF is chaotic, not uniform)
    const vfScales={I:.9,II:1.0,III:.85,aVR:.7,aVL:.6,aVF:.8,V1:.75,V2:.8,V3:.9,V4:1.0,V5:.95,V6:.85};
    leads.forEach(n=>out[n]=base_v*(vfScales[n]||1));
    return out;
  }

  if(key==='asys'){
    leads.forEach(n=>{
      if(!s.noise[n]) s.noise[n]={y:0,v:0};
      const ln=s.noise[n];
      ln.v+=(Math.random()-.5)*.025; ln.v*=.97;
      ln.y+=ln.v; ln.y*=.995;
      out[n]=ln.y*1.8;
    });
    return out;
  }

  if(key==='af'){
    const afMedianRR=60000/(bpm||110);
    s.ms+=dtMs;
    if(s.ms>=s.afRR){
      s.ms-=s.afRR;
      const spread=afMedianRR*0.35;
      s.afRR=Math.max(300,Math.min(1800,afMedianRR+(Math.random()-.5)*2*spread));
    }
    // Fibrillatory noise (shared baseline wander)
    // Tight mean-reverting noise — stays near isoelectric, no wandering baseline
    s.noiseV=(s.noiseV||0)+(Math.random()-.5)*.4; s.noiseV*=.75;
    s.noiseY=(s.noiseY||0)+s.noiseV; s.noiseY*=.82;
    const fib=s.noiseY*2.5;
    leads.forEach(n=>{
      const fn=MORPH.af[n];
      const qrs=fn?fn(s.ms):0;
      // Fibrillatory baseline varies per lead (most visible in V1)
      const fibScale={I:.6,II:1,III:.7,aVR:.5,aVL:.4,aVF:.8,V1:1.2,V2:.9,V3:.7,V4:.5,V5:.4,V6:.3};
      out[n]=qrs+(fib*(fibScale[n]||.5));
    });
    return out;
  }

  if(key==='aflut'){
    s.flutMs=((s.flutMs||0)+dtMs)%200;
    const flutPh=s.flutMs/200;
    s.ms=(s.ms+dtMs)%800;
    leads.forEach(n=>{
      const fn=MORPH.aflut[n];
      out[n]=fn?fn(s.ms,flutPh):0;
    });
    return out;
  }

  if(key==='mob1'){
    const baseRR=1000,grpSize=4;
    const prMs=[160,220,260];
    s.ms+=dtMs;
    if(s.ms>=baseRR){s.ms-=baseRR;s.beat=(s.beat+1)%grpSize;}
    const pScales={I:.7,II:1,III:.5,aVR:-.7,aVL:.3,aVF:.8,V1:-.4,V2:.3,V3:.5,V4:.6,V5:.6,V6:.5};
    const qScales={I:.7,II:1,III:.45,aVR:-.7,aVL:.3,aVF:.65,V1:-.12,V2:.18,V3:.48,V4:.86,V5:.97,V6:.77};
    leads.forEach(n=>{
      const pWave=gauss(s.ms,40,22,10)*(pScales[n]||.5);
      let qrs=0;
      if(s.beat<grpSize-1){
        const qStart=40+prMs[s.beat];
        const base=-gauss(s.ms,qStart,7,7)+gauss(s.ms,qStart+22,10,65)-gauss(s.ms,qStart+45,7,11)+gauss(s.ms,qStart+180,55,20);
        qrs=base*(qScales[n]||.5);
      }
      out[n]=pWave+qrs;
    });
    return out;
  }

  if(key==='mob2'){
    const baseRR=1000,grpSize=3,prMs=160;
    s.ms+=dtMs;
    if(s.ms>=baseRR){s.ms-=baseRR;s.beat=(s.beat+1)%grpSize;}
    const pScales={I:.7,II:1,III:.5,aVR:-.7,aVL:.3,aVF:.8,V1:-.4,V2:.3,V3:.5,V4:.6,V5:.6,V6:.5};
    const qScales={I:.7,II:1,III:.45,aVR:-.7,aVL:.3,aVF:.65,V1:-.12,V2:.18,V3:.48,V4:.86,V5:.97,V6:.77};
    leads.forEach(n=>{
      const pWave=gauss(s.ms,40,22,10)*(pScales[n]||.5);
      let qrs=0;
      if(s.beat<grpSize-1){
        const qStart=40+prMs;
        const base=-gauss(s.ms,qStart,7,7)+gauss(s.ms,qStart+22,10,65)-gauss(s.ms,qStart+45,7,11)+gauss(s.ms,qStart+180,55,20);
        qrs=base*(qScales[n]||.5);
      }
      out[n]=pWave+qrs;
    });
    return out;
  }

  if(key==='chb'){
    // Independent P waves ~75bpm
    const pRR=60000/80; // Atrial independent ~80bpm
    s.pMs=((s.pMs||0)+dtMs)%pRR;
    // Ventricular escape: wide at slider rate
    const vRR=60000/bpm;
    s.ms=(s.ms+dtMs)%vRR;
    const pScales={I:.7,II:1,III:.5,aVR:-.7,aVL:.3,aVF:.8,V1:-.4,V2:.3,V3:.5,V4:.6,V5:.6,V6:.5};
    leads.forEach(n=>{
      const pWave=gauss(s.pMs,40,22,10)*(pScales[n]||.5);
      // CHB escape: use escapeQRSMs — wide but not VT-extreme
      const vBeat=escapeQRSMs(s.ms)*0.85*(
        {I:.8,II:1,III:.5,aVR:-.7,aVL:.4,aVF:.7,V1:-.5,V2:-.3,V3:.2,V4:.7,V5:.9,V6:.8}[n]||.6);
      out[n]=pWave+vBeat;
    });
    return out;
  }

  if(key==='vt'){
    const rr=60000/bpm;
    const prev=s.ms; s.ms=(s.ms+dtMs)%rr;
    if(prev>s.ms) s.vtVar=(Math.random()-0.5)*0.6;
    const v=s.vtVar||0;
    leads.forEach(n=>{
      const fn=MORPH.vt[n];
      out[n]=fn?fn(s.ms,v):0;
    });
    return out;
  }

  if(key==='aivr'){
    const rr=60000/bpm;
    const prev=s.ms; s.ms=(s.ms+dtMs)%rr;
    if(prev>s.ms) s.vtVar=(Math.random()-0.5)*0.4;
    const v=s.vtVar||0;
    leads.forEach(n=>{
      const fn=MORPH.aivr[n];
      out[n]=fn?fn(s.ms,v)*0.85:0;
    });
    return out;
  }

  // STEMI family — NSR morphology with ST/T overlay per territory
  if(key.startsWith('stemi')){
    const rr=60000/bpm;
    s.ms=(s.ms+dtMs)%rr;
    const morph=MORPH[key];
    leads.forEach(n=>{
      const fn=morph?morph[n]:null;
      out[n]=fn?fn(s.ms):0;
    });
    return out;
  }

  // Pacing rhythms — spikes drawn as Zoll dashed lines, not Gaussian
  if(key==='vvipace'||key==='aaipace'||key==='dddpace'){
    const rr=60000/bpm;
    const prev=s.ms; s.ms=(s.ms+dtMs)%rr;
    if(prev>s.ms){
      // Beat start: mark spike type
      if(key==='vvipace') s.spikeV=true;
      else if(key==='aaipace') s.spikeA=true;
      else { s.spikeA=true; }  // DDD atrial spike at beat start
    }
    // DDD ventricular spike at ~160ms
    if(key==='dddpace'){
      const vDelay=160;
      if(s.ms>=vDelay && prev<vDelay) s.spikeV=true;
    }
    const qrsScale={I:.8,II:1,III:.5,aVR:-.7,aVL:.4,aVF:.7,V1:-.5,V2:-.3,V3:.2,V4:.7,V5:.9,V6:.8};
    const pScale  ={I:.7,II:1,III:.5,aVR:-.7,aVL:.3,aVF:.8,V1:-.3,V2:.2,V3:.4,V4:.5,V5:.6,V6:.6};
    leads.forEach(n=>{
      let y=0;
      if(key==='vvipace'){
        y=(qrsScale[n]||.5)*escapeQRSMs(s.ms);
      } else if(key==='aaipace'){
        const sinusMorph=MORPH.nsr[n];
        y=sinusMorph?sinusMorph(s.ms):0;
      } else {
        y=(pScale[n]||.5)*gauss(s.ms,30,18,10);
        y+=(qrsScale[n]||.5)*(gauss(s.ms,200,22,14)+gauss(s.ms,250,35,62)-gauss(s.ms,380,55,52));
      }
      out[n]=y;
    });
    return out;
  }

  // Extended rhythm family — morphology modifications on sinus base
  if(['deg1','junct','wpw','pvc','hyperK','hypoK','longQT','peri','nstemi','pe','brugada'].includes(key)){
    const rr=60000/bpm;
    s.ms=(s.ms+dtMs)%rr;
    const ms=s.ms;

    // Lead-specific scale factors for each new rhythm
    const leadScales = {
      // I use morph.nsr as base and modify per lead per rhythm
      deg1:   {I:.7,II:1,III:.45,aVR:-.7,aVL:.3,aVF:.65,V1:-.12,V2:.18,V3:.48,V4:.86,V5:.97,V6:.77},
      junct:  {I:.7,II:1,III:.45,aVR:-.7,aVL:.3,aVF:.65,V1:-.12,V2:.18,V3:.48,V4:.86,V5:.97,V6:.77},
      wpw:    {I:.75,II:1,III:.5,aVR:-.7,aVL:.4,aVF:.7,V1:.6,V2:.7,V3:.8,V4:.9,V5:.85,V6:.75},
      pvc:    {I:.7,II:1,III:.45,aVR:-.7,aVL:.3,aVF:.65,V1:-.12,V2:.18,V3:.48,V4:.86,V5:.97,V6:.77},
      hyperK: {I:.7,II:1,III:.5,aVR:-.7,aVL:.3,aVF:.7,V1:-.15,V2:.25,V3:.55,V4:.9,V5:1.0,V6:.8},
      hypoK:  {I:.7,II:1,III:.45,aVR:-.7,aVL:.3,aVF:.65,V1:-.12,V2:.3,V3:.5,V4:.8,V5:.95,V6:.75},
      longQT: {I:.7,II:1,III:.45,aVR:-.7,aVL:.3,aVF:.65,V1:-.12,V2:.18,V3:.48,V4:.86,V5:.97,V6:.77},
      peri:   {I:.8,II:1,III:.6,aVR:-.5,aVL:.5,aVF:.75,V1:.3,V2:.6,V3:.8,V4:.9,V5:.9,V6:.8},
      nstemi: {I:.7,II:1,III:.45,aVR:.5,aVL:.3,aVF:.65,V1:.3,V2:.5,V3:.7,V4:.9,V5:.8,V6:.6},
      pe:     {I:.7,II:1,III:.5,aVR:-.3,aVL:.2,aVF:.6,V1:.4,V2:.5,V3:.5,V4:.4,V5:.3,V6:.2},
      brugada:{I:.7,II:1,III:.45,aVR:-.7,aVL:.3,aVF:.65,V1:1.2,V2:1.1,V3:.8,V4:.5,V5:.4,V6:.3},
    };
    const scales = leadScales[key] || leadScales.deg1;

    // Get base sample from poc-style rhythm function
    // Use MORPH.nsr for all and apply modification in sample space
    leads.forEach(n=>{
      const sc = scales[n] || 0.5;
      const baseFn = MORPH.nsr[n];
      let base = baseFn ? baseFn(ms) : 0;

      // Per-rhythm modifications
      if(key==='deg1'){
        // Longer PR — shift QRS+T right by 80ms
        const baseFnShifted = MORPH.nsr[n];
        // Re-compute with PR offset
        base = gauss(ms,P_PEAK,P_WIDTH,P_AMP*patient.pAmp*Math.abs(sc))
              -gauss(ms+80,Q_ONSET,Q_WIDTH,Q_AMP*patient.rAmp*Math.abs(sc))
              +gauss(ms+80,R_PEAK,R_WIDTH,R_AMP*patient.rAmp*Math.abs(sc))*(sc<0?-1:1)
              -gauss(ms+80,S_TROUGH,S_WIDTH,S_AMP*patient.rAmp*Math.abs(sc))*(sc<0?-1:1)
              +gauss(ms,T_PEAK,T_WIDTH,T_AMP*patient.tAmp*Math.abs(sc))*(sc<0?-1:1);
        out[n] = base; return;
      }

      if(key==='junct'){
        // Inverted P in inferior leads, narrow QRS, short PR
        const pSign = ['II','III','aVF'].includes(n) ? -1 : 1;
        base = gauss(ms,55,18,P_AMP*0.9*Math.abs(sc))*pSign
              -gauss(ms,Q_ONSET,Q_WIDTH,Q_AMP*patient.rAmp*Math.abs(sc))*(sc<0?-1:1)
              +gauss(ms,R_PEAK,R_WIDTH,R_AMP*patient.rAmp*Math.abs(sc))*(sc<0?-1:1)
              -gauss(ms,S_TROUGH,S_WIDTH,S_AMP*patient.rAmp*Math.abs(sc))*(sc<0?-1:1)
              +gauss(ms,T_PEAK,T_WIDTH,T_AMP*patient.tAmp*Math.abs(sc))*(sc<0?-1:1);
        out[n] = base; return;
      }

      if(key==='wpw'){
        // Delta wave + short PR + widened QRS + discordant T
        // V1 has dominant R (type A WPW)
        const deltaAmp = ['V1','V2','V3'].includes(n) ? 18 : 14;
        const tDisc = sc < 0 ? 1 : -1; // discordant T
        base = gauss(ms,20,14,P_AMP*0.9*Math.abs(sc))
              +gauss(ms,85,35,deltaAmp*Math.abs(sc))*(sc<0?-1:1)
              +gauss(ms,145,14,R_AMP*patient.rAmp*Math.abs(sc))*(sc<0?-1:1)
              -gauss(ms,175,10,S_AMP*patient.rAmp*Math.abs(sc))*(sc<0?-1:1)
              +gauss(ms,330,65,T_AMP*0.8*patient.tAmp*Math.abs(sc))*tDisc*(sc<0?-1:1);
        out[n] = base; return;
      }

      if(key==='hyperK'){
        // Flat P, wide QRS, peaked narrow T
        const peakT = ['V2','V3','V4','V5'].includes(n) ? 3.2 : 2.2;
        base = gauss(ms,P_PEAK,P_WIDTH*1.5,P_AMP*0.2*Math.abs(sc))
              +gauss(ms,R_PEAK+20,R_WIDTH*2.2,R_AMP*patient.rAmp*Math.abs(sc))*(sc<0?-1:1)
              -gauss(ms,S_TROUGH+25,S_WIDTH*2,S_AMP*patient.rAmp*0.7*Math.abs(sc))*(sc<0?-1:1)
              +gauss(ms,T_PEAK-20,T_WIDTH*0.45,T_AMP*peakT*patient.tAmp*Math.abs(sc))*(sc<0?-1:1);
        out[n] = base; return;
      }

      if(key==='hypoK'){
        // Flat T, U wave, ST depression
        base = gauss(ms,P_PEAK,P_WIDTH,P_AMP*1.1*Math.abs(sc))
              +gauss(ms,R_PEAK,R_WIDTH,R_AMP*patient.rAmp*Math.abs(sc))*(sc<0?-1:1)
              -gauss(ms,S_TROUGH,S_WIDTH,S_AMP*patient.rAmp*Math.abs(sc))*(sc<0?-1:1)
              -gauss(ms,260,60,6*Math.abs(sc))*(sc<0?-1:1)   // ST depression
              +gauss(ms,T_PEAK,T_WIDTH,T_AMP*0.3*patient.tAmp*Math.abs(sc))*(sc<0?-1:1)
              +gauss(ms,T_PEAK+90,35,T_AMP*0.5*Math.abs(sc))*(sc<0?-1:1); // U wave
        out[n] = base; return;
      }

      if(key==='longQT'){
        // Normal QRS, T shifted late and broad
        base = gauss(ms,P_PEAK,P_WIDTH,P_AMP*patient.pAmp*Math.abs(sc))
              +gauss(ms,R_PEAK,R_WIDTH,R_AMP*patient.rAmp*Math.abs(sc))*(sc<0?-1:1)
              -gauss(ms,S_TROUGH,S_WIDTH,S_AMP*patient.rAmp*Math.abs(sc))*(sc<0?-1:1)
              +gauss(ms,420,T_WIDTH*1.4,T_AMP*0.75*patient.tAmp*Math.abs(sc))*(sc<0?-1:1)
              +gauss(ms,490,T_WIDTH*0.9,T_AMP*0.4*patient.tAmp*Math.abs(sc))*(sc<0?-1:1);
        out[n] = base; return;
      }

      if(key==='peri'){
        // Saddle STE in most leads, PR depression
        const stAmp = ['aVR','V1'].includes(n) ? -8 : 10; // reciprocal in aVR
        base = -gauss(ms,80,30,4*Math.abs(sc))  // PR depression
              +gauss(ms,P_PEAK,P_WIDTH,P_AMP*patient.pAmp*Math.abs(sc))
              +gauss(ms,R_PEAK,R_WIDTH,R_AMP*patient.rAmp*Math.abs(sc))*(sc<0?-1:1)
              -gauss(ms,S_TROUGH,S_WIDTH,S_AMP*patient.rAmp*Math.abs(sc))*(sc<0?-1:1)
              +gauss(ms,250,80,stAmp*Math.abs(sc))*(sc<0?-1:1)
              +gauss(ms,T_PEAK,T_WIDTH,T_AMP*0.9*patient.tAmp*Math.abs(sc))*(sc<0?-1:1);
        out[n] = base; return;
      }

      if(key==='nstemi'){
        // STD — most prominent in lateral/anterior leads
        const stdAmp = ['V4','V5','V6','I','aVL'].includes(n) ? 12 : 6;
        base = gauss(ms,P_PEAK,P_WIDTH,P_AMP*patient.pAmp*Math.abs(sc))
              +gauss(ms,R_PEAK,R_WIDTH,R_AMP*patient.rAmp*Math.abs(sc))*(sc<0?-1:1)
              -gauss(ms,S_TROUGH,S_WIDTH,S_AMP*patient.rAmp*Math.abs(sc))*(sc<0?-1:1)
              -gauss(ms,240,55,stdAmp*Math.abs(sc))*(sc<0?-1:1)  // ST depression
              +gauss(ms,T_PEAK,T_WIDTH,T_AMP*0.4*patient.tAmp*Math.abs(sc))*(sc<0?-1:1);
        out[n] = base; return;
      }

      if(key==='pe'){
        // S1Q3T3 pattern: deep S in I, Q+inverted T in III, sinus tachy, RV strain precordial
        const deepS = n==='I' ? 2.5 : (n==='III'||n==='aVF') ? -1.5 : 1;
        const tInv  = ['V1','V2','V3','V4','III'].includes(n);
        base = gauss(ms,P_PEAK,P_WIDTH,P_AMP*1.1*Math.abs(sc))
              +gauss(ms,R_PEAK,R_WIDTH,R_AMP*patient.rAmp*Math.abs(sc))*(sc<0?-1:1)
              -gauss(ms,S_TROUGH+20,S_WIDTH*2.2,S_AMP*deepS*patient.rAmp*Math.abs(sc))*(sc<0?-1:1)
              +gauss(ms,T_PEAK,T_WIDTH,T_AMP*0.7*patient.tAmp*Math.abs(sc))*(tInv?-1:1)*(sc<0?-1:1);
        out[n] = base; return;
      }

      if(key==='brugada'){
        // Type 1: coved STE + T inversion V1-V3; normal elsewhere
        if(['V1','V2','V3'].includes(n)){
          // Coved morphology: R, then elevated ST descending into inverted T
          base = gauss(ms,R_PEAK,R_WIDTH,R_AMP*patient.rAmp*0.7)
                +gauss(ms,190,18,22)                          // R' (RBBB terminal)
                +gauss(ms,260,75,18)                          // coved STE
                -gauss(ms,380,65,22*patient.tAmp);            // inverted T
        } else {
          base = (baseFn?baseFn(ms):0)*sc;
          // Add terminal S in right-looking leads
          if(['I','V5','V6','aVL'].includes(n)) base -= gauss(ms,195,18,12*Math.abs(sc));
        }
        out[n] = base; return;
      }

      out[n] = (baseFn?baseFn(ms):0)*sc;
    });
    return out;
  }

  // Default: sinus-family (nsr, stach, sbrad, svt)
  {
    const rr=60000/bpm;
    s.ms=(s.ms+dtMs)%rr;
    // Pass ms directly — morph functions are now ms-based
    const morph=MORPH[key]||MORPH.nsr;
    leads.forEach(n=>{
      const fn=morph[n];
      out[n]=fn?fn(s.ms):0;
    });
    return out;
  }
}

// =====================================================================
// TRACE DATA BUFFERS
// One Float32Array per lead + strip
// =====================================================================
const traceData={};
const spikeData={};  // per-lead spike position buffers
const MID_LEAD = LEAD_H*0.52;
const MID_STRIP = STRIP_H*0.58; // lower baseline for strip

LEAD_LAYOUT.forEach(n=>{
  traceData[n]=new Float32Array(LEAD_W);
  traceData[n].fill(MID_LEAD);
  spikeData[n]=new Uint8Array(LEAD_W);
});
traceData['strip']=new Float32Array(STRIP_W);
traceData['strip'].fill(MID_STRIP);
spikeData['strip']=new Uint8Array(STRIP_W);

let headX=0;       // lead head (0..LEAD_W)
let stripHead=0;   // strip head (0..STRIP_W)
let lastMs=0;
const ERASE_PX=2;

// =====================================================================
// RENDER LOOP
// =====================================================================
function drawSpikesOn(ctx, spikes, W, hX, erasePx, mid){
  const startX=(hX+erasePx)%W;
  ctx.save();
  ctx.strokeStyle=_traceColour||'#00ff88';
  ctx.lineWidth=1.5;
  ctx.setLineDash([3,3]);
  for(let i=0;i<W-erasePx;i++){
    const x=(startX+i)%W;
    const sp=spikes[x];
    if(!sp) continue;
    if(sp===1||sp===3){
      // Atrial spike — top portion only
      ctx.beginPath();
      ctx.moveTo(x,mid-55); ctx.lineTo(x,mid-5);
      ctx.stroke();
    }
    if(sp===2||sp===3){
      // Ventricular spike — full height
      ctx.beginPath();
      ctx.moveTo(x,mid-60); ctx.lineTo(x,mid+35);
      ctx.stroke();
    }
  }
  ctx.restore();
}

self._drawFrame = function(ts){
  if(!lastMs) lastMs=ts;
  const dtMs=Math.min(ts-lastMs,50);
  lastMs=ts;

  // Lead steps
  const leadSteps=Math.floor(dtMs*PX_PER_MS);
  const msPerLeadPx=1/PX_PER_MS;

  // Strip steps
  const stripSteps=Math.floor(dtMs*STRIP_PX_PER_MS);
  const msPerStripPx=1/STRIP_PX_PER_MS;

  // Generate lead samples
  // Lead cells — freeze when self._captureMode detects wrap
  if(!self._leadsFrozen) {
    for(let i=0;i<leadSteps;i++){
      if(self._captureMode && headX > 0 && (headX+1) % LEAD_W === 0) {
        // Finish this last pixel then freeze leads only
        const samples=computeSamples(state,msPerLeadPx,currentBpm,currentKey);
        const x=headX%LEAD_W;
        const noiseVal=sampleNoise();
        LEAD_LAYOUT.forEach(n=>{
          const bbb=applyBBB(samples[n],state.ms,n);
          traceData[n][x]=MID_LEAD-(bbb*patient.ampScale+noiseVal);
          spikeData[n][x]=0;
          if(state.spikeA){spikeData[n][x]=1;}
          if(state.spikeV){spikeData[n][x]=(spikeData[n][x]===1)?3:2;}
        });
        if(state.spikeA) state.spikeA=false;
        if(state.spikeV) state.spikeV=false;
        headX=(headX+1)%LEAD_W;
        self._leadsFrozen = true; // freeze leads, strip keeps running
        break;
      }
      const samples=computeSamples(state,msPerLeadPx,currentBpm,currentKey);
      const x=headX%LEAD_W;
      const noiseVal=sampleNoise();
      LEAD_LAYOUT.forEach(n=>{
        const bbb=applyBBB(samples[n],state.ms,n);
        traceData[n][x]=MID_LEAD-(bbb*patient.ampScale+noiseVal);
        spikeData[n][x]=0;
        if(state.spikeA){ spikeData[n][x]=1; }
        if(state.spikeV){ spikeData[n][x]=(spikeData[n][x]===1)?3:2; }
      });
      if(state.spikeA) state.spikeA=false;
      if(state.spikeV) state.spikeV=false;
      headX=(headX+1)%LEAD_W;
    }
  }

  // Strip — keeps running after leads freeze, triggers final capture on wrap
  if(!self._frozen) {
    for(let i=0;i<stripSteps;i++){
      // If leads already self._frozen and strip is about to wrap — do final capture
      if(self._leadsFrozen && stripHead > 0 && (stripHead+1) % STRIP_W === 0) {
        // Process last strip pixel
        const samples=computeSamplesStrip(msPerStripPx);
        const x=stripHead%STRIP_W;
        const stripBBB=applyBBB(samples['II'],stripState.ms,'II');
        traceData['strip'][x]=MID_STRIP-(stripBBB*patient.ampScale+sampleNoise()*0.5);
        stripHead=(stripHead+1)%STRIP_W;
        self._doCapture(); // now freeze everything and flash
        break;
      }
      const samples=computeSamplesStrip(msPerStripPx);
      const x=stripHead%STRIP_W;
      const stripBBB=applyBBB(samples['II'],stripState.ms,'II');
      traceData['strip'][x]=MID_STRIP-(stripBBB*patient.ampScale+sampleNoise()*0.5);
      stripHead=(stripHead+1)%STRIP_W;
    }
  }

  // Render all lead canvases
  LEAD_LAYOUT.forEach(n=>{
    const tc=leadCanvases[n].trace;
    const ctx=tc.getContext('2d');
    ctx.clearRect(0,0,LEAD_W,LEAD_H);
    const hX=headX%LEAD_W;
    ctx.fillStyle=_traceGlow||'rgba(0,255,136,0.10)';
    ctx.fillRect(hX,0,2,LEAD_H);
    renderTraceOn(ctx,traceData[n],LEAD_W,hX,ERASE_PX);
    drawSpikesOn(ctx,spikeData[n],LEAD_W,hX,ERASE_PX,MID_LEAD);
  });

  // Render strip
  {
    const ctx=stripTraceC.getContext('2d');
    ctx.clearRect(0,0,STRIP_W,STRIP_H);
    const hX=stripHead%STRIP_W;
    ctx.fillStyle=_traceGlow||'rgba(0,255,136,0.10)';
    ctx.fillRect(hX,0,2,STRIP_H);
    renderTraceOn(ctx,traceData['strip'],STRIP_W,hX,ERASE_PX);
    drawSpikesOn(ctx,spikeData['strip'],STRIP_W,hX,ERASE_PX,MID_STRIP);
  }

  // Keep animating if strip still running after leads self._frozen
  if(!self._frozen) // started externally
}

function redrawAllTraces() {
  // Called when theme changes while self._frozen — redraws everything with new colours
  LEAD_LAYOUT.forEach(n=>{
    const tc=leadCanvases[n].trace;
    const ctx=tc.getContext('2d');
    ctx.clearRect(0,0,LEAD_W,LEAD_H);
    const hX=headX%LEAD_W;
    ctx.fillStyle=_traceGlow||'rgba(0,255,136,0.10)';
    ctx.fillRect(hX,0,2,LEAD_H);
    renderTraceOn(ctx,traceData[n],LEAD_W,hX,ERASE_PX);
    drawSpikesOn(ctx,spikeData[n],LEAD_W,hX,ERASE_PX,MID_LEAD);
  });
  const ctx=stripTraceC.getContext('2d');
  ctx.clearRect(0,0,STRIP_W,STRIP_H);
  const hX=stripHead%STRIP_W;
  ctx.fillStyle=_traceGlow||'rgba(0,255,136,0.10)';
  ctx.fillRect(hX,0,2,STRIP_H);
  renderTraceOn(ctx,traceData['strip'],STRIP_W,hX,ERASE_PX);
  drawSpikesOn(ctx,spikeData['strip'],STRIP_W,hX,ERASE_PX,MID_STRIP);
}

function renderTraceOn(ctx,data,W,hX,erasePx){
  const startX=(hX+erasePx)%W;
  // Glow
  ctx.strokeStyle=_traceGlow||'rgba(0,255,136,0.18)';
  ctx.lineWidth=3;
  ctx.lineJoin='round';ctx.lineCap='round';
  _drawPath(ctx,data,W,startX,erasePx);
  // Line
  ctx.strokeStyle=_traceColour||'#00ff88';
  ctx.lineWidth=_traceWidth||1.5;
  _drawPath(ctx,data,W,startX,erasePx);
}

function _drawPath(ctx,data,W,startX,erasePx){
  ctx.beginPath();
  let first=true,prevX=-1;
  for(let i=0;i<W-erasePx;i++){
    const x=(startX+i)%W;
    if(prevX!==-1&&x<prevX){ctx.stroke();ctx.beginPath();first=true;}
    first?ctx.moveTo(x,data[x]):ctx.lineTo(x,data[x]);
    first=false;prevX=x;
  }
  ctx.stroke();
}

// =====================================================================
// STRIP STATE (separate state so strip runs at its own rate without
// interfering with per-lead state)
// =====================================================================
let stripState=makeState();
function computeSamplesStrip(dtMs){
  return computeSamples(stripState,dtMs,currentBpm,currentKey);
}

// =====================================================================
// HR DISPLAY
// =====================================================================
let hrAnimId=null,afHRInterval=null;
function animHR(target){
  const el=self._hrEl;
  if(target===0){el.textContent='---';return;}
  cancelAnimationFrame(hrAnimId);
  const start=parseInt(el.textContent)||72;
  const t0=performance.now();
  function tick(now){
    const p=Math.min((now-t0)/500,1);
    el.textContent=Math.round(start+(target-start)*p);
    if(p<1)hrAnimId=requestAnimationFrame(tick);
  }
  hrAnimId=requestAnimationFrame(tick);
}

// =====================================================================
// RHYTHM SWITCHING
// =====================================================================
self._setRhythm = function(key){
  currentKey=key;
  state=makeState();
  stripState=makeState();
  patient=generatePatient();
  if(key==='vt'||key==='aivr') vtMorph=generateVTMorph();
  _nY=0; _nV=0;
  LEAD_LAYOUT.forEach(n=>{spikeData[n].fill(0);});
  spikeData['strip'].fill(0);
  // Don't wipe traces or reset heads — rhythm changes seamlessly

  const r=RHYTHMS[key];
  clearInterval(afHRInterval);

  const slider=self._sliderEl;
  const bpmLabel=self._bpmEl;
  const noteEl=self._noteEl;

  if(r.sliderMin!==null){
    slider.disabled=false;
    slider.min=r.sliderMin; slider.max=r.sliderMax;
    const v=r.defaultBpm; // always use rhythm's own default on switch
    slider.value=v; currentBpm=v;
    bpmLabel.textContent=v+' BPM';
  } else {
    slider.disabled=true;
    slider.min=40;slider.max=220;
    currentBpm=r.defaultBpm;
    bpmLabel.textContent='— BPM';
  }

  noteEl.textContent=r.sliderNote||'';
  self._rhythmNameEl.textContent=r.label;

  if(key==='vf'||key==='asys') animHR(0);
  else if(key==='af'){
    animHR(currentBpm);
    afHRInterval=setInterval(()=>{
      const v=Math.floor((Math.random()-.5)*currentBpm*0.3);
      animHR(Math.max(40,Math.min(200,currentBpm+v)));
    },1200);
  }
  else if(key==='aflut') animHR(75);
  else if(key==='mob1'||key==='mob2') animHR(50);
  else animHR(currentBpm);

  self.container.querySelectorAll('.ecg-btn').forEach(b=>b.classList.remove('active'));
  const btnEl=document.getElementById('btn-'+key);
  if(btnEl) btnEl.classList.add('active');
}

self.setBBB = function(mode){
  if((currentKey==='vf'||currentKey==='asys')&&mode!=='none') return;
  bbbMode=mode;
  // trace continues — no wipe on BBB change
  self.container.querySelectorAll('[id^="bbb-"]').forEach(b=>b.classList.remove('active'));
  const el=document.getElementById('bbb-'+mode);
  if(el) el.classList.add('active');
}

self.onSlider = function(val){
  currentBpm=parseInt(val);
  self._bpmEl.textContent=val+' BPM';
  animHR(currentBpm);
}

// =====================================================================
// INIT
// =====================================================================

// =============================================================
// COLOUR THEMES
// =============================================================
let currentTheme = 'monitor';

const THEMES = {
  monitor: {
    bgOuter:'#060606', bgMonitor:'#050f08', bgCanvas:'#020a04',
    trace:'#00ff88', traceGlow:'rgba(0,255,136,0.20)', traceWidth:1.5,
    gridSmall:'rgba(0,110,50,0.30)', gridLarge:'rgba(0,160,70,0.55)',
    separator:'#000000',
    textBright:'#00ff88', textMid:'#00cc66', textDim:'#00aa55', textDimmer:'#005522',
    btnBorder:'#003a1a', btnText:'#008844',
    btnActiveBg:'rgba(0,255,100,0.10)', btnActiveBorder:'#00cc66', btnActiveText:'#00ff88',
    monitorBorder:'#003318',
  },
  paper: {
    bgOuter:'#ddd8cc', bgMonitor:'#faf7f2', bgCanvas:'#faf7f2',
    trace:'#1a1a1a', traceGlow:'rgba(0,0,0,0.08)', traceWidth:1.1,
    gridSmall:'rgba(210,45,45,0.22)', gridLarge:'rgba(180,20,20,0.60)',
    separator:'#e8ddd0',
    textBright:'#1a1a1a', textMid:'#333333', textDim:'#666666', textDimmer:'#aaaaaa',
    btnBorder:'#c8a888', btnText:'#664422',
    btnActiveBg:'rgba(0,0,0,0.08)', btnActiveBorder:'#442200', btnActiveText:'#221100',
    monitorBorder:'#b8a080',
  },
};

function randomTheme(paper) {
  const hue   = Math.floor(Math.random() * 360);
  const gridH = (hue + 20 + Math.floor(Math.random()*40)) % 360;
  const sat   = 80 + Math.floor(Math.random()*20);
  const lit   = paper ? 25 + Math.floor(Math.random()*20)
                      : 55 + Math.floor(Math.random()*20);
  const trace     = `hsl(${hue},${sat}%,${lit}%)`;
  const traceGlow = `hsla(${hue},${sat}%,${lit}%,0.20)`;
  if (paper) {
    const gridS = `hsla(${gridH},55%,45%,0.22)`;
    const gridL = `hsla(${gridH},65%,40%,0.60)`;
    return {
      bgOuter:'#ddd8cc', bgMonitor:'#faf7f2', bgCanvas:'#faf7f2',
      trace, traceGlow, traceWidth:1.1,
      gridSmall:gridS, gridLarge:gridL, separator:'#e8ddd0',
      textBright:trace, textMid:`hsl(${hue},${sat-10}%,${lit+10}%)`,
      textDim:`hsl(${hue},30%,40%)`, textDimmer:'#aaaaaa',
      btnBorder:`hsla(${hue},30%,60%,1)`, btnText:trace,
      btnActiveBg:`hsla(${hue},${sat}%,${lit}%,0.12)`,
      btnActiveBorder:trace, btnActiveText:trace,
      monitorBorder:'#b8a080',
    };
  } else {
    const gridS = `hsla(${gridH},55%,50%,0.28)`;
    const gridL = `hsla(${gridH},65%,55%,0.58)`;
    return {
      bgOuter:'#060606', bgMonitor:'#050f08', bgCanvas:'#020a04',
      trace, traceGlow, traceWidth:1.5,
      gridSmall:gridS, gridLarge:gridL, separator:'#000000',
      textBright:trace, textMid:`hsla(${hue},${sat}%,${lit-10}%,1)`,
      textDim:`hsla(${hue},${sat-20}%,${lit-20}%,1)`, textDimmer:`hsla(${hue},30%,25%,1)`,
      btnBorder:`hsla(${hue},40%,20%,1)`, btnText:trace,
      btnActiveBg:`hsla(${hue},${sat}%,${lit}%,0.12)`,
      btnActiveBorder:trace, btnActiveText:trace,
      monitorBorder:`hsla(${hue},40%,18%,1)`,
    };
  }
}

self._applyTheme = function(t) {
  const r = self.container.style;
  r.setProperty('--bg-outer',           t.bgOuter);
  r.setProperty('--bg-monitor',         t.bgMonitor);
  r.setProperty('--bg-canvas',          t.bgCanvas);
  r.setProperty('--trace',              t.trace);
  r.setProperty('--trace-glow',         t.traceGlow);
  r.setProperty('--grid-small',         t.gridSmall);
  r.setProperty('--grid-large',         t.gridLarge);
  r.setProperty('--text-bright',        t.textBright);
  r.setProperty('--text-mid',           t.textMid);
  r.setProperty('--text-dim',           t.textDim);
  r.setProperty('--text-dimmer',        t.textDimmer);
  r.setProperty('--btn-border',         t.btnBorder);
  r.setProperty('--btn-text',           t.btnText);
  r.setProperty('--btn-active-bg',      t.btnActiveBg);
  r.setProperty('--btn-active-border',  t.btnActiveBorder);
  r.setProperty('--btn-active-text',    t.btnActiveText);
  r.setProperty('--monitor-border',     t.monitorBorder);
  _traceColour = t.trace;
  _traceGlow   = t.traceGlow;
  _themeBg     = t.bgCanvas;
  _themeGridS  = t.gridSmall;
  _themeGridL  = t.gridLarge;
  _traceWidth  = t.traceWidth || 1.5;
  self.container.style.setProperty('--separator', t.separator || '#000');
  // Redraw grid with explicit colours (not CSS var lookup)
  // Redraw all lead grids
  _drawBgGrid(t.bgCanvas, t.gridSmall, t.gridLarge);
  // If self._frozen, redraw all trace canvases with new colour so update is instant
  if(self._frozen || self._leadsFrozen) redrawAllTraces();
  // Update canvas element backgrounds directly
  // Update monitor and body
  const mon = self.container.closest('.monitor') || self.container;
  if (mon) mon.style.cssText += ';background:' + t.bgMonitor + ' !important';
  self.container.style.cssText += ';background:' + t.bgOuter + ' !important';
  self.container.style.cssText += ';background:' + t.bgOuter + ' !important';
  // Explicitly set canvas element backgrounds so no bleed-through on light themes
  const bgGrid = document.getElementById('ecgBgGrid') || document.getElementById('ecgGrid');
  if (bgGrid) bgGrid.style.cssText += ';background:' + t.bgCanvas + ' !important';
}

self._applyThemeByName = function(name) {
  currentTheme = name;
  const t = name === 'random'       ? randomTheme(false)
             : name === 'random-paper' ? randomTheme(true)
             : (THEMES[name] || THEMES.monitor);
  self._applyTheme(t);
  self.container.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('theme-' + name);
  if (btn) btn.classList.add('active');
}

// started externally

// =============================================================
// CAPTURE
// =============================================================
// self._captureMode managed by ECGEngine  // waiting to freeze at end of sweep
// self._leadsFrozen managed by ECGEngine  // leads self._frozen, strip still running
// self._frozen managed by ECGEngine  // everything self._frozen (final state)

self.toggleCapture = function() {
  const btn = self._capBtn;
  if (self._frozen) {
    // Resume — reset all freeze states
    self._frozen = false;
    self._leadsFrozen = false;
    self._captureMode = false;
    lastMs = 0;
    // started externally
    btn.textContent = '⏸ CAPTURE';
    btn.style.borderColor = '';
    btn.style.color = '';
  } else if (self._captureMode || self._leadsFrozen) {
    // Cancel pending capture
    self._captureMode = false;
    self._leadsFrozen = false;
    btn.textContent = '⏸ CAPTURE';
    btn.style.borderColor = '';
  } else {
    // Arm capture — will freeze when head next reaches right edge
    self._captureMode = true;
    btn.textContent = '⌛ CAPTURING...';
    btn.style.borderColor = 'var(--text-bright, #00ff88)';
  }
}

self._doCapture = function() {
  // Called when strip completes its run — freeze everything and flash
  self._frozen = true;
  self._leadsFrozen = false;
  self._captureMode = false;
  const btn = self._capBtn;
  btn.textContent = '▶ RESUME';
  btn.style.borderColor = 'var(--text-bright, #00ff88)';
  btn.style.color = 'var(--text-bright, #00ff88)';
  // Flash
  const flash = self._flashEl;
  // Use dark flash on light themes, light flash on dark themes
  const isDark = _themeBg && _themeBg.includes('02');
  flash.style.background = isDark ? 'white' : 'black';
  flash.style.opacity = '0.12';
  setTimeout(() => { flash.style.opacity = '0'; }, 200);
}
    // Store public refs
    self._rhythms = RHYTHMS;

    // Apply initial theme
    self._applyTheme = function(nameOrObj) {
      if (typeof nameOrObj === 'string') {
        const t = THEMES[nameOrObj] || (nameOrObj === 'random' ? randomTheme(false) : nameOrObj === 'random-paper' ? randomTheme(true) : THEMES.monitor);
        self._applyTheme(t);
      } else {
        // nameOrObj is a theme object
        const t = nameOrObj;
        _traceColour = t.trace;
        _traceGlow   = t.traceGlow;
        _themeBg     = t.bgCanvas;
        _themeGridS  = t.gridSmall;
        _themeGridL  = t.gridLarge;
        _traceWidth  = t.traceWidth || 1.5;
        _drawBgGrid(t.bgCanvas, t.gridSmall, t.gridLarge);
        bgCanvas.style.cssText += ';background:' + t.bgCanvas + ' !important';
        container.style.background = t.bgMonitor;
        // Update lead labels colour
        container.querySelectorAll('.ecg-lead-label,.ecg-strip-label').forEach(el => el.style.color = t.trace);
      }
    };

    // Start draw loop
    self._running = true;
    requestAnimationFrame(ts => self._drawFrame(ts));

  } // end _initCore
} // end class ECGEngine
