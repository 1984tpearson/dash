/**
 * ECG Engine — ecg_engine.js
 * Realistic animated ECG for Ambulance Victoria scenario tool
 * Version: built from ecg_12lead_v3.html
 *
 * Usage:
 *   const ecg = new ECGEngine(containerEl, { mode:'12lead'|'strip', theme:'monitor'|'paper' });
 *   ecg.setRhythm('af', 110, 'none');
 *   ECGEngine.mapRhythm('Atrial Fibrillation', 126) // => {key:'af', bpm:126, bbbMode:'none'}
 */


// =============================================================
// RHYTHM MAP — converts scenario text strings to engine keys
// =============================================================
const RHYTHM_MAP = [
  ['sinus tachycardia',         'stach',    130, 'none'],
  ['sinus bradycardia',         'sbrad',     48, 'none'],
  ['normal sinus',              'nsr',       72, 'none'],
  ['sinus rhythm',              'nsr',       72, 'none'],
  ['sinus arrhythmia',          'nsr',       72, 'none'],
  ['atrial fibrillation',       'af',       110, 'none'],
  ['atrial flutter',            'aflut',     75, 'none'],
  ['supraventricular',          'svt',      190, 'none'],
  ['avnrt',                     'svt',      190, 'none'],
  ['\\bsvt\\b',             'svt',      190, 'none'],
  ['ventricular tachycardia',   'vt',       175, 'none'],
  ['ventricular fibrillation',  'vf',         0, 'none'],
  ['\\bvf\\b',              'vf',         0, 'none'],
  ['torsades',                  'vt',       175, 'none'],
  ['polymorphic',               'vt',       175, 'none'],
  ['asystole',                  'asys',       0, 'none'],
  ['complete heart block',      'chb',       38, 'none'],
  ['3rd degree',                'chb',       38, 'none'],
  ['third degree',              'chb',       38, 'none'],
  ['\\bchb\\b',             'chb',       38, 'none'],
  ['wenckebach',                'mob1',      60, 'none'],
  ['mobitz i',                  'mob1',      60, 'none'],
  ['mobitz ii',                 'mob2',      50, 'none'],
  ['2nd degree',                'mob1',      60, 'none'],
  ['first degree',              'deg1',      70, 'none'],
  ['1st degree',                'deg1',      70, 'none'],
  ['junctional',                'junct',     50, 'none'],
  ['\\bwpw\\b',             'wpw',       72, 'none'],
  ['wolff',                     'wpw',       72, 'none'],
  ['\\bpvc\\b',             'pvc',       70, 'none'],
  ['premature ventricular',     'pvc',       70, 'none'],
  ['bigeminy',                  'pvc',       70, 'none'],
  ['idioventricular',           'aivr',      35, 'none'],
  ['hyperkalaemia',             'hyperK',    65, 'none'],
  ['hyperkalemia',              'hyperK',    65, 'none'],
  ['hypokalaemia',              'hypoK',     72, 'none'],
  ['hypokalemia',               'hypoK',     72, 'none'],
  ['prolonged qt',              'longQT',    65, 'none'],
  ['long qt',                   'longQT',    65, 'none'],
  ['pericarditis',              'peri',      90, 'none'],
  ['\\bnstemi\\b',          'nstemi',    85, 'none'],
  ['pulmonary embolism',        'pe',       110, 'none'],
  ['brugada',                   'brugada',   72, 'none'],
  ['inferior stemi',            'stemi-inf', 72, 'none'],
  ['anterior stemi',            'stemi-ant', 72, 'none'],
  ['lateral stemi',             'stemi-lat', 72, 'none'],
  ['posterior stemi',           'stemi-post',72, 'none'],
  ['\\bstemi\\b',           'stemi-ant', 72, 'none'],
  ['st elevation',              'stemi-ant', 72, 'none'],
  ['left bundle',               'nsr',       72, 'lbbb'],
  ['\\blbbb\\b',            'nsr',       72, 'lbbb'],
  ['right bundle',              'nsr',       72, 'rbbb'],
  ['\\brbbb\\b',            'nsr',       72, 'rbbb'],
  ['pulseless electrical',      'sbrad',     50, 'none'],
  ['\\bpea\\b',             'sbrad',     50, 'none'],
  ['hypothermia',               'sbrad',     40, 'none'],
  ['vvi',                       'vvipace',   72, 'none'],
  ['aai',                       'aaipace',   72, 'none'],
  ['ddd',                       'dddpace',   72, 'none'],
  ['paced',                     'vvipace',   72, 'none'],
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
  constructor(container, options) {
    this.container = typeof container === 'string' ? document.getElementById(container) : container;
    options = options || {};
    this._mode     = options.mode  || '12lead';
    this._theme    = options.theme || 'monitor';
    this._frozen   = false;
    this._leadsFrozen = false;
    this._captureMode = false;
    this._onCapture = options.onCapture || null;
    this._running  = false;
    this._pub      = {};  // public refs set by _initCore
    this._options_theme = options.theme || 'monitor';
    this._options = options;
    this._initCore();
  }

  static mapRhythm(rhythmStr, hrOverride) { return mapRhythm(rhythmStr, hrOverride); }

  setRhythm(key, bpm, bbbOverride) {
    // Accept engine key or natural string
    let _key = key, _bpm = bpm, _bbb = bbbOverride || 'none';
    if (!this._pub.rhythms || !this._pub.rhythms[_key]) {
      const m = mapRhythm(_key, _bpm);
      _key = m.key;
      _bpm = _bpm || m.bpm;
      _bbb = bbbOverride || m.bbbMode || 'none';
    }
    _bpm = _bpm || (this._pub.rhythms && this._pub.rhythms[_key] ? this._pub.rhythms[_key].defaultBpm : 72);
    if (this._pub.setRhythm) this._pub.setRhythm(_key, _bpm, _bbb);
  }

  setTheme(name)  { if (this._pub.setTheme)  this._pub.setTheme(name);  }
  setBBB(mode)    { if (this._pub.setBBB)    this._pub.setBBB(mode);    }
  setStripLead(name) { if (this._pub.setStripLead) this._pub.setStripLead(name); }
  triggerShockArtifact() { if (this._pub.triggerShockArtifact) this._pub.triggerShockArtifact(); }
  getMorphSeed()  { return this._pub.getMorphSeed ? this._pub.getMorphSeed() : null; }
  applySeed(seed) { if (this._pub.applySeed) this._pub.applySeed(seed); }
  capture()       { if (this._pub.toggleCapture) this._pub.toggleCapture(); }
  resume()        { this._frozen = false; this._leadsFrozen = false; this._captureMode = false; if (this._pub.resume) this._pub.resume(); }
  toggleCapture() { if (this._pub.toggleCapture) this._pub.toggleCapture(); }
  onSlider(val)   { if (this._pub.onSlider)  this._pub.onSlider(val);  }
  destroy()       { this._frozen = true; this._running = false; if (this._visObserver) this._visObserver.disconnect(); if (this.container) this.container.innerHTML = ''; }

  _initCore() {
    const self = this;
    const container = this.container;

    // ── Get container width robustly ──────────────────────────────────
    const _getW = () => {
      let w = container.clientWidth || container.offsetWidth;
      if (!w) w = Math.floor(container.getBoundingClientRect().width);
      // Walk up ancestors to find a container with real width
      if (!w) {
        let el = container.parentElement;
        while (el && !w) { w = el.clientWidth || el.offsetWidth; el = el.parentElement; }
      }
      // Use explicit style width if set
      if (!w && container.style.width) w = parseInt(container.style.width);
      return w || 856;
    };

    // ── Inject required DOM structure ─────────────────────────────────
    container.innerHTML = '';
    container.style.position = 'relative';

    // Inject scoped CSS if not already present
    if (!document.getElementById('_ecg_engine_styles')) {
      const s = document.createElement('style');
      s.id = '_ecg_engine_styles';
      s.textContent = `
        .lead-cell { position:relative; overflow:hidden; box-sizing:border-box; }
        .lead-label-tag { position:absolute; top:2px; left:3px; font-size:9px; font-weight:bold;
          letter-spacing:0.5px; z-index:5; pointer-events:none;
          color:#555; font-family:sans-serif; }
        .ecg-strip-label { color:#555 !important; }
      `;
      document.head.appendChild(s);
    }

    const mode = self._mode;

    if (mode === 'strip') {
      // Single strip mode — just a strip wrapper
      container.innerHTML = `
        <div id="_ecg_stripWrapper" style="position:relative;z-index:2;background:transparent;">
          <span style="position:absolute;top:3px;left:5px;font-size:10px;font-weight:bold;letter-spacing:1px;z-index:5;pointer-events:none;color:#00ff88;" class="ecg-strip-label">LEAD II</span>
        </div>`;
    } else {
      container.innerHTML = `
        <canvas id="_ecg_bgGrid" style="position:absolute;top:0;left:0;z-index:1;pointer-events:none;"></canvas>
        <div id="_ecg_leadsGrid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:0;background:transparent;position:relative;z-index:2;"></div>
        <div id="_ecg_stripWrapper" style="position:relative;z-index:2;background:transparent;">
          <span style="position:absolute;top:3px;left:5px;font-size:9px;letter-spacing:1px;z-index:5;pointer-events:none;color:#00ff88;" class="ecg-strip-label">LEAD II — RHYTHM STRIP</span>
        </div>`;
    }

    // Patch document.getElementById to intercept the IDs the v3 code uses
    // by pre-creating elements with those IDs inside our container
    const _ids = {
      'leadsGrid':    container.querySelector('#_ecg_leadsGrid'),
      'stripWrapper': container.querySelector('#_ecg_stripWrapper'),
      'ecgBgGrid':    container.querySelector('#_ecg_bgGrid'),
      'ecgArea':      container,
    };
    const _origGetById = document.getElementById.bind(document);
    const _patchedGetById = (id) => _ids[id] || _origGetById(id);
    // We pass this as a local override into the closure below

    // ── Run the v3 engine in a closure ────────────────────────────────
    // All v3 code runs here with access to container dimensions
    (function(_container, _doc_getElementById, _self) {

    // Shim getElementById for v3 code
    const getElementById = _doc_getElementById;

    // Override MONITOR_W to use actual container width
    const _containerW = _getW();

// =====================================================================
// LAYOUT
// Lead order: row1=[I,aVR,V1,V4], row2=[II,aVL,V2,V5], row3=[III,aVF,V3,V6]
// rhythm strip = Lead II full width
// =====================================================================
const LEAD_LAYOUT = ['I','aVR','V1','V4','II','aVL','V2','V5','III','aVF','V3','V6'];

// Allow caller to pass a target total height; derive LEAD_H and STRIP_H proportionally
// Default total: 110*3 + 140 = 470px  (leads 70%, strip 30%)
const _targetH = (_self._options && _self._options.height) ? parseInt(_self._options.height) : 0;
const _totalH  = _targetH > 200 ? _targetH : 470;
const LEAD_H   = Math.floor(_totalH * 0.70 / 3);   // 3 rows of leads
const STRIP_H  = _totalH - LEAD_H * 3;             // remainder to strip

const _styleW = (container.style.width && !container.style.width.includes('%'))
                ? parseInt(container.style.width) : 0;
const MONITOR_W = _containerW || (_styleW > 100 ? _styleW : 0) || 856;
const LEAD_W = Math.floor(MONITOR_W / 4);
const STRIP_W = MONITOR_W;

// Timing
const PX_PER_MS       = STRIP_W / 6000;
const STRIP_PX_PER_MS = PX_PER_MS;
const SMALL_SQ_MS  = 40;
const SMALL_SQ_PX  = SMALL_SQ_MS * PX_PER_MS;
const BIG_SQ_PX    = SMALL_SQ_PX * 5;
const STRIP_SMALL_PX = SMALL_SQ_PX;
const STRIP_BIG_PX   = BIG_SQ_PX;

// =====================================================================
// BUILD DOM
// =====================================================================
const leadsGrid = getElementById('leadsGrid') || getElementById('_ecg_leadsGrid');
const stripWrapper = getElementById('stripWrapper') || getElementById('_ecg_stripWrapper');
const ecgArea = getElementById('ecgArea') || _container;
const ecgAreaH = LEAD_H * 3 + STRIP_H;
ecgArea.style.height = ecgAreaH + 'px';
ecgArea.style.width = MONITOR_W + 'px';
if (leadsGrid) { leadsGrid.style.width = MONITOR_W + 'px'; }
ecgArea.style.position = 'relative';
stripWrapper.style.height = STRIP_H + 'px';
stripWrapper.style.width = MONITOR_W + 'px';

// Lead cells
const leadCanvases = {};
LEAD_LAYOUT.forEach(name => {
  const cell = document.createElement('div');
  cell.className = 'lead-cell';
  cell.style.width  = LEAD_W + 'px';
  cell.style.height = LEAD_H + 'px';

  const tag = document.createElement('span');
  tag.className = 'lead-label-tag';
  tag.textContent = name;

  const tc = document.createElement('canvas');
  tc.className = 'trace-c';
  tc.width = LEAD_W; tc.height = LEAD_H;
  tc.style.position = 'absolute';
  tc.style.top = '0'; tc.style.left = '0';
  tc.style.zIndex = '3';
  tc.style.background = 'transparent';

  cell.appendChild(tc); cell.appendChild(tag);
  if(leadsGrid) leadsGrid.appendChild(cell);
  leadCanvases[name] = { trace: tc };
});

const TOTAL_H = LEAD_H * 3 + STRIP_H;
const bgGridCanvas = getElementById('ecgBgGrid') || getElementById('_ecg_bgGrid');
if(bgGridCanvas) {
  bgGridCanvas.className = 'ecg-bg-canvas';
  bgGridCanvas.width  = MONITOR_W;
  bgGridCanvas.height = TOTAL_H;
  bgGridCanvas.style.width  = MONITOR_W + 'px';
  bgGridCanvas.style.height = TOTAL_H + 'px';
}
const bgCtx = bgGridCanvas ? bgGridCanvas.getContext('2d') : null;

const stripTraceC = document.createElement('canvas');
stripTraceC.className = 'strip-trace';
stripTraceC.style.position = 'absolute';
stripTraceC.style.top = '0'; stripTraceC.style.left = '0';
stripTraceC.style.zIndex = '3';
stripTraceC.style.background = 'transparent';
stripTraceC.width = STRIP_W; stripTraceC.height = STRIP_H;
stripWrapper.appendChild(stripTraceC);

// =====================================================================
// BACKGROUND GRID
// =====================================================================
function drawBgGrid(bg, smallCol, largeCol) {
  if(!bgCtx) return;
  const bgCol   = bg        || window._themeBg    || '#020a04';
  const sCol    = smallCol  || window._themeGridS || 'rgba(0,110,50,0.30)';
  const lCol    = largeCol  || window._themeGridL || 'rgba(0,160,70,0.55)';
  bgCtx.fillStyle = bgCol;
  bgCtx.fillRect(0, 0, MONITOR_W, TOTAL_H);
  bgCtx.strokeStyle = sCol;
  bgCtx.lineWidth = 0.5;
  bgCtx.beginPath();
  for(let x=0; x<=MONITOR_W; x+=SMALL_SQ_PX){ bgCtx.moveTo(x,0); bgCtx.lineTo(x,TOTAL_H); }
  for(let y=0; y<=TOTAL_H;   y+=SMALL_SQ_PX){ bgCtx.moveTo(0,y); bgCtx.lineTo(MONITOR_W,y); }
  bgCtx.stroke();
  bgCtx.strokeStyle = lCol;
  bgCtx.lineWidth = 1.0;
  bgCtx.beginPath();
  for(let x=0; x<=MONITOR_W; x+=BIG_SQ_PX){ bgCtx.moveTo(x,0); bgCtx.lineTo(x,TOTAL_H); }
  for(let y=0; y<=TOTAL_H;   y+=BIG_SQ_PX){ bgCtx.moveTo(0,y); bgCtx.lineTo(MONITOR_W,y); }
  bgCtx.stroke();
}
drawBgGrid();

// =====================================================================
// WAVEFORM MATH
// =====================================================================
function gauss(t,c,w,a){const d=(t-c)/w;return a*Math.exp(-d*d*4);}

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
    const lateral = ['I','aVL','V5','V6'].includes(l);
    const septal  = ['V1','V2'].includes(l);
    const trans   = ['V3','V4'].includes(l);
    if(septal){
      return -gauss(t,148,28,55) + gauss(t,320,55,-12);
    }
    if(lateral){
      const broadR = gauss(t,138,18,52) + gauss(t,162,14,32);
      const noQ    = -gauss(t,110,6,0);
      const invT   = -gauss(t,T_PEAK,T_WIDTH,18);
      return broadR + noQ + invT;
    }
    if(trans){
      return raw * 0.85 + gauss(t,155,20,12);
    }
    return raw * 0.92 + gauss(t,148,14,8);
  }

  if(bbbMode==='rbbb'){
    const v12  = ['V1','V2'].includes(l);
    const v3v4 = ['V3','V4'].includes(l);
    const lat  = ['I','aVL','V5','V6'].includes(l);
    if(v12){
      const initR  =  gauss(t, 115, 8,  14);
      const midDip = -gauss(t, 155, 10, 22);
      const rPrime =  gauss(t, 196, 11, 48);
      const invT   = -gauss(t, T_PEAK, T_WIDTH, 20);
      return initR + midDip + rPrime + invT;
    }
    if(v3v4){
      return raw * 0.9 - gauss(t, 188, 14, 12);
    }
    if(lat){
      const termS = -gauss(t, 192, 18, 30);
      return raw + termS;
    }
    return raw * 0.95 + gauss(t, 185, 14, 6);
  }

  return raw;
}

// =====================================================================
// TIMING CONSTANTS
// =====================================================================
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
// VT COMPLEX GENERATOR
// =============================================================
let vtMorph = generateVTMorph();
function generateVTMorph() {
  const r = Math.random;
  const riseTime  = 0.15 + r() * 0.25;
  const peakPlat  = r() < 0.35 ? r() * 0.12 : 0;
  const fallTime  = 0.12 + r() * 0.28;
  const zc        = Math.min(riseTime + peakPlat + fallTime, 0.78);
  const peakAmp   = 55 + r() * 20;
  const negAmp    = 42 + r() * 30;
  const peakShape = r();
  const negShape  = r();
  const widthScale = 0.82 + r() * 0.38;
  const mNotch    = r() < 0.25 ? { t: riseTime * 0.65, amp: 8 + r() * 14 } : null;
  return { riseTime, peakPlat, fallTime, zc, peakAmp, negAmp,
           peakShape, negShape, widthScale, mNotch };
}

function vtComplex(t, beatVar) {
  const v  = beatVar || 0;
  const m  = vtMorph;
  const period = 220 * m.widthScale;
  if (t <= 0 || t >= period) return 0;
  const ph = t / period;
  const ampScale = 1.0 + v * 0.14;
  const { riseTime: rise, peakPlat: plat, fallTime: fall,
          zc, peakAmp, negAmp, peakShape, negShape } = m;
  const pA = peakAmp * ampScale;
  const nA = negAmp  * ampScale;
  let y = 0;
  if (ph < rise) {
    const frac = ph / rise;
    y = pA * Math.pow(frac, 1.0 - peakShape * 0.6);
  } else if (ph < rise + plat) {
    y = pA * (0.92 + 0.08 * Math.cos((ph - rise) / Math.max(plat, 0.001) * Math.PI));
  } else if (ph < zc) {
    const frac = (ph - rise - plat) / fall;
    y = pA * Math.pow(Math.max(1.0 - frac, 0), 1.0 + peakShape * 0.4);
  } else {
    const neg = 1.0 - zc;
    const frac = (ph - zc) / neg;
    y = -nA * Math.pow(Math.sin(frac * Math.PI), 1.0 - negShape * 0.5);
  }
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
function wideII(t,beatVar){ return vtComplex(t,beatVar||0); }

// =============================================================
// SVT MORPHOLOGY GENERATOR
// =============================================================
let svtMorph = generateSVTMorph();
function generateSVTMorph() {
  const r = Math.random;
  const ampScale    = 0.88 + r() * 0.26;
  const stClass     = r() < 0.40 ? 0 : r() < 0.67 ? 1 : 2;
  const stDep       = stClass === 0 ? 0 : stClass === 1 ? 1.5 + r() * 2.5 : 4 + r() * 3.5;
  const tInferior   = 0.6 + r() * 0.8;
  const tLateral    = 0.7 + r() * 0.7;
  const tPrecordial = 0.5 + r() * 1.0;
  const tV1pol      = r() < 0.60 ? -1 : r() < 0.80 ? 0 : 1;
  const pseudoR     = r() < 0.50;
  const pseudoRAmp  = pseudoR ? 3 + r() * 6 : 0;
  const pseudoS     = r() < 0.40;
  const pseudoSAmp  = pseudoS ? 3 + r() * 5 : 0;
  const tPos        = 255 + r() * 15;
  const tWidth      = 40 + r() * 12;
  return { ampScale, stDep, tInferior, tLateral, tPrecordial,
           tV1pol, pseudoRAmp, pseudoSAmp, tPos, tWidth };
}

function narrowII(ms){
  const m = svtMorph;
  const a = m.ampScale;
  let y = -gauss(ms,110,6,5*a) + gauss(ms,130,9,72*a) - gauss(ms,155,8,18*a);
  if(m.pseudoSAmp > 0) y -= gauss(ms,170,5,m.pseudoSAmp);
  if(m.stDep > 0) y -= gauss(ms,210,30,m.stDep);
  y += m.tInferior * gauss(ms, m.tPos, m.tWidth, 14);
  return y;
}

// =====================================================================
// MORPHOLOGY DEFINITIONS
// =====================================================================
const MORPH = {};

function buildSinus(params){
  const leads = ['I','II','III','aVR','aVL','aVF','V1','V2','V3','V4','V5','V6'];
  const tbl = {};
  leads.forEach((name,i)=>{
    const [pA,rA,sA,tA,tP]=params[i];
    tbl[name]=(t)=>{
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

// =============================================================
// SINUS MORPHOLOGY GENERATOR
// =============================================================
let sinusMorph = generateSinusMorph();
function generateSinusMorph() {
  const r = Math.random;
  const ampScale    = 0.80 + r() * 0.40;
  const pScale      = 0.75 + r() * 0.50;
  const tInferior   = 0.70 + r() * 0.60;
  const tLateral    = 0.70 + r() * 0.60;
  const tPrecordial = 0.60 + r() * 0.80;
  const tV1pol      = r() < 0.40 ? -1 : 1;
  const rProg       = 0.85 + r() * 0.30;
  return { ampScale, pScale, tInferior, tLateral, tPrecordial, tV1pol, rProg };
}

function getSinusParams() {
  const m = sinusMorph;
  const a = m.ampScale, p = m.pScale, rp = m.rProg;
  return [
   //pA          rA          sA        tA                    tP
    [8*p,        50*a,       6*a,      16*m.tLateral,        1 ],  // I
    [11*p,       68*a,       12*a,     22*m.tInferior,       1 ],  // II
    [6*p,        30*a,       4*a,      12*m.tInferior,       1 ],  // III
    [-8*p,      -48*a,      -5*a,     -16*m.tLateral,       -1 ],  // aVR
    [4*p,        20*a,       3*a,      8*m.tLateral,         1 ],  // aVL
    [8*p,        45*a,       8*a,      18*m.tInferior,       1 ],  // aVF
    [-4*p,      -8*a,        30*a,    -6*m.tPrecordial,      m.tV1pol],  // V1
    [3*p,        12*a*rp,    35*a,     4*m.tPrecordial,      1 ],  // V2
    [5*p,        32*a*rp,    28*a,     12*m.tPrecordial,     1 ],  // V3
    [6*p,        58*a*rp,    18*a,     18*m.tPrecordial,     1 ],  // V4
    [5*p,        65*a,       10*a,     20*m.tLateral,        1 ],  // V5
    [5*p,        52*a,       6*a,      18*m.tLateral,        1 ],  // V6
  ];
}
const sinusParams = getSinusParams();

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
MORPH.nsr   = buildSinusWithAVR(getSinusParams());
MORPH.stach = MORPH.nsr;
MORPH.sbrad = MORPH.nsr;

// ---- SVT ----
function buildSVT(){
  const t = {};
  const m = svtMorph;
  const a = m.ampScale;
  function svtLead(qA, rA, sA, baseTamp, tMult, tPol, stScale, inferiorPS, v1PR){
    return (ms) => {
      let y = -gauss(ms,110,6,qA*a) + gauss(ms,130,9,rA*a) - gauss(ms,155,8,sA*a);
      if(v1PR && m.pseudoRAmp > 0) y += gauss(ms,162,4,m.pseudoRAmp);
      if(inferiorPS && m.pseudoSAmp > 0) y -= gauss(ms,170,5,m.pseudoSAmp);
      if(m.stDep > 0) y -= gauss(ms,210,30,m.stDep * stScale);
      y += tPol * tMult * gauss(ms, m.tPos, m.tWidth, baseTamp);
      return y;
    };
  }
  t['I']   = svtLead(4,  52,   8,  13,  m.tLateral,    1,   0.7,    false, false);
  t['II']  = (ms) => narrowII(ms);
  t['III'] = svtLead(3,  28,   5,   9,  m.tInferior,   1,   0.8,    m.pseudoSAmp>0, false);
  t['aVR'] = svtLead(-4,-55, -10, -11,  m.tLateral,   -1,  -0.5,   false, false);
  t['aVL'] = svtLead(3,  22,   4,   7,  m.tLateral,    1,   0.3,   false, false);
  t['aVF'] = svtLead(4,  48,   7,  12,  m.tInferior,   1,   0.9,   m.pseudoSAmp>0, false);
  t['V1']  = svtLead(3, -10,  18,   6,  m.tPrecordial, m.tV1pol, 0.6, false, m.pseudoRAmp>0);
  t['V2']  = svtLead(2,  15,  28,   4,  m.tPrecordial, 1,   0.7,   false, m.pseudoRAmp>0);
  t['V3']  = svtLead(3,  34,  20,  10,  m.tPrecordial, 1,   0.85,  false, false);
  t['V4']  = svtLead(4,  55,  13,  14,  m.tLateral,    1,   1.0,   false, false);
  t['V5']  = svtLead(4,  62,   8,  16,  m.tLateral,    1,   1.0,   false, false);
  t['V6']  = svtLead(3,  48,   5,  14,  m.tLateral,    1,   0.8,   false, false);
  return t;
}
MORPH.svt = buildSVT();

// ---- VT ----
function buildVT(){
  const t={};
  function wideUp(rA,sA,tA){
    const scale=rA/65;
    return (ms,v)=>scale*wideII(ms,v||0);
  }
  function wideDown(rA,sA,tA){
    const scale=rA/65;
    return (ms,v)=>-scale*wideII(ms,v||0);
  }
  t['I']  = (ms,v)=>-wideII(ms,v)*0.75;
  t['II'] = wideUp(58,22,30);
  t['III']= wideUp(38,14,18);
  t['aVR']= (ms,v)=>wideII(ms,v)*0.85+gauss(ms,80,40,5);
  t['aVL']= (ms,v)=>-wideII(ms,v)*0.65;
  t['aVF']= wideUp(44,16,22);
  t['V1'] = (ms,v)=>wideII(ms,v)*0.78;
  t['V2'] = wideUp(55,18,25);
  t['V3'] = wideUp(50,16,22);
  t['V4'] = wideUp(45,14,20);
  t['V5'] = wideUp(40,12,18);
  t['V6'] = (ms,v)=>gauss(ms,28,16,5)-wideII(ms,v)*0.60;
  return t;
}
MORPH.vt = buildVT();

// ---- AIVR — separate generator, distinct from VT ----
let aivrMorph = generateAIVRMorph();
function generateAIVRMorph() {
  const r = Math.random;
  const isLBBB     = r() < 0.60;
  const widthScale = 0.65 + r() * 0.25;
  const peakAmp    = 48 + r() * 22;
  const negAmp     = 35 + r() * 25;
  const riseTime   = 0.18 + r() * 0.22;
  const fallTime   = 0.14 + r() * 0.24;
  const peakShape  = r();
  const negShape   = r();
  const peakPlat   = r() < 0.30 ? r() * 0.10 : 0;
  const zc         = Math.min(riseTime + peakPlat + fallTime, 0.76);
  const rabbitEar  = r() < 0.30;
  const rabbitAmp  = rabbitEar ? 8 + r() * 14 : 0;
  const tAmpScale  = 0.7 + r() * 0.6;
  return { isLBBB, widthScale, peakAmp, negAmp, riseTime, fallTime,
           peakShape, negShape, peakPlat, zc, rabbitEar, rabbitAmp, tAmpScale };
}

function aivrComplex(t, beatVar, invert) {
  const m = aivrMorph;
  const period = 290 * m.widthScale;
  if (t <= 0 || t >= period) return 0;
  const ph = t / period;
  const ampScale = 1.0 + (beatVar||0) * 0.10;
  const pA = m.peakAmp * ampScale;
  const nA = m.negAmp  * ampScale;
  const { riseTime: rise, peakPlat: plat, fallTime: fall, zc,
          peakShape, negShape } = m;
  let y = 0;
  if (ph < rise) {
    y = pA * Math.pow(ph / rise, 1.0 - peakShape * 0.6);
  } else if (ph < rise + plat) {
    y = pA * (0.92 + 0.08 * Math.cos((ph - rise) / Math.max(plat,0.001) * Math.PI));
  } else if (ph < zc) {
    const frac = (ph - rise - plat) / fall;
    y = pA * Math.pow(Math.max(1.0 - frac, 0), 1.0 + peakShape * 0.4);
  } else {
    const neg = 1.0 - zc;
    const frac = (ph - zc) / neg;
    const sharpness = 0.35 + negShape * 0.30;
    if (frac < 0.45) {
      y = -nA * Math.pow(frac / 0.45, sharpness);
    } else {
      const r2 = (frac - 0.45) / 0.55;
      y = -nA * (1.0 - Math.pow(r2, 0.6));
    }
  }
  return invert ? -y : y;
}

function buildAIVR() {
  const t = {};
  const m = aivrMorph;
  if (m.isLBBB) {
    t['I']   = (ms,v) =>  aivrComplex(ms,v,false) * 0.80;
    t['II']  = (ms,v) =>  aivrComplex(ms,v,false) * 0.90;
    t['III'] = (ms,v) =>  aivrComplex(ms,v,false) * 0.50;
    t['aVR'] = (ms,v) => -aivrComplex(ms,v,false) * 0.75;
    t['aVL'] = (ms,v) =>  aivrComplex(ms,v,false) * 0.65;
    t['aVF'] = (ms,v) =>  aivrComplex(ms,v,false) * 0.60;
    t['V1']  = (ms,v) => {
      let y = -aivrComplex(ms,v,false) * 0.85;
      if (m.rabbitAmp > 0) y += gauss(ms, 40, 20, m.rabbitAmp);
      return y;
    };
    t['V2']  = (ms,v) => -aivrComplex(ms,v,false) * 0.70;
    t['V3']  = (ms,v) => -aivrComplex(ms,v,false) * 0.30;
    t['V4']  = (ms,v) =>  aivrComplex(ms,v,false) * 0.40;
    t['V5']  = (ms,v) =>  aivrComplex(ms,v,false) * 0.85;
    t['V6']  = (ms,v) =>  aivrComplex(ms,v,false) * 0.75;
  } else {
    t['I']   = (ms,v) => -aivrComplex(ms,v,false) * 0.70;
    t['II']  = (ms,v) =>  aivrComplex(ms,v,false) * 0.85;
    t['III'] = (ms,v) =>  aivrComplex(ms,v,false) * 0.55;
    t['aVR'] = (ms,v) =>  aivrComplex(ms,v,false) * 0.80;
    t['aVL'] = (ms,v) => -aivrComplex(ms,v,false) * 0.60;
    t['aVF'] = (ms,v) =>  aivrComplex(ms,v,false) * 0.65;
    t['V1']  = (ms,v) => {
      let y = aivrComplex(ms,v,false) * 0.82;
      if (m.rabbitAmp > 0) y += gauss(ms, 55, 18, m.rabbitAmp);
      return y;
    };
    t['V2']  = (ms,v) =>  aivrComplex(ms,v,false) * 0.72;
    t['V3']  = (ms,v) =>  aivrComplex(ms,v,false) * 0.55;
    t['V4']  = (ms,v) =>  aivrComplex(ms,v,false) * 0.40;
    t['V5']  = (ms,v) => -aivrComplex(ms,v,false) * 0.55;
    t['V6']  = (ms,v) => -aivrComplex(ms,v,false) * 0.65;
  }
  return t;
}
MORPH.aivr = buildAIVR();

MORPH.chb = MORPH.vt;

// ---- AF — per-patient morph generator ----
let afMorph = generateAFMorph();
function generateAFMorph() {
  const r = Math.random;
  const ampScale  = 0.80 + r() * 0.40;
  const tScale    = 0.60 + r() * 0.70;
  const fibClass  = r() < 0.30 ? 'coarse' : r() < 0.80 ? 'medium' : 'fine';
  const fibAmp    = fibClass === 'coarse' ? 3.5 + r() * 1.5
                  : fibClass === 'medium' ? 1.8 + r() * 1.2
                  : 0.6 + r() * 0.6;
  return { ampScale, tScale, fibAmp };
}

function buildAF() {
  const t = {};
  const m = afMorph;
  const a = m.ampScale, ts = m.tScale;
  const afQRS = (rA,sA,tA,tP) => (ms) => {
    let y = -gauss(ms,110,6,rA*a*.10) + gauss(ms,130,10,rA*a)
            - gauss(ms,155,6,sA*a) + tP*gauss(ms,290,50,tA*ts);
    return y;
  };
  t['I']   = afQRS(50,  6,  16,  1);
  t['II']  = afQRS(56,  9,  16,  1);
  t['III'] = afQRS(30,  4,  10,  1);
  t['aVR'] = afQRS(-48,-5, -14, -1);
  t['aVL'] = afQRS(20,  3,   7,  1);
  t['aVF'] = afQRS(44,  7,  14,  1);
  t['V1']  = afQRS(-8, 28,  -5, -1);
  t['V2']  = afQRS(12, 32,   4,  1);
  t['V3']  = afQRS(32, 25,  10,  1);
  t['V4']  = afQRS(55, 16,  16,  1);
  t['V5']  = afQRS(62,  9,  18,  1);
  t['V6']  = afQRS(50,  5,  16,  1);
  return t;
}
MORPH.af = buildAF();

// ---- Atrial flutter ----
MORPH.aflut = (()=>{
  const t={};
  const fScales={I:0.2,II:1.0,III:0.8,aVR:-0.3,aVL:-0.1,aVF:0.9,V1:-0.4,V2:0.1,V3:0.1,V4:0.1,V5:0.1,V6:0.1};
  const qrsScales={I:0.7,II:1.0,III:0.4,aVR:-0.7,aVL:0.3,aVF:0.6,V1:-0.2,V2:0.2,V3:0.5,V4:0.85,V5:0.9,V6:0.75};
  const leads=['I','II','III','aVR','aVL','aVF','V1','V2','V3','V4','V5','V6'];
  leads.forEach(name=>{
    const fs=fScales[name]||0;
    const qs=qrsScales[name]||0;
    t[name]=(ms,flutPh)=>{
      const fp=flutPh;
      const fWave=fs*(fp<0.70 ? 8-fp*22 : -7.4+(fp-0.70)*38);
      const qrs=qs*(-gauss(ms,110,6,6)+gauss(ms,130,9,60)-gauss(ms,155,6,9)+gauss(ms,290,45,9));
      return fWave+qrs;
    };
  });
  return t;
})();

MORPH.mob1 = MORPH.nsr;
MORPH.mob2 = MORPH.nsr;
MORPH.vf   = null;
MORPH.asys = null;

// =====================================================================
// STEMI MORPHOLOGY
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
function stSeg(mag, tAmp, tPol){
  return (ms)=>{
    if(ms<160) return 0;
    const st = mag * Math.exp(-Math.pow((ms-240)/60,2)*2);
    const t  = tPol * tAmp * gauss(ms, 340, 85, 1);
    const plateau = (ms>=175 && ms<=480) ? mag*(1-Math.pow((ms-175)/310,2))*0.8 : 0;
    return st + t + plateau;
  };
}
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

MORPH['stemi-inf'] = buildSTEMI({
  'I':   [50,  6, -8,  10, -1],
  'II':  [68, 12, 14,  28,  1],
  'III': [38,  8, 16,  24,  1],
  'aVR': [-48,-5,  4, -14, -1],
  'aVL': [20,  3,-10,   8, -1],
  'aVF': [52,  9, 13,  26,  1],
  'V1':  [-8, 28,  5,  -4, -1],
  'V2':  [12, 32,  0,   5,  1],
  'V3':  [32, 25,  0,  12,  1],
  'V4':  [58, 16,  0,  18,  1],
  'V5':  [65, 10,  0,  20,  1],
  'V6':  [52,  6,  0,  18,  1],
});

MORPH['stemi-ant'] = buildSTEMI({
  'I':   [50,  6,  4,  18,  1],
  'II':  [68, 12, -6,  10, -1],
  'III': [38,  8, -8,   8, -1],
  'aVR': [-48,-5,  8, -18, -1],
  'aVL': [20,  3,  5,  10,  1],
  'aVF': [52,  9, -5,  10, -1],
  'V1':  [-8, 28, 12,  -8, -1],
  'V2':  [10, 35, 18,  22,  1],
  'V3':  [28, 28, 20,  26,  1],
  'V4':  [52, 18, 16,  24,  1],
  'V5':  [62, 10,  6,  18,  1],
  'V6':  [50,  6,  2,  16,  1],
});

MORPH['stemi-lat'] = buildSTEMI({
  'I':   [50,  6, 14,  22,  1],
  'II':  [68, 12, -6,  10, -1],
  'III': [38,  8,-10,   7, -1],
  'aVR': [-48,-5, -6, -10, -1],
  'aVL': [20,  3, 14,  18,  1],
  'aVF': [52,  9, -5,   9, -1],
  'V1':  [-8, 28,  0,  -4, -1],
  'V2':  [12, 32, -2,   4,  1],
  'V3':  [32, 25,  0,  12,  1],
  'V4':  [58, 16,  2,  16,  1],
  'V5':  [65, 10, 12,  20,  1],
  'V6':  [52,  6, 14,  18,  1],
});

MORPH['stemi-post'] = buildSTEMI({
  'I':   [50,  6,  0,  16,  1],
  'II':  [68, 12,  6,  22,  1],
  'III': [38,  8,  8,  18,  1],
  'aVR': [-48,-5,  2, -14, -1],
  'aVL': [20,  3, -4,   8, -1],
  'aVF': [52,  9,  6,  20,  1],
  'V1':  [28, 10,-14,  28,  1],
  'V2':  [38,  8,-16,  30,  1],
  'V3':  [42, 10,-12,  26,  1],
  'V4':  [58, 16,  0,  18,  1],
  'V5':  [65, 10,  0,  20,  1],
  'V6':  [52,  6,  0,  18,  1],
});

// =====================================================================
// RHYTHM STATE
// =====================================================================
function makeState(){
  return {ms:0,beat:0,pMs:0,vfT:0,flutMs:0,afRR:550,noiseY:0,noiseV:0,pvcBeat:0,pvcMs:0,
          noise:{},
  };
}
let state=makeState();
// Defibrillation artifact — a huge amplifier-saturating vertical deflection,
// NOT part of the cardiac cycle model (unlike spikeA/spikeV pacer ticks,
// which are timed off the heartbeat state machine). Triggered externally via
// triggerShockArtifact() the instant a shock is delivered, independent of
// rhythm/outcome — it's the electrical event hitting the leads, not a
// verdict on whether it worked. Modelled as a column counter (not a single
// pixel) so it reads as a solid blown-out bar across the width of a real
// shock's duration, consumed once per column exactly like spikeA/spikeV are.
let shockArtifactLeadRemaining=0, shockArtifactStripRemaining=0;
function triggerShockArtifact(){
  const artifactMs=45; // how long the bar reads as — quartered from an initial 180ms, which read too wide
  shockArtifactLeadRemaining=Math.max(3,Math.round(artifactMs*PX_PER_MS));
  shockArtifactStripRemaining=Math.max(3,Math.round(artifactMs*STRIP_PX_PER_MS));
}

const RHYTHMS={
  nsr:  {label:'SINUS RHYTHM',        defaultBpm:72,  sliderMin:60,  sliderMax:100, sliderNote:''},
  stach:{label:'SINUS TACHYCARDIA',   defaultBpm:130, sliderMin:101, sliderMax:220, sliderNote:''},
  sbrad:{label:'SINUS BRADYCARDIA',   defaultBpm:48,  sliderMin:40,  sliderMax:59,  sliderNote:''},
  svt:  {label:'SVT',                 defaultBpm:170, sliderMin:150, sliderMax:300, sliderNote:''},
  vt:   {label:'VENTRICULAR TACHYCARDIA',defaultBpm:175,sliderMin:100,sliderMax:220,sliderNote:''},
  aivr: {label:'IDIOVENTRICULAR',     defaultBpm:60,  sliderMin:20,  sliderMax:110, sliderNote:'AIVR RANGE'},
  chb:  {label:'3° HEART BLOCK',      defaultBpm:38,  sliderMin:25,  sliderMax:55,  sliderNote:'VENTRICULAR RATE'},
  af:   {label:'ATRIAL FIBRILLATION', defaultBpm:110, sliderMin:60,  sliderMax:180, sliderNote:'MEDIAN VENTRICULAR RATE'},
  aflut:{label:'ATRIAL FLUTTER',      defaultBpm:0,   sliderMin:null,sliderMax:null,sliderNote:'4:1 — 75 VPM'},
  mob1: {label:'MOBITZ I — WENCKEBACH',defaultBpm:0,  sliderMin:null,sliderMax:null,sliderNote:'3:2 WENCKEBACH'},
  mob2: {label:'MOBITZ II',           defaultBpm:0,   sliderMin:null,sliderMax:null,sliderNote:'3:2 CONDUCTION'},
  vf:   {label:'VENTRICULAR FIBRILLATION',defaultBpm:0,   sliderMin:null,sliderMax:null,sliderNote:'NO ORGANISED RHYTHM'},
  deg1:   {label:'1ST DEGREE AV BLOCK',   defaultBpm:70, sliderMin:50,  sliderMax:100, sliderNote:'PR > 200ms'},
  junct:  {label:'JUNCTIONAL RHYTHM',     defaultBpm:60, sliderMin:50,  sliderMax:150, sliderNote:'AV JUNCTIONAL PACEMAKER'},
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
    s.noiseV=(s.noiseV||0)+(Math.random()-.5)*.4; s.noiseV*=.75;
    s.noiseY=(s.noiseY||0)+s.noiseV; s.noiseY*=.82;
    const fib=s.noiseY*(afMorph ? afMorph.fibAmp * 2.5 : 2.5);
    leads.forEach(n=>{
      const fn=MORPH.af[n];
      const qrs=fn?fn(s.ms):0;
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
    const pRR=60000/80;
    s.pMs=((s.pMs||0)+dtMs)%pRR;
    const vRR=60000/bpm;
    s.ms=(s.ms+dtMs)%vRR;
    const pScales={I:.7,II:1,III:.5,aVR:-.7,aVL:.3,aVF:.8,V1:-.4,V2:.3,V3:.5,V4:.6,V5:.6,V6:.5};
    leads.forEach(n=>{
      const pWave=gauss(s.pMs,40,22,10)*(pScales[n]||.5);
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

  // ---- PVC Bigeminy: alternating sinus beat / PVC ----
  if(key==='pvc'){
    const rr       = 60000/bpm;
    const coupling = rr * 0.72;
    const compPause= rr * 1.28;
    const interval = s.pvcBeat===0 ? rr : compPause;
    const prev = s.pvcMs;
    s.pvcMs += dtMs;
    if(s.pvcMs >= interval){
      s.pvcMs -= interval;
      s.pvcBeat = (s.pvcBeat + 1) % 2;
      if(s.pvcBeat === 1) s.vtVar = (Math.random()-0.5)*0.5;
    }
    const ms = s.pvcMs;
    leads.forEach(n=>{
      let y = 0;
      if(s.pvcBeat === 0){
        const fn = MORPH.nsr[n];
        y = fn ? fn(ms) : 0;
      } else {
        const pvcMs = ms - (compPause - rr);
        if(pvcMs >= 0){
          const fn = MORPH.vt[n];
          y = fn ? fn(pvcMs, s.vtVar||0) * 0.90 : 0;
        }
      }
      out[n] = y;
    });
    return out;
  }

  // STEMI family
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

  // Pacing rhythms
  if(key==='vvipace'||key==='aaipace'||key==='dddpace'){
    const rr=60000/bpm;
    const prev=s.ms; s.ms=(s.ms+dtMs)%rr;
    if(prev>s.ms){
      if(key==='vvipace') s.spikeV=true;
      else if(key==='aaipace') s.spikeA=true;
      else { s.spikeA=true; }
    }
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
        const sinusMorphFn=MORPH.nsr[n];
        y=sinusMorphFn?sinusMorphFn(s.ms):0;
      } else {
        y=(pScale[n]||.5)*gauss(s.ms,30,18,10);
        y+=(qrsScale[n]||.5)*(gauss(s.ms,200,22,14)+gauss(s.ms,250,35,62)-gauss(s.ms,380,55,52));
      }
      out[n]=y;
    });
    return out;
  }

  // Extended rhythm family
  if(['deg1','junct','wpw','hyperK','hypoK','longQT','peri','nstemi','pe','brugada'].includes(key)){
    const rr=60000/bpm;
    s.ms=(s.ms+dtMs)%rr;
    const ms=s.ms;

    const leadScales = {
      deg1:   {I:.7,II:1,III:.45,aVR:-.7,aVL:.3,aVF:.65,V1:-.12,V2:.18,V3:.48,V4:.86,V5:.97,V6:.77},
      junct:  {I:.7,II:1,III:.45,aVR:-.7,aVL:.3,aVF:.65,V1:-.12,V2:.18,V3:.48,V4:.86,V5:.97,V6:.77},
      wpw:    {I:.75,II:1,III:.5,aVR:-.7,aVL:.4,aVF:.7,V1:.6,V2:.7,V3:.8,V4:.9,V5:.85,V6:.75},
      hyperK: {I:.7,II:1,III:.5,aVR:-.7,aVL:.3,aVF:.7,V1:-.15,V2:.25,V3:.55,V4:.9,V5:1.0,V6:.8},
      hypoK:  {I:.7,II:1,III:.45,aVR:-.7,aVL:.3,aVF:.65,V1:-.12,V2:.3,V3:.5,V4:.8,V5:.95,V6:.75},
      longQT: {I:.7,II:1,III:.45,aVR:-.7,aVL:.3,aVF:.65,V1:-.12,V2:.18,V3:.48,V4:.86,V5:.97,V6:.77},
      peri:   {I:.8,II:1,III:.6,aVR:-.5,aVL:.5,aVF:.75,V1:.3,V2:.6,V3:.8,V4:.9,V5:.9,V6:.8},
      nstemi: {I:.7,II:1,III:.45,aVR:.5,aVL:.3,aVF:.65,V1:.3,V2:.5,V3:.7,V4:.9,V5:.8,V6:.6},
      pe:     {I:.7,II:1,III:.5,aVR:-.3,aVL:.2,aVF:.6,V1:.4,V2:.5,V3:.5,V4:.4,V5:.3,V6:.2},
      brugada:{I:.7,II:1,III:.45,aVR:-.7,aVL:.3,aVF:.65,V1:1.2,V2:1.1,V3:.8,V4:.5,V5:.4,V6:.3},
    };
    const scales = leadScales[key] || leadScales.deg1;

    leads.forEach(n=>{
      const sc = scales[n] || 0.5;
      const baseFn = MORPH.nsr[n];
      let base = baseFn ? baseFn(ms) : 0;

      if(key==='deg1'){
        const prExtra = (s.deg1PR || 240) - 160;
        const sinFn = MORPH.nsr[n];
        const pOnly  = gauss(ms, P_PEAK, P_WIDTH, P_AMP * patient.pAmp * Math.abs(sc)) * (sc < 0 ? -1 : 1);
        const shiftMs = ms - prExtra;
        const fullSinus = sinFn ? sinFn(shiftMs) : 0;
        const pAtShift = gauss(shiftMs, P_PEAK, P_WIDTH, P_AMP * patient.pAmp * Math.abs(sc)) * (sc < 0 ? -1 : 1);
        base = pOnly + (fullSinus - pAtShift);
        out[n] = base; return;
      }

      if(key==='junct'){
        base = -gauss(ms,Q_ONSET,Q_WIDTH,Q_AMP*patient.rAmp*Math.abs(sc))*(sc<0?-1:1)
               +gauss(ms,R_PEAK,R_WIDTH,R_AMP*patient.rAmp*Math.abs(sc))*(sc<0?-1:1)
               -gauss(ms,S_TROUGH,S_WIDTH,S_AMP*patient.rAmp*Math.abs(sc))*(sc<0?-1:1)
               +gauss(ms,T_PEAK,T_WIDTH,T_AMP*patient.tAmp*Math.abs(sc))*(sc<0?-1:1);
        out[n] = base; return;
      }

      if(key==='wpw'){
        const pol  = sc < 0 ? -1 : 1;
        const rAmp = R_AMP * patient.rAmp * Math.abs(sc);
        const sAmp = S_AMP * patient.rAmp * Math.abs(sc) * 0.9;
        const qrsStart = 80, rPeak = 148, sVal = 175;
        let qrs = 0;
        if (ms >= qrsStart && ms < rPeak) {
          const frac = (ms - qrsStart) / (rPeak - qrsStart);
          if (frac < 0.55) {
            qrs = rAmp * frac * 0.18;
          } else {
            const f2 = (frac - 0.55) / 0.45;
            qrs = rAmp * (0.55 * 0.18 + (1 - 0.55 * 0.18) * Math.pow(f2, 1.8));
          }
        } else if (ms >= rPeak && ms < sVal) {
          const frac = (ms - rPeak) / (sVal - rPeak);
          qrs = rAmp * (1 - frac) - sAmp * frac;
        } else if (ms >= sVal && ms < sVal + 25) {
          const frac = (ms - sVal) / 25;
          qrs = -sAmp * (1 - frac);
        }
        const pWave = gauss(ms, P_PEAK, P_WIDTH, P_AMP*patient.pAmp*Math.abs(sc)) * pol;
        const tWave = gauss(ms, 340, 60, T_AMP*0.85*patient.tAmp*Math.abs(sc)) * -pol;
        base = pWave + qrs * pol + tWave;
        out[n] = base; return;
      }

      if(key==='hyperK'){
        const peakT = ['V2','V3','V4','V5'].includes(n) ? 3.2 : 2.2;
        base = gauss(ms,P_PEAK,P_WIDTH*1.5,P_AMP*0.2*Math.abs(sc))
              +gauss(ms,R_PEAK+20,R_WIDTH*2.2,R_AMP*patient.rAmp*Math.abs(sc))*(sc<0?-1:1)
              -gauss(ms,S_TROUGH+25,S_WIDTH*2,S_AMP*patient.rAmp*0.7*Math.abs(sc))*(sc<0?-1:1)
              +gauss(ms,T_PEAK-20,T_WIDTH*0.45,T_AMP*peakT*patient.tAmp*Math.abs(sc))*(sc<0?-1:1);
        out[n] = base; return;
      }

      if(key==='hypoK'){
        base = gauss(ms,P_PEAK,P_WIDTH,P_AMP*1.1*Math.abs(sc))
              +gauss(ms,R_PEAK,R_WIDTH,R_AMP*patient.rAmp*Math.abs(sc))*(sc<0?-1:1)
              -gauss(ms,S_TROUGH,S_WIDTH,S_AMP*patient.rAmp*Math.abs(sc))*(sc<0?-1:1)
              -gauss(ms,260,60,6*Math.abs(sc))*(sc<0?-1:1)
              +gauss(ms,T_PEAK,T_WIDTH,T_AMP*0.3*patient.tAmp*Math.abs(sc))*(sc<0?-1:1)
              +gauss(ms,T_PEAK+90,35,T_AMP*0.5*Math.abs(sc))*(sc<0?-1:1);
        out[n] = base; return;
      }

      if(key==='longQT'){
        base = gauss(ms,P_PEAK,P_WIDTH,P_AMP*patient.pAmp*Math.abs(sc))
              +gauss(ms,R_PEAK,R_WIDTH,R_AMP*patient.rAmp*Math.abs(sc))*(sc<0?-1:1)
              -gauss(ms,S_TROUGH,S_WIDTH,S_AMP*patient.rAmp*Math.abs(sc))*(sc<0?-1:1)
              +gauss(ms,420,T_WIDTH*1.4,T_AMP*0.75*patient.tAmp*Math.abs(sc))*(sc<0?-1:1)
              +gauss(ms,490,T_WIDTH*0.9,T_AMP*0.4*patient.tAmp*Math.abs(sc))*(sc<0?-1:1);
        out[n] = base; return;
      }

      if(key==='peri'){
        const stAmp = ['aVR','V1'].includes(n) ? -8 : 10;
        base = -gauss(ms,80,30,4*Math.abs(sc))
              +gauss(ms,P_PEAK,P_WIDTH,P_AMP*patient.pAmp*Math.abs(sc))
              +gauss(ms,R_PEAK,R_WIDTH,R_AMP*patient.rAmp*Math.abs(sc))*(sc<0?-1:1)
              -gauss(ms,S_TROUGH,S_WIDTH,S_AMP*patient.rAmp*Math.abs(sc))*(sc<0?-1:1)
              +gauss(ms,250,80,stAmp*Math.abs(sc))*(sc<0?-1:1)
              +gauss(ms,T_PEAK,T_WIDTH,T_AMP*0.9*patient.tAmp*Math.abs(sc))*(sc<0?-1:1);
        out[n] = base; return;
      }

      if(key==='nstemi'){
        const stdAmp = ['V4','V5','V6','I','aVL'].includes(n) ? 12 : 6;
        base = gauss(ms,P_PEAK,P_WIDTH,P_AMP*patient.pAmp*Math.abs(sc))
              +gauss(ms,R_PEAK,R_WIDTH,R_AMP*patient.rAmp*Math.abs(sc))*(sc<0?-1:1)
              -gauss(ms,S_TROUGH,S_WIDTH,S_AMP*patient.rAmp*Math.abs(sc))*(sc<0?-1:1)
              -gauss(ms,240,55,stdAmp*Math.abs(sc))*(sc<0?-1:1)
              +gauss(ms,T_PEAK,T_WIDTH,T_AMP*0.4*patient.tAmp*Math.abs(sc))*(sc<0?-1:1);
        out[n] = base; return;
      }

      if(key==='pe'){
        const deepS = n==='I' ? 2.5 : (n==='III'||n==='aVF') ? -1.5 : 1;
        const tInv  = ['V1','V2','V3','V4','III'].includes(n);
        base = gauss(ms,P_PEAK,P_WIDTH,P_AMP*1.1*Math.abs(sc))
              +gauss(ms,R_PEAK,R_WIDTH,R_AMP*patient.rAmp*Math.abs(sc))*(sc<0?-1:1)
              -gauss(ms,S_TROUGH+20,S_WIDTH*2.2,S_AMP*deepS*patient.rAmp*Math.abs(sc))*(sc<0?-1:1)
              +gauss(ms,T_PEAK,T_WIDTH,T_AMP*0.7*patient.tAmp*Math.abs(sc))*(tInv?-1:1)*(sc<0?-1:1);
        out[n] = base; return;
      }

      if(key==='brugada'){
        if(['V1','V2','V3'].includes(n)){
          base = gauss(ms,R_PEAK,R_WIDTH,R_AMP*patient.rAmp*0.7)
                +gauss(ms,190,18,22)
                +gauss(ms,260,75,18)
                -gauss(ms,380,65,22*patient.tAmp);
        } else {
          base = (baseFn?baseFn(ms):0)*sc;
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
// =====================================================================
const traceData={};
const spikeData={};
const MID_LEAD = LEAD_H*0.52;
const MID_STRIP = STRIP_H*0.58;

LEAD_LAYOUT.forEach(n=>{
  traceData[n]=new Float32Array(LEAD_W);
  traceData[n].fill(MID_LEAD);
  spikeData[n]=new Uint8Array(LEAD_W);
});
traceData['strip']=new Float32Array(STRIP_W);
traceData['strip'].fill(MID_STRIP);
spikeData['strip']=new Uint8Array(STRIP_W);

let headX=0;
let stripHead=0;
let lastMs=0;
const ERASE_PX=2;

// =====================================================================
// RENDER LOOP
// =====================================================================
function drawSpikesOn(ctx, spikes, W, hX, erasePx, mid, fullH){
  const startX=(hX+erasePx)%W;
  ctx.save();
  for(let i=0;i<W-erasePx;i++){
    const x=(startX+i)%W;
    const sp=spikes[x];
    if(!sp) continue;
    if(sp===9){
      // Shock artifact — solid and near-full-height, deliberately unlike the
      // small dashed pacer ticks below: a real defib discharge saturates the
      // amplifier, not a small timed blip. Same green as the trace itself
      // (not a distinct colour) — it's the same electrical signal railing out.
      ctx.strokeStyle=window._traceColour||'#00ff88';
      ctx.lineWidth=window._traceWidth||1.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x,mid-(fullH||120)*0.48); ctx.lineTo(x,mid+(fullH||120)*0.48);
      ctx.stroke();
      continue;
    }
    ctx.strokeStyle=window._traceColour||'#00ff88';
    ctx.lineWidth=1.5;
    ctx.setLineDash([3,3]);
    if(sp===1||sp===3){
      ctx.beginPath();
      ctx.moveTo(x,mid-55); ctx.lineTo(x,mid-5);
      ctx.stroke();
    }
    if(sp===2||sp===3){
      ctx.beginPath();
      ctx.moveTo(x,mid-60); ctx.lineTo(x,mid+35);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function draw(ts){
  if(!lastMs) lastMs=ts;
  const dtMs=Math.min(ts-lastMs,50);
  lastMs=ts;

  const leadSteps=Math.floor(dtMs*PX_PER_MS);
  const msPerLeadPx=1/PX_PER_MS;
  const stripSteps=Math.floor(dtMs*STRIP_PX_PER_MS);
  const msPerStripPx=1/STRIP_PX_PER_MS;

  if(!leadsFrozen) {
    for(let i=0;i<leadSteps;i++){
      if(captureMode && headX > 0 && (headX+1) % LEAD_W === 0) {
        const bbbMs=state.ms;
        const samples=computeSamples(state,msPerLeadPx,currentBpm,currentKey);
        const x=headX%LEAD_W;
        const noiseVal=sampleNoise();
        LEAD_LAYOUT.forEach(n=>{
          const bbb=applyBBB(samples[n],bbbMs,n);
          traceData[n][x]=MID_LEAD-(bbb*patient.ampScale+noiseVal);
          spikeData[n][x]=0;
          if(state.spikeA){spikeData[n][x]=1;}
          if(state.spikeV){spikeData[n][x]=(spikeData[n][x]===1)?3:2;}
          if(shockArtifactLeadRemaining>0){spikeData[n][x]=9;}
        });
        if(state.spikeA) state.spikeA=false;
        if(state.spikeV) state.spikeV=false;
        if(shockArtifactLeadRemaining>0) shockArtifactLeadRemaining--;
        headX=(headX+1)%LEAD_W;
        leadsFrozen = true;
        break;
      }
      const bbbMs=state.ms;
      const samples=computeSamples(state,msPerLeadPx,currentBpm,currentKey);
      const x=headX%LEAD_W;
      const noiseVal=sampleNoise();
      LEAD_LAYOUT.forEach(n=>{
        const bbb=applyBBB(samples[n],bbbMs,n);
        traceData[n][x]=MID_LEAD-(bbb*patient.ampScale+noiseVal);
        spikeData[n][x]=0;
        if(state.spikeA){ spikeData[n][x]=1; }
        if(state.spikeV){ spikeData[n][x]=(spikeData[n][x]===1)?3:2; }
        if(shockArtifactLeadRemaining>0){ spikeData[n][x]=9; }
      });
      if(state.spikeA) state.spikeA=false;
      if(state.spikeV) state.spikeV=false;
      if(shockArtifactLeadRemaining>0) shockArtifactLeadRemaining--;
      headX=(headX+1)%LEAD_W;
    }
  }

  if(!frozen) {
    for(let i=0;i<stripSteps;i++){
      if(leadsFrozen && stripHead > 0 && (stripHead+1) % STRIP_W === 0) {
        const stripBbbMs=stripState.ms;
        const samples=computeSamplesStrip(msPerStripPx);
        const x=stripHead%STRIP_W;
        const stripBBB=applyBBB(samples[stripLeadName],stripBbbMs,stripLeadName);
        traceData['strip'][x]=MID_STRIP-(stripBBB*patient.ampScale+sampleNoise()*0.5);
        spikeData['strip'][x]=0;
        if(stripState.spikeA){ spikeData['strip'][x]=1; stripState.spikeA=false; }
        if(stripState.spikeV){ spikeData['strip'][x]=(spikeData['strip'][x]===1)?3:2; stripState.spikeV=false; }
        if(shockArtifactStripRemaining>0){ spikeData['strip'][x]=9; shockArtifactStripRemaining--; }
        stripHead=(stripHead+1)%STRIP_W;
        doCapture();
        break;
      }
      const stripBbbMs=stripState.ms;
      const samples=computeSamplesStrip(msPerStripPx);
      const x=stripHead%STRIP_W;
      const stripBBB=applyBBB(samples[stripLeadName],stripBbbMs,stripLeadName);
      traceData['strip'][x]=MID_STRIP-(stripBBB*patient.ampScale+sampleNoise()*0.5);
      spikeData['strip'][x]=0;
      if(stripState.spikeA){ spikeData['strip'][x]=1; stripState.spikeA=false; }
      if(stripState.spikeV){ spikeData['strip'][x]=(spikeData['strip'][x]===1)?3:2; stripState.spikeV=false; }
      if(shockArtifactStripRemaining>0){ spikeData['strip'][x]=9; shockArtifactStripRemaining--; }
      stripHead=(stripHead+1)%STRIP_W;
    }
  }

  LEAD_LAYOUT.forEach(n=>{
    const tc=leadCanvases[n].trace;
    const ctx=tc.getContext('2d');
    ctx.clearRect(0,0,LEAD_W,LEAD_H);
    const hX=headX%LEAD_W;
    ctx.fillStyle=window._traceGlow||'rgba(0,255,136,0.10)';
    ctx.fillRect(hX,0,2,LEAD_H);
    renderTraceOn(ctx,traceData[n],LEAD_W,hX,ERASE_PX);
    drawSpikesOn(ctx,spikeData[n],LEAD_W,hX,ERASE_PX,MID_LEAD,LEAD_H);
  });

  {
    const ctx=stripTraceC.getContext('2d');
    ctx.clearRect(0,0,STRIP_W,STRIP_H);
    const hX=stripHead%STRIP_W;
    ctx.fillStyle=window._traceGlow||'rgba(0,255,136,0.10)';
    ctx.fillRect(hX,0,2,STRIP_H);
    renderTraceOn(ctx,traceData['strip'],STRIP_W,hX,ERASE_PX);
    drawSpikesOn(ctx,spikeData['strip'],STRIP_W,hX,ERASE_PX,MID_STRIP,STRIP_H);
  }

  if(!frozen) requestAnimationFrame(draw);
}

function redrawAllTraces() {
  LEAD_LAYOUT.forEach(n=>{
    const tc=leadCanvases[n].trace;
    const ctx=tc.getContext('2d');
    ctx.clearRect(0,0,LEAD_W,LEAD_H);
    const hX=headX%LEAD_W;
    ctx.fillStyle=window._traceGlow||'rgba(0,255,136,0.10)';
    ctx.fillRect(hX,0,2,LEAD_H);
    renderTraceOn(ctx,traceData[n],LEAD_W,hX,ERASE_PX);
    drawSpikesOn(ctx,spikeData[n],LEAD_W,hX,ERASE_PX,MID_LEAD,LEAD_H);
  });
  const ctx=stripTraceC.getContext('2d');
  ctx.clearRect(0,0,STRIP_W,STRIP_H);
  const hX=stripHead%STRIP_W;
  ctx.fillStyle=window._traceGlow||'rgba(0,255,136,0.10)';
  ctx.fillRect(hX,0,2,STRIP_H);
  renderTraceOn(ctx,traceData['strip'],STRIP_W,hX,ERASE_PX);
  drawSpikesOn(ctx,spikeData['strip'],STRIP_W,hX,ERASE_PX,MID_STRIP);
}

function renderTraceOn(ctx,data,W,hX,erasePx){
  const startX=(hX+erasePx)%W;
  ctx.strokeStyle=window._traceGlow||'rgba(0,255,136,0.18)';
  ctx.lineWidth=3;
  ctx.lineJoin='round';ctx.lineCap='butt';
  _drawPath(ctx,data,W,startX,erasePx);
  ctx.strokeStyle=window._traceColour||'#00ff88';
  ctx.lineWidth=window._traceWidth||1.5;
  ctx.lineCap='butt';
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
// STRIP STATE
// =====================================================================
let stripState=makeState();
let stripLeadName='II';
function computeSamplesStrip(dtMs){
  return computeSamples(stripState,dtMs,currentBpm,currentKey);
}
function setStripLead(name){
  if(LEAD_LAYOUT.indexOf(name)===-1) return; // unknown lead name, ignore
  if(name===stripLeadName) return; // already showing this lead — no-op, avoids a reset glitch on every call
  stripLeadName=name;
  // Avoid a visual jump-cut when switching leads mid-trace
  traceData['strip'].fill(MID_STRIP);
  spikeData['strip'].fill(0);
  stripHead=0;
  const labels=container.querySelectorAll('.ecg-strip-label');
  labels.forEach(el=>{
    el.textContent = (el.textContent.indexOf('RHYTHM STRIP')!==-1)
      ? `LEAD ${name} \u2014 RHYTHM STRIP`
      : `LEAD ${name}`;
  });
}

// =====================================================================
// HR DISPLAY
// =====================================================================
let hrAnimId=null,afHRInterval=null;
function animHR(target){
  const el=getElementById('hrValue'); if(!el) return;
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
// MORPH SEED
// =====================================================================
function getMorphSeed(){
  return {
    sinus:  sinusMorph  ? JSON.parse(JSON.stringify(sinusMorph))  : null,
    vt:     vtMorph     ? JSON.parse(JSON.stringify(vtMorph))     : null,
    aivr:   aivrMorph   ? JSON.parse(JSON.stringify(aivrMorph))   : null,
    svt:    svtMorph    ? JSON.parse(JSON.stringify(svtMorph))    : null,
    af:     afMorph     ? JSON.parse(JSON.stringify(afMorph))     : null,
    deg1PR: state       ? state.deg1PR                            : null,
  };
}

function applySeed(seed){
  if (!seed) return;
  if (seed.sinus){ sinusMorph = seed.sinus; MORPH.nsr = buildSinusWithAVR(getSinusParams()); MORPH.stach = MORPH.nsr; MORPH.sbrad = MORPH.nsr; }
  if (seed.vt)   { vtMorph   = seed.vt;    MORPH.vt  = buildVT();   }
  if (seed.aivr) { aivrMorph = seed.aivr;  MORPH.aivr = buildAIVR(); }
  if (seed.svt)  { svtMorph  = seed.svt;   MORPH.svt  = buildSVT();  }
  if (seed.af)   { afMorph   = seed.af;    MORPH.af   = buildAF();   }
  if (seed.deg1PR != null){ state.deg1PR = seed.deg1PR; stripState.deg1PR = seed.deg1PR; }
}

// =====================================================================
// RHYTHM SWITCHING
// =====================================================================
function setRhythm(key, _bpmOverride, _bbbOverride){
  currentKey=key;
  state=makeState();
  stripState=makeState();
  patient=generatePatient();
  if(key==='vt') vtMorph=generateVTMorph();
  if(key==='aivr'){ aivrMorph=generateAIVRMorph(); MORPH.aivr=buildAIVR(); }
  if(key==='svt'){ svtMorph=generateSVTMorph(); MORPH.svt=buildSVT(); }
  if(key==='af'){ afMorph=generateAFMorph(); MORPH.af=buildAF(); }
  if(['nsr','stach','sbrad'].includes(key)){ sinusMorph=generateSinusMorph(); MORPH.nsr=buildSinusWithAVR(getSinusParams()); MORPH.stach=MORPH.nsr; MORPH.sbrad=MORPH.nsr; }
  if(key==='deg1'){
    const marked = Math.random() < 0.20;
    state.deg1PR  = marked ? 300 + Math.floor(Math.random()*20) : 210 + Math.floor(Math.random()*90);
    stripState.deg1PR = state.deg1PR;
  }
  _nY=0; _nV=0;
  LEAD_LAYOUT.forEach(n=>{spikeData[n].fill(0);});
  spikeData['strip'].fill(0);

  const r=RHYTHMS[key];
  clearInterval(afHRInterval);

  const slider=getElementById('hrSlider');
  const bpmLabel=getElementById('sliderBpm');
  const noteEl=getElementById('sliderNote');

  const _effectiveBpm = _bpmOverride || r.defaultBpm || 72;
  currentBpm = _effectiveBpm;
  if(_bbbOverride && _bbbOverride !== 'none') bbbMode = _bbbOverride;

  if(slider) {
    if(r.sliderMin!==null){
      slider.disabled=false;
      slider.min=r.sliderMin; slider.max=r.sliderMax;
      slider.value=_effectiveBpm;
    } else {
      slider.disabled=true;
      slider.min=40; slider.max=220;
    }
  }
  if(bpmLabel) bpmLabel.textContent = r.sliderMin!==null ? _effectiveBpm+' BPM' : '— BPM';
  if(noteEl) noteEl.textContent=r.sliderNote||'';
  const _rn=getElementById('rhythmName'); if(_rn) _rn.textContent=r.label;

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

  document.querySelectorAll('.btn').forEach(b=>b.classList.remove('active'));
  const btnEl=getElementById('btn-'+key);
  if(btnEl) btnEl.classList.add('active');
}

function setBBB(mode){
  if((currentKey==='vf'||currentKey==='asys')&&mode!=='none') return;
  bbbMode=mode;
  document.querySelectorAll('[id^="bbb-"]').forEach(b=>b.classList.remove('active'));
  const el=getElementById('bbb-'+mode); if(el) el.classList.add('active');
}

function onSlider(val){
  currentBpm=parseInt(val);
  getElementById('sliderBpm').textContent=val+' BPM';
  animHR(currentBpm);
}

// =====================================================================
// COLOUR THEMES
// =====================================================================
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

function applyTheme(t) {
  const r = document.documentElement.style;
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
  window._traceColour = t.trace;
  window._traceGlow   = t.traceGlow;
  window._themeBg     = t.bgCanvas;
  window._themeGridS  = t.gridSmall;
  window._themeGridL  = t.gridLarge;
  window._traceWidth  = t.traceWidth || 1.5;
  document.documentElement.style.setProperty('--separator', t.separator || '#000');
  drawBgGrid(t.bgCanvas, t.gridSmall, t.gridLarge);
  if(frozen || leadsFrozen) redrawAllTraces();
  container.style.background = t.bgMonitor;
  const bgGrid = getElementById('ecgBgGrid') || getElementById('ecgGrid');
  if (bgGrid) bgGrid.style.cssText += ';background:' + t.bgCanvas + ' !important';
}

function setTheme(name) {
  currentTheme = name;
  const t = name === 'random'       ? randomTheme(false)
             : name === 'random-paper' ? randomTheme(true)
             : (THEMES[name] || THEMES.monitor);
  applyTheme(t);
  document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
  const btn = getElementById('theme-' + name);
  if (btn) btn.classList.add('active');
}

requestAnimationFrame(draw);

// =====================================================================
// CAPTURE
// =====================================================================
let captureMode  = false;
let leadsFrozen  = false;
let frozen       = false;

function toggleCapture() {
  const btn = getElementById('captureBtn');
  if (frozen) {
    frozen = false;
    leadsFrozen = false;
    captureMode = false;
    lastMs = 0;
    requestAnimationFrame(draw);
    btn.textContent = '⏸ CAPTURE';
    btn.style.borderColor = '';
    btn.style.color = '';
  } else if (captureMode || leadsFrozen) {
    captureMode = false;
    leadsFrozen = false;
    btn.textContent = '⏸ CAPTURE';
    btn.style.borderColor = '';
  } else {
    captureMode = true;
    btn.textContent = '⌛ CAPTURING...';
    btn.style.borderColor = 'var(--text-bright, #00ff88)';
  }
}

function doCapture() {
  frozen = true;
  leadsFrozen = false;
  captureMode = false;
  const btn = getElementById('captureBtn');
  if (btn) {
    btn.textContent = '▶ RESUME';
    btn.style.borderColor = 'var(--text-bright, #00ff88)';
    btn.style.color = 'var(--text-bright, #00ff88)';
  }
  const flash = getElementById('captureFlash');
  if (flash) {
    const isDark = window._themeBg && window._themeBg.includes('02');
    flash.style.background = isDark ? 'white' : 'black';
    flash.style.opacity = '0.12';
    setTimeout(() => { flash.style.opacity = '0'; }, 200);
  }
  if (_self._onCapture) _self._onCapture();
}

    // Expose internals to ECGEngine instance
    _self._pub.rhythms      = RHYTHMS;
    _self._pub.setRhythm    = setRhythm;
    _self._pub.getMorphSeed = getMorphSeed;
    _self._pub.applySeed    = applySeed;
    _self._pub.setTheme     = setTheme;
    _self._pub.setBBB       = setBBB;
    _self._pub.setStripLead = setStripLead;
    _self._pub.triggerShockArtifact = triggerShockArtifact;
    _self._pub.onSlider     = onSlider;
    _self._pub.toggleCapture = (typeof toggleCapture !== 'undefined') ? toggleCapture : null;
    _self._pub.resume       = function() {
      frozen = false; leadsFrozen = false; captureMode = false; lastMs = 0;
      requestAnimationFrame(draw);
    };

    // ── Pause rendering while off-screen to avoid wasted CPU/GPU work,
    // which was causing scroll stutter on lower-end hardware. Only
    // auto-pauses/resumes traces that weren't already deliberately
    // frozen by the user (e.g. via the capture/freeze button).
    let _autoPaused = false;
    if (typeof IntersectionObserver !== 'undefined') {
      const _visObserver = new IntersectionObserver((entries) => {
        const visible = entries[entries.length - 1].isIntersecting;
        if (!visible) {
          if (!frozen) { frozen = true; _autoPaused = true; }
        } else if (_autoPaused) {
          _autoPaused = false;
          frozen = false;
          lastMs = 0;
          requestAnimationFrame(draw);
        }
      }, { rootMargin: '150px' });
      _visObserver.observe(container);
      _self._visObserver = _visObserver;
    }

    // Apply initial theme from constructor options
    setTheme(_self._options_theme || 'monitor');

    // Start the draw loop
    _self._running = true;
    requestAnimationFrame(draw);

    }).call(this, container, _patchedGetById, self);
  }
}
