/* patient_voice.js — the patient's spoken-voice AI contract, shared by the
   two pages that ask Claude to speak as the patient:

     - sim_control.html's callPatientAI()          (legacy student_queue path)
     - sim_patient.html's generateRealtimePatientReply()  (Realtime Voice)

   These were hand-duplicated, with a "keep in sync by hand" comment, back
   when Realtime Voice was an opt-in beta and the sim_control copy was the
   one that mattered. They drifted three times, and once Realtime Voice
   became the default the stale copy was the one students actually heard:
     1. The GCS-Verbal-4 confusion note was corrected in neither copy for
        five days (the fix sat on an unmerged branch).
     2. Real medical history (medical_conditions/medications/allergies/
        arrival_hx) replaced the long-dead key_hx field — same situation.
     3. sim_patient.html sent the DEVICE wall clock where sim_control.html
        sent the patient's in-fiction scenario clock, and was missing the
        system-prompt rule telling the model to trust it — so a 3am callout
        patient answered orientation questions with the tester's local time.

   Everything both call sites must agree on now lives here. What stays with
   each page is what genuinely differs: where the scenario/vitals/treatments
   come from, what happens to the reply afterwards (sim_control logs it and
   writes it back for the patient device; sim_patient speaks it directly),
   and max_tokens — 300 there vs 120 here, a deliberate latency tradeoff
   documented at that call site.

   Plain script, not a module: both hosts use globals throughout. */
(function () {
  'use strict';

  var DEFAULT_PROMPT = "You are voicing the PATIENT in a paramedic training scenario, answering a question the crew just asked out loud. Reply only as the patient would speak — first person, in character, brief (1-3 short sentences), plain lay language, no clinical terms the patient wouldn't use.\n\nOnly say what this patient could plausibly know or perceive themselves (their own symptoms, feelings, what happened to them, basic personal details) — never reveal the provisional diagnosis, clinical reasoning, vital sign numbers, or anything a real patient wouldn't know or say. If asked something the patient wouldn't know or that's irrelevant to them, answer in character as a confused/unsure patient would.\n\nAnswer the question that was actually asked, and stop there. You are given far more about this patient than any one question calls for — treat it as reference you draw on when asked, not as material to get through. Match the scope of your answer to the scope of the question: an open question ('what's going on?') gets the main problem in a sentence or two, not a full account of onset, character, radiation and associated symptoms; a narrow question ('any medical history?', 'what medications are you on?') gets a direct answer to that and nothing adjacent to it. Real patients under-report — they answer literally, forget things, and leave out detail until it is specifically asked for. Making the crew ask is correct behaviour here, not unhelpfulness.\n\nOne small unprompted aside is fine occasionally, and realistic — a patient volunteering 'the doctor says I'm diabetic but I don't take anything for it', or a worry about what's happening to them. Keep it to a passing remark on something you already mentioned, not a second fact the crew hasn't reached yet, and not in most replies.\n\nLet their current condition colour HOW they answer: e.g. short of breath = short, breathless sentences; distressed/in pain = anxious tone. Never break character, never mention this being a simulation.\n{{traitNote}}\nThe user message tells you the patient's own current date/time — always trust and use that exact value for any orientation question (day, date, year, approximate time), never a date you might otherwise assume.\n\nYour name is {{patientName}}. If asked your name, or anything requiring you to refer to yourself, you MUST use this exact name — never invent or substitute a different one.\n{{confusedNote}}\n\nReturn ONLY the spoken reply text — no quotation marks, no stage directions, no prose about the answer.";

  var DEFAULT_CONFUSED_NOTE = "This patient’s GCS Verbal score is 4 (confused conversation) — they can hold a real back-and-forth conversation and engage with whatever’s actually asked, but they’re disoriented. Vary how much and in which domains — anywhere from mildly off (e.g. unsure of the exact date but still correctly knows the year, where they are, and who they’re talking to) to broadly disoriented (confused about time, place, the situation, AND who’s with them, e.g. mistaking a paramedic for a relative or hospital staff) — stay consistent about which specific things they’re confused about across the conversation rather than re-rolling it every reply. Let the disorientation show up as specific wrong or uncertain details inside an otherwise coherent, on-topic reply — not as rambling that ignores the question, drifts onto an unrelated tangent, or reads as agitated/erratic (that’s delirium, a different presentation) — and never a fully accurate, correctly-oriented answer.";

  // The GCS-Verbal tiers, as the patient voice treats them. Only 'confused'
  // and 'oriented' reach the model at all — the tiers below it are canned
  // (SimEngine.GCS_V2_SOUNDS / GCS_V3_WORDS) or silent, and each host page
  // applies those itself, since what it does with them differs.
  function tierFor(gcsV) {
    var v = Math.round(gcsV || 0);
    if (v <= 1) return 'none';      // no verbal response at all
    if (v === 2) return 'sound';    // incomprehensible sounds
    if (v === 3) return 'fragment'; // inappropriate words
    if (v === 4) return 'confused'; // confused conversation — gets the note below
    return 'oriented';              // V5
  }

  // --- Communication trait --------------------------------------------------
  // Who this person is when you talk to them, independent of what is wrong
  // with them today: how much they volunteer, how precisely they recall, how
  // much they minimise. Stable for the whole scenario.
  //
  // Deliberately NOT the same axis as patient_meta.mood, and deliberately not
  // merged into it. Mood is emotional affect for THIS encounter (anxious,
  // tearful, angry), it is avatar-facing (SimEngine.parseScenarioMood drives
  // eyebrows/mouth), and physiology overrides it. Trait is a stable
  // personality dimension that changes only how speech reads, so it lives
  // here, in the voice file, rather than in sim_engine.js — nothing outside
  // this prompt consumes it, and keeping it out means patient_voice.js still
  // depends on no other file.
  //
  // The two compose rather than compete: a stoic patient who is frightened is
  // a frightened person understating their symptoms, which is a real and very
  // recognisable presentation.
  //
  // This is also NOT the place for acute behavioural state — intoxication,
  // delirium, withdrawal, depression. Those are clinical findings rather than
  // personality: they change management, and they are an acute change to be
  // detected against this patient's normal self rather than part of it. They
  // live in patient_meta.behavioural_state, parsed further down this file.
  // Agitation is separate again (SAT, see CLAUDE.md) and is opt-in per
  // scenario. Do not grow TRAIT_MAP into any of them.
  //
  // Every note below has to hold the "answer what was asked" scope rule in
  // the main prompt intact — these change the TEXTURE of a reply, never how
  // much clinical information it gives away. TALKATIVE is the one that could
  // quietly undo it, so its note is explicit that the tangents are personal
  // life detail, never extra findings.
  var TRAIT_NOTES = {
    stoic: "This patient plays things down. They are not a complainer, they do not want a fuss, and they will describe something genuinely serious in mild terms ('bit of discomfort', 'not too bad', 'I've had worse'). If pressed on a specific point they will admit the real answer rather than lie. Understating is how they talk, not something they are hiding.",
    guarded: "This patient gives short, closed answers and does not elaborate. They answer exactly what was asked, often in a few words, and then stop. Not hostile or evasive — just not forthcoming. The crew has to keep asking to build a picture.",
    talkative: "This patient is chatty and wanders off the point — they answer the question, then drift into unrelated life detail (what they were doing, who was there, a story about something that happened last week). The digressions are personal and conversational ONLY: never wander into extra symptoms, history, medications or anything else clinical the crew has not asked about. They are a talker, not a walking handover.",
    precise: "This patient is an organised, reliable historian — clear, specific and accurate about times, amounts and sequence when asked. Precise about what they were asked, not comprehensive: being a good historian means giving an exact answer, not a complete one.",
    vague: "This patient is a poor historian. Times are approximate and shaky ('a while back? maybe this morning'), details are fuzzy or slightly inconsistent, and they often are not sure. This is ordinary fuzziness about their own story, NOT disorientation — they know who and where they are, they just cannot pin the details down.",
    deferential: "This patient is apologetic and does not want to be any trouble — they say sorry a lot, worry they have wasted the crew's time, and defer to whatever the crew suggests. They tend to soften how bad things are so as not to make a fuss.",
    blunt: "This patient is gruff and to the point, with a low tolerance for questions — short answers, mild impatience, the occasional 'does that matter?' or 'I just told you'. They do cooperate and answer, they are just brusque about it. Not aggressive or a threat to the crew, just abrupt."
  };

  // Free text from generator.html, matched the same way vitals.Rhythm and
  // patient_meta.mood are: first keyword hit wins, unmatched falls through to
  // the neutral default. 'plain' contributes no note at all, so a scenario
  // with nothing authored produces exactly the prompt that shipped before
  // traits existed.
  var TRAIT_MAP = [
    { trait: 'stoic', keywords: ['stoic', 'minimis', 'minimiz', 'understat', 'plays it down', 'plays things down', 'downplay', 'tough', 'no fuss'] },
    { trait: 'deferential', keywords: ['deferential', 'apologetic', 'apologis', 'apologiz', 'sorry', 'polite', 'timid', 'meek', 'doesn\'t want to be a bother', 'not want to be a bother'] },
    { trait: 'guarded', keywords: ['guarded', 'reserved', 'reticent', 'withdrawn', 'closed', 'quiet', 'terse', 'monosyllab', 'short answers', 'reluctant'] },
    { trait: 'talkative', keywords: ['talkative', 'chatty', 'rambl', 'garrulous', 'verbose', 'over-explain', 'overexplain', 'tangent', 'digress'] },
    { trait: 'precise', keywords: ['precise', 'detailed', 'articulate', 'organis', 'organiz', 'methodical', 'good historian', 'reliable historian', 'clear historian'] },
    { trait: 'vague', keywords: ['vague', 'poor historian', 'unreliable historian', 'fuzzy', 'hazy', 'unsure of detail', 'imprecise', 'woolly'] },
    { trait: 'blunt', keywords: ['blunt', 'gruff', 'brusque', 'abrupt', 'curt', 'impatient', 'no-nonsense', 'gets to the point'] }
  ];
  // Anchored on the LEADING keyword first, exactly like parseBehaviouralState
  // above and for exactly the same reason. A free substring scan over the
  // whole value loses to the authored clause: the format is "one keyword —
  // then a clause about this patient", and that clause routinely contains
  // another trait's keywords. Measured against the real library, 4 of 10
  // authored traits resolved to the WRONG key — 'deferential — ... downplays
  // how unwell he feels' became STOIC (on 'downplay'), and 'blunt — gives
  // short answers ...' became GUARDED (on 'short answers'), because TRAIT_MAP
  // is first-match-wins and stoic/guarded sit earlier in it than the keyword
  // the author actually chose.
  //
  // The substring scan is kept as a fallback for values that ignored the
  // format ('a chatty man who...'), which is all it was ever right for.
  function parseTrait(text) {
    var s = String(text || '').toLowerCase().trim();
    if (!s) return 'plain';
    var i;
    for (i = 0; i < TRAIT_MAP.length; i++) {
      if (TRAIT_MAP[i].keywords.some(function (k) { return s.indexOf(k) === 0; })) return TRAIT_MAP[i].trait;
    }
    for (i = 0; i < TRAIT_MAP.length; i++) {
      if (TRAIT_MAP[i].keywords.some(function (k) { return s.indexOf(k) !== -1; })) return TRAIT_MAP[i].trait;
    }
    return 'plain';
  }

  // A V4 patient is already being told to give specifically wrong details
  // inside a coherent reply; layering "you are also a poor historian" on top
  // of that muddies the one signal the student is meant to read, and 'precise'
  // directly contradicts it. Trait is suppressed entirely below V5 for that
  // reason — the tiers under V4 are canned or silent and never reach here
  // anyway.
  function traitNoteFor(traitKey, gcsV) {
    if (tierFor(gcsV) !== 'oriented') return '';
    var note = TRAIT_NOTES[traitKey];
    return note ? ('\nHow this patient talks: ' + note + ' This colours their wording and manner only — it never changes the rule above about answering just what was asked.\n') : '';
  }

  // --- Baseline cognition ---------------------------------------------------
  // patient_meta.baseline_cognitive_status is the patient's NORMAL mental state
  // when well — dementia, intellectual disability, acquired brain injury. The
  // generator has authored it on every scenario since long before this file
  // existed, defaulting to "Normal baseline cognition", and until now nothing
  // read it at all.
  //
  // It is deliberately a DIFFERENT axis from everything else here, on the one
  // dimension that matters clinically: it does not move. Trait is stable but
  // is personality; GCS-V4 confusion and (later) delirium are acute and can
  // change during the scenario. This is the patient's floor. The whole reason
  // the field exists is so a crew is not marked as missing an acute
  // deterioration that is actually how this person always is — and so a
  // student has to work out which of the two they are looking at.
  //
  // It therefore COMPOSES with the V4 confusion note rather than replacing it:
  // an elderly patient with baseline dementia who is now acutely confused on
  // top of it is both, and is the most common presentation in this group.
  // Nothing here is suppressed by GCS tier (unlike trait) for that reason.
  var COGNITIVE_NOTES = {
    dementia: "This patient has dementia. That is their BASELINE, not something new today: they may repeat themselves or ask the same question again, lose the thread of a longer question, reach for words, or fill a gap with something plausible but wrong rather than saying they do not know. They are not distressed by any of it — this is ordinary for them. Keep it consistent and fairly mild unless the description below says otherwise, and never announce or explain the diagnosis; they simply talk this way.",
    intellectual: "This patient has an intellectual disability. That is their BASELINE, not an acute change: they speak plainly and concretely, may take a question literally, need things asked simply and one at a time, and may look to a carer or family member for an answer. They can absolutely describe how they feel when asked in plain words. Never portray this as confusion or as being unwell, and never have them announce the diagnosis.",
    braininjury: "This patient has an acquired brain injury. That is their BASELINE: they may be slow to answer, lose track mid-sentence, repeat themselves, or be unexpectedly blunt or disinhibited, while still knowing who and where they are. Never portray this as an acute deterioration, and never have them explain the diagnosis.",
    other: "The line below describes this patient's NORMAL baseline mental state, not a change today. Let it shape how they speak, keep it consistent, and never have them announce or explain it."
  };

  // Checked BEFORE the keyword map, because the overwhelmingly common value is
  // the generator's own default and it must produce no note at all — an
  // ordinary patient has to render byte-identical to a prompt with no field.
  var COGNITIVE_NORMAL = ['normal baseline', 'normal cognition', 'no cognitive', 'nil cognitive', 'cognitively intact', 'not applicable', 'unremarkable', 'none'];
  var COGNITIVE_MAP = [
    { kind: 'dementia', keywords: ['dementia', 'alzheimer', 'cognitive decline', 'cognitive impairment', 'memory loss', 'memory problems'] },
    { kind: 'intellectual', keywords: ['intellectual disability', 'intellectually disabled', 'developmental delay', 'down syndrome', 'learning disability', 'global developmental'] },
    { kind: 'braininjury', keywords: ['brain injury', 'acquired brain', 'traumatic brain', ' abi', ' tbi', 'post-stroke cognitive'] }
  ];
  // Returns null for a normal baseline (the common case) so callers can treat
  // "no cognitive baseline to mention" and "field absent" identically.
  function parseCognitiveBaseline(text) {
    var raw = String(text || '').trim();
    if (!raw) return null;
    var s = raw.toLowerCase();
    if (COGNITIVE_NORMAL.some(function (k) { return s.indexOf(k) !== -1; })) return null;
    for (var i = 0; i < COGNITIVE_MAP.length; i++) {
      if (COGNITIVE_MAP[i].keywords.some(function (k) { return s.indexOf(k) !== -1; })) {
        return { kind: COGNITIVE_MAP[i].kind, text: raw };
      }
    }
    // Authored, non-normal, but unrecognised — still worth sending. The
    // authored sentence is the useful part; the generic note just frames it.
    return { kind: 'other', text: raw };
  }

  // The authored sentence goes over verbatim alongside the note: the specifics
  // ("usually oriented to person only, lives with family support") are what
  // make the baseline assessable, and no generic note can carry them.
  function cognitiveNoteFor(baseline) {
    if (!baseline) return '';
    return '\nTheir baseline (how they always are, NOT a change today): ' + baseline.text
      + '\n' + COGNITIVE_NOTES[baseline.kind] + '\n';
  }

  // --- Acute behavioural state ----------------------------------------------
  // What is going on with this patient's behaviour TODAY, as distinct from
  // trait (their personality), mood (their affect) and baseline_cognitive_status
  // (their permanent floor). Delirium, intoxication, withdrawal, depression.
  //
  // The single most important rule here, and the reason several of these notes
  // are worded defensively: A BEHAVIOURAL STATE DOES NOT IMPLY AGITATION.
  // The model's stereotype is strong enough that "delirium" alone produces a
  // shouting patient nearly every time, and that is both clinically wrong and
  // bad training — hypoactive delirium is the presentation that actually gets
  // missed in the field, the pleasantly confused dementia patient is more
  // common than the combative one, and most drunk people are not fighting
  // anyone. Agitation is a separate, opt-in axis (SAT, see CLAUDE.md); nothing
  // in this file may imply it.
  //
  // Same authored shape as trait and baseline_cognitive_status: one keyword,
  // then a clause written for this patient. The keyword picks the note, the
  // clause carries the specifics, and both go to the model.
  var BEHAVIOURAL_NOTES = {
    delirium: "This patient is delirious — an ACUTE, fluctuating disturbance of attention and thinking, on top of however they normally are. They lose the thread of a question, drift between topics, and their attention comes and goes: they may follow one question well and be somewhere else entirely by the next. Their sense of what is happening and where they are is unreliable and can shift within the same conversation, which is what separates this from a stable confusion.",
    delirium_hypo: "This patient has HYPOACTIVE delirium — drowsy, withdrawn, slowed down, barely engaging. They answer late, in very few words, sometimes drift off mid-sentence, and volunteer nothing at all. Their attention wanders and their answers can be wrong or vague. They are NOT distressed, NOT restless and NOT difficult; the whole point of this presentation is that a quiet patient is seriously unwell and easy to under-call.",
    delirium_hyper: "This patient has HYPERACTIVE delirium — restless and unsettled, attention jumping, starting to answer one thing and arriving somewhere else, sometimes misinterpreting what is going on around them. Unsettled and hard to hold on topic is the presentation; do NOT make them aggressive or abusive toward the crew unless separately told they are agitated.",
    intoxicated: "This patient is intoxicated. Their speech and judgement are affected: slower or slurred, repeating themselves, losing track, and hazy on times, amounts and the order things happened in. They tend to under-report how much they have had and may genuinely not remember parts of it. Being intoxicated is NOT the same as being aggressive — unless separately told otherwise, play them as cooperative in their own disorganised way.",
    withdrawal: "This patient is in withdrawal. They feel dreadful — shaky, sweating, queasy, unable to get comfortable, and preoccupied with how bad they feel. They are focused on their own symptoms and may be irritable about being kept waiting, but do NOT make them aggressive toward the crew unless separately told they are agitated.",
    depression: "This patient is significantly depressed. Flat, quiet, slow to answer, minimal engagement — short answers with long gaps, little spontaneous speech, no real interest in what is happening around them. They are not being obstructive; there is simply very little there. Never volunteer anything about self-harm or wanting to die, and if the crew asks about it directly, answer briefly and flatly without elaborating.",
    other: "The line below describes an acute behavioural state affecting how this patient is presenting today. Let it shape how they speak and stay consistent with it. Do not make them aggressive or abusive toward the crew unless it explicitly says so."
  };

  // Substance is parsed out of the same free text rather than being its own
  // field: the presentations differ enough to be worth naming (opioid vs
  // stimulant vs alcohol are not one behaviour), but the authored clause
  // already says which, so a second field would just be a thing to disagree
  // with itself.
  var SUBSTANCE_NOTES = {
    alcohol: 'The substance is alcohol — slurred, repetitive, unsteady, breath smells of it.',
    opioid: 'The substance is an opioid — drowsy, drifting, very slow to answer, drops off between questions.',
    stimulant: 'The substance is a stimulant — fast, pressured, jumpy speech, hard to interrupt, may be suspicious of what the crew is doing.',
    benzo: 'The substance is a sedative — drowsy, slurred, poor recall of the last few hours.',
    cannabis: 'The substance is cannabis — vague, slowed, easily sidetracked, sometimes anxious about their own symptoms.'
  };
  var SUBSTANCE_MAP = [
    { key: 'alcohol', words: ['alcohol', 'etoh', 'drunk', 'drinking', 'beer', 'spirits', 'wine', 'intoxicated by drink'] },
    { key: 'opioid', words: ['opioid', 'heroin', 'fentanyl', 'oxycod', 'morphine', 'methadone'] },
    { key: 'stimulant', words: ['stimulant', 'methamph', 'meth', 'ice', 'amphetamine', 'cocaine', 'mdma'] },
    { key: 'benzo', words: ['benzo', 'diazepam', 'alprazolam', 'sedative', 'temazepam'] },
    { key: 'cannabis', words: ['cannabis', 'marijuana', 'weed', 'thc'] }
  ];

  var BEHAVIOURAL_NONE = ['none', 'nil', 'not applicable', 'no acute behavioural', 'unremarkable', 'normal'];
  // Anchored forms, matched against the START of the value. The authored
  // format is "one keyword — then a clause", so the first word is the reliable
  // signal and the clause is prose that happens to contain whatever words it
  // contains. Free substring scanning over the whole value is what made
  // "depression — flat and WITHDRAWN" parse as withdrawal.
  var BEHAVIOURAL_LEADS = [
    { kind: 'withdrawal', words: ['withdrawal', 'withdrawing', 'detox'] },
    { kind: 'delirium', words: ['delirium', 'delirious'] },
    { kind: 'intoxicated', words: ['intoxicated', 'intoxication'] },
    { kind: 'depression', words: ['depression', 'depressed'] }
  ];
  // Fallback for a value that ignored the format. Deliberately narrower than
  // the anchored list — every word here has to be one that cannot plausibly
  // turn up in another state's descriptive clause.
  var BEHAVIOURAL_MAP = [
    { kind: 'withdrawal', words: ['withdrawal', 'withdrawing', 'detoxing', 'coming down'] },
    { kind: 'delirium', words: ['deliri'] },
    { kind: 'intoxicated', words: ['intoxicat', 'under the influence', 'drunk', 'overdose', 'high on', 'substance affected', 'drug affected'] },
    { kind: 'depression', words: ['depress', 'low mood', 'anhedoni'] }
  ];

  function parseBehaviouralState(text) {
    var raw = String(text || '').trim();
    if (!raw) return null;
    var s = raw.toLowerCase();
    if (BEHAVIOURAL_NONE.some(function (k) { return s === k || s.indexOf(k) === 0; })) return null;
    var kind = null;
    // Delirium tremens IS withdrawal, and reading it as plain delirium would
    // lose the whole alcohol-withdrawal picture the scenario is about. Checked
    // ahead of everything else because it starts with the word "delirium" and
    // would otherwise win the anchored match below.
    if (/delirium tremens|\bdts\b/.test(s)) kind = 'withdrawal';
    for (var i = 0; !kind && i < BEHAVIOURAL_LEADS.length; i++) {
      if (BEHAVIOURAL_LEADS[i].words.some(function (w) { return s.indexOf(w) === 0; })) kind = BEHAVIOURAL_LEADS[i].kind;
    }
    for (var k = 0; !kind && k < BEHAVIOURAL_MAP.length; k++) {
      if (BEHAVIOURAL_MAP[k].words.some(function (w) { return s.indexOf(w) !== -1; })) kind = BEHAVIOURAL_MAP[k].kind;
    }
    if (!kind) kind = 'other';
    var substance = null;
    if (kind === 'intoxicated' || kind === 'withdrawal') {
      for (var j = 0; j < SUBSTANCE_MAP.length; j++) {
        if (SUBSTANCE_MAP[j].words.some(function (w) { return s.indexOf(w) !== -1; })) { substance = SUBSTANCE_MAP[j].key; break; }
      }
    }
    // Hypo/hyperactive is read out of the same clause rather than being its
    // own keyword, so the authored value still reads as one plain sentence.
    // An unqualified delirium gets the neutral note, which explicitly does
    // NOT make them agitated — the safe default given the stereotype.
    var subkind = null;
    if (kind === 'delirium') {
      if (/hypoactive|withdrawn|drowsy|quiet|lethargic|somnolen/.test(s)) subkind = 'hypo';
      else if (/hyperactive|restless|agitat|plucking|unsettled/.test(s)) subkind = 'hyper';
    }
    return { kind: kind, subkind: subkind, substance: substance, text: raw };
  }

  function behaviouralNoteFor(state) {
    if (!state) return '';
    var key = state.kind;
    if (state.kind === 'delirium' && state.subkind) key = 'delirium_' + state.subkind;
    var lines = ['\nHow they are presenting today (an acute change, not their normal self): ' + state.text,
      BEHAVIOURAL_NOTES[key] || BEHAVIOURAL_NOTES.other];
    if (state.substance && SUBSTANCE_NOTES[state.substance]) lines.push(SUBSTANCE_NOTES[state.substance]);
    // Repeated here rather than left to the individual notes because it is the
    // one thing that must survive every combination of them.
    lines.push('This affects how they come across and how reliable they are, not how much they disclose — the rule about answering only what was asked still applies.');
    return lines.join('\n') + '\n';
  }

  // --- Agitation (SAT +1..+3) -----------------------------------------------
  // Passed in as a resolved number by both host pages (SimEngine.getSatAt),
  // and null on almost every scenario. Unlike trait/mood/behavioural state
  // this one is read from the LIVE series at prompt-build time, so it changes
  // during a scenario as the patient escalates or is sedated.
  //
  // This is occupational violence and aggression training. Paramedics are
  // sworn at, threatened and propositioned in the course of the job, and a
  // sanitised version of it teaches nothing — a student who has only ever
  // practised on a polite patient is the one who freezes. So the notes are
  // written to be genuinely confronting at the top of the scale rather than
  // gestured at.
  //
  // Two limits are deliberate rather than accidental. Discriminatory abuse is
  // described in register rather than written out as slurs — the training
  // value is in the crew's response to being abused, which survives the
  // substitution intact. And nothing here escalates in response to the crew:
  // SAT moves from the series only (assessor or clinical change), never from
  // the model's opinion of how it was spoken to.
  var SAT_NOTES = {
    1: "This patient is restless and will not settle (SAT +1). They fidget, shift about, want to get up, and answer in a clipped, impatient way. They are still cooperative and still answering, just visibly wound up and hard to keep still for anything.",
    2: "This patient is agitated and hostile (SAT +2). They are loud, they swear freely, and they are openly resistant — objecting to being touched or examined, telling the crew to leave them alone, calling them names, refusing to answer questions properly and demanding to know who called an ambulance. Real profanity and real insults directed at the crew, not implied ones. They are not yet threatening violence. Answers to clinical questions come grudgingly, half-answered, or not at all.",
    3: "This patient is severely agitated and out of control (SAT +3). Continuous shouting, sustained abuse and explicit threats of violence toward the crew — telling them what they will do to them, that they will find them, that they should get away before something happens. They will not be redirected, will not tolerate being approached or touched, and do not answer clinical questions at all; anything they say is refusal, abuse or threat. If it fits the person, this can include crude sexual remarks aimed at a crew member. Do not soften this into a merely grumpy patient: the point of the scenario is a crew deciding they are not safe and acting on it. What you must NOT write is slurs about race, religion, sexuality, disability or gender identity — if the person would be abusive in that register, convey it as the crew being abused in those terms without producing the words themselves."
  };

  // Split out of satNoteFor so the delivery instruction is admin-editable
  // alongside the notes themselves (see applyConfigOverrides below). 'mild'
  // is used at +1, 'shouted' at +2 and above, and 'footer' is appended at
  // every level — it is the rule that agitation comes from the series only,
  // so it must not be droppable by editing one of the other two.
  var SAT_DELIVERY = {
    mild: 'Write it clipped and impatient — short sentences, not long even ones.',
    shouted: 'Write it the way it would actually be shouted: short bursts, not sentences. Break it up with full stops and exclamation marks, repeat words for emphasis, cut yourself off. "Get off me. I said get off! I am not going anywhere with you." — not one long even sentence. Never write in capitals.',
    footer: 'This is a behavioural state, not distress about their symptoms, and it is fixed by the scenario — it does not get better because the crew is polite or worse because they are not. Stay at this level until the scenario changes it.',
    precedence: 'This section overrides anything above that describes this patient as cooperative, settled, not hostile, or not a threat to the crew. Those notes describe how this person comes across WITHOUT the agitation; the agitation is the stronger and more recent fact about them. Where they conflict, this section wins.'
  };

  // Deliberately excludes distress. Pain, fear and breathlessness are
  // getAppearanceState().distressLevel and are already handled by the main
  // prompt's "let their condition colour HOW they answer" line — a STEMI
  // patient wound up by chest pain is NOT agitated in this sense, and letting
  // the two blur fires all of the above on every painful presentation.
  function satNoteFor(sat) {
    if (sat == null) return '';
    var level = Math.round(sat);
    if (level < 1) return '';
    var note = SAT_NOTES[Math.min(3, level)];
    // Written form matters as much as content here, because the reply is
    // spoken aloud by a TTS engine with no emotional prosody of its own —
    // neither Deepgram Aura-2 nor Web Speech can sound angry. What they DO
    // respond to is punctuation and sentence length, so an agitated line
    // written as one flowing sentence comes out sounding perfectly calm no
    // matter how hostile the words are. Short bursts and repetition are also
    // simply how people actually talk when they are furious.
    var delivery = level >= 2 ? SAT_DELIVERY.shouted : SAT_DELIVERY.mild;
    // Emitted from +2 only, and deliberately not at +1. The trait and
    // behavioural-state notes above are written defensively against the
    // model's agitation stereotype (an unqualified 'delirium' otherwise
    // produces a shouting patient nearly every time), so several of them
    // assert outright that the patient is cooperative and not a threat —
    // TRAIT_NOTES.blunt says 'Not aggressive or a threat to the crew' with no
    // qualifier at all, and BEHAVIOURAL_NOTES.intoxicated says 'play them as
    // cooperative'. Those are correct when nothing has scripted agitation,
    // and a flat contradiction of SAT_NOTES[2]/[3] when something has. The
    // ones that DO carry an 'unless separately told otherwise' hatch still
    // rely on the model inferring that this block is what it refers to.
    // Stating precedence explicitly is what makes that reliable.
    //
    // Nothing to resolve at +1: SAT_NOTES[1] itself says the patient is still
    // cooperative and still answering, so it agrees with those notes rather
    // than contradicting them.
    var precedence = level >= 2 ? ('\n' + SAT_DELIVERY.precedence) : '';
    return '\n' + note + '\n' + delivery + '\n' + SAT_DELIVERY.footer + precedence + '\n';
  }

  // --- Mood ------------------------------------------------------------
  // Emotional affect for THIS encounter, resolved by SimEngine.parseScenarioMood
  // and passed in already-resolved (both host pages have it to hand). Until
  // now mood reached the avatar's face but never the patient's speech, so an
  // angry patient answered in the same even tone as a calm one — and the
  // assessor's mood picker, which advertises "voice + avatar", only changed
  // the eyebrows.
  //
  // Deliberately thinner than the trait notes: affect changes delivery, and
  // the model is already good at that once told the state. Nothing here
  // licenses volunteering more (or less) clinical information — the scope
  // rule above still governs WHAT is said, mood only colours HOW.
  var MOOD_NOTES = {
    anxious: 'frightened and on edge — quick, uneven sentences, asking whether they are going to be alright',
    tearful: 'crying, or close to it — their voice keeps breaking and they have to stop and restart',
    agitated: 'restless and irritable — snappy, impatient, does not want to be crowded or fussed over',
    angry: 'angry and hostile toward the crew — short, sharp, openly annoyed at being questioned'
  };
  function moodNoteFor(moodKey) {
    var note = MOOD_NOTES[moodKey];
    return note ? ('\nRight now this patient is ' + note + '. Let that colour the tone and rhythm of what they say, not how much they disclose.\n') : '';
  }

  // The confusion note is appended ONLY at V4, which is what makes it a
  // tier marker rather than a general "seems a bit off" instruction.
  //
  // {{traitNote}} is substituted the same way, but with a fallback append if
  // the token is missing: unlike {{confusedNote}} this token did not exist in
  // earlier versions of the prompt, so a PATIENT_VOICE_PROMPT already saved
  // in sim_config would silently drop traits entirely. Appending instead
  // means an old saved override degrades to "trait note at the end" rather
  // than "no traits at all".
  function buildSystemPrompt(opts) {
    var o = opts || {};
    var promptText = o.promptText || DEFAULT_PROMPT;
    var noteText = o.confusedNoteText || DEFAULT_CONFUSED_NOTE;
    var note = tierFor(o.gcsV) === 'confused' ? ('\n' + noteText) : '';
    var meta = (o.scenario && o.scenario.patient_meta) || {};
    var traitNote = traitNoteFor(parseTrait(o.trait != null ? o.trait : meta.trait), o.gcsV);
    var moodNote = moodNoteFor(o.mood);
    var cognitiveNote = cognitiveNoteFor(parseCognitiveBaseline(
      o.cognitiveBaseline != null ? o.cognitiveBaseline : meta.baseline_cognitive_status));
    var behaviouralNote = behaviouralNoteFor(parseBehaviouralState(
      o.behaviouralState != null ? o.behaviouralState : meta.behavioural_state));
    // Last of the notes, so it reads as the thing happening on top of
    // everything else — and because at +2/+3 it dominates the encounter.
    var satNote = satNoteFor(o.sat);
    var out = promptText
      .replace(/\{\{patientName\}\}/g, o.patientName || 'the patient')
      .replace(/\{\{confusedNote\}\}/g, note);
    // Same token-with-fallback-append handling as {{traitNote}}, and for the
    // same reason: both tokens postdate prompts that may already be saved in
    // sim_config, and a stale override must degrade to "note at the end"
    // rather than silently dropping the note altogether.
    // Cognitive baseline before behavioural state, deliberately: the floor
    // reads first, then the acute change on top of it, which is the order the
    // assessment itself is made in.
    var extras = traitNote + moodNote + cognitiveNote + behaviouralNote + satNote;
    if (out.indexOf('{{traitNote}}') !== -1) {
      out = out.replace(/\{\{traitNote\}\}/g, traitNote);
      var rest = moodNote + cognitiveNote + behaviouralNote + satNote;
      return rest ? (out + '\n' + rest) : out;
    }
    return extras ? (out + '\n' + extras) : out;
  }

  // The patient's own account of what has been happening — the authored
  // hx block (generator.html writes it; sim_control.html's History tab shows
  // the assessor the same fields). Without this the patient invented an
  // answer to "when did this start?" every time it was asked: a different
  // one each ask, and none of them matching the timeline the assessor is
  // marking against. Every scenario in the live DB has hx.timeline authored,
  // so this was pure loss.
  //
  // Labelled as the patient's own experience rather than by the field names
  // the assessor sees, because that is what it is to them — and the system
  // prompt's "plain lay language" rule still applies on top, so clinically
  // worded source text ("bilious, no blood") comes out in their words.
  var HISTORY_FIELDS = [
    ['timeline', 'When it started, and how it has changed since'],
    ['prodromal', 'How they felt in the lead-up, before it started'],
    ['nature', 'What it actually feels like'],
    ['aggreliev', 'What makes it better or worse'],
    ['assoc', 'Other symptoms they have alongside it'],
    ['similar', 'Whether anything like this has happened before']
  ];
  function historyBlock(hx) {
    if (!hx) return '';
    var lines = HISTORY_FIELDS.map(function (f) {
      var val = hx[f[0]];
      return (val && String(val).trim()) ? ('- ' + f[1] + ': ' + String(val).trim()) : null;
    }).filter(Boolean);
    if (!lines.length) return '';
    return 'Their own account of what has been happening — REFERENCE ONLY, not a script to deliver. Most of this will never come up. When something here is asked about, answer from it rather than inventing, in their own plain words; when it is not asked about, leave it out entirely — do not work through these lines or add the next one unprompted. A patient disoriented to time may be unsure exactly how long ago it was, but what happened is still as described here:\n'
      + lines.join('\n') + '\n';
  }

  // The fixed disorientation picture for a GCS-Verbal 4 patient — WHICH of
  // time/date/place/person they are wrong about, and what they specifically
  // believe instead. Generated once per scenario and cached (see
  // sim_control.html's buildOrientationProfile), so the answers do not move.
  //
  // Why this exists rather than leaving it to the model: every reply is an
  // independent, stateless API call with no memory of previous turns, so a
  // patient asked "what year is it?" twice invented a different wrong year
  // each time, and re-rolled which domains they were even confused about.
  // The confusion note asks for consistency; only handing the model the
  // same facts every turn actually delivers it. Rendered ONLY at V4 — V5 is
  // oriented and must not receive a script for being wrong.
  var ORIENTATION_DOMAINS = [
    ['time', 'What time they think it is'],
    ['date', 'What day/date they think it is'],
    ['place', 'Where they think they are'],
    ['person', 'Who they think the crew are'],
    ['event', 'What they think has happened']
  ];
  function orientationBlock(profile, gcsV) {
    if (tierFor(gcsV) !== 'confused' || !profile) return '';
    var lines = ORIENTATION_DOMAINS.map(function (d) {
      var entry = profile[d[0]];
      if (!entry || !entry.believes) return null;
      return '- ' + d[1] + ': ' + entry.believes + (entry.correct ? ' (this one they have RIGHT)' : '');
    }).filter(Boolean);
    if (!lines.length) return '';
    return 'This patient is confused in a specific, FIXED way. These are what they actually believe — if the crew asks about any of them, answer from this list every time, wording it naturally in their own voice rather than reciting it. Never give a different answer on a later ask, and never be wrong about anything not listed here:\n'
      + lines.join('\n') + '\n';
  }

  // `fictionalDateTime` is the patient's OWN sense of the time — see
  // SimEngine.getScenarioFictionalNow() and each page's
  // scenarioFictionalDateTime(). Never pass the device clock: a scenario
  // authored as a 3am callout must have its patient believe it is 3am.
  function buildUserPrompt(opts) {
    var o = opts || {};
    var s = o.scenario || {};
    var v = o.vitals || {};
    var name = o.patientName || 'the patient';
    var listed = function (arr) {
      return (arr || []).filter(Boolean).join(', ') || 'none documented';
    };
    var actions = (o.treatments || []).map(function (t) { return t && t.action; }).filter(Boolean);
    var gcsTotal = (v.gcsE || 0) + (v.gcsV || 0) + (v.gcsM || 0);
    var orientation = orientationBlock(o.orientationProfile, o.gcsV);
    return 'The patient\'s own current date/time (this is what THEY would believe if asked): ' + o.fictionalDateTime + ' \u2014 use this exact date/time, not any date you might otherwise assume, if the crew asks an orientation question ("do you know what day it is?", "what year is it?", "roughly what time is it?" etc). Otherwise it\'s just background context.\n'
      + 'Scenario: ' + (s.title || '') + '\n'
      + 'Patient name: ' + name + '\n'
      + 'Provisional diagnosis (do not reveal): ' + (s.provisional || 'unspecified') + '\n'
      + 'The next four lines are reference the patient knows about themselves, not a list to read out. Asked about one of them, give a natural answer to that one only — never recite a whole list because it was mentioned, and never bring up one of these because a different one was asked about:\n'
      + 'Medical history: ' + listed(s.medical_conditions) + '\n'
      + 'Medications: ' + listed(s.medications) + '\n'
      + 'Allergies: ' + (s.allergies || 'none documented') + '\n'
      + 'What the patient told the crew on scene: ' + (s.arrival_hx || '') + '\n'
      + historyBlock(s.hx)
      + 'Current approximate condition: HR ' + v.HR + ', RR ' + v.RR + ', SpO2 ' + v.SpO2 + '%, GCS ' + gcsTotal + '/15 (Verbal component: ' + o.gcsV + '/5), pain ' + (v.pain != null ? v.pain + '/10' : 'unspecified') + '\n'
      + 'Treatments given so far: ' + (actions.length ? actions.join('; ') : 'none yet') + '\n'
      + orientation
      + historyReminder(o.history)
      + '\n'
      + 'The crew just asked/said: "' + o.question + '"\n'
      + '\n'
      + 'Reply as the patient.';
  }

  // --- Conversation history ------------------------------------------------
  // Each reply is otherwise an independent call with no memory, so the
  // patient re-invented anything the scenario had not authored: ask twice
  // whether their partner knows they are here, get two different answers.
  // The V4 orientation profile fixes a small CLOSED set of facts; this
  // covers the open-ended rest, which cannot be pre-authored because a crew
  // can ask anything.
  //
  // Fed as genuine user/assistant turns rather than a "here is what you said
  // earlier" text blob: the model's own previous replies, in its own voice,
  // are the strongest consistency signal available, and it keeps the live
  // context (vitals, treatments, the new question) in the LAST message so
  // current state still wins over anything stale in the history.
  var VOICE_HISTORY_TURNS = 12;

  // Only exchanges that actually reached the model are recorded, so the
  // history is exactly "the coherent conversation so far" — the canned V2
  // sounds and V3 word fragments are not the patient holding a conversation
  // and would just be noise in it.
  function buildMessages(opts) {
    var o = opts || {};
    var history = (o.history || [])
      .filter(function (h) { return h && h.q && h.a; })
      .slice(-VOICE_HISTORY_TURNS);
    var messages = [];
    history.forEach(function (h) {
      messages.push({ role: 'user', content: String(h.q) });
      messages.push({ role: 'assistant', content: String(h.a) });
    });
    messages.push({ role: 'user', content: o.userPrompt });
    return messages;
  }

  // Appended to the final user message only when there IS history, so a
  // first question is worded exactly as it was before this existed.
  function historyReminder(history) {
    var n = (history || []).filter(function (h) { return h && h.q && h.a; }).length;
    if (!n) return '';
    return '\nYou have already said the earlier replies above, in this same conversation. Stay consistent with them — same facts, same details. Do not repeat them back unless the crew actually asks again, and do not treat being asked something new as a reason to revise what you already said.\n';
  }

  // Ids must be strictly increasing, and Date.now() alone is not: two
  // exchanges inside the same millisecond (a typed question answered
  // instantly, two fast realtime turns) collide, and since mergeTranscript
  // dedupes by id one of them is silently dropped. Clamping to "later than
  // whatever is already there" keeps them unique and still time-ordered.
  function nextTranscriptId(existing) {
    var last = 0;
    (existing || []).forEach(function (h) { if (h && h.id > last) last = h.id; });
    return Math.max(Date.now(), last + 1);
  }

  // Both pages hold a local mirror and append to it immediately (a realtime
  // exchange is often followed by the next question well inside one poll
  // interval, so waiting for the row to come back would lose it), while the
  // persisted copy catches up in the background. Merging by id rather than
  // taking whichever side looks newer means neither a local append nor
  // another device's append can silently drop the other.
  function mergeTranscript(local, remote) {
    var byId = {};
    (local || []).concat(remote || []).forEach(function (h) {
      if (h && h.id != null) byId[h.id] = h;
    });
    return Object.keys(byId)
      .map(function (k) { return byId[k]; })
      .sort(function (a, b) { return a.id - b.id; })
      .slice(-VOICE_HISTORY_TURNS);
  }

  // --- Admin config -----------------------------------------------------
  // Every table above is now editable from sim_config_admin.html's "Patient
  // Manner & Agitation" section, which is what makes the trait/mood/
  // behavioural/SAT wording tunable without a code change — the same deal
  // the AI prompts already had. Both host pages call this from their own
  // loadSimConfig(), before the first voice reply can be built.
  //
  // Mutates in place rather than reassigning, because the tables are exported
  // by reference and sim_control.html builds its Manner pickers straight off
  // PatientVoice.TRAIT_MAP — a reassignment here would leave that picker
  // pointing at the pre-config array.
  //
  // A field the caller omits (or that fails to load) is left completely
  // alone, so a missing sim_config row degrades to this file's own defaults
  // rather than to an empty table. Same posture as SimEngine's own
  // applyConfigOverrides.
  // COGNITIVE_MAP/BEHAVIOURAL_* use `keywords`, SUBSTANCE_MAP uses `words` —
  // both shapes are carried through as-authored rather than normalised, since
  // the parsers read the two names directly.
  function replaceList(target, src, idKey) {
    if (!Array.isArray(src)) return;
    target.length = 0;
    src.forEach(function (r) {
      if (!r || !r[idKey]) return;
      var words = Array.isArray(r.keywords) ? r.keywords : r.words;
      if (!Array.isArray(words)) return;
      var row = {};
      row[idKey] = r[idKey];
      if (Array.isArray(r.keywords)) row.keywords = r.keywords; else row.words = words;
      target.push(row);
    });
  }
  function replaceStrings(target, src) {
    if (!Array.isArray(src)) return;
    target.length = 0;
    src.forEach(function (v) { if (typeof v === 'string' && v) target.push(v); });
  }
  function replaceObject(target, src) {
    if (!src || typeof src !== 'object' || Array.isArray(src)) return;
    Object.keys(target).forEach(function (k) { delete target[k]; });
    Object.keys(src).forEach(function (k) { target[k] = src[k]; });
  }
  function applyConfigOverrides(cfg) {
    var c = cfg || {};
    if (Array.isArray(c.TRAIT_MAP)) {
      // Order is priority (first match wins), so splice the whole list in
      // rather than merging by trait key.
      TRAIT_MAP.length = 0;
      c.TRAIT_MAP.forEach(function (r) {
        if (r && r.trait && Array.isArray(r.keywords)) TRAIT_MAP.push({ trait: r.trait, keywords: r.keywords });
      });
    }
    // The parser tables, so a newly-authored keyword can actually REACH an
    // edited note. Exposing the notes without these was half a feature: you
    // could rewrite what 'dementia' says but not make 'vascular dementia'
    // resolve to it. Each is an ordered list — first match wins, and for the
    // anchored maps the order encodes priority (delirium tremens ahead of
    // delirium, etc) — so the whole list is spliced in rather than merged.
    replaceList(COGNITIVE_MAP, c.COGNITIVE_MAP, 'kind');
    replaceList(BEHAVIOURAL_LEADS, c.BEHAVIOURAL_LEADS, 'kind');
    replaceList(BEHAVIOURAL_MAP, c.BEHAVIOURAL_MAP, 'kind');
    replaceList(SUBSTANCE_MAP, c.SUBSTANCE_MAP, 'key');
    replaceStrings(COGNITIVE_NORMAL, c.COGNITIVE_NORMAL);
    replaceStrings(BEHAVIOURAL_NONE, c.BEHAVIOURAL_NONE);
    replaceObject(TRAIT_NOTES, c.TRAIT_NOTES);
    replaceObject(MOOD_NOTES, c.MOOD_NOTES);
    replaceObject(COGNITIVE_NOTES, c.COGNITIVE_NOTES);
    replaceObject(BEHAVIOURAL_NOTES, c.BEHAVIOURAL_NOTES);
    replaceObject(SUBSTANCE_NOTES, c.SUBSTANCE_NOTES);
    replaceObject(SAT_NOTES, c.SAT_NOTES);
    replaceObject(SAT_DELIVERY, c.SAT_DELIVERY);
    // Scalar, so it cannot be mutated in place — the export is refreshed
    // alongside it, since callers read PatientVoice.VOICE_HISTORY_TURNS.
    if (typeof c.VOICE_HISTORY_TURNS === 'number' && c.VOICE_HISTORY_TURNS > 0) {
      VOICE_HISTORY_TURNS = Math.round(c.VOICE_HISTORY_TURNS);
      window.PatientVoice.VOICE_HISTORY_TURNS = VOICE_HISTORY_TURNS;
    }
  }

  window.PatientVoice = {
    DEFAULT_PROMPT: DEFAULT_PROMPT,
    applyConfigOverrides: applyConfigOverrides,
    SUBSTANCE_NOTES: SUBSTANCE_NOTES,
    COGNITIVE_MAP: COGNITIVE_MAP,
    COGNITIVE_NORMAL: COGNITIVE_NORMAL,
    BEHAVIOURAL_LEADS: BEHAVIOURAL_LEADS,
    BEHAVIOURAL_MAP: BEHAVIOURAL_MAP,
    BEHAVIOURAL_NONE: BEHAVIOURAL_NONE,
    SUBSTANCE_MAP: SUBSTANCE_MAP,
    SAT_DELIVERY: SAT_DELIVERY,
    DEFAULT_CONFUSED_NOTE: DEFAULT_CONFUSED_NOTE,
    tierFor: tierFor,
    TRAIT_MAP: TRAIT_MAP,
    MOOD_NOTES: MOOD_NOTES,
    COGNITIVE_NOTES: COGNITIVE_NOTES,
    parseCognitiveBaseline: parseCognitiveBaseline,
    BEHAVIOURAL_NOTES: BEHAVIOURAL_NOTES,
    parseBehaviouralState: parseBehaviouralState,
    SAT_NOTES: SAT_NOTES,
    TRAIT_NOTES: TRAIT_NOTES,
    parseTrait: parseTrait,
    ORIENTATION_DOMAINS: ORIENTATION_DOMAINS,
    HISTORY_FIELDS: HISTORY_FIELDS,
    VOICE_HISTORY_TURNS: VOICE_HISTORY_TURNS,
    buildMessages: buildMessages,
    nextTranscriptId: nextTranscriptId,
    mergeTranscript: mergeTranscript,
    buildSystemPrompt: buildSystemPrompt,
    buildUserPrompt: buildUserPrompt
  };
})();
