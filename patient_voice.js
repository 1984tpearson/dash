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
  // delirium, agitation/aggression, psychosis, depression. Those are clinical
  // findings that change management (scene safety, de-escalation, capacity,
  // sedation), several of them move during the scenario in response to
  // treatment, and they need to reach the avatar and the assessor as well as
  // the voice. They want their own time-varying axis alongside the vitals,
  // not a static free-text field here. Deliberately left for later; do not
  // grow TRAIT_MAP into it.
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
  function parseTrait(text) {
    var s = String(text || '').toLowerCase().trim();
    if (!s) return 'plain';
    for (var i = 0; i < TRAIT_MAP.length; i++) {
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
    var out = promptText
      .replace(/\{\{patientName\}\}/g, o.patientName || 'the patient')
      .replace(/\{\{confusedNote\}\}/g, note);
    if (out.indexOf('{{traitNote}}') !== -1) return out.replace(/\{\{traitNote\}\}/g, traitNote);
    return traitNote ? (out + '\n' + traitNote) : out;
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

  window.PatientVoice = {
    DEFAULT_PROMPT: DEFAULT_PROMPT,
    DEFAULT_CONFUSED_NOTE: DEFAULT_CONFUSED_NOTE,
    tierFor: tierFor,
    TRAIT_MAP: TRAIT_MAP,
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
