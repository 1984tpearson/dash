-- Spontaneous/unprompted patient speech: a small AI-authored bank of
-- in-character lines the patient may say unprompted (not answering a
-- question), tagged with the distressLevel band (0-3, see
-- SimEngine.getAppearanceState) each line fits. See CLAUDE.md's "Spontaneous
-- speech" section.
--
-- scenario_sim_timelines.spontaneous_lines: the initial bank, generated once
-- alongside the untreated baseline trajectory (generateSimTimeline) and
-- cached per-scenario like timeline_overrides already is.
--
-- sim_sessions.spontaneous_lines: the session's own live copy, seeded from
-- the cached scenario bank at createSession(), then wholesale-replaced (not
-- merged) by regenerateTimelineAfterTreatment/regenerateTimelineForScriptedEvent
-- whenever the AI decides the new clinical state changes what the patient
-- would spontaneously say — same "only touch it if the AI actually returned
-- something new" rule the vitals overrides splice already follows, so an
-- ordinary treatment with no bearing on spontaneous speech leaves the
-- existing bank untouched rather than wiping it.
alter table sim_sessions add column if not exists spontaneous_lines jsonb not null default '[]'::jsonb;
alter table scenario_sim_timelines add column if not exists spontaneous_lines jsonb not null default '[]'::jsonb;
