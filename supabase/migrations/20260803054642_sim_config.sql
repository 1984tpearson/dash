-- sim_config: backend store for the sim-tuning admin editor
-- (sim_config_admin.html / sim_config_schema.js). One row per admin-UI
-- "section" (medications, defib, timers, graph, severity, avatar, voice),
-- each holding that section's full field set as one JSON blob — sim_control
-- .html / sim_patient.html fetch this once at page load and merge it over
-- their own hardcoded defaults (see loadSimConfig() in both files).
--
-- RLS posture matches the rest of this training tool (see CLAUDE.md: "anon
-- key is hardcoded client-side, this is a training tool not a security
-- boundary") — public read (both the assessor and patient pages fetch
-- anonymously) and open write (write access is gated client-side via
-- isAdmin() in sim_config_admin.html, same as this repo's other admin
-- surfaces, e.g. cpg_editor.html).
create table if not exists sim_config (
  section_key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table sim_config enable row level security;

create policy "sim_config public read" on sim_config
  for select using (true);

create policy "sim_config public insert" on sim_config
  for insert with check (true);

create policy "sim_config public update" on sim_config
  for update using (true);
