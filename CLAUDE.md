# dash — Paramedic Training Simulation Tools

A collection of standalone HTML/JS tools for EMS/paramedic training. No
build step — everything is loaded either as static files (GitHub Pages,
auto-deploys on push to `main` via `.github/workflows/static.yml`) or as
absolute `https://1984tpearson.github.io/dash/...` `<script src>` references
between the tools themselves (not relative paths — matters when testing
locally, since a plain `python3 -m http.server` won't serve those cross-file
references without intercepting/redirecting them).

This repo is a fresh duplicate of the old `AV` repo (single-commit history,
duplicated deliberately to shed the Ambulance Victoria branding/name — see
the Gotchas entry below on remaining AV references still baked into the
content itself).

**`index.html` is the DASH verbal scenario assessment tool** — the main page,
served at the Pages root. It used to live at `scenario.html`, with `index.html`
being the small "other tools" landing grid; the two were swapped (Aug 2026) so
the site root lands on the tool itself rather than a link menu. The landing
grid is now `tools.html` (linked as "More Tools" in `nav.js`'s sidebar and as
"← Back to Tools" from `games.html`). **`scenario.html` still exists as a
deliberate redirect stub** — it forwards to `index.html` preserving the query
string, so previously shared `scenario.html?id=<uuid>` links keep working. It
is not dead code; don't remove it in a cleanup sweep.

Backend is Supabase (`sim_sessions`, `scenarios`, `scenario_sim_timelines`
tables; anon key is hardcoded client-side, this is a training tool not a
security boundary). Two edge functions exist (`generate-avatar`,
`generate-featured-blurb`) — unrelated to the sim engine below.

## The real-time scenario simulator (most active area)

Three files work together:

- **`sim_engine.js`** — shared deterministic vitals engine. Both
  `sim_control.html` (assessor) and `sim_patient.html` (student) load it
  and independently compute the same vitals from the same inputs
  (baseline, override list, elapsed time) — no server-side ticking, only
  the override/treatment data needs to sync (via Supabase polling, ~3s).
- **`sim_control.html`** — assessor/instructor control panel: trajectory
  graph, treatment log, "Script an Event" command field, session
  creation.
- **`sim_patient.html`** — student-facing patient view: monitor, ECG,
  voice-driven "Treat / Assess / Talk" interactions.
- **`ecg_engine.js`** — shared with *other* tools in this collection
  (`monitor.html`, `index.html`, etc), not written for this sim
  specifically, but fully appropriate to reuse here. Renders real
  waveform morphology per named rhythm key (`nsr`, `af`, `vf`, `asys`,
  `stemi-inf`, ~40 more) and has `mapRhythm(text, hr)` to fuzzy-match
  free clinical text to an engine key.

### Vitals model: baseline + overrides

`cfg.overrides[vitalKey] = [{ targetValue, startMs, endMs }, ...]`. A vital's
value at time T interpolates toward `targetValue` between `startMs`/`endMs`;
once an override completes, it becomes a permanent additive offset (the
raw baseline trend "resumes drifting" from that point, not freezing) — see
`applyOverrides()` in `sim_engine.js`. **Chained entries must run end-to-end
with no gaps** — the renderer doesn't interpolate between chain links.

### AI trajectory generation — three call sites, one shared splice rule

- `generateSimTimeline(scenario)` — the untreated baseline course, run once
  per scenario and cached in `scenario_sim_timelines` (keyed by
  `scenario.updated_at`, so editing a scenario invalidates the cache).
- `regenerateTimelineAfterTreatment(action, givenAtMs)` — reasons about a
  crew treatment's actual pharmacological effect. Skeptical by design: no
  real mechanism → no effect, even if "something was done."
- `regenerateTimelineForScriptedEvent(command, givenAtMs)` — the assessor
  directly authors a clinical event ("put patient into cardiac arrest in
  5 minutes"). Authoritative by design: it's a direct command, not
  something to second-guess for plausibility.

**All three are Sonnet-only, deliberately.** `classifyTreatmentWithHaiku()`
is the *only* legitimate Haiku call in the treatment path — it's a router
that fuzzy-matches free text against a fixed catalogue of already-reviewed
simple actions (aspirin, tourniquet, etc.) so obvious cases skip an AI
reasoning call entirely. Full physiological reasoning (either of the two
functions above) must never run on Haiku — it was previously configurable
via a model picker and that's exactly why the cascade bugs below existed;
the picker was removed for this reason. Don't reintroduce a Haiku option
for those two calls.

Both `regenerateTimeline*` functions share `spliceAiOverridePlan()` — the
non-obvious part of this whole system:
1. An override key the AI didn't mention in its response is left **completely
   untouched**, including its future — omission means "nothing changes here,"
   not "erase what was scheduled." This took two iterations to get right;
   see the comment above `spliceAiOverridePlan` for the two bugs it fixes.
2. For a key the AI *did* touch: anything already fully in the past is kept
   as history, anything mid-transition right now is truncated to end exactly
   at `givenAtMs` (frozen at its real current value), and anything still in
   the future is dropped before the new chain is spliced in. Otherwise a
   stale wide-window override keeps "winning" over the new plan for its
   entire original duration (the engine always uses whichever override, in
   start-time order, contains "now").

**Cascade rule baked into both prompts**: if an event causes cardiac arrest /
severe shock / LOC change, the AI must write overrides for *every* vital that
state implies (HR, BP, SpO2, EtCO2, RR, GCS) — not just the one it reasoned
about first — or the graph shows a contradictory picture (e.g. HR flatlined
at 0 while RR keeps breathing normally on its old schedule). Pain/nausea are
self-reported and must cut to 0 in lockstep with LOC, not fade out
independently.

### Rhythm — separate from vitals, deliberately

HR is a number; a rhythm (VF vs asystole vs PEA vs sinus) is a distinct
concept that can't be inferred from HR alone (all three of those can be
"HR 0" but render completely differently, and PEA specifically looks
organized despite no pulse). `overrides.rhythm` is a **step-function** list
— `{ label, startMs }`, no `endMs`/`targetValue` — read via
`SimEngine.getRhythmAt(cfg, nowMs)` (last entry at-or-before `nowMs` wins,
`null` if nothing's been scripted). Spliced separately via
`spliceRhythmPlan()` (much simpler than the vitals splice: no in-progress
truncation needed since it's discrete, just drop superseded future entries).

Both AI prompts can return an optional `rhythm` array alongside `overrides`,
using the ECG engine's recognised terminology (sinus rhythm/tachy/brady, AF,
VF, asystole, PEA, heart blocks, STEMI territories, etc — see the prompt
text for the full list `mapRhythm` understands). Cardiac arrest **always**
needs a rhythm entry — never leave it to the engine to guess.

`generator.html` has long had a per-scenario `vitals.Rhythm` free-text field
(e.g. "SVT") for other tools in this collection — plenty of scenarios
*start* with an abnormal rhythm already showing, not just one reached via a
treatment/event. `createSession()` seeds `overrides.rhythm` from
`scenario.vitals.Rhythm` (via `parseScenarioStartingRhythm()`) at session
creation, so this doesn't depend on any AI call firing first.

`sim_patient.html`'s `ensureECG()` prefers this explicit scripted rhythm
over the old `deriveRhythmFromHR()` fallback (which only ever picks
sinus brady/normal/tachy — falls back to it only when nothing's been
scripted). `sim_control.html`'s `renderGraph()` draws a vertical marker +
label at each in-scenario rhythm change in view, plus a persistent
"♥ CURRENT RHYTHM" badge (skips drawing a marker line for the scenario's
starting entry itself — the badge already covers that).

### Patient orientation: real-world date vs. in-scenario time-of-day

`sim_engine.js`'s `getScenarioFictionalNow(timeOfDayRaw, cfg, nowMs)` is the
patient's own in-fiction sense of "what time is it" — today's real calendar
date (so a GCS orientation question doesn't get answered with some earlier
year from a model's training cutoff, or a stale device clock) at the
scenario's authored baseline time-of-day (`vitals.TimeOfDay`, a
`generator.html` free-text-with-fallback field parsed by
`SimEngine.parseTimeOfDay()` — same pattern as `vitals.Rhythm` above, e.g.
"03:15" for a scenario that opens as a 3am callout), advanced by however
much scenario time has genuinely elapsed since arrival via the SAME
pause-aware clock (`getSimNow()`) the vitals engine itself runs on — so
pausing the session doesn't also age the patient's sense of time, and
rewinding the playhead moves it backward too since it's recomputed fresh
each call rather than accumulated separately. Returns `null` if
`timeOfDayRaw` doesn't parse (older scenarios that predate the field) —
both call sites below fall back to the real device clock in that case, same
as before this field existed. Kept in `sim_engine.js` and called
independently from both pages, same as the vitals themselves, rather than
syncing one computed value between them:

- `sim_control.html`'s `scenarioFictionalDateTime()` feeds `callPatientAI()`'s
  user prompt (the "Talk to Patient" AI path, gcsV 4-5) — distinct from
  `currentDateTimeContext()` (the real device clock), which stays wired into
  the trajectory/projection prompts (`generateSimTimeline`,
  `TREATMENT_UPDATE_PROMPT`, `SCRIPTED_EVENT_PROMPT`) purely to ground the
  model's pharmacological/clinical reasoning in the real calendar date —
  unrelated to what the patient believes, so left untouched.
  `PATIENT_VOICE_PROMPT`'s system-prompt text also explicitly tells the
  model to trust the given date/time over any date it might otherwise
  assume, rather than relying on the user-turn wording alone.
- `sim_patient.html`'s `scenarioFictionalDateTime()` feeds the same prompt
  line on the Realtime Voice path, and its `updateScenarioClock()`, called
  every `tick()`, drives the "Scene time" row in the Patient / Scene Info
  panel — a 24-hour HH:MM readout of the scenario's own in-fiction time,
  deliberately separate from the topbar's `#scenario-timer` (a T+mm:ss
  elapsed-time countup) so a student can tell "what time is it in the
  scenario" apart from "how long have we been on scene."

### The patient's spoken voice lives in `patient_voice.js`

Both pages ask Claude to speak as the patient — `sim_control.html`'s
`callPatientAI()` (legacy `student_queue` path) and `sim_patient.html`'s
`generateRealtimePatientReply()` (Realtime Voice). The system prompt, the
GCS-Verbal-4 confusion note, the GCS tiering and the user-prompt builder
are shared via **`patient_voice.js`** (`window.PatientVoice`), loaded by
both pages plus `sim_config_admin.html`.

This was two hand-synced copies with a "keep in sync by hand" comment,
which is exactly how it failed — three separate drifts, and once Realtime
Voice became the default the stale copy was the one students actually
heard: the corrected V4 note reached neither copy for days, real PMHx
replaced the dead `key_hx` field in only one, and `sim_patient.html` sent
the *device* wall clock where `sim_control.html` sent the patient's
in-fiction scenario clock (so a 3am callout answered orientation questions
with the tester's local time). **Don't reintroduce a local copy of either
prompt string or the user-prompt shape.**

What deliberately stays per-page: where the scenario/vitals/treatments are
read from (`currentScenario`/`liveConfig` vs `scenarioMeta`/`testConfig`),
what happens to the reply afterwards (logged and written back for the
patient device, vs spoken straight out), and `max_tokens` — 300 in
`sim_control.html` vs 120 in `sim_patient.html`, a deliberate latency
tradeoff documented at that call site.

The prompt carries three things beyond the scenario basics, all built in
that one file so both paths get them identically:
- the scenario's authored `hx` block (onset/nature/aggravating/associated/
  similar), so the patient answers "when did this start?" from the same
  text the assessor is marking against instead of inventing it;
- at GCS-Verbal 4 only, the **orientation profile** — see below;
- **conversation history**, as real user/assistant turns rather than a text
  blob, so the patient stays consistent with what they have already said
  about anything the scenario never authored. Stored in
  `sim_sessions.voice_transcript` (`{id, atMin, q, a}`, trimmed to the last
  12), appended by whichever page answered, and merged rather than replaced
  on poll (`PatientVoice.mergeTranscript`) because a page routinely holds a
  just-recorded exchange the row has not caught up with. Only exchanges
  that actually reached the model are recorded — the canned V2/V3 sounds
  are not the patient holding a conversation. Ids come from
  `PatientVoice.nextTranscriptId()`, not a bare `Date.now()`: two turns in
  the same millisecond collide, and the merge dedupes by id, so one would
  be silently dropped.

The **orientation profile** (`scenario_sim_timelines.orientation_profile`,
copied onto the session row at creation) fixes what a V4 patient is
confused about — which of time/date/place/person/event they have wrong,
and what they believe instead — generated once per scenario by a cheap
Haiku call and cached under the same `source_updated_at` key as the
trajectory, so every student meets the same confused patient and their
orientation assessments are comparable. `sim_control.html`'s Med Hx tab
shows it to the assessor while the patient is actually at V4. It exists
because the per-turn calls are stateless: asked the same question twice,
the patient invented a different wrong answer each time. History covers
the open-ended rest; the profile pins the closed set absolutely.

`sim_config_schema.js`'s two prompt defaults *reference*
`window.PatientVoice` rather than carrying literals — a third copy would
mean "reset to default" in the admin editor writing stale text into the DB
for every user. That's why `patient_voice.js` must load before
`sim_config_schema.js` (all three host pages order it that way).

### Patient avatar (`sim_patient.html` only)

The `#head-wrap` placeholder is a hand-built inline SVG face, not a photo —
deliberately no AI/image generation involved. The artwork itself lives in
`avatar_assets.js`, extracted once from DiceBear's "Avataaars" style (MIT
core, art free for personal/commercial use — see that file's header for the
full licensing note and extraction method) rather than calling DiceBear at
runtime: this repo is otherwise all static files, and a live external
avatar-service call is a new failure mode this training tool doesn't need.
`window.AvatarAssets = { eyes, eyebrows, mouth, top, headBodyPaths }` — hair
(`top`) keeps a `__HAIRCOLOR__` token, the head/body path a `__SKINCOLOR__`
token, substituted at render time rather than baked in, so colour stays
dynamic. Two layers on top of that shared data:

- **Build** (fixed per scenario): skin tone from `scenario.patient_meta.skin_colour`
  (hex swatch, already stored by `generator.html` — see
  `pickSkinToneForEthnicity()`, weighted by the same `patient.ethnicity` the
  name pool picked via `SKIN_TONE_LEAN`, one weight table per ethnicity key
  — a soft lean toward population-typical tones, not a lookup: every
  ethnicity keeps a nonzero chance at every swatch, verified against 5000
  draws per ethnicity. Previously generated fully independently of
  ethnicity "to avoid caricature" — changed because in practice an
  uncorrelated pick was actively working against the inclusive/
  representative goal the field exists for, not serving it),
  hair style/colour and eyebrow style all picked deterministically from a hash
  of `scenario_id` (each with a differently-suffixed hash so they don't land
  in lockstep) so they're stable across reconnects rather than re-rolling
  each page load. Hair style is softly weighted by `patient_meta.gender` via
  `HAIR_STYLE_LEAN` (each of the 34 styles tagged masc/femme/neutral-leaning)
  and `weightedPick()` — a *soft* bias (male ≈61% masc/13% femme/26% neutral
  in practice, mirrored for female), not a hard filter: gender-unset scenarios
  and eyebrow/colour selection stay fully unweighted. Went through two prior
  versions of this: first hard-restricted to 2-3 hand-drawn hair shapes by
  gender (too rigid), then dropped gender entirely once real variety existed
  (came across as arbitrary — see conversation history) — this weighted
  middle ground is what stuck. `buildAvatarBase()` in `sim_patient.html`.
  `hashStr()` is a simple rolling hash with poor avalanche behaviour for
  inputs differing only in a short numeric suffix (e.g. sequential test
  seeds) — fine for real `scenario_id` UUIDs (verified: near-uniform
  distribution across 300 real-shaped seeds) but worth knowing if ever
  seeding from something more patterned.

  `CASUAL_HEADWEAR` (hat, the four winter hats — NOT hijab/turban, see
  `HEADWEAR` below) gets an extra 0.3x knocked off its weight within
  whichever `HAIR_STYLE_LEAN` category it's tagged into: it's plain
  'n'-tagged, same as several real hairstyles (curly, dreads, fro, etc), so
  it was landing on ~1 in 7 patients — reads as costume variety rather than
  a real hairstyle, unlike hijab/turban which represent real day-to-day
  headwear for a portion of the population and are deliberately left at
  normal weight. Verified: ~5.6% casual headwear / ~6.4% hijab+turban /
  ~88% real hair across 500 real-shaped seeds, down from casual headwear's
  previous ~14.7%.

  Clothing colour — the patient's own, not a uniform — is picked the same
  way: `CLOTHES_COLOURS`, unweighted (no gender/age lean; a pool this broad
  doesn't need one). Rendered as a flat-colour fill only, no separate
  neckline/collar graphic: a duplicate of `headBodyPaths` re-filled
  (`#av-clothes-static-path`, plus `#av-chest-path` reused from the
  breathing layer below), both sharing `#av-chest-clip` (y=199, the same
  boundary the breathing layer uses) rather than a separate, higher
  boundary of their own. Went through two prior versions: DiceBear's own
  hand-drawn neckline graphics (crew neck, v-neck, hoodie, etc, layered on
  top for visual variety) first — dropped, since those are positioned for
  stock Avataaars' eye/eyebrow placement, which sits higher than ours
  (`#av-eyes` is at y90-112 here), so every one of them (and especially
  decorative details like the hoodie's drawstrings around y63-110) crossed
  the eyes/eyebrows instead of sitting on the shoulders. Then a flat fill
  clipped higher, at y175 — verified pixel-for-pixel against the rendered
  SVG to sit well clear of the head/jaw path geometry — which still visibly
  read as the collar touching the chin: y175 is only ~15px below the
  mouth's own drawn shape (origin y134), not the wide margin the path
  geometry alone suggested. Matching the breathing layer's own y199 is far
  more conservative (no collar creeping up the neck at all — the shirt
  starts right at the shoulder line) but guarantees clothing can't read as
  touching the face again, regardless of age band or head-bulge amount.

  `#av-chest-clip`'s rect height is 81 (covering y199 to y280), not 61
  (which would stop at y260, the viewBox's own bottom edge) — the
  `headBodyPaths` `d` actually reaches y280, past what's visible at
  `AGE_SCALE=1`. For a shrunk-down pediatric figure, `av-scale-group`'s
  scale pulls that y260-280 sliver up into the visible frame, so a clip
  that only covered the viewBox's edge left a bare skin gap right at the
  bottom of the frame below the shirt for every band except adult, while
  invisibly doing nothing wrong at adult scale (hence not caught until a
  younger band was actually checked against it).

`patient_meta.age` (verbatim `patient.age` from generator.html — a plain
number of years, a "N months" string, or the literal string "newborn";
older scenarios predate the field and fall through to 'adult', not a guess)
drives two more build-time effects, added after a paediatric scenario
rendered as a literal middle-aged adult:
- **`ageRamp(years, atZero, atEighteen)`**: every age-scaling property below
  is a continuous function of `avatarBuild.ageYears` (exact age in years,
  separate from the discrete `ageBand` string used for hair-pool/grey-weight
  decisions), linearly interpolating from its `atZero` (newborn) value to
  its `atEighteen` (adult/normal) value — reaching "normal" exactly at 18,
  not at a banded cutoff. Previously these were keyed by the 5 discrete
  `ageBand` buckets (infant/toddler/child/teen/adult), which both capped out
  at the 'teen' value for anyone up to 17 (never actually reaching the adult
  look until crossing into the 'adult' band at 18) and jumped
  discontinuously at each band boundary (e.g. age 4.99 vs 5.0) instead of
  scaling smoothly. Unknown age (`years == null`) returns the adult value,
  matching `ageBandFromMeta()`'s own fallback.
- **`AGE_SCALE_AT_ZERO` (0.94, tuned via `avatar_tuning_lab.html`)**: the
  whole figure is scaled (`av-scale-group`, anchored at the top of the head
  at (140,36) so it shrinks toward that point rather than the viewBox
  origin), reaching 1 (no shrink) at 18. Kept close to 1 (an earlier version
  went down to 0.6, then 0.78, for infants) — most of the "younger" cue
  comes from `HEAD_BULGE_RX_AT_ZERO`/`HEAD_BULGE_RY_AT_ZERO` below rather
  than shrinking the whole figure hard, which read as "a tiny adult" and
  made infants disappear on screen rather than looking younger.
- **`ADULT_ONLY_HAIR`**: a small set of structured/receding-hairline-prone
  cuts (theCaesar, theCaesarAndSidePart, shavedSides, sides) excluded from
  the hair pool below teen — a hard filter, unlike the gender lean, since
  there's no equivalent "some variety is good here" case for a toddler
  landing on a middle-aged man's haircut. Infants skip the hair pool
  entirely (`avatarBuild.hairStyle = null`, `#av-top` left empty) — real
  babies are frequently bald or near-bald and nothing in the pool reads as
  "infant hair," the shortest options are still styled cuts.
- **`FACE_FRAMING_HEADWEAR`** (hijab, turban): also excluded below teen,
  same cutoff as `ADULT_ONLY_HAIR` but for a different reason — these drape
  down around the neck/shoulders, a fixed part of the artwork that a hair
  scale/offset tuned for the head alone can't correctly stretch to match.
  On a younger patient's proportionally bigger head this either fell short
  of the shoulders or gaped visibly at the neck/back of the head. `hat`/the
  four winter hats don't have this problem (they only cover the top of the
  head, no neck drape) so stay in the pool at every age. (Hair itself is no
  longer scaled with age at all — see `HAIR_SCALE_AT_ZERO` below — so this
  mismatch is specific to hijab/turban's drape, not a general hair-scaling
  problem.)
- **`EYE_SCALE_X_AT_ZERO`/`EYE_SCALE_Y_AT_ZERO`/`FACE_LOWER_OFFSET_AT_ZERO`**:
  the classic cartoon "younger = bigger eyes, face sits lower/rounder" cues,
  layered on top of the whole-figure scale since eyes/eyebrows/mouth are
  already independent groups that can move/scale on their own — `#av-eyes`
  scales around its own on-screen centre (56,22), while eyes/eyebrows shift
  down as a unit by `FACE_LOWER_OFFSET_AT_ZERO`'s ramp. X and Y scale
  separately rather than one shared factor: scaling around the two-eye
  centre moves each eye away from it by the same factor it grows them, so
  an earlier single `EYE_SCALE` of 1.45 for infants also pushed the two eyes
  45% further apart — read as wall-eyed/alien rather than "big eyed". Y
  still does most of the work (1.6 at age 0) for the bigger/rounder look; X
  stays close to 1 (1.1 at age 0) so eyes grow without spreading far apart.
  The mouth uses its own `MOUTH_LOWER_OFFSET_AT_ZERO` (6.5, not 12) rather
  than sharing the eyes/eyebrows offset — at the shared value, newborn
  mouths sat too low (too close to the chin/jaw curve); 6.5 was tuned
  visually via `avatar_tuning_lab.html` (an earlier pass had landed on 4,
  before the head-bulge/figure-scale retune below shifted where "too low"
  actually was).
- **`HEAD_BULGE_RX_AT_ZERO`/`HEAD_BULGE_RY_AT_ZERO`** (1.16/1.19, tuned via
  `avatar_tuning_lab.html`): makes the head outline itself read as
  proportionally bigger for younger ages (ramping down to 1, no bulge, at
  18), which `EYE_SCALE`/`FACE_LOWER_OFFSET` alone don't touch — the
  head/body outline is one rigid path shared with the torso, no separate
  head/body art to scale independently. RX and RY are independently
  tunable (not one shared radius) specifically so the bulge can be
  stretched TALLER to reach further down toward the jaw/chin without also
  over-widening the cheeks/temples — added after noticing there was no way
  to affect the jaw/chin/neck contour at all (it's part of the same rigid
  head+torso path, untouched by anything else here). Went through two
  prior single-radius (`HEAD_BULGE_AT_ZERO`) values before the RX/RY split:
  1.7 (bulge diameter ~190px, aimed at matching `headBodyPaths`' own
  ~200px hem width on the reasoning that a newborn's head circumference is
  roughly equal to their chest circumference) read as "ridiculous" once
  rendered; 1.445 (1.7 dialled back 15%) was themselves not the final
  answer — visual tuning landed on the current, smaller RX/RY pair instead
  once independent width/height was available. Worked around with
  `#av-head-bulge`, a same-fill ellipse
  behind `#av-head-path` centred on the head arc's own centre (cx=132,
  cy=92, matching the path's own "a56 56" head arc) at a LARGER radius:
  because it's an ellipse, it naturally tapers to zero width well above
  the jaw/neck curve, so a bigger radius reads as a wider/rounder
  head+cheeks with no clipping and no seam against the body below —
  avoids the whole "second chin" class of bug by
  construction, since there's no hard edge to mismatch.
- **`HAIR_SCALE_AT_ZERO`/`HAIR_OFFSET_Y_AT_ZERO`** (1 / -2): hair used to be
  tied 1:1 to the head bulge's own ratio, growing by the same amount —
  once RX/RY landed on smaller, more modest values (see above) that no
  longer needed matching, so hair now just holds its normal size at every
  age (`HAIR_SCALE_AT_ZERO = 1`, i.e. a no-op) with a small upward
  `HAIR_OFFSET_Y_AT_ZERO` nudge at younger ages instead, ramping back to 0
  by 18. Kept as independent constants (not deleted along with the 1:1
  tie) since `avatar_tuning_lab.html` exposes them as their own sliders —
  a future retune of the head bulge doesn't have to also mean retuning
  hair.
- **`greyWeight()`**: separately, hair *colour* (not style) softly ramps
  toward grey/silver/white (`GREY_HAIR_COLOURS`) as age climbs from 40 to
  75+ (≈7% grey at 20, ≈47% at 45, ≈83% at 80 — verified against 500
  seeds per age) — same weighted-pick mechanism as the gender lean, low but
  nonzero baseline at any age rather than a hard young/old split. Eyebrows
  are NOT recoloured to match — `avatar_assets.js`'s eyebrow paths have
  their fill baked in (`fill="#000"`, no `__COLOR__` token like hair has),
  so this would need SVG surgery on the asset file to add; skipped as
  out of scope for now. Excludes `HEADWEAR` (hat, hijab, turban, the four
  winter hats) — those `top` entries share the same `__HAIRCOLOR__` token
  for lack of a more specific one, but they're a garment, not hair, so
  greying them with age makes no sense; an elderly patient in a hijab or
  turban gets an unweighted colour draw instead of a grey-leaning one.
- **Live state** (re-derived every tick): eyes are NOT one of
  `avatar_assets.js`'s pre-baked variants — several of those (including
  `default`, the plain look) are just flat pupil dots with no sclera
  underneath, and none expose the pupil as independently sizeable. Sclera
  (`av-eye-l/r-sclera`) and pupil (`av-eye-l/r-pupil`) are separate elements
  instead, deliberately so pupil size/reactivity can later be driven by
  clinical state (dilated/pinpoint/unequal — anisocoria, blown pupils) as
  its own axis, not baked into a fixed shape per eye-openness level. Both
  stay full-size at all times; "droopy" (GCS E2) is a skin-toned eyelid
  path (`av-eye-l/r-lid`) occluding the top ~70% of each eye instead of
  shrinking the eyeball — shrinking it used to still read as a small OPEN
  eye rather than a heavy/half-closed one. `closed` still reuses the real
  `AvatarAssets.eyes.closed` asset (a plain eyelid crease, no sclera
  needed) via the always-present `av-eyes-closed-overlay` group, toggled
  visible instead of swapped in. Skin appearance (pallor/flush/cyanosis,
  applied to `#av-head-path`/`#av-head-bulge`/eyelids only — clothing is
  deliberately NOT tinted, since these wouldn't show through fabric) and
  diaphoresis are covered in their own section below. Resting mouth
  expression (neutral/mild/distress/grimace/slack, plus mood states —
  mapped onto Avataaars' named mouth shapes; `avatar_assets.js` has all 12
  of DiceBear's mouth variants, including `grimace` and `serious`, so
  `MOUTH_VARIANT` maps `grimace`/`mild` straight to those literal keys — a
  prior pass here mis-detected the two as missing, because the key-scan
  regex used only matched values starting with `` `<path` `` and both
  `grimace`/`serious` happen to start with `` `<rect` ``, and "fixed" it by
  routing them to `vomit`/`default` instead, which is what actually broke
  the pain≥7 grimace) comes from pain score, distress level, consciousness,
  and mood (see below).
  Driven by `SimEngine.getAppearanceState(v)` — the same severity bands
  (`hrSeverity`/`rrSeverity`/`spo2Severity`/`painSeverity`/`bpSysSeverity`)
  `sim_control.html`'s assessor-facing Appearance tab computes
  independently, kept in `sim_engine.js` as the one shared source rather
  than two threshold tables drifting apart.
  `updateAvatarFace()`, called from `tick()` — always as the LAST thing
  tick() does, wrapped in try/catch (see Gotchas): tick() runs once
  synchronously before the setInterval(tick,...) that keeps the page live
  even gets registered, so a throw anywhere earlier in the avatar path would
  silently freeze vitals/override-sync too, not just the avatar.

### Mood (eyebrows, and mouth when physiology is otherwise unremarkable)

`patient_meta.mood` is scenario-authored free text (generator.html's AI
prompt, e.g. "Anxious and tearful", "Agitated and uncooperative" — same
free-text-plus-fuzzy-match pattern as `vitals.Rhythm`), fuzzy-mapped once
per session (not every tick — it can't change mid-scenario) by
`SimEngine.parseScenarioMood()` into one of calm/anxious/tearful/agitated/
angry/confused, stored in `patientMood`. `calm` (the default/unset case)
deliberately has no eyebrow-shape entry in `MOOD_EYEBROW` — it means "use
this patient's own per-scenario neutral eyebrow pick"
(`avatarBuild.eyebrowStyle`, chosen once for variety, same as hair/eyebrow
style always were) rather than forcing every calm patient onto one
identical shape. Eyebrows were previously fixed at build time only (picked
once, never touched again) — mood is what makes them a live, tick-driven
element like the mouth already was (`setEyebrows()`, called from
`updateAvatarFace()` alongside `setMouth()`).

Vitals still win over mood, deliberately: `updateAvatarFace()` only applies
mood (`moodActive = !app.unresponsive && patientMood !== 'calm'`) when the
patient isn't unresponsive — an angry patient at GCS 3 shows the same
neutral/relaxed expression as any other unresponsive patient, not angry
eyebrows on a slack face. Within mood-active states, physiological findings
still take priority for the MOUTH specifically (severe pain still grimaces,
significant physiological distress still looks distressed) — mood only
supplies the mouth when physiology is otherwise in the unremarkable range,
though it always drives eyebrows whenever active, since there's no
physiological eyebrow signal to compete with.

GCS eye-opening (E) maps to clinical exam findings, not a linear scale: E4
open spontaneously, E3 ("opens to voice") droopy/half-open at rest and only
opens fully while `_voiceModalOpen` is true (i.e. a crew member is actively
mid-interaction via Treat/Assess/Talk — that's the actual voice stimulus
being modelled, not just cosmetic). E2 ("opens to pain") and E1 ("none")
both render closed — there's no pain-stimulus interaction modelled here, so
E2 has nothing to open in response to and stays closed, same as E1. An
earlier version had this backwards (E2 droopy/half-open, E3 closed at rest)
which read as the patient looking MORE responsive at a lower GCS than a
higher one — ordering it E4 > E3(droopy, or open mid-interaction) > E2/E1
(closed) is what actually matches the clinical severity gradient.

Driven by `gcsE` ALONE — deliberately not folded together with
`app.unresponsive` (`getAppearanceState()`'s overall-GCS-≤8 flag, used
elsewhere for e.g. resting mouth expression), even though an earlier
version did exactly that. E is specifically the eye-opening component of
the scale; a real E4/V1/M1 presentation (eyes open, no other response) is
rare but clinically possible and should still render open eyes, which
`app.unresponsive` (4+1+1=6 ≤ 8) would otherwise force closed.

Idle animations run independently of the 1s vitals tick (a 1s-stepped
animation reads as a slideshow, not motion), all inside one
`requestAnimationFrame` loop (`idleMotionLoop()`):

- **Blink** every ~2.5–6s (`scheduleNextBlink()`/`doBlink()`, only from a
  fully-open resting state — skipped for droopy/closed, restores to
  whatever `_restingEyeLevel` is AT RESTORE time so a vitals change
  mid-blink isn't clobbered back open).
- **Breathing** is two independently-driven layers, both period-matched to
  live RR and stopping dead at RR≤0 (an apnoeic patient shouldn't still
  look like they're breathing): `#av-chest-group` is a same-shape
  duplicate of the head/body path, clipped to just the shoulder region
  (`av-chest-clip`, a `<rect>` over the lower part of the shape) and
  sitting BEHIND `#av-face-group` — at rest the two perfectly overlap so
  the clipped duplicate is invisible, only becoming visible as "shoulder
  rise" once its own transform diverges from the face group's. This is
  the primary, always-present breathing cue. The clip's top edge (y=199)
  matters more than it looks: it's set just past where the path's
  neck-to-shoulder curve resolves into the flat shoulder taper — set any
  higher (into the curvy jaw/neck transition) and that curve peeks out as
  a visible "second chin" whenever the chest offset diverges enough from
  the face's. The *head* itself (`#av-face-group`) barely moves normally —
  real quiet breathing doesn't bob the head; visible head movement is
  actually a laboured-breathing sign (accessory muscle use, tripoding) —
  so its amplitude is scaled by `_wobAmplitude`, set from
  `SimEngine.getAppearanceState(v).wob` in `updateAvatarFace()`,
  near-zero for a calm patient and progressively more pronounced toward
  agonal/severe distress. Phase is a running angle accumulator
  (`_breathAngle`, advanced each frame by `(dt/period)*2π`) rather than
  recomputed fresh from the absolute rAF timestamp — RR can change
  mid-breath, and recomputing `sin(tsMs/period)` straight from `tsMs` kept
  the numerator growing while the denominator jumped, causing a visible
  phase discontinuity on nearly every RR change (read as the breathing
  "resetting" and looking too fast). Accumulating means a period change
  only changes the rate of future advancement, not the current position
  in the cycle — verified by sampling chest-Y across a live RR change:
  smooth acceleration, no jump.

There used to be a slow ~7s idle side-to-side sway here too (`#av-face-group`
X, plus a parallax version on `#av-top`), purely "not a frozen photo" and
unrelated to any vital sign. Removed — its horizontal motion competed with
the chest/head breathing rise (the actual RR cue) for attention, making
respiratory rate harder to read at a glance than it should be. If a "not a
frozen photo" idle cue is wanted again, it should avoid moving anything on
the same axis the breathing animation uses.

Mouth also flaps between a talking frame and the current resting expression
while patient TTS is actually speaking (`utter.onstart`/`onend` in
`checkForPatientReply()` drive `startTalkAnimation()`/`stopTalkAnimation()`)
— so a distressed patient still looks distressed mid-sentence, not neutral.

`avatar_lab.html` is a standalone playground (sliders for vitals/GCS, build
controls including direct hair/eyebrow pickers, preset states, dropdowns to
browse every raw eyes/mouth variant by name, an SVG-source viewer) that runs
the exact same avatar functions against slider input instead of a real
session — for iterating on the artwork/thresholds without needing a live
scenario. It loads `avatar_assets.js` the same way `sim_patient.html` does
(shared data, no duplication), but keeps its own copy of the render
functions (`updateAvatarFace()` etc — not shared via a script include) since
the two have different plumbing around them (real session state vs. slider
state).

`avatar_tuning_lab.html` is a companion tool, not a replacement for
avatar_lab.html — it exposes every age-scale constant (whole-figure scale,
head bulge, eye scale X/Y, eyes/brows and mouth Y offset, plus hair
scale/X/Y which aren't independently adjustable in the shipped code, only
tied 1:1 to the head bulge ratio) and every skin-severity constant
(cyanosis/pallor/flush/mottled thresholds, blend amounts, and colours) as
live sliders, each showing the value actually applied at a separately
adjustable "preview age" — for dialling in numbers visually instead of
describing adjustments back and forth in chat. An "Export current values"
panel lists only the constants that differ from shipped defaults, as
paste-ready `const` lines. Values tuned here need to be manually applied to
sim_patient.html/avatar_lab.html afterward — this tool doesn't write to
them directly.

### Graph rendering

`renderGraph()` in `sim_control.html` is hand-rolled SVG (no charting
library) — fixed `viewBox` coordinate math (`xForMin`/`yFor`), with
ghost-line overlays for "no treatment" baseline and "plan before the last
change." If extending it, follow the existing layering order (grid →
rhythm markers → ghosts → main paths → hit-paths → override markers →
playhead → ...) — later layers draw on top.

### Manual editing — Add/Move/Remove tools, rebuild-from-flat-list model

Edit Mode lets the assessor hand-author overrides directly on the graph.
Arm a tile (`handleVtileClick`), then use one of three tools (icon buttons,
bottom-left of the graph, `setEditTool()`):

- **Add** — tap/drag anywhere after "now" drops a point there.
- **Move** — drags ANY existing future point (including ones from the
  scenario's original AI-generated timeline, not just manually-added
  ones) to a new value/time, and it's free to cross past a neighbouring
  point in time to reorder them — "now" is the only floor, there's no
  constraint against crossing siblings.
- **Remove** — tap a point (confirm) to delete it.

All three funnel through `handleGraphZonePointerDown()`, which branches on
`editTool`. Move/Remove locate the target point via `findNearestFuturePoint()`
— a generous-radius distance check in pixel space, not native SVG hit-testing
against a tiny circle (which was unreliable on touch — see Gotchas). Marker
circles are purely decorative (`pointer-events:none`) for exactly that
reason: without it, an inert circle silently swallows taps meant for the
invisible catcher underneath.

The underlying model: rather than upserting one entry in place, a
series' entire future is rebuilt every time from a flat, unordered
`{value, atMs}` target list (`futureTargetsFor()` reads the current one,
`rebuildSeriesArray()`/`rebuildGcsArrays()` sort it by time and re-chain
end-to-end with no gaps). This is what makes reordering — and deleting
out of the middle without leaving a gap — both just work: nothing holds
a point by reference to its neighbours, everything is recomputed from
scratch each time a point is added, moved, or removed. Releasing commits
immediately (`commitPendingPoint()`, no confirm step for Add/Move) and
leaves the tool armed for the next action.

BP arms two series at once (sys+dia sharing one tile); Add resolves a
click to whichever series is visually closer in Y at that moment
(`resolveArmedSeriesAtClick`).

This only changes the *editing interaction* — the underlying interpolation
is still the same straight-line ramp `sim_engine.js` always computed, so
what the patient's monitor displays is unaffected.

**Performance**: this whole area re-renders the entire SVG on every
pointermove while dragging, which was genuinely laggy/unresponsive on
iPad. Two mitigations: `scheduleGraphRender()` throttles renders to one
per animation frame instead of one per pointer event, and `SAMPLES` (the
per-series sample count in `renderGraph()`) drops while `pendingDrag` is
set. Separately, `sim_engine.js`'s `applyOverrides()` now caches the
sorted overrides array per array reference (WeakMap) instead of
re-sorting on every single sample — it was re-sorting the same small
array dozens of times per render, across both pages, not just while
editing.

## Open TODOs

- **Split `index.html` into `index.html` + `index.js` + `index.css`.**
  Agreed with Tim as the right next step, deliberately deferred — not
  urgent, do it when there's a reason to be in the file anyway. The file is
  ~7.6k lines of which only ~1.6k is actual markup; the rest is one inline
  `<script>` and one inline `<style>`. Extracting both to sibling files is
  the single biggest readability win left, and it's mechanical.
  **The one constraint that matters: the JS must stay a plain
  `<script src="index.js">`, NOT `type="module"`.** Every interactive
  element in the rendered assessment sheet uses inline `onclick="foo()"`
  attributes, which resolve against globals; module scope would break all
  of them at once and force a full migration to `addEventListener` across
  hundreds of dynamically-generated call sites. That's the expensive,
  risky refactor this split is specifically avoiding — keep the globals.
  Cost of the split: three files to keep in sync instead of one, plus two
  extra HTTP requests (irrelevant on Pages).
- **Corrections Log — the review path is Claude reading the table, NOT the
  admin modal. Do not "clean up" the corrections system as dead code.**
  The `openCorrectionsModal` cluster in `index.html` is currently
  unreachable (its only entry point was a link inside the Manage Custom
  Scenarios modal, superseded by `nav.js`'s `AVNav.openManageMine()` and
  removed; `nav.js` has no replacement link). That does NOT make the
  feature dead — per Tim, the intended consumer is Claude periodically
  scanning the `scenario_corrections` Supabase table directly and advising
  on site/prompt fixes it implies. The modal is just one human-facing
  viewer of that table, not the delivery mechanism.
  The write path is live and independent of it: "🚩 Flag Error"
  (`toggleFlagMode`) → per-field popover (`openCorrectionPopover`) →
  `saveCorrection()` → `scenario_corrections`.
  What makes the table genuinely analysable in aggregate: `field_key` is a
  stable enumerated key from `CORRECTABLE_FIELDS`/`SS_FIELD_LABELS`
  (`field_provisional`, `vital_GCS`, `field_ss_chest`, …), not free text —
  so repeated corrections against the same key across unrelated scenarios
  are a direct signal about `generator.html`'s prompts rather than about
  any one scenario. Each row also carries `original_value` +
  `corrected_value` + the submitter's `comment`, which is what separates
  "the AI got this wrong" (fix the prompt) from "the assessor disagreed"
  (no action). Keep that field-key stability in mind before renaming keys —
  renames silently break the historical trend.
  **Corrections are live-applied, not queued for approval.**
  `loadScenario()` patches the scenario through
  `applyCorrectionsToScenario()` before rendering, so any row with
  `status:'active'` immediately changes that scenario's content for every
  user. Writing one is gated only by `guestBlocked()` — any signed-in user,
  not just admins. `revertCorrection()` sets `status:'reverted'` but is
  reachable only from the popover on that specific scenario+field, so you
  have to already know which one is wrong.
  Open question (Tim's call, low urgency): that leaves no cross-scenario
  view of what's currently been altered. Largely covered in practice by the
  Claude-scanning path above, and low risk while accounts are limited to
  trusted users — worth revisiting if a wider cohort ever gets logins.

## Gotchas

- **Keep a casual eye out for dead code — flag it, don't hunt for it.**
  Same posture as the AV-text entry below: while working in a file for
  some other reason, notice unreferenced functions, orphaned CSS, stubs
  left behind by a superseded feature, or markup nothing renders — and
  tell Tim rather than silently leaving it or silently deleting it. Don't
  start a dedicated sweep unless asked.
  Two sweeps have already been done (Aug 2026): `index.html` and
  `generator.html`. Worth knowing what those found, because the same
  patterns are the ones to watch for elsewhere:
  - The damage isn't usually the dead code itself, it's what it *hides*.
    `buildSidebar()` was still being called from five places after its
    `#scenario-list` element was removed with the old sidebar, so every
    call threw and aborted the rest of its caller — silently killing the
    tail of `saveEditedScenario()` (the re-render and modal close) and
    both delete paths. That bug was invisible until the dead code around
    it was cleared.
  - The recurring cause is a feature being **superseded rather than
    removed** — most often by `nav.js` taking something over (the sidebar,
    Manage Scenarios, auth, theming all moved there and left duplicates
    behind in `index.html`). When you move something into `nav.js`,
    delete the old copy in the same commit.
  - Other repeat offenders: markup deleted while its JS stayed (the whole
    retired dev-notes cluster), hidden `<div style="display:none">` shim
    fields kept for code that no longer reads them, and CSS added as a new
    appended `<style>` block overriding earlier rules instead of editing
    them in place.
  **Verifying a cleanup or a pure-move refactor:** there's no test suite,
  but the renderers are deterministic, so before/after equivalence is
  directly checkable and is much stronger evidence than a screenshot.
  Serve the repo locally, drive it with Playwright (intercept the
  `1984tpearson.github.io` and supabase-js CDN requests to serve local
  copies — see the no-build-step note at the top), stub `Math.random` for
  determinism, set `localStorage.av_guest_mode='true'` to get past the
  login gate and `localStorage.av_service` to cover both packs, then diff
  `renderScenario()` / `renderSection1()` (both medical and trauma) /
  `renderSection2()` output, the home-screen DOM, the `window` global
  list, and `getComputedStyle` on a sample of selectors. For anything
  that's purely a move, all of it must come out identical — any diff at
  all is a bug, which makes reordering far safer here than "no test
  suite" suggests. Normalise the per-render random ids
  (`cpg-block-*`/`cpg-accordion-*`/`cpg-expand-*`) before diffing.

- **Service-pack de-branding from Ambulance Victoria (AV) — status and the
  IP reasoning behind what did/didn't change.** This repo was duplicated
  from the old `AV` repo specifically to shed Ambulance Victoria's
  branding/IP while keeping AV's content available as an optional,
  explicitly-loaded pack (`nav.js`'s `SERVICE_PACKS`, `'none'` vs `'av'`,
  persisted per-browser in `localStorage.av_service`). Still keep an eye
  out for leftover unconditional "AV"/"Ambulance Victoria" text while
  working nearby — don't go hunting for it — and flag anything found to
  Tim rather than silently leaving or silently fixing it.
  Three-tier IP analysis this was all built on, decided directly with Tim,
  worth not re-litigating without a reason to revisit it:
  1. **Condition/category taxonomy** (`category_pack_*.js`'s `CATEGORIES`
     etc) — NOT an IP concern. Standard, industry-wide EMS categorization
     (Cardiac Arrest / Respiratory / Trauma / etc), not a distinctive AV
     creative arrangement. Left as-is for both packs.
  2. **The verbal assessment STRUCTURE itself** (RABCDE primary survey,
     pre-arrival → primary → life threats → history → vitals → secondary
     survey → focused assessments → risk/DDx → care pathway → implement,
     the three-section division and its scoring skeleton, all in
     `index.html`) — also left identical between packs, deliberately.
     RABCDE/primary-secondary-survey sequencing is standard clinical
     practice taught broadly, not AV's invention, and a 3-section
     (assessment / diagnosis+treatment / knowledge check) split is a
     generic, low-distinctiveness way to organize any clinical
     assessment — low risk, and Tim didn't want to rebuild it without a
     real reason to. What DOES differ per pack is the AV-*sourced content*
     living inside that shared structure — see `hasAvLegalPack()` in both
     `index.html` and `generator.html`, which gates: Section 2's
     CPG-derived management-detail box/hint/Browse-CPGs button (generic
     pack shows a plain "consult your local guidelines/protocols" row
     instead, using the same tick mechanism as every other row); the AI
     system prompts' wording (Ambulance Victoria phrasing, CPG source
     labels, the `AV CPG A0108` flags reference); and Section 3 knowledge
     questions (AV pack: exactly 3, `cpgCode`-tagged; generic pack: 5,
     untagged, explicitly told to avoid paramedic-specific phrasing since
     Tim wants the generic content usable for nursing/medical training
     too — narrower per-profession targeting deferred to future packs).
  3. **The CPG clinical content itself** (`cpg_pack_av.js` — verbatim
     Ambulance Victoria ALS-MICA guideline text, see that file's own
     header) — clearly AV's IP, and per Tim: genuinely less central to
     what the tool does over time anyway, more a "here's what the site
     thinks should apply, you as assessor decide if that's right" aid
     than the core mechanism. `cpg_pack_none.js`/`category_pack_none.js`
     are the generic pack's equivalent, but NOT symmetrically placeholder
     — `category_pack_none.js`'s taxonomy (CATEGORIES/CATEGORY_TO_CPG/
     COND_TO_CPG_KEY/CPG_SUBTYPE_LABELS) is a full, deliberate copy of
     `category_pack_av.js`'s, same ~69-condition breadth, because the
     condition list itself is standard industry categorization, not AV's
     IP (see tier 1 above) — no reason for the generic pack to offer a
     reduced picker. `cpg_pack_none.js`'s actual clinical CONTENT is the
     part that's still a genuine placeholder (currently only 6 of those
     ~69 keys have an entry) — explicitly NOT copied/derived from AV's
     text (that would remove the very attribution that makes AV's own
     content reproduction defensible, not just relabel it), ordinary
     general clinical knowledge in plain wording, marked in its own
     header as a placeholder Tim intends to properly fill out over time.
     A condition selected in the generic pack that doesn't have a
     matching `cpg_pack_none.js` entry yet just falls back to the AI's
     general knowledge at generation time (`buildCPGContext` returns
     empty for it) rather than injected CPG text — not broken, just less
     tightly grounded until more entries get written.
  Also worth knowing: `cpg_editor.html` always loads/patches
  `cpg_pack_av.js`/`category_pack_av.js` directly, never through
  `cpg_pack_loader.js` — it's an authoring tool for the real AV content
  specifically, so its own AI prompts staying AV-worded is correct, not a
  leftover to fix.
  Architecture note for whoever adds a second real service pack later:
  the generic pack was built as the *same* assessment-view template/
  renderer with pack-supplied content swapped in (branching on
  `hasAvLegalPack()`/`AVNav.getServicePack()`), not a genuinely pluggable
  per-pack renderer — deliberate, to avoid over-engineering a plugin
  system before a second pack actually exists that needs a different
  section skeleton. If that day comes, the `hasAvLegalPack()` branches are
  the seams to generalize into a real per-pack renderer choice.
- **Backticks inside a prompt string break the JS parse.** The AI system
  prompts are themselves JS template literals (backtick-delimited) — never
  use `` ` `` for markdown-style emphasis inside that text (use single
  quotes instead). Always run a syntax check after editing a prompt block:
  `python3 -c "import re; ..."` to extract `<script>` contents, then
  `node --check`.
- No test suite. Verify changes by extracting/checking JS syntax and, for
  UI changes, a local `http.server` + Playwright screenshot (remote
  `1984tpearson.github.io` script/asset URLs need request interception to
  serve local copies when testing offline).
- **A decorative SVG element without `pointer-events:none` silently
  swallows clicks meant for whatever's underneath it** — it doesn't need
  an `onclick`/`onpointerdown` to intercept the event, just to exist on
  top in z-order. Bit the graph's marker circles once already (drawn
  after the invisible catcher rect, with no handlers, no `pointer-events`
  override — any tap landing on one did nothing instead of reaching the
  catcher). Anything added to `renderGraph()`'s output purely for display
  needs `pointer-events:none` if it can overlap an interactive layer
  drawn earlier.
- `renderGraph()`-local closures (`xForMin`, `yFor`) are NOT the same
  functions as the standalone `minForX`/`valForY`/`xForMinVal`/`yForVal`
  outside it, despite near-identical names/math — code called from
  outside a render pass (hit-testing, tool logic) must use the standalone
  versions (which read `_lastLayout`), not assume the local ones are in
  scope. Mixing them up is a silent `ReferenceError` at the call site.
- **Always push finished work to `main` directly** (rebase onto latest
  `main` if it moved, then fast-forward) — do not stop at a feature/`claude/*`
  branch and wait to be told to merge, and do not open a PR. This is a solo
  project with no review step; a branch sitting unmerged means GitHub Pages
  never redeploys, which defeats the point. Only skip this — stay on a
  branch, or open a PR — if explicitly told to for that task.
- **`max-height:<percent>` on an element inside a flex column compounds with
  the container's own flex-shrink, instead of just capping it once.** Bit
  `sim_patient.html`'s avatar: its containing block (`#head-wrap`, sized
  by content) has no explicit height, so the percentage resolves against
  whatever *already-shrunk* height the flex algorithm just gave it — every
  time something elsewhere in the column grows (e.g. the voice-modal panel
  taking more vertical space), the avatar shrinks by 45% of an already-
  reduced box, not 45% of the original one, compounding on every layout
  pass. `#patient-graphic img { max-width:100%; max-height:100%; object-fit:
  contain; }` doesn't have this problem — `object-fit:contain` scales
  exactly once against whatever final box the flex layout settles on. Any
  new image/SVG dropped into a flex column here should use that pattern,
  not an ad hoc percentage.
- **A flex item's default `min-height`/`min-width` is `auto`, which resolves
  to its own content size — not 0 — and silently wins over `max-height`/
  `max-width` when they conflict.** Bit `#head-wrap` when the avatar's SVG
  grew from a small hand-drawn placeholder to real artwork sized to its full
  viewBox: `max-height:100%` looked like it should cap the element, but the
  browser was still enforcing an implicit minimum equal to the SVG's
  intrinsic height (from its `width`/`height` attributes) — so instead of
  shrinking, `#head-wrap` refused to shrink and got pushed out of its
  `overflow:hidden` container by `#patient-graphic`'s `justify-content:
  center` (the *top* of the face — eyes, eyebrows — went missing, since
  centering overflow clips symmetrically and head-wrap is the first child).
  Setting `min-height:0` fixes the clip but can overcorrect the other way —
  once nothing protects it, `#head-wrap` can lose ALL the flex-shrink
  contest to sibling elements with their own intact auto-minimums (here,
  `#voice-fab-strip` has `flex-shrink:0`, so all the pressure landed on
  `#head-wrap` alone and it collapsed toward 0). The actual fix is a small
  explicit floor — `min-height:50px; min-width:50px;` — small enough to let
  real shrinking happen under space pressure, non-zero so the avatar can't
  fully disappear. Any element sized from an SVG/image's own intrinsic
  dimensions inside a shrinking flex container needs an explicit min-size;
  never assume `max-*` alone is enough.
