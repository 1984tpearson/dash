/* sim_engine.js
 * Shared deterministic vitals-trajectory engine for the real-time scenario tool.
 * Both student and assessor views load this file and compute vitals independently
 * from the SAME inputs (baseline, severity, treatment event log, elapsed time) —
 * no server-side "ticking" process required. Only the event log needs to sync.
 *
 * Public API:
 *   SimEngine.getVitals(scenarioConfig, nowMs) -> { HR, BP:{sys,dia}, SpO2, RR, EtCO2, ...+ raw trend }
 */
(function (global) {
  'use strict';

  // ---- Config overrides ---------------------------------------------------
  // Every tunable value below (durations, keyword lists, severity/survivability
  // bands, energy-factor thresholds, mood keywords) is stored here, seeded from
  // this file's own hardcoded defaults so the engine works identically to
  // before if nothing ever calls applyConfigOverrides — a missing/unreachable
  // sim_config row (see sim_control.html's/sim_patient.html's loadSimConfig())
  // must never break the sim, only leave it un-customized. Host pages fetch
  // config once at page load and call this once, before the first tick —
  // there is no live re-poll, see sim_config_schema.js.
  const _cfg = {};
  function applyConfigOverrides(overrides) {
    if (!overrides) return;
    Object.keys(overrides).forEach(key => {
      if (Object.prototype.hasOwnProperty.call(_cfg, key) && overrides[key] !== undefined) {
        _cfg[key] = overrides[key];
      }
    });
  }

  // ---- Severity presets ------------------------------------------------
  // REMOVED: the old generic severity/direction-driven autonomous ramp.
  // Vitals progression is now entirely authored per-scenario by AI-generated
  // overrides (see scenario_sim_timelines), which are clinically grounded in
  // the specific condition rather than a generic shock-pattern placeholder.
  // rawTrendDeltasAt() below now just returns a flat (zero) baseline trend.

  // ---- Treatments -------------------------------------------------------
  // REMOVED: the old generic per-drug effect table (DRUG_LIBRARY) and its
  // onset/peak/duration potency curve. Treatment effects are now decided by
  // the AI per-patient, per-condition, per-action — it directly authors new
  // overrides for the future (see regenerateTimelineAfterTreatment() in
  // sim_control.html) rather than this engine applying a generic delta.
  // cfg.treatments is still stored/logged for the assessor's record, but no
  // longer feeds vitals calculation here.

  // ---- Action durations (reveal-delay system) ---------------------------
  // Seconds each assessment action takes before its value/waveform reveals.
  // ecg12lead is conditional: faster if monitoring leads are already on.
  // bp is likewise conditional: the first-ever BP of a session pays a one-off
  // "putting the cuff on" lead-in on top of the normal inflate/hold/deflate
  // cycle (subsequent) — an imagined step, not a separately-timed action, since
  // once the cuff is on the patient's arm it stays on for auto-refires/retakes.
  _cfg.ACTION_DURATIONS = {
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
    pulse: 10 // manual palpation at a chosen site (radial/brachial/carotid) — quicker than a full RR count, see getPulseState
  };
  function getActionDurationSec(key, context) {
    const d = _cfg.ACTION_DURATIONS[key];
    if (typeof d === 'number') return d;
    if (key === 'ecg12lead') {
      return (context && context.ecgApplied) ? d.withMonitoring : d.fromScratch;
    }
    if (key === 'bp') {
      return (context && context.bpCuffApplied) ? d.subsequent : d.firstApplication;
    }
    return 10; // fallback
  }

  // ---- Raw trend (no overrides, no jitter): flat baseline, evaluated at an
  // arbitrary point in time (not just "now"). This is what overrides are
  // layered on top of. Treatments no longer contribute here (see note above).
  function rawTrendDeltasAt(cfg, tMs) {
    return {
      HR: 0, RR: 0, SpO2: 0, EtCO2: 0, BPsys: 0, BPdia: 0,
      temp: 0, bgl: 0, ketones: 0, pain: 0, nausea: 0, gcsE: 0, gcsV: 0, gcsM: 0
    };
  }
  function rawTrendAt(cfg, key, tMs) {
    const deltas = rawTrendDeltasAt(cfg, tMs);
    const raw = cfg.baseline[key] + (deltas[key] || 0);
    return key === 'SpO2' ? Math.min(100, raw) : raw;
  }

  // ---- Overrides -----------------------------------------------------------
  // overrides[key] = [{ targetValue, startMs, endMs }, ...] sorted by time.
  // A completed override becomes a permanent additive OFFSET from the raw curve
  // from that point on (so the vital keeps drifting per the underlying trend/
  // treatments, just shifted to pass through the target at the moment the
  // override finished) — i.e. "resume drifting", not "hold and freeze".
  //
  // The graph re-evaluates this many times per render (once per sample point,
  // per visible vital) and callers frequently re-render dozens of times a
  // second while dragging — re-sorting the same small array on every single
  // call was showing up as real, visible lag (particularly on iPad). Cached
  // per array reference, since a given overrides array is only ever appended
  // to, spliced, or replaced wholesale — never sorted in place — so a stale
  // cache entry is impossible: any mutation either changes the reference
  // (cache miss, correctly re-sorts) or wouldn't be reflected without one.
  const _sortedOverridesCache = new WeakMap();
  function sortedOverrides(events) {
    let sorted = _sortedOverridesCache.get(events);
    if (!sorted) {
      sorted = events.slice().sort((a, b) => a.startMs - b.startMs);
      _sortedOverridesCache.set(events, sorted);
    }
    return sorted;
  }
  function applyOverrides(cfg, key, nowMs) {
    const events = (cfg.overrides && cfg.overrides[key]) || [];
    const raw = (t) => rawTrendAt(cfg, key, t);
    let offset = 0;
    const sorted = events.length ? sortedOverrides(events) : events;
    for (let i = 0; i < sorted.length; i++) {
      const ov = sorted[i];
      if (nowMs < ov.startMs) break; // not started yet — ignore
      const startVal = raw(ov.startMs) + offset;
      if (nowMs < ov.endMs) {
        const span = Math.max(ov.endMs - ov.startMs, 1);
        const progress = Math.min(1, Math.max(0, (nowMs - ov.startMs) / span));
        return startVal + (ov.targetValue - startVal) * progress;
      }
      // override complete — shift the curve to pass through target at endMs
      offset = ov.targetValue - raw(ov.endMs);
    }
    return raw(nowMs) + offset;
  }

  // ---- Beat-to-beat jitter -----------------------------------------------
  // Seeded by the current second so any device computing "now" gets a very
  // similar wobble — cosmetic only, doesn't need to match exactly.
  function seededRand(seedInt) {
    const x = Math.sin(seedInt * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }
  function jitter(value, magnitude, seedSecond, offset) {
    const r = seededRand(seedSecond * 31 + offset) * 2 - 1; // -1..1
    return value + r * magnitude;
  }

  // ---- Main entry point ---------------------------------------------------
  // scenarioConfig = {
  //   baseline: { HR, RR, SpO2, EtCO2, BPsys, BPdia, temp, bgl, ketones, pain, nausea, gcsE, gcsV, gcsM },
  //   startTimeMs: <scenario start epoch ms>,
  //   treatments: [{ action, detail, givenAtMin }, ...] — logged for the record only, doesn't drive vitals here
  //   overrides: { HR: [{targetValue,startMs,endMs}], BPsys: [...], ... },
  //   instantMode: boolean (currently unused now that treatments don't have onset/peak timing here)
  // }
  // ---- Raw (unjittered) vitals — useful for graphing/projection, where the
  // small cosmetic wobble would just add noise to a planning chart.
  function getVitalsRaw(scenarioConfig, nowMs) {
    const cfg = scenarioConfig;
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    return {
      HR: applyOverrides(cfg, 'HR', nowMs),
      RR: applyOverrides(cfg, 'RR', nowMs),
      SpO2: Math.min(100, applyOverrides(cfg, 'SpO2', nowMs)),
      EtCO2: applyOverrides(cfg, 'EtCO2', nowMs),
      BPsys: applyOverrides(cfg, 'BPsys', nowMs),
      BPdia: applyOverrides(cfg, 'BPdia', nowMs),
      temp: applyOverrides(cfg, 'temp', nowMs),
      bgl: Math.max(0, applyOverrides(cfg, 'bgl', nowMs)),
      ketones: Math.max(0, applyOverrides(cfg, 'ketones', nowMs)),
      pain: clamp(applyOverrides(cfg, 'pain', nowMs), 0, 10),
      nausea: clamp(applyOverrides(cfg, 'nausea', nowMs), 0, 10),
      gcsE: clamp(applyOverrides(cfg, 'gcsE', nowMs), 1, 4),
      gcsV: clamp(applyOverrides(cfg, 'gcsV', nowMs), 1, 5),
      gcsM: clamp(applyOverrides(cfg, 'gcsM', nowMs), 1, 6)
    };
  }


  function getVitals(scenarioConfig, nowMs) {
    const nowSec = Math.floor(nowMs / 1000);
    const raw = getVitalsRaw(scenarioConfig, nowMs);
    const hrVal = raw.HR, rrVal = raw.RR, spo2Val = raw.SpO2, etco2Val = raw.EtCO2,
          bpSysVal = raw.BPsys, bpDiaVal = raw.BPdia;

    return {
      HR: Math.round(jitter(hrVal, 2, nowSec, 1)),
      RR: Math.round(jitter(rrVal, 1, nowSec, 2)),
      SpO2: Math.round(Math.min(100, jitter(spo2Val, 0.5, nowSec, 3))),
      EtCO2: Math.round(jitter(etco2Val, 1, nowSec, 4)),
      BPsys: Math.round(bpSysVal),
      BPdia: Math.round(bpDiaVal),
      _elapsedMin: Math.max(0, (nowMs - scenarioConfig.startTimeMs) / 60000)
    };
  }

  // ---- Pause-aware clock --------------------------------------------------
  // Every timestamp fed into getVitals/overrides/treatments should be this
  // "sim time", not raw Date.now(), so the whole trajectory (and any
  // in-progress override transition) genuinely freezes while paused rather
  // than just hiding the fact that time kept moving underneath.
  // cfg needs: isPaused, pausedAtMs (when the current pause began), totalPausedMs
  // (sum of all completed pauses, not including one currently in progress).
  function getSimNow(cfg, rawNowMs) {
    const totalPaused = cfg.totalPausedMs || 0;
    const pausedNow = cfg.isPaused
      ? Math.max(0, rawNowMs - (cfg.pausedAtMs != null ? cfg.pausedAtMs : rawNowMs))
      : 0;
    return rawNowMs - totalPaused - pausedNow;
  }

  // ---- Scenario baseline time-of-day (patient orientation) ----------------
  // Parses generator.html's vitals.TimeOfDay field (e.g. "03:15" for a
  // scenario that opens as a 3am callout) — strict 24-hour HH:MM, same
  // free-text-with-fallback pattern as vitals.Rhythm. Returns null for older
  // scenarios that predate the field, or anything that doesn't parse cleanly.
  function parseTimeOfDay(raw) {
    const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(raw || '').trim());
    if (!m) return null;
    return { hh: parseInt(m[1], 10), mm: parseInt(m[2], 10) };
  }

  // The patient's own in-fiction "now" — today's real calendar date (so a
  // GCS orientation question doesn't get answered with some earlier year
  // from a model's training cutoff, or a stale device clock) at the
  // scenario's authored baseline time-of-day, advanced by however much
  // scenario time has genuinely elapsed since arrival via the SAME
  // pause-aware clock (getSimNow, above) the vitals engine itself runs on —
  // so pausing the session doesn't also age the patient's sense of time.
  // Both sim_control.html (AI patient-voice prompt) and sim_patient.html
  // (the on-screen scenario clock) call this independently, same as the
  // vitals themselves, rather than syncing a computed value between them.
  // Returns null if timeOfDayRaw doesn't parse — callers fall back to the
  // real device clock in that case.
  function getScenarioFictionalNow(timeOfDayRaw, cfg, nowMs) {
    const tod = parseTimeOfDay(timeOfDayRaw);
    if (!tod) return null;
    const base = new Date();
    base.setHours(tod.hh, tod.mm, 0, 0);
    const elapsedMs = Math.max(0, getSimNow(cfg, nowMs) - cfg.startTimeMs);
    return new Date(base.getTime() + elapsedMs);
  }

  // ---- Static-vital history (Temp/GCS/BGL/Ketones/Pain) -------------------
  // These aren't continuous curves — they're point-in-time readings that hold
  // until explicitly reassessed. Modelled as a step function: a list of
  // {..., atMin} entries, and "current value at time T" is whichever entry's
  // atMin is the most recent one at-or-before T.
  function getStaticVitalAt(historyArr, atMin) {
    if (!historyArr || !historyArr.length) return null;
    const sorted = historyArr.slice().sort((a, b) => a.atMin - b.atMin);
    let result = sorted[0];
    for (const ev of sorted) {
      if (ev.atMin <= atMin) result = ev; else break;
    }
    return result;
  }

  // ---- ECG rhythm (AI/assessor-scripted, step function) -------------------
  // HR is just a number and can't tell the ECG display whether the patient
  // is in sinus rhythm, VF, asystole, complete heart block, etc — those are
  // distinct rhythm TYPES, several of which can share the same HR (or lack
  // of one). cfg.overrides.rhythm holds discrete step-change events —
  // { label, startMs } — authored by the AI alongside the numeric vitals
  // whenever an event actually changes the rhythm. "Current rhythm at time
  // T" is whichever entry's startMs is the most recent one at-or-before T;
  // null means nothing's been explicitly scripted yet, so callers should
  // fall back to deriving a plain sinus rate from HR themselves.
  function getRhythmAt(cfg, nowMs) {
    const events = (cfg.overrides && cfg.overrides.rhythm) || [];
    if (!events.length) return null;
    const sorted = events.slice().sort((a, b) => a.startMs - b.startMs);
    let current = null;
    for (const ev of sorted) {
      if (ev.startMs <= nowMs) current = ev.label; else break;
    }
    return current;
  }

  // ---- Defibrillation (shared, deterministic — no AI call) ----------------
  // Fully hardcoded rather than routed through Sonnet/Haiku like drug
  // treatments: defib physiology is well-established and predictable enough
  // not to need per-patient AI reasoning, and — critically — this needs to
  // run instantly on sim_patient.html the moment the crew hits Shock, not
  // after a network round trip to an LLM. Lives here (not in sim_control.html
  // alone) so BOTH pages can compute the identical outcome locally: the
  // patient device runs it the instant Shock is tapped for a zero-delay
  // response, then writes the result to the session row for sim_control.html
  // to pick up on its normal poll (see sim_patient.html's handleShockBtn()
  // and sim_control.html's applyDefibrillation(), which now just does the
  // read/write plumbing around a call here).
  //
  // Modelled loosely on real defibrillation outcomes (AHA/ILCOR-style
  // figures): biphasic first-shock termination of VF/pulseless VT is
  // commonly cited around 60-90% with prompt, adequately-energised shocks,
  // falling off fast with downtime (survival is often quoted as dropping
  // roughly 7-10%/min without bystander CPR, ~3-4%/min with it). Termination
  // of the rhythm on a given shock is NOT the same figure as eventual
  // survival-to-discharge — a patient can need several shocks before
  // converting and still survive overall, or convert on the first shock and
  // still not survive the admission — so this deliberately keeps two related
  // but separate numbers: a per-patient survivability score
  // (computeSurvivabilityScore) and a per-shock conversion chance
  // (computeShockableOutcome) that USES the survivability score as one
  // input among several, rather than being it.

  _cfg.HIGH_RISK_CONDITION_KEYWORDS = [
    'heart failure', 'chf', 'cardiomyopathy', 'copd', 'emphysema', 'chronic bronchitis',
    'renal failure', 'dialysis', 'ckd', 'cancer', 'malignancy', 'metastatic',
    'dementia', 'alzheimer', 'stroke', 'cva', 'diabetes', 'obesity', 'morbidly obese',
    'ischaemic heart disease', 'ischemic heart disease', 'coronary artery disease', 'cad',
    'previous mi', 'myocardial infarction', 'atrial fibrillation', 'valve disease',
    'cirrhosis', 'immunocompromised', 'frailty', 'frail'
  ];

  // Age/weight aren't structured fields anywhere in the schema (see
  // CLAUDE.md — only free-text demographics like "45yo Male"), so this
  // parses the same "[age]yo" convention generator.html always writes into
  // title/subtitle/dispatch, same spirit as the gender title-sniffing
  // fallback in sim_patient.html's connectSession(). Weight is similarly
  // free text ("82 kg") in vitals.Weight. scenarioMeta only needs to carry
  // whatever subset of these fields the caller has on hand — every lookup
  // here tolerates a missing field.
  function parseAgeFromScenario(scenario) {
    const text = `${scenario.title || ''} ${scenario.subtitle || ''} ${scenario.dispatch || ''}`;
    const m = text.match(/(\d{1,3})\s*(?:yo\b|y\.?o\.?\b|year[- ]old)/i);
    return m ? parseInt(m[1], 10) : 55; // unknown — a neutral middle-aged default
  }
  function parseWeightKgFromScenario(scenario) {
    const raw = (scenario.vitals && scenario.vitals.Weight) || '';
    const m = String(raw).match(/(\d{1,3}(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : 80; // unknown — an unremarkable adult default
  }

  // 0-100. Deliberately NOT the same number as any single shock's conversion
  // chance — see the comment above this section. Age bands are ordered,
  // first match wins (age <= maxAge); ageAboveAllBandsDelta applies past the
  // last band.
  _cfg.SURVIVABILITY = {
    baseScore: 70, // an average adult, witnessed arrest, prompt care
    ageBands: [
      { maxAge: 1, delta: 10 },   // infants/neonates are a genuinely different model in reality — out of scope, kept neutral rather than penalised
      { maxAge: 35, delta: 15 },
      { maxAge: 55, delta: 5 },
      { maxAge: 70, delta: -5 },
      { maxAge: 85, delta: -15 }
    ],
    ageAboveAllBandsDelta: -25,
    weightHighKg: 120, weightHighDelta: -10,
    weightModerateKg: 100, weightModerateDelta: -5,
    frailtyMinAge: 15, frailtyWeightKg: 45, frailtyDelta: -5, // frailty/cachexia proxy — only meaningful for an adult-sized patient
    conditionPenaltyPerHit: 6, conditionPenaltyCap: 30,
    downtimePenaltyPerMin: 5, // downtime dominates, per the AHA figures cited above
    clampMin: 2, clampMax: 95
  };
  function computeSurvivabilityScore(scenario, downtimeMs) {
    const s = _cfg.SURVIVABILITY;
    let score = s.baseScore;
    const age = parseAgeFromScenario(scenario);
    const ageBand = s.ageBands.find(b => age <= b.maxAge);
    score += ageBand ? ageBand.delta : s.ageAboveAllBandsDelta;

    const weightKg = parseWeightKgFromScenario(scenario);
    if (weightKg >= s.weightHighKg) score += s.weightHighDelta;
    else if (weightKg >= s.weightModerateKg) score += s.weightModerateDelta;
    else if (age > s.frailtyMinAge && weightKg < s.frailtyWeightKg) score += s.frailtyDelta;

    const conditionsText = (scenario.medical_conditions || []).join(' ').toLowerCase();
    const hits = _cfg.HIGH_RISK_CONDITION_KEYWORDS.filter(k => conditionsText.includes(k)).length;
    score -= Math.min(s.conditionPenaltyCap, hits * s.conditionPenaltyPerHit);

    const downtimeMin = downtimeMs / 60000;
    score -= downtimeMin * s.downtimePenaltyPerMin;

    return Math.max(s.clampMin, Math.min(s.clampMax, Math.round(score)));
  }

  // Buckets a rhythm label into what matters for a defib decision (also
  // reused wherever else in this file "is there any cardiac output at all"
  // needs deciding — see healthLevelAt, computeCprEffect) — NOT the same
  // bucketing as ecg_engine.js's mapRhythm(), which is purely about
  // waveform rendering and conflates clinically distinct things (e.g. PEA
  // and sinus bradycardia both render as its 'sbrad' key, but PEA is
  // pulseless arrest and sinus brady isn't — this logic cannot use that
  // mapping).
  //
  // VF is unambiguous (there is no such thing as "VF with a pulse") but VT/
  // torsades/polymorphic-VT are NOT — a bare "ventricular tachycardia" is a
  // real, dangerous, but genuinely PERFUSING rhythm (the patient has a
  // pulse; management is synchronised cardioversion, not defibrillation +
  // CPR), and only counts as an arrest rhythm when explicitly "pulseless".
  // Requires that qualifier before treating VT/torsades/polymorphic as
  // shockable-arrest — see classifyRhythmForPulse below, which needs the
  // exact same distinction and was the reason this got tightened. The AI
  // prompts (TREATMENT_UPDATE_PROMPT/SCRIPTED_EVENT_PROMPT/
  // UNTREATED_PROJECTION_PROMPT in sim_control.html) are written to always
  // say "pulseless ventricular tachycardia" explicitly when they mean an
  // arrest, never a bare "ventricular tachycardia" — see the cardiac-arrest
  // cascade rules there for why this needed fixing together, not
  // separately.
  function classifyRhythmForDefib(label) {
    const s = (label || '').toLowerCase();
    if (/\bvf\b|ventricular fib/.test(s)) return 'shockable';
    if (/pulseless/.test(s) && /(torsades|polymorphic|\bvt\b|ventricular tach)/.test(s)) return 'shockable';
    if (/asystole|\bpea\b|pulseless electrical/.test(s)) return 'nonshockable-arrest';
    return 'organized';
  }

  // Fallback rhythm when nothing's been explicitly scripted on the rhythm
  // timeline yet (see getRhythmAt above) — the single canonical version
  // both pages' ECG/defib code call, since (unlike the avatar functions)
  // this must produce byte-identical results wherever it runs.
  function deriveRhythmFromHR(hr) {
    if (hr < 60) return 'sinus bradycardia';
    if (hr > 100) return 'sinus tachycardia';
    return 'sinus rhythm';
  }

  // Walks backwards through the rhythm timeline from a shockable/
  // nonshockable-arrest entry to find when this arrest actually began (the
  // start of the contiguous run of arrest-classified entries containing
  // "now") — downtime for the survivability score above. Returns 0 if the
  // patient isn't currently in an arrest rhythm at all.
  function msSinceArrestStart(cfg, nowMs) {
    const events = ((cfg.overrides && cfg.overrides.rhythm) || []).slice().sort((a, b) => a.startMs - b.startMs);
    let idx = -1;
    for (let i = 0; i < events.length; i++) { if (events[i].startMs <= nowMs) idx = i; else break; }
    if (idx === -1 || classifyRhythmForDefib(events[idx].label) === 'organized') return 0;
    let arrestStartMs = events[idx].startMs;
    for (let i = idx - 1; i >= 0; i--) {
      if (classifyRhythmForDefib(events[i].label) === 'organized') break;
      arrestStartMs = events[i].startMs;
    }
    return Math.max(0, nowMs - arrestStartMs);
  }

  // Real-world energy dosing is weight-based for paediatrics (2-4 J/kg) but
  // a fixed protocol dose for adults (typically 120-200J biphasic, with
  // little added benefit much past that) — NOT weight-based for adults, so
  // this deliberately branches on age rather than applying one formula to
  // both.
  _cfg.ENERGY_FACTOR = {
    pediatricAgeThreshold: 12,
    pediatricJPerKgLow: 2, pediatricJPerKgHigh: 4, // real-world 2-4 J/kg dosing band
    pediatricUnderHalfFactor: 0.3, // joules < idealLow*pediatricLowMultiplier
    pediatricLowMultiplier: 0.5,
    pediatricUnderIdealFactor: 0.6, // joules < idealLow
    pediatricWithinFactor: 1, // joules <= idealHigh*pediatricHighMultiplier
    pediatricHighMultiplier: 1.5,
    pediatricOverFactor: 0.85, // over-energised for a child — likely still works, just not the guideline dose
    adultLowJoules: 100, adultLowFactor: 0.55,
    adultMidJoules: 120, adultMidFactor: 0.8,
    adultFullFactor: 1
  };
  function computeEnergyFactor(joules, age, weightKg) {
    const e = _cfg.ENERGY_FACTOR;
    if (age < e.pediatricAgeThreshold) {
      const idealLow = weightKg * e.pediatricJPerKgLow, idealHigh = weightKg * e.pediatricJPerKgHigh;
      if (joules < idealLow * e.pediatricLowMultiplier) return e.pediatricUnderHalfFactor;
      if (joules < idealLow) return e.pediatricUnderIdealFactor;
      if (joules <= idealHigh * e.pediatricHighMultiplier) return e.pediatricWithinFactor;
      return e.pediatricOverFactor;
    }
    if (joules < e.adultLowJoules) return e.adultLowFactor;
    if (joules < e.adultMidJoules) return e.adultMidFactor;
    return e.adultFullFactor;
  }

  // Per-shock outcome for a genuinely shockable rhythm (VF/pulseless VT/
  // torsades). Three possible outcomes, not just success/fail — post-shock
  // asystole is a real, recognised (if less common) outcome, and is more
  // likely the worse the underlying prognosis.
  function computeShockableOutcome(survivability, energyFactor, downtimeMs) {
    const downtimeMin = downtimeMs / 60000;
    const downtimeDecay = Math.exp(-downtimeMin / 8); // ~50% remaining by ~5.5 min — "every minute counts"
    const survivabilityFactor = 0.4 + (survivability / 100) * 0.8; // even a low-survivability patient can still convert on any given shock
    let convertChance = 0.75 * energyFactor * downtimeDecay * survivabilityFactor;
    convertChance = Math.max(0.03, Math.min(0.92, convertChance));

    let asystoleChance = 0.03 + (1 - survivability / 100) * 0.12;
    asystoleChance = Math.min(0.35, asystoleChance);

    const r = Math.random();
    const outcome = r < convertChance ? 'converted' : r < convertChance + asystoleChance ? 'asystole' : 'unchanged';
    return { outcome, convertChance, asystoleChance };
  }

  // Shocking a patient who has a pulse (organized rhythm) is never actually
  // indicated, but the sim allows it — this models the real risk: an
  // unsynchronised shock landing on a vulnerable point in the cycle can
  // precipitate VF (the R-on-T mechanism, well known as the reason
  // cardioversion is normally synchronised), more likely on already-
  // ischaemic myocardium. Short of that, an unsynchronised shock CAN still
  // cardiovert a disorganised atrial/re-entry tachyarrhythmia back to sinus
  // (cruder and riskier than a proper synchronised cardioversion, but not
  // physiologically impossible) — otherwise it just hurts, with no rhythm
  // change at all.
  function computeOrganizedShockOutcome(rhythmLabel, joules) {
    const s = (rhythmLabel || '').toLowerCase();
    const isIschaemic = /stemi|nstemi|ischaemia|ischemia/.test(s);
    const isTachyarrhythmia = /fibrillation|flutter|svt|supraventricular|tachycardia/.test(s);
    let induceVfChance = isIschaemic ? 0.12 : 0.04;
    induceVfChance *= Math.max(0.6, Math.min(1.3, joules / 150));

    if (Math.random() < induceVfChance) return { outcome: 'induced-vf', induceVfChance };
    if (isTachyarrhythmia && Math.random() < 0.35) return { outcome: 'cardioverted', induceVfChance };
    return { outcome: 'no-change', induceVfChance };
  }

  // A transient bump (onset -> hold -> fade) that fades back to whatever
  // this vital would have been doing anyway rather than a flat pre-shock
  // number — same "evaluate the untouched natural schedule" trick
  // applyCodedEffect (sim_control.html) uses for wearOffMin. Takes cfg
  // directly (not a separately-snapshotted overrides object): this is
  // always called before any splicing happens against cfg, so cfg.overrides
  // is still exactly the untouched pre-shock schedule.
  function buildFadeToNaturalChain(cfg, key, bumpTarget, onsetMin, holdMin, fadeMin, givenAtMs) {
    const holdEndMin = onsetMin + holdMin;
    const fadeEndMin = holdEndMin + fadeMin;
    const fadeEndMs = givenAtMs + fadeEndMin * 60000;
    const naturalAtFadeEnd = getVitalsRaw(cfg, fadeEndMs)[key];
    return [
      { targetValue: bumpTarget, startMin: 0, endMin: onsetMin },
      { targetValue: bumpTarget, startMin: onsetMin, endMin: holdEndMin },
      { targetValue: naturalAtFadeEnd, startMin: holdEndMin, endMin: fadeEndMin }
    ];
  }

  // The main entry point: decides the outcome and builds the override/rhythm
  // plan, but does NOT splice or persist anything — callers pass the result
  // to spliceAiOverridePlan/spliceRhythmPlan below and handle their own I/O
  // (sim_control.html reads/writes the DB directly; sim_patient.html applies
  // to its local testConfig immediately, then syncs to the DB in the
  // background). scenarioMeta needs at most { title, subtitle, dispatch,
  // vitals, medical_conditions } — whatever subset the caller has fetched.
  function computeDefibrillationEffect(cfg, scenarioMeta, joules, givenAtMs) {
    const vitalsNow = getVitalsRaw(cfg, givenAtMs);
    const rhythmLabel = getRhythmAt(cfg, givenAtMs) || deriveRhythmFromHR(vitalsNow.HR);
    const rhythmClass = classifyRhythmForDefib(rhythmLabel);

    const parsedOverrides = {};
    const parsedRhythm = [];
    let note;
    // Tracked separately from the prose note so callers (sim_control.html's
    // pollSession, deciding whether a follow-up AI re-projection is needed)
    // don't have to regex-match the note text — see resultOutcome below.
    let resultOutcome;

    if (rhythmClass === 'shockable') {
      const downtimeMs = msSinceArrestStart(cfg, givenAtMs);
      const survivability = computeSurvivabilityScore(scenarioMeta, downtimeMs);
      const age = parseAgeFromScenario(scenarioMeta);
      const weightKg = parseWeightKgFromScenario(scenarioMeta);
      const energyFactor = computeEnergyFactor(joules, age, weightKg);
      const { outcome, convertChance } = computeShockableOutcome(survivability, energyFactor, downtimeMs);
      resultOutcome = outcome;

      if (outcome === 'converted') {
        const postTachy = Math.random() < 0.65; // catecholamine surge post-ROSC — tachycardia is the more common immediate picture
        const postLabel = postTachy ? 'sinus tachycardia' : 'sinus rhythm';
        const postHR = postTachy ? 100 + Math.random() * 30 : 70 + Math.random() * 30;
        parsedRhythm.push({ label: postLabel, startMin: 0 });
        // Full cascade — ROSC is as much a state transition as arresting is,
        // same "every implied vital, together" rule CLAUDE.md documents for
        // the AI-authored paths.
        parsedOverrides.HR = [{ targetValue: postHR, startMin: 0, endMin: 0.15 }];
        parsedOverrides.BPsys = [{ targetValue: 70 + Math.random() * 25, startMin: 0, endMin: 0.3 }]; // post-ROSC hypotension is the norm, not the exception
        parsedOverrides.BPdia = [{ targetValue: 40 + Math.random() * 20, startMin: 0, endMin: 0.3 }];
        parsedOverrides.SpO2 = [{ targetValue: 85 + Math.random() * 7, startMin: 0, endMin: 1 }, { targetValue: 93 + Math.random() * 5, startMin: 1, endMin: 5 }];
        parsedOverrides.EtCO2 = [{ targetValue: 35 + Math.random() * 10, startMin: 0, endMin: 0.15 }]; // the classic abrupt EtCO2 jump taught as a ROSC sign
        parsedOverrides.RR = [{ targetValue: 4 + Math.random() * 6, startMin: 0, endMin: 0.5 }]; // usually still apnoeic/agonal immediately post-ROSC, needing support
        parsedOverrides.gcsE = [{ targetValue: 1, startMin: 0, endMin: 0.1 }];
        parsedOverrides.gcsV = [{ targetValue: 1, startMin: 0, endMin: 0.1 }];
        parsedOverrides.gcsM = [{ targetValue: 1 + Math.round(Math.random()), startMin: 0, endMin: 0.1 }];
        parsedOverrides.pain = [{ targetValue: 0, startMin: 0, endMin: 0.1 }];
        parsedOverrides.nausea = [{ targetValue: 0, startMin: 0, endMin: 0.1 }];
        note = `Defibrillation ${joules}J: ${rhythmLabel} terminated — ROSC, reverted to ${postLabel}. Survivability score ${survivability}/100, ~${Math.round(convertChance * 100)}% conversion chance modelled for this shock (hardcoded, no AI call).`;
      } else if (outcome === 'asystole') {
        parsedRhythm.push({ label: 'asystole', startMin: 0 });
        parsedOverrides.HR = [{ targetValue: 0, startMin: 0, endMin: 0.1 }];
        parsedOverrides.BPsys = [{ targetValue: 0, startMin: 0, endMin: 0.2 }];
        parsedOverrides.BPdia = [{ targetValue: 0, startMin: 0, endMin: 0.2 }];
        parsedOverrides.SpO2 = [{ targetValue: 0, startMin: 0, endMin: 1 }];
        parsedOverrides.EtCO2 = [{ targetValue: 5 + Math.random() * 5, startMin: 0, endMin: 0.5 }];
        parsedOverrides.RR = [{ targetValue: 0, startMin: 0, endMin: 0.1 }];
        parsedOverrides.gcsE = [{ targetValue: 1, startMin: 0, endMin: 0.1 }];
        parsedOverrides.gcsV = [{ targetValue: 1, startMin: 0, endMin: 0.1 }];
        parsedOverrides.gcsM = [{ targetValue: 1, startMin: 0, endMin: 0.1 }];
        parsedOverrides.pain = [{ targetValue: 0, startMin: 0, endMin: 0.1 }];
        parsedOverrides.nausea = [{ targetValue: 0, startMin: 0, endMin: 0.1 }];
        note = `Defibrillation ${joules}J: deteriorated to asystole post-shock. Survivability score ${survivability}/100 (hardcoded, no AI call).`;
      } else {
        note = `Defibrillation ${joules}J: no effect — remains in ${rhythmLabel}. Survivability score ${survivability}/100, ~${Math.round(convertChance * 100)}% conversion chance modelled for this shock (hardcoded, no AI call).`;
      }
    } else if (rhythmClass === 'nonshockable-arrest') {
      // Real ACLS teaching point: asystole/PEA are not shockable — there's
      // no fibrillating myocardium for a shock to terminate. Deliberately a
      // pure no-op, not a randomised low chance of something.
      resultOutcome = 'nonshockable-arrest';
      note = `Defibrillation ${joules}J: not indicated for ${rhythmLabel} — no effect (hardcoded, no AI call).`;
    } else {
      const conscious = vitalsNow.gcsV >= 4; // same "can this patient perceive/report it" threshold the AI treatment prompt uses for pain/nausea
      const { outcome, induceVfChance } = computeOrganizedShockOutcome(rhythmLabel, joules);
      resultOutcome = outcome;

      if (outcome === 'induced-vf') {
        parsedRhythm.push({ label: 'ventricular fibrillation', startMin: 0.05 });
        parsedOverrides.HR = [{ targetValue: 0, startMin: 0.05, endMin: 0.15 }];
        parsedOverrides.BPsys = [{ targetValue: 0, startMin: 0.05, endMin: 0.25 }];
        parsedOverrides.BPdia = [{ targetValue: 0, startMin: 0.05, endMin: 0.25 }];
        parsedOverrides.SpO2 = [{ targetValue: 0, startMin: 0.05, endMin: 1 }];
        parsedOverrides.EtCO2 = [{ targetValue: 5 + Math.random() * 5, startMin: 0.05, endMin: 0.5 }];
        parsedOverrides.RR = [{ targetValue: 0, startMin: 0.05, endMin: 0.15 }];
        parsedOverrides.gcsE = [{ targetValue: 1, startMin: 0.05, endMin: 0.15 }];
        parsedOverrides.gcsV = [{ targetValue: 1, startMin: 0.05, endMin: 0.15 }];
        parsedOverrides.gcsM = [{ targetValue: 1, startMin: 0.05, endMin: 0.15 }];
        parsedOverrides.pain = [{ targetValue: 0, startMin: 0.05, endMin: 0.15 }];
        parsedOverrides.nausea = [{ targetValue: 0, startMin: 0.05, endMin: 0.15 }];
        note = `Defibrillation ${joules}J: inappropriate shock on ${rhythmLabel} precipitated ventricular fibrillation (~${Math.round(induceVfChance * 100)}% chance modelled, hardcoded, no AI call).`;
      } else if (outcome === 'cardioverted') {
        parsedRhythm.push({ label: 'sinus rhythm', startMin: 0 });
        parsedOverrides.HR = [{ targetValue: 70 + Math.random() * 25, startMin: 0, endMin: 0.15 }];
        if (conscious) parsedOverrides.pain = buildFadeToNaturalChain(cfg, 'pain', 8 + Math.random() * 2, 0.05, 0.5, 4, givenAtMs);
        note = `Defibrillation ${joules}J: ${rhythmLabel} cardioverted to sinus rhythm${conscious ? ' — painful, unsynchronised shock' : ''} (hardcoded, no AI call).`;
      } else if (conscious) {
        parsedOverrides.pain = buildFadeToNaturalChain(cfg, 'pain', 8 + Math.random() * 2, 0.05, 0.5, 4, givenAtMs);
        parsedOverrides.HR = buildFadeToNaturalChain(cfg, 'HR', vitalsNow.HR + 20 + Math.random() * 15, 0.05, 0.5, 3, givenAtMs);
        note = `Defibrillation ${joules}J: no rhythm change (remains ${rhythmLabel}) — painful stimulus only (hardcoded, no AI call).`;
      } else {
        note = `Defibrillation ${joules}J: no rhythm change (remains ${rhythmLabel}); patient unresponsive, no pain response (hardcoded, no AI call).`;
      }
    }

    // A follow-up AI re-projection is only worth it for an outcome that
    // actually changes the patient's underlying trajectory going forward —
    // ROSC or a successful cardioversion. An unattended VF/VT would, in
    // reality, eventually degrade further on its own, but that's not worth
    // modelling: a crew that does nothing after a failed shock has
    // effectively walked away, not created a scenario branch worth AI time.
    // asystole/nonshockable-arrest/induced-vf are all static without further
    // intervention, and "no-change" never touched the rhythm at all — none
    // of those need anything beyond the hardcoded cascade already applied.
    // 5 minutes safely clears the longest hardcoded cascade phase in either
    // qualifying outcome (ROSC's SpO2 recovery ends at minute 5; a
    // cardioverted patient's pain fade-out ends around minute 4.55) so a
    // follow-up plan splicing in at that point never clobbers this cascade.
    const followUpDelayMin = (resultOutcome === 'converted' || resultOutcome === 'cardioverted') ? 5 : null;

    return { parsedOverrides, parsedRhythm, note, vitalsNow, outcome: resultOutcome, followUpDelayMin };
  }

  // ---- Pulse (derived — never independently stored) -----------------------
  // A pulse is NOT the same thing as the monitor's HR. HR reflects
  // ELECTRICAL activity (what a real monitor actually derives its rate
  // from — QRS detection, not a felt or oximeter pulse); a pulse reflects
  // genuine MECHANICAL/perfusing output. The two can legitimately disagree —
  // PEA is organized electrical activity with NO pulse (the entire clinical
  // trap: the monitor can look reassuring while there's nothing to feel),
  // and conversely effective CPR can generate a real pulse from a heart
  // that's electrically doing nothing useful at all (VF) or nothing at all
  // (asystole). There is no independent overrides array for "pulse" the way
  // there is for HR/BP/etc — nothing is ever authored onto a pulse timeline
  // directly; it's a pure function of the rhythm plus whichever blood
  // pressure source (the patient's own, or CPR's) is actually generating
  // output right now, recomputed fresh on every call exactly like
  // getRhythmAt/getVitalsRaw already are.
  _cfg.PULSE = {
    // Standard (approximate) teaching thresholds for which site is
    // palpable at a given systolic pressure — deliberately ONE table used
    // for both genuine and CPR-driven pressure. An earlier draft of this
    // capped CPR-generated pressure at carotid-only on the theory that
    // compression-generated flow can't reach a radial pulse — real,
    // reported clinical experience says otherwise (a good, deep compression
    // absolutely can produce a palpable radial pulse), so there's no
    // source-based cap here: whichever pressure is in effect is judged the
    // same way. The genuinely reliable real-world teaching point isn't
    // "which site is reachable" but "manual pulse checks of any site are
    // unreliable to PERFORM during active compressions" (motion artifact,
    // brief pauses, feeling your own pulse) — that's a UI/interaction
    // concern for the pulse-check action (not built yet), not a constraint
    // on what's physiologically possible here.
    radialSys: 90, brachialSys: 70, carotidSys: 60,
    // Ectopy-heavy rhythms don't perfuse on every QRS — a PVC often fires
    // before the ventricle has adequately filled, so only a fraction of
    // beats generate a real stroke volume/palpable beat, even though the
    // monitor's HR counts every complex. Regex tested against the rhythm
    // label (first match wins); anything organized and not listed here is
    // assumed fully perfusing (fraction 1). Approximate teaching figures,
    // not measured — reasonable enough for a training tool.
    ECTOPY_FRACTIONS: [
      { match: 'bigeminy', fraction: 0.5 },
      { match: 'trigeminy', fraction: 0.67 },
      { match: 'frequent (?:pvc|premature ventricular)', fraction: 0.75 }
    ]
  };

  // Distinct from classifyRhythmForDefib just above — that bucketing is
  // purely about shock decisions, this one is purely about whether/how a
  // beat generates a palpable pulse — but both require the same "pulseless"
  // qualifier before treating VT/torsades/polymorphic as an arrest rhythm,
  // for the same reason. 'pea' is its own category, separate from
  // 'nonperfusing-arrest': PEA has organized, often unremarkable-looking
  // electrical activity — the trap is exactly that the rate can look fine
  // while there's no pulse — whereas VF/asystole/pulseless VT have no
  // organized mechanical activity to begin with, so there's no rate-based
  // trap to model there.
  function classifyRhythmForPulse(label) {
    const s = (label || '').toLowerCase();
    if (/pulseless electrical|\bpea\b/.test(s)) return 'pea';
    if (/asystole/.test(s)) return 'nonperfusing-arrest';
    if (/ventricular fib|\bvf\b/.test(s)) return 'nonperfusing-arrest';
    if (/pulseless/.test(s) && /(torsades|polymorphic|\bvt\b|ventricular tach)/.test(s)) return 'nonperfusing-arrest';
    // A bare "ventricular tachycardia"/torsades/etc with no "pulseless"
    // qualifier is a genuinely perfusing (if dangerous) rhythm — falls
    // through to the ectopy check and then the perfusing default below,
    // same as any other organized rhythm.
    const ectopy = _cfg.PULSE.ECTOPY_FRACTIONS.find(e => new RegExp(e.match).test(s));
    if (ectopy) return 'partial-perfusion';
    return 'perfusing';
  }

  // The single entry point for "is there a pulse right now, where can you
  // feel it, and what rate": rhythm class decides whether there's any
  // mechanical output at all (and, for ectopy, what fraction of beats
  // count), and whichever blood pressure is actually driving output right
  // now — the patient's own (perfusing/partial-perfusion) or CPR's hidden
  // compression-generated numbers (pea/nonperfusing-arrest, only while
  // cfg.overrides.cpr.active) — decides which sites are palpable.
  function getPulseState(cfg, nowMs) {
    const vitalsNow = getVitalsRaw(cfg, nowMs);
    const rhythmLabel = getRhythmAt(cfg, nowMs) || deriveRhythmFromHR(vitalsNow.HR);
    const pulseClass = classifyRhythmForPulse(rhythmLabel);
    const cpr = (cfg.overrides && cfg.overrides.cpr) || null;
    const p = _cfg.PULSE;

    function sitesFor(sys) {
      const sites = [];
      if (sys >= p.carotidSys) sites.push('carotid');
      if (sys >= p.brachialSys) sites.push('brachial');
      if (sys >= p.radialSys) sites.push('radial');
      return sites;
    }
    const none = { present: false, source: null, rate: 0, palpableSites: [] };

    if (pulseClass === 'perfusing' || pulseClass === 'partial-perfusion') {
      const fraction = pulseClass === 'partial-perfusion'
        ? ((p.ECTOPY_FRACTIONS.find(e => new RegExp(e.match).test(rhythmLabel.toLowerCase())) || {}).fraction || 1)
        : 1;
      const rate = Math.round(vitalsNow.HR * fraction);
      if (rate <= 0 || vitalsNow.BPsys <= 0) return none; // e.g. mid-transition into/out of another state
      return { present: true, source: 'intrinsic', rate, palpableSites: sitesFor(vitalsNow.BPsys) };
    }

    // 'pea' or 'nonperfusing-arrest' — no intrinsic mechanical output
    // regardless of what the electrical rate/rhythm looks like. Only CPR
    // (the hidden compression-generated numbers) can produce a pulse here.
    if (cpr && cpr.active && cpr.pulseRate) {
      return { present: true, source: 'cpr', rate: cpr.pulseRate, palpableSites: sitesFor(cpr.perfusionSys || 0) };
    }
    return none;
  }

  // ---- CPR (shared, deterministic — no AI call) ----------------------------
  // Same reasoning as defibrillation above: chest-compression physiology is
  // well-established/predictable enough not to need per-patient AI
  // reasoning, and a quick-action button needs to feel instant, not wait on
  // a round trip.
  //
  // The monitor's HR/BPsys/BPdia are deliberately NEVER written here — an
  // earlier version of this function repurposed HR into a compression-driven
  // rate, which conflated the same two things getPulseState above exists to
  // keep separate (electrical vs mechanical). The monitor keeps showing
  // whatever the true rhythm/perfusion state already is (0 for a genuine
  // arrest, same as before CPR started) — the compression-generated pulse
  // and pressure are hidden values, stored only on cfg.overrides.cpr
  // (pulseRate/perfusionSys/perfusionDia), surfaced to the crew through a
  // deliberate pulse-check action rather than continuously on the monitor.
  // EtCO2 is the one exception and IS written directly: capnography reads
  // exhaled CO2 regardless of whether there's a pulse, so it's a real,
  // continuously-observable monitor value, and it genuinely does rise with
  // effective compressions (a recognised bedside sign of CPR quality) and
  // fall sharply the moment compressions stop.
  //
  // The hidden pulse/perfusion numbers are stored as flat values, not an
  // interpolated override chain — there's no monitor-facing ramp to animate
  // for a value nothing displays continuously, and real compressions
  // generate pressure within the first cycle or two, not gradually.
  // EtCO2's single-entry overrides below still rely on the same trick
  // computeDefibrillationEffect's cascades do: since rawTrendDeltasAt()
  // always returns a flat baseline in this engine, a single completed
  // entry holds at its target FOREVER on its own (see applyOverrides'
  // "override complete — shift the curve to pass through target at endMs"
  // branch) — no second explicit hold entry needed.
  //
  // cfg.overrides.cpr holds a single CURRENT-STATE object (not a vitals
  // array, not a step-function history like rhythm) — { active,
  // lmaInserted, startedAtMs, ratioLabel, pulseRate, perfusionSys,
  // perfusionDia } — so callers can drive Start/Stop CPR button labels, an
  // "Insert LMA" gate, and getPulseState above. Every place that
  // generically iterates cfg.overrides' keys (sim_control.html's
  // treatment/scripted-event context builders) must skip 'cpr' the same
  // way they already skip 'rhythm'.
  //
  // classifyRhythmForDefib now requires "pulseless" before treating VT/
  // torsades/polymorphic as an arrest rhythm (see its own comment) — a bare
  // "ventricular tachycardia" correctly classifies as 'organized' here, so
  // Start CPR on a perfusing (if dangerous) VT goes through the same
  // arrhythmia-risk/warning-note branch below as any other perfusing
  // rhythm, not the genuine-arrest branch. Old sessions that may have used
  // a bare "ventricular tachycardia" to mean an arrest (from before the AI
  // prompts were tightened to always say "pulseless") are the one residual
  // risk this doesn't retroactively fix — a data-migration concern, not a
  // code one.
  //
  // CPR started on a genuinely perfusing rhythm is handled inside
  // computeCprEffect's 'start' branch below, not a separate function — it
  // shares the same hidden-state bookkeeping, it's just a different note/
  // risk path once rhythmClass comes back 'organized'.
  _cfg.CPR = {
    compressionRateLow: 100, compressionRateHigh: 120, // guideline compression rate — the hidden CPR-driven pulse rate
    bpSysLow: 70, bpSysHigh: 90, bpDiaLow: 20, bpDiaHigh: 35, // hidden CPR-driven perfusion pressure, deliberately short of normotensive
    etco2Low: 15, etco2High: 25, // recognised bedside sign of reasonably effective compressions — the one value CPR writes to the monitor directly
    lmaEtco2BumpLow: 2, lmaEtco2BumpHigh: 5 // further modest rise once ventilation stops pausing compressions
  };
  function computeCprEffect(cfg, givenAtMs, mode) {
    const c = _cfg.CPR;
    const vitalsNow = getVitalsRaw(cfg, givenAtMs);
    const rhythmLabel = getRhythmAt(cfg, givenAtMs) || deriveRhythmFromHR(vitalsNow.HR);
    const rhythmClass = classifyRhythmForDefib(rhythmLabel); // still just gating "is this genuinely an arrest" — see the Phase 2 note above
    const priorCpr = (cfg.overrides && cfg.overrides.cpr) || { active: false, lmaInserted: false, startedAtMs: null, ratioLabel: null, pulseRate: null, perfusionSys: null, perfusionDia: null };

    const parsedOverrides = {};
    const parsedRhythm = [];
    let note;
    let cprState = priorCpr;

    if (mode === 'start') {
      if (priorCpr.active) {
        note = 'CPR is already in progress — no change.';
      } else {
        // The hidden compression-generated numbers are computed and stored
        // regardless of rhythm class — compressions genuinely do produce
        // this contribution mechanically, whether or not it's clinically
        // indicated right now. This matters for a case getPulseState's own
        // rhythm-class check already makes harmless: if CPR is started on a
        // perfusing rhythm (below) and that rhythm LATER genuinely arrests
        // (from a separate event, with the crew never re-pressing Start
        // since the button already reads "Stop CPR"), the hidden numbers
        // are already in place and getPulseState picks them straight up —
        // no gap. While the rhythm stays perfusing, getPulseState's
        // 'perfusing'/'partial-perfusion' branch is checked FIRST and never
        // looks at cpr at all, so storing these here changes nothing about
        // what's derived while they're not needed.
        const rate = Math.round(c.compressionRateLow + Math.random() * (c.compressionRateHigh - c.compressionRateLow));
        const bpSys = Math.round(c.bpSysLow + Math.random() * (c.bpSysHigh - c.bpSysLow));
        const bpDia = Math.round(c.bpDiaLow + Math.random() * (c.bpDiaHigh - c.bpDiaLow));
        cprState = { active: true, lmaInserted: false, startedAtMs: givenAtMs, ratioLabel: '30:2', pulseRate: rate, perfusionSys: bpSys, perfusionDia: bpDia };

        if (rhythmClass === 'organized') {
          // Compressing an already-beating heart isn't inert — it's a real,
          // if usually survivable, assessment error. Mechanically similar
          // in kind to an inappropriate/unsynchronised shock landing on a
          // vulnerable part of the cycle (see computeOrganizedShockOutcome
          // above), just from a blunter, lower-energy insult — so the risk
          // here is calibrated meaningfully lower than defib's equivalent,
          // not "compressions usually cause arrest" (that would over-punish
          // the standard, correctly-taught "if unsure, start CPR" default).
          // No EtCO2 override here: the CPR-quality EtCO2 rise specifically
          // reflects restoring flow during a NO-FLOW state, which doesn't
          // apply when the heart's already pumping on its own.
          const s = rhythmLabel.toLowerCase();
          const isIschaemic = /stemi|nstemi|ischaemia|ischemia/.test(s);
          const induceVfChance = isIschaemic ? 0.05 : 0.015;
          if (Math.random() < induceVfChance) {
            parsedRhythm.push({ label: 'ventricular fibrillation', startMin: 0.05 });
            parsedOverrides.HR = [{ targetValue: 0, startMin: 0.05, endMin: 0.15 }];
            parsedOverrides.BPsys = [{ targetValue: 0, startMin: 0.05, endMin: 0.25 }];
            parsedOverrides.BPdia = [{ targetValue: 0, startMin: 0.05, endMin: 0.25 }];
            parsedOverrides.SpO2 = [{ targetValue: 0, startMin: 0.05, endMin: 1 }];
            parsedOverrides.EtCO2 = [{ targetValue: Math.round(5 + Math.random() * 5), startMin: 0.05, endMin: 0.5 }];
            parsedOverrides.RR = [{ targetValue: 0, startMin: 0.05, endMin: 0.15 }];
            parsedOverrides.gcsE = [{ targetValue: 1, startMin: 0.05, endMin: 0.15 }];
            parsedOverrides.gcsV = [{ targetValue: 1, startMin: 0.05, endMin: 0.15 }];
            parsedOverrides.gcsM = [{ targetValue: 1, startMin: 0.05, endMin: 0.15 }];
            parsedOverrides.pain = [{ targetValue: 0, startMin: 0.05, endMin: 0.15 }];
            parsedOverrides.nausea = [{ targetValue: 0, startMin: 0.05, endMin: 0.15 }];
            note = `⚠ CPR started on a perfusing rhythm (${rhythmLabel}) — compressions precipitated ventricular fibrillation (~${Math.round(induceVfChance * 100)}% chance modelled). This is a genuine consequence of the assessment error, not random bad luck alone — a pulse check first would have caught it. (Hardcoded, no AI call.)`;
          } else {
            note = `⚠ CPR started, but a pulse WAS present (${rhythmLabel}) at the time — compressions aren't indicated here. No cardiac effect this time, but this reflects a genuine assessment error, not a null action — a pulse check first would have caught it. (Hardcoded, no AI call.)`;
          }
        } else {
          const etco2 = Math.round(c.etco2Low + Math.random() * (c.etco2High - c.etco2Low));
          parsedOverrides.EtCO2 = [{ targetValue: etco2, startMin: 0, endMin: 0.3 }];
          note = `CPR commenced (30:2) — compressions generating a palpable, compression-driven pulse at ~${rate}/min (~${bpSys}/${bpDia} mmHg) and EtCO₂ ~${etco2} mmHg. This pulse is compression-generated, not ROSC — the monitor's HR/BP keep reflecting the true underlying rhythm (${rhythmLabel}), not this number. (Hardcoded, no AI call.)`;
        }
      }
    } else if (mode === 'lma') {
      if (!priorCpr.active) {
        note = 'LMA logged — CPR is not currently active, so a compression:ventilation ratio doesn’t apply.';
      } else if (priorCpr.lmaInserted) {
        note = 'LMA is already in place — no change.';
      } else {
        cprState = { ...priorCpr, lmaInserted: true, ratioLabel: '15:1' };
        const bump = Math.round(c.lmaEtco2BumpLow + Math.random() * (c.lmaEtco2BumpHigh - c.lmaEtco2BumpLow));
        const etco2 = Math.round(vitalsNow.EtCO2 + bump);
        parsedOverrides.EtCO2 = [{ targetValue: etco2, startMin: 0, endMin: 0.2 }];
        note = `LMA inserted — compressions now continuous with asynchronous ventilation (displayed as ${cprState.ratioLabel}); fewer compression pauses, modest EtCO₂ improvement to ~${etco2} mmHg. (Hardcoded, no AI call.)`;
      }
    } else if (mode === 'stop') {
      if (!priorCpr.active) {
        note = 'CPR is already stopped — no change.';
      } else {
        cprState = { active: false, lmaInserted: priorCpr.lmaInserted, startedAtMs: null, ratioLabel: null, pulseRate: null, perfusionSys: null, perfusionDia: null };
        if (rhythmClass === 'organized') {
          note = `CPR stopped — ${rhythmLabel} is a perfusing rhythm; no monitor change (the circulation was already genuine, not compression-driven).`;
        } else {
          // EtCO2 is the one monitor value CPR was actually driving directly
          // — it genuinely does fall sharply the moment compressions stop.
          // HR/BP were never touched by CPR under this model, so there is
          // nothing to revert there.
          parsedOverrides.EtCO2 = [{ targetValue: Math.round(5 + Math.random() * 5), startMin: 0, endMin: 0.5 }];
          note = `CPR stopped — compression-driven pulse and perfusion lost immediately; ${rhythmLabel} confirmed with no cardiac output. (Hardcoded, no AI call.)`;
        }
      }
    }

    return { parsedOverrides, parsedRhythm, note, vitalsNow, cprState };
  }

  // Splices a computed override plan (AI-authored, or the hardcoded defib
  // plan above) into the session's existing overrides. For every vital key
  // the plan actually returned entries for: anything already fully in the
  // past is kept as accurate history, anything mid-transition right now is
  // truncated to end exactly at givenAtMs (at its real current value), and
  // anything still in the future is dropped before the new chain is
  // appended — otherwise the engine (which always uses whichever override,
  // in start-time order, contains "now") would let the OLD trajectory keep
  // winning for its entire remaining duration. A vital the plan didn't
  // mention is left completely untouched — omission means "keep whatever
  // was already scheduled", not "erase it with nothing to replace it".
  // Graph-UI side effects (auto-enabling a series' visibility) are the
  // caller's responsibility, not this function's — this file has no DOM.
  function spliceAiOverridePlan(freshOverrides, parsedOverrides, vitalsNow, givenAtMs) {
    const affectedKeys = new Set(Object.keys(parsedOverrides || {}).filter(k => Array.isArray(parsedOverrides[k]) && parsedOverrides[k].length));
    Object.keys(freshOverrides).forEach(key => {
      if (!affectedKeys.has(key)) return;
      const arr = freshOverrides[key] || [];
      const kept = [];
      arr.forEach(ov => {
        if (ov.endMs <= givenAtMs) {
          kept.push(ov);
        } else if (ov.startMs < givenAtMs) {
          kept.push({ startMs: ov.startMs, endMs: givenAtMs, targetValue: vitalsNow[key] });
        }
        // else: startMs >= givenAtMs — superseded future plan, drop (this vital IS being replaced below)
      });
      freshOverrides[key] = kept;
    });
    Object.entries(parsedOverrides || {}).forEach(([key, arr]) => {
      if (!Array.isArray(arr) || !arr.length) return;
      const cleanArr = arr
        .filter(ov => typeof ov.targetValue === 'number' && typeof ov.startMin === 'number' && typeof ov.endMin === 'number')
        .map(ov => ({
          targetValue: ov.targetValue,
          startMs: givenAtMs + Math.min(60, Math.max(0, ov.startMin)) * 60000,
          endMs: givenAtMs + Math.min(60, Math.max(0, ov.endMin)) * 60000
        }));
      if (!freshOverrides[key]) freshOverrides[key] = [];
      freshOverrides[key] = freshOverrides[key].concat(cleanArr);
    });
    return freshOverrides;
  }

  // Splices a computed rhythm plan into freshOverrides.rhythm — a separate,
  // much simpler mechanism from spliceAiOverridePlan because a rhythm is a
  // discrete step-change list (see getRhythmAt above), not an interpolated
  // curve: no in-progress truncation is needed, just drop anything scheduled
  // at/after givenAtMs (a superseded future plan) and append the new
  // entries. If the plan didn't return a rhythm array at all, the existing
  // schedule — including its future — is left completely alone, same
  // "omission means don't touch it" rule as vitals.
  function spliceRhythmPlan(freshOverrides, parsedRhythm, givenAtMs) {
    if (!Array.isArray(parsedRhythm) || !parsedRhythm.length) return;
    const existing = ((freshOverrides.rhythm || [])).filter(ev => ev.startMs < givenAtMs);
    const clean = parsedRhythm
      .filter(ev => typeof ev.label === 'string' && ev.label.trim() && typeof ev.startMin === 'number')
      .map(ev => ({ label: ev.label.trim(), startMs: givenAtMs + Math.min(60, Math.max(0, ev.startMin)) * 60000 }));
    freshOverrides.rhythm = existing.concat(clean);
  }

  // After a rewind + a genuinely diverging action (something given at a time
  // EARLIER than what's already logged — see appendTreatmentEntry in
  // sim_control.html), every vital/rhythm has to stop reflecting the
  // now-invalid old future. There's no per-entry record of which treatment
  // produced which override row, so surgically undoing just the discarded
  // treatment's own contribution isn't possible — instead EVERY key's
  // future beyond givenAtMs is dropped outright, leaving each vital holding
  // at its real value at the fork. History up to givenAtMs, and anything
  // mid-transition at givenAtMs (frozen at its real value there), are
  // preserved exactly like an ordinary splice — only the future is touched.
  //
  // Deliberately NOT refilled from the scenario's untreated baseline course
  // (baselineOverrides), which an earlier version did: that course is "what
  // happens if this patient is never treated at all", which for a lethal
  // presentation (anaphylaxis, major haemorrhage, tension pneumothorax...)
  // ends in GCS 3 / VF / asystole. Restoring it wholesale meant a crew who
  // rewound and then gave a genuinely effective treatment still got the
  // untreated death course back on every key their new treatment's AI plan
  // didn't happen to name — HR/BP/SpO2 stabilising on the graph while GCS
  // kept sliding to 3 and the scripted VF/asystole markers stayed put. A
  // cleared future can't contradict itself that way: the AI's plan for the
  // new action is then the ONLY thing scheduling anything forward.
  //
  // Callers apply their own action's splice (spliceAiOverridePlan etc)
  // AFTER this, and must tell the AI the forward plan was cleared so it
  // projects the complete picture — including any continued deterioration
  // the new action doesn't address — rather than assuming the old schedule
  // still covers whatever it leaves out. See regenerateTimelineAfterTreatment
  // /regenerateTimelineForScriptedEvent's DIVERGENCE_NOTE in sim_control.html.
  const VITAL_KEYS = ['HR', 'RR', 'SpO2', 'EtCO2', 'BPsys', 'BPdia', 'temp', 'bgl', 'ketones', 'pain', 'nausea', 'gcsE', 'gcsV', 'gcsM'];
  function clearFutureFromFork(freshOverrides, vitalsNow, givenAtMs) {
    VITAL_KEYS.forEach(key => {
      const arr = freshOverrides[key] || [];
      const kept = [];
      arr.forEach(ov => {
        if (ov.endMs <= givenAtMs) {
          kept.push(ov);
        } else if (ov.startMs < givenAtMs) {
          kept.push({ startMs: ov.startMs, endMs: givenAtMs, targetValue: vitalsNow[key] });
        }
        // else: startMs >= givenAtMs — from a discarded branch, drop
      });
      freshOverrides[key] = kept;
    });
    // Rhythm is a step function with no in-progress state to truncate —
    // whatever was showing at the fork stays showing until something new
    // schedules a change (getRhythmAt: last entry at-or-before now wins).
    freshOverrides.rhythm = (freshOverrides.rhythm || []).filter(ev => ev.startMs < givenAtMs);
    // CPR state (see computeCprEffect) is a single current-state object, not
    // a vitals array or the rhythm step-function, so neither loop above
    // touches it — but if CPR was started AFTER this fork point (i.e. in the
    // now-discarded future), leaving it "active" would be stale: those
    // compressions never happened on this branch. A CPR session that started
    // BEFORE the fork is still genuinely in progress and is left alone.
    const cpr = freshOverrides.cpr;
    if (cpr && cpr.active && cpr.startedAtMs != null && cpr.startedAtMs >= givenAtMs) {
      freshOverrides.cpr = { active: false, lmaInserted: cpr.lmaInserted, startedAtMs: null, ratioLabel: null, pulseRate: null, perfusionSys: null, perfusionDia: null };
    }
  }

  // ---- Live appearance state (derived from vitals, no AI) -----------------
  // Same severity bands sim_control.html's assessor-facing Appearance tab
  // uses, kept here as the one shared source so sim_patient.html's avatar
  // reads identical thresholds instead of a second drifting copy. Only
  // gates on consciousness where a working brain is actually required
  // (eye-opening) — skin colour/moisture/work-of-breathing are physical
  // findings and stay live regardless of GCS.
  // Threshold numbers only — the band VALUES (0-4) are a fixed ordinal
  // severity scale, not themselves configurable. spo2's chronic-respiratory
  // baseline shift (see sim_control.html's detectChronicRespiratoryBaseline)
  // is passed in per-call, not stored here — it's scenario-specific, not a
  // global tuning value.
  _cfg.SEVERITY_BANDS = {
    hr:    { extremeLow: 40, extremeHigh: 140, severeLow: 50, severeHigh: 120, mildLow: 60, mildHigh: 100 },
    rr:    { extremeLow: 6,  extremeHigh: 30,  severeLow: 9,  severeHigh: 24,  mildLow: 12, mildHigh: 20 },
    spo2:  { band4: 80, band3: 85, band2: 90, band1: 95 },
    pain:  { band3: 7, band2: 4, band1: 1 },
    bpSys: { band3: 70, band2: 90, band1: 100 }
  };
  function hrSeverity(hr) {
    const t = _cfg.SEVERITY_BANDS.hr;
    if (hr <= 0) return 4;
    if (hr < t.extremeLow || hr > t.extremeHigh) return 3;
    if (hr < t.severeLow || hr > t.severeHigh) return 2;
    if (hr < t.mildLow || hr > t.mildHigh) return 1;
    return 0;
  }
  function rrSeverity(rr) {
    const t = _cfg.SEVERITY_BANDS.rr;
    if (rr <= 0) return 4;
    if (rr <= t.extremeLow || rr > t.extremeHigh) return 3;
    if (rr <= t.severeLow || rr > t.severeHigh) return 2;
    if (rr < t.mildLow || rr > t.mildHigh) return 1;
    return 0;
  }
  function spo2Severity(spo2, shift) {
    shift = shift || 0;
    const t = _cfg.SEVERITY_BANDS.spo2;
    if (spo2 < t.band4 - shift) return 4;
    if (spo2 < t.band3 - shift) return 3;
    if (spo2 < t.band2 - shift) return 2;
    if (spo2 < t.band1 - shift) return 1;
    return 0;
  }
  function painSeverity(pain) {
    const t = _cfg.SEVERITY_BANDS.pain;
    if (pain >= t.band3) return 3;
    if (pain >= t.band2) return 2;
    if (pain >= t.band1) return 1;
    return 0;
  }
  function bpSysSeverity(sys) {
    const t = _cfg.SEVERITY_BANDS.bpSys;
    if (sys <= 0) return 4;
    if (sys < t.band3) return 3;
    if (sys < t.band2) return 2;
    if (sys < t.band1) return 1;
    return 0;
  }
  // Real session data can momentarily lack a key (older scenarios, a field
  // mid-splice) or carry a non-finite value — this must never throw, since
  // sim_patient.html's tick() depends on everything after its avatar call
  // still running (timer, override polling, etc). Non-finite input maps to
  // a safe, unremarkable default rather than propagating NaN into severity
  // comparisons (which silently evaluate false, not throw, but would render
  // a misleading "resting" appearance instead of an honest fallback).
  function numOr(x, fallback) {
    return Number.isFinite(x) ? x : fallback;
  }
  function clamp01(x) { return Math.max(0, Math.min(1, x)); }
  // Continuous 0-1 counterparts to the discrete severity bands above — same
  // clinical thresholds (e.g. spo2Abnormality reaches 1 right where
  // spo2Severity would hit its top band), but smoothly graduated instead of
  // stepped. These exist purely to drive how DEEP a live appearance effect
  // (skin tint blend, sweat amount) reads, not to change which clinical
  // category applies — the discrete severity()/skinColour/moisture logic
  // below is untouched, so nothing that read those band labels changes
  // behaviour. Without this, applySkinTint()/setSweat() had only an on/off
  // (or fixed-blend) signal to work with, so the avatar's skin tint and
  // diaphoresis snapped straight to a fixed intensity the instant a
  // threshold ticked over, rather than deepening as the vital drifted
  // further past it.
  function hrAbnormality(hr) {
    if (hr <= 0) return 1;
    return Math.max(clamp01((60 - hr) / 60), clamp01((hr - 100) / 100));
  }
  function rrAbnormality(rr) {
    if (rr <= 0) return 1;
    return Math.max(clamp01((12 - rr) / 12), clamp01((rr - 20) / 20));
  }
  function bpSysAbnormality(sys) {
    if (sys <= 0) return 1;
    return clamp01((100 - sys) / 60);
  }
  function spo2Abnormality(spo2) {
    return clamp01((95 - spo2) / 20);
  }
  function painAbnormality(pain) {
    return clamp01(pain / 10);
  }
  function getAppearanceState(v) {
    v = v || {};
    const hr = numOr(v.HR, 80), rr = numOr(v.RR, 16), spo2 = numOr(v.SpO2, 98),
          bpSys = numOr(v.BPsys, 120), pain = numOr(v.pain, 0),
          gcsE = numOr(v.gcsE, 4), gcsV = numOr(v.gcsV, 5), gcsM = numOr(v.gcsM, 6);
    const unresponsive = (gcsE + gcsV + gcsM) <= 8;
    const hypoxia = spo2Severity(spo2);
    const perfusion = Math.max(hrSeverity(hr), bpSysSeverity(bpSys));
    const distressLevel = Math.max(hrSeverity(hr), rrSeverity(rr), hypoxia, painSeverity(pain));
    // perfusionFrac (direction-agnostic — used for moisture/mottled depth,
    // where it's "how badly is perfusion failing", not which way HR/BP is
    // off) vs the directional fractions below (pallor/flush specifically
    // care WHICH way a vital is abnormal — a fast HR doesn't cause pallor,
    // only a slow one does, and only a high BP flushes).
    const perfusionFrac = Math.max(hrAbnormality(hr), bpSysAbnormality(bpSys));
    const hrLowFrac = hr <= 0 ? 1 : clamp01((60 - hr) / 60);
    const bpHighFrac = clamp01((bpSys - 140) / 60);
    const pallorFrac = Math.max(hrLowFrac, bpSysAbnormality(bpSys));
    const flushFrac = bpHighFrac;
    // Cyanosis is deliberately split into two independent depths: lips pick
    // it up first, from mild hypoxia (ramping as SpO2 drops below 95%);
    // general skin only joins in once truly critical (below ~85%), then
    // deepens gradually the whole way down to 0% rather than plateauing at
    // some "fully cyanotic" SpO2 — tuned visually via avatar_tuning_lab.html.
    const lipCyanosisFrac = clamp01((95 - spo2) / 15);
    const skinCyanosisFrac = clamp01((85 - spo2) / 85);
    let skinColour;
    if (skinCyanosisFrac > 0) skinColour = 'cyanotic';
    else if (perfusion >= 3) skinColour = 'mottled';
    else if (pallorFrac > 0) skinColour = 'pale';
    else if (flushFrac > 0) skinColour = 'flushed';
    else skinColour = 'normal';
    // Only meaningful for 'mottled' now (a genuinely blotchy discolouration,
    // rendered as a plain colour blend) — pallor/flush/cyanosis are HSL
    // hue/saturation adjustments computed client-side straight from the
    // frac fields above, not a blend toward a fixed hex, so a patient's own
    // base skin tone stays visible under them instead of flattening
    // everyone toward the same fixed "pale grey"/"cyanotic blue".
    let skinTintAmount = 0;
    if (skinColour === 'mottled') skinTintAmount = 0.25 + perfusionFrac * 0.35;
    const moistureLvl = Math.max(perfusion, painSeverity(pain));
    const moisture = moistureLvl >= 2 ? 'diaphoretic' : moistureLvl >= 1 ? 'clammy' : 'dry';
    // Continuous 0-1 sweat amount — drives a graduated 1-to-3-drop escalation
    // (see setSweat() in sim_patient.html) instead of a flat on/off, so
    // "barely clammy" and "drenched" read as visibly different amounts of
    // sweat rather than the same drops just changing opacity.
    const moistureFrac = Math.max(perfusionFrac, painAbnormality(pain));
    const wob = rr <= 0 ? 'apnoeic' : rr <= 4 ? 'agonal' : Math.max(rrSeverity(rr), hypoxia);
    return {
      unresponsive, distressLevel, skinColour, skinTintAmount,
      pallorFrac, flushFrac, lipCyanosisFrac, skinCyanosisFrac,
      moisture, moistureFrac, wob, gcsE, pain
    };
  }

  // ---- Composite "Health" score (0-100, "dead" at 0, "normal" at 100) -----
  // Shared by sim_control.html's Health graph line and sim_patient.html's
  // improving/deteriorating trend arrows — kept here, not duplicated in
  // either caller, since both need the exact same number for their
  // respective indicators to agree with each other.

  // Instantaneous 0-100 "how normal right now" reading — a weighted average
  // of the DISCRETE severity bands above across HR, RR, SpO2, BP sys, GCS and
  // pain. 100 = every input fully normal; 0 = every input simultaneously at
  // its worst band, which is reachable in practice — the AI's cardiac-arrest
  // cascade rule (see CLAUDE.md) writes HR/RR/SpO2/BP/GCS overrides
  // together, not just one of them. This is the graph line's own calibration
  // (matches the Appearance tab), used by getHealthScore() below; the trend
  // arrows use healthLevelContinuous() instead — see that one for why.
  //
  // Pain is self-reported, so it only means something while the patient is
  // conscious enough to report it. painWeight fades from 1 down to 0 as GCS
  // falls from 15 toward 8 (the same threshold getAppearanceState() above
  // gates unresponsive on) rather than snapping off at that line — a hard
  // cutoff would put a visible kink in the score at the exact instant
  // consciousness is lost, while everything else is still transitioning
  // smoothly. Below GCS 8, pain carries no weight at all: cascade-scripted
  // arrests correctly cut pain to 0 alongside LOC, which would otherwise
  // read as "0 abnormality" — an improvement — at exactly the moment the
  // patient is at their worst. BPdia/EtCO2/temp/bgl/ketones/nausea are left
  // out entirely, for lack of an existing calibrated severity band for them.
  function healthLevelDiscrete(v) {
    const gcsTotal = (v.gcsE || 0) + (v.gcsV || 0) + (v.gcsM || 0);
    const gcsAbnormality = Math.min(1, Math.max(0, (15 - gcsTotal) / 12));
    const painWeight = Math.min(1, Math.max(0, (gcsTotal - 8) / 7));
    const weighted = [
      { sub: hrSeverity(v.HR) / 4, w: 1 },
      { sub: rrSeverity(v.RR) / 4, w: 1 },
      { sub: spo2Severity(v.SpO2) / 4, w: 1 },
      { sub: bpSysSeverity(v.BPsys) / 4, w: 1 },
      { sub: gcsAbnormality, w: 1 },
      { sub: painSeverity(v.pain) / 3, w: painWeight }
    ];
    const totalWeight = weighted.reduce((a, x) => a + x.w, 0);
    const avgAbnormality = weighted.reduce((a, x) => a + x.sub * x.w, 0) / totalWeight;
    return 100 * (1 - avgAbnormality);
  }

  // Same weighted blend as healthLevelDiscrete(), but built on the
  // CONTINUOUS 0-1 abnormality curves above (hrAbnormality/rrAbnormality/
  // bpSysAbnormality/spo2Abnormality/painAbnormality) instead of the
  // discrete severity bands. Only the trend arrows use this: a trend is
  // nothing but "how much did this move," and the discrete bands are blind
  // to any movement that doesn't cross a band boundary — a HR swinging from
  // 180 to 145 stays "severity 3, extreme" the whole way and registers as
  // zero change, even though 35bpm of real movement happened. The graph's
  // own instantaneous score deliberately stays on the discrete bands (see
  // healthLevelDiscrete) since that's what's calibrated against the
  // Appearance tab; this one exists purely for rate-of-change sensitivity.
  function healthLevelContinuous(v) {
    const gcsTotal = (v.gcsE || 0) + (v.gcsV || 0) + (v.gcsM || 0);
    const gcsAbnormality = Math.min(1, Math.max(0, (15 - gcsTotal) / 12));
    const painWeight = Math.min(1, Math.max(0, (gcsTotal - 8) / 7));
    const weighted = [
      { sub: hrAbnormality(v.HR), w: 1 },
      { sub: rrAbnormality(v.RR), w: 1 },
      { sub: spo2Abnormality(v.SpO2), w: 1 },
      { sub: bpSysAbnormality(v.BPsys), w: 1 },
      { sub: gcsAbnormality, w: 1 },
      { sub: painAbnormality(v.pain), w: painWeight }
    ];
    const totalWeight = weighted.reduce((a, x) => a + x.w, 0);
    const avgAbnormality = weighted.reduce((a, x) => a + x.sub * x.w, 0) / totalWeight;
    return 100 * (1 - avgAbnormality);
  }

  // Rhythm is a distinct concept from the numeric vitals (see CLAUDE.md —
  // HR/RR/BP/SpO2 don't by themselves say whether there's a pulse), and
  // it's the authoritative "is there any perfusion at all" signal: VF,
  // pulseless VT, asystole and PEA all mean zero cardiac output regardless
  // of what the monitor numbers still read (an authored cascade doesn't
  // always land every vital on 0 in perfect lockstep with the rhythm
  // change). Reusing classifyRhythmForDefib() here — the same bucketing
  // already trusted for shock/no-shock decisions — rather than inventing a
  // second classification. HR<=0 is kept as a fallback for the rare
  // scenario that reaches "HR 0" without a matching rhythm entry (a
  // cascade-authoring gap CLAUDE.md's own cascade rule says shouldn't
  // happen, but costs nothing to guard against here too).
  function healthLevelAt(cfg, tMs, continuous) {
    const rhythm = getRhythmAt(cfg, tMs);
    if (rhythm && classifyRhythmForDefib(rhythm) !== 'organized') return 0;
    const v = getVitalsRaw(cfg, tMs);
    if (v.HR <= 0) return 0;
    return continuous ? healthLevelContinuous(v) : healthLevelDiscrete(v);
  }

  // Trailing window both getHealthScore() and the trend arrows sample
  // across. Admin-configurable (see sim_config_schema.js's 'timers'
  // section) like the other tunables above, via _cfg/applyConfigOverrides.
  _cfg.HEALTH_WINDOW_MS = 90000;
  _cfg.HEALTH_SAMPLES = 4; // evenly spaced across the window, including "now"

  // The WORST (lowest) of healthLevelAt() sampled across the trailing
  // window — not an average, and not a separate magnitude-based "how much
  // is this swinging" heuristic (an earlier version tried that: it could
  // floor the score to a literal, maximal 0 from nothing more than one
  // vital's raw number moving a lot, even while every sample's actual
  // computed severity was nowhere near that bad — verified against a real
  // session where this fired 6 minutes before the patient was anywhere
  // close to arrest). Taking the worst ACTUAL sampled level instead means
  // the result is always grounded in a real computed reading, never an
  // independent overshoot:
  //
  // - Fixes "crashing through normal": a HR sliding from tachycardic
  //   through the 60-100 normal band on its way to arrest used to read as
  //   briefly perfectly healthy at the exact crossing instant. The worse
  //   reading from just before/after that instant, still inside the same
  //   trailing window, now wins instead.
  // - Fixes step noise from small-range vitals (pain/GCS/nausea have few
  //   severity bands covering a small numeric range, so a routine authored
  //   change crosses a whole band, and used to spike on its own) — a brief
  //   worse reading here still only holds for as long as it stays inside
  //   the trailing window, same as any other sample.
  // - Confirmed cardiac arrest falls out of this for free: once every
  //   sample in the window reads 0 (via healthLevelAt's rhythm/HR check),
  //   the worst of them is 0 too — no separate "has HR been 0 the whole
  //   window" gate needed, and no gap at the trailing edge of that gate
  //   for a stray non-zero sample to slip through (which is what produced
  //   a brief uptick a few minutes into a real confirmed asystole).
  function getHealthScore(cfg, nowMs) {
    let worst = 100;
    for (let i = 0; i < _cfg.HEALTH_SAMPLES; i++) {
      const tMs = nowMs - _cfg.HEALTH_WINDOW_MS * (i / (_cfg.HEALTH_SAMPLES - 1));
      worst = Math.min(worst, healthLevelAt(cfg, tMs, false));
    }
    return worst;
  }

  // Same worst-of-window mechanism as getHealthScore(), but sampling
  // healthLevelAt(..., true) (the continuous basis) instead — this is what
  // sim_patient.html's trend arrows actually difference two of, 3 minutes
  // apart (see computeHealthTrend() there). Needs its own function rather
  // than reusing getHealthScore() purely because of that continuous basis:
  // the discrete severity bands getHealthScore() uses are blind to any
  // movement that doesn't cross a band boundary, which is fine for "how
  // abnormal is this reading" but wrong for "how much has this moved" — a
  // trend needs the latter. The worst-of-window mechanism itself is
  // unchanged between the two and doesn't need separate justification here:
  // unlike the swing-based approach it replaced, it doesn't cancel out a
  // genuinely fast recovery (verified — see the redesign's own test notes),
  // since it's always grounded in an actual computed reading rather than an
  // independent magnitude heuristic.
  function getHealthTrendLevel(cfg, nowMs) {
    let worst = 100;
    for (let i = 0; i < _cfg.HEALTH_SAMPLES; i++) {
      const tMs = nowMs - _cfg.HEALTH_WINDOW_MS * (i / (_cfg.HEALTH_SAMPLES - 1));
      worst = Math.min(worst, healthLevelAt(cfg, tMs, true));
    }
    return worst;
  }

  // ---- Display smoothing (visual only — doesn't change what
  // getHealthScore()/getHealthTrendLevel() themselves consider correct) -----
  // A composite built on discrete severity bands is inherently a staircase,
  // and different vitals cross their own band boundaries at slightly
  // different times — e.g. pain's contribution can briefly spike right as
  // its severity crosses a band, then fade back down as its own
  // consciousness-based weight keeps shrinking underneath it (see
  // healthLevelDiscrete/painWeight above), producing small sawtoothed
  // ripples in an otherwise clearly-declining trend. The Health line is a
  // visual trend indicator, not a hard clinical reading, so ironing those
  // out after the fact is fine — this is a trailing moving average of the
  // ALREADY-COMPUTED score/trend-level, layered on top rather than folded
  // into the scoring itself, so rhythm-awareness/worst-of-window/confirmed-
  // arrest all still work exactly as before underneath it.
  _cfg.HEALTH_DISPLAY_SMOOTHING_MS = 120000;
  _cfg.HEALTH_DISPLAY_SMOOTHING_SAMPLES = 20;
  function smoothOverTrailingWindow(fn, cfg, nowMs) {
    let sum = 0;
    for (let i = 0; i < _cfg.HEALTH_DISPLAY_SMOOTHING_SAMPLES; i++) {
      const tMs = nowMs - _cfg.HEALTH_DISPLAY_SMOOTHING_MS * (i / (_cfg.HEALTH_DISPLAY_SMOOTHING_SAMPLES - 1));
      sum += fn(cfg, tMs);
    }
    return sum / _cfg.HEALTH_DISPLAY_SMOOTHING_SAMPLES;
  }
  // Used by sim_control.html's Health graph line/tile instead of
  // getHealthScore() directly.
  function getDisplayHealthScore(cfg, nowMs) {
    return smoothOverTrailingWindow(getHealthScore, cfg, nowMs);
  }
  // Used by sim_patient.html's trend arrows instead of getHealthTrendLevel()
  // directly, so the arrows react to the same smoothed picture the graph
  // shows rather than the raw ripples.
  function getDisplayHealthTrendLevel(cfg, nowMs) {
    return smoothOverTrailingWindow(getHealthTrendLevel, cfg, nowMs);
  }

  // Fuzzy-maps the scenario's free-text patient_meta.mood (e.g. "Anxious and
  // tearful", authored by generator.html's AI prompt) into a small canonical
  // set the avatar's live eyebrow/mouth expression can actually render —
  // same style as ecg_engine.js's mapRhythm(). Order matters: checked
  // top-to-bottom, first match wins. Falls back to 'calm' for unset/
  // unrecognised text rather than guessing, since "not sure" should read as
  // an unremarkable resting expression, not an arbitrary mood. Plain
  // substring keyword lists (not regex) — the original patterns were all
  // simple word alternations with no other regex features, so this is a
  // safe, equivalent, and admin-UI-friendly (no regex-authoring risk) form.
  _cfg.MOOD_MAP = [
    { mood: 'angry', keywords: ['angry', 'hostile', 'aggressive', 'combative', 'furious', 'irate'] },
    { mood: 'agitated', keywords: ['agitat', 'restless', 'irritable', 'uncooperative', 'on edge'] },
    { mood: 'tearful', keywords: ['tearful', 'crying', 'weeping', 'sobbing'] },
    { mood: 'anxious', keywords: ['anxious', 'worried', 'frightened', 'scared', 'fearful', 'panick'] },
    { mood: 'confused', keywords: ['confus', 'disorient', 'vague', 'bewildered'] }
  ];
  function parseScenarioMood(text) {
    const s = String(text || '').toLowerCase().trim();
    if (!s) return 'calm';
    for (let i = 0; i < _cfg.MOOD_MAP.length; i++) {
      const entry = _cfg.MOOD_MAP[i];
      if (entry.keywords.some(k => s.includes(k))) return entry.mood;
    }
    return 'calm';
  }

  // --- Spontaneous/unprompted patient speech --------------------------------
  // Shared between sim_control.html (which asks the AI to write/refresh a
  // per-scenario line bank, tagged by distressLevel band — see
  // getAppearanceState() above) and sim_patient.html (which plays it back on
  // a random timer, gated by the SAME gcsV tiering answerPatientQuestion()
  // already uses for a directly-asked question: gcsV<=1 has nothing to say,
  // 2/3 can only produce a generic sound/fragment — the AI-written lines only
  // ever apply at gcsV>=4, where coherent speech is plausible at all).
  // GCS_V2_SOUNDS/GCS_V3_WORDS previously lived only in sim_control.html
  // (answerPatientQuestion's forced reply to a direct question) — moved here,
  // one shared pool, so a spontaneous groan and a forced-answer groan don't
  // drift into two different sets of the same handful of noises.
  _cfg.GCS_V2_SOUNDS = ['Nnnghhh...', 'Uhhh... hnnn...', 'Mmm... hhh... mmm...', '...ngh... uhh...'];
  _cfg.GCS_V3_WORDS = ['...dog... the blue one...', "...where's... my keys...", '...no... stop the light...', '...mum? ...mum...', '...cold... the cold one...'];
  // Generic, non-AI fallback lines for a coherent (gcsV>=4) patient when
  // either no scenario-specific bank exists yet (AI call hasn't returned,
  // or failed) or nothing in it matches the patient's current distressLevel
  // band — so spontaneous speech never goes silent just because the
  // scenario-specific bank is thin or stale.
  _cfg.GENERIC_SPONTANEOUS_LINES = [
    { text: 'Is this going to take much longer?', distressMin: 0, distressMax: 1 },
    { text: "Can someone let my family know what's happening?", distressMin: 0, distressMax: 1 },
    { text: '...I just want to go home.', distressMin: 0, distressMax: 2 },
    { text: "I don't feel right...", distressMin: 1, distressMax: 2 },
    { text: 'I feel sick...', distressMin: 1, distressMax: 2 },
    { text: 'It really hurts...', distressMin: 2, distressMax: 3 },
    { text: 'Please... help me...', distressMin: 2, distressMax: 3 },
    { text: "Something's wrong, I can feel it...", distressMin: 2, distressMax: 3 }
  ];
  // Validates/clamps the AI's spontaneousLines response (same shape from all
  // three call sites in sim_control.html — generateSimTimeline's initial
  // bank and both regenerateTimeline* refreshes) into the
  // {text, distressMin, distressMax} shape sim_patient.html's playback
  // filter expects, dropping anything malformed rather than trusting the
  // model's JSON verbatim.
  function cleanSpontaneousLines(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(l => l && typeof l.text === 'string' && l.text.trim())
      .map(l => ({
        text: l.text.trim(),
        distressMin: Math.max(0, Math.min(3, Number.isFinite(l.distressMin) ? l.distressMin : 0)),
        distressMax: Math.max(0, Math.min(3, Number.isFinite(l.distressMax) ? l.distressMax : 3))
      }));
  }

  global.SimEngine = {
    get ACTION_DURATIONS() { return _cfg.ACTION_DURATIONS; },
    get GCS_V2_SOUNDS() { return _cfg.GCS_V2_SOUNDS; },
    get GCS_V3_WORDS() { return _cfg.GCS_V3_WORDS; },
    get GENERIC_SPONTANEOUS_LINES() { return _cfg.GENERIC_SPONTANEOUS_LINES; },
    getActionDurationSec, getVitals, getVitalsRaw, getSimNow, getStaticVitalAt, getRhythmAt, getAppearanceState,
    parseTimeOfDay, getScenarioFictionalNow,
    getHealthScore, getHealthTrendLevel, getDisplayHealthScore, getDisplayHealthTrendLevel,
    deriveRhythmFromHR, classifyRhythmForDefib, classifyRhythmForPulse, getPulseState, computeSurvivabilityScore, computeDefibrillationEffect, computeCprEffect, spliceAiOverridePlan, spliceRhythmPlan, clearFutureFromFork,
    parseAgeFromScenario, parseScenarioMood, cleanSpontaneousLines,
    hrSeverity, rrSeverity, spo2Severity, painSeverity, bpSysSeverity,
    applyConfigOverrides
  };
})(typeof window !== 'undefined' ? window : this);

