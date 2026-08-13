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

  var DEFAULT_PROMPT = "You are voicing the PATIENT in a paramedic training scenario, answering a question the crew just asked out loud. Reply only as the patient would speak — first person, in character, brief (1-3 short sentences), plain lay language, no clinical terms the patient wouldn't use.\n\nOnly say what this patient could plausibly know or perceive themselves (their own symptoms, feelings, what happened to them, basic personal details) — never reveal the provisional diagnosis, clinical reasoning, vital sign numbers, or anything a real patient wouldn't know or say. If asked something the patient wouldn't know or that's irrelevant to them, answer in character as a confused/unsure patient would.\n\nLet their current condition colour HOW they answer: e.g. short of breath = short, breathless sentences; distressed/in pain = anxious tone. Never break character, never mention this being a simulation.\n\nThe user message tells you the patient's own current date/time — always trust and use that exact value for any orientation question (day, date, year, approximate time), never a date you might otherwise assume.\n\nYour name is {{patientName}}. If asked your name, or anything requiring you to refer to yourself, you MUST use this exact name — never invent or substitute a different one.\n{{confusedNote}}\n\nReturn ONLY the spoken reply text — no quotation marks, no stage directions, no prose about the answer.";

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

  // The confusion note is appended ONLY at V4, which is what makes it a
  // tier marker rather than a general "seems a bit off" instruction.
  function buildSystemPrompt(opts) {
    var o = opts || {};
    var promptText = o.promptText || DEFAULT_PROMPT;
    var noteText = o.confusedNoteText || DEFAULT_CONFUSED_NOTE;
    var note = tierFor(o.gcsV) === 'confused' ? ('\n' + noteText) : '';
    return promptText
      .replace(/\{\{patientName\}\}/g, o.patientName || 'the patient')
      .replace(/\{\{confusedNote\}\}/g, note);
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
    return 'The patient\'s own current date/time (this is what THEY would believe if asked): ' + o.fictionalDateTime + ' \u2014 use this exact date/time, not any date you might otherwise assume, if the crew asks an orientation question ("do you know what day it is?", "what year is it?", "roughly what time is it?" etc). Otherwise it\'s just background context.\n'
      + 'Scenario: ' + (s.title || '') + '\n'
      + 'Patient name: ' + name + '\n'
      + 'Provisional diagnosis (do not reveal): ' + (s.provisional || 'unspecified') + '\n'
      + 'Medical history: ' + listed(s.medical_conditions) + '\n'
      + 'Medications: ' + listed(s.medications) + '\n'
      + 'Allergies: ' + (s.allergies || 'none documented') + '\n'
      + 'What the patient told the crew on scene: ' + (s.arrival_hx || '') + '\n'
      + 'Current approximate condition: HR ' + v.HR + ', RR ' + v.RR + ', SpO2 ' + v.SpO2 + '%, GCS ' + gcsTotal + '/15 (Verbal component: ' + o.gcsV + '/5), pain ' + (v.pain != null ? v.pain + '/10' : 'unspecified') + '\n'
      + 'Treatments given so far: ' + (actions.length ? actions.join('; ') : 'none yet') + '\n'
      + '\n'
      + 'The crew just asked/said: "' + o.question + '"\n'
      + '\n'
      + 'Reply as the patient.';
  }

  window.PatientVoice = {
    DEFAULT_PROMPT: DEFAULT_PROMPT,
    DEFAULT_CONFUSED_NOTE: DEFAULT_CONFUSED_NOTE,
    tierFor: tierFor,
    buildSystemPrompt: buildSystemPrompt,
    buildUserPrompt: buildUserPrompt
  };
})();
