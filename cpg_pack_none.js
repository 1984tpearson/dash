/**
 * dash — Generic Default CPG Package Data (PLACEHOLDER)
 *
 * This is the "none" service pack's clinical content — what the base app
 * ships with when no real-world service's guidelines have been loaded.
 * It is NOT sourced from, adapted from, or a substitute for any real
 * clinical practice guideline document. It's ordinary, widely-known
 * paramedic/EMS clinical knowledge, written in plain generic terms, just
 * enough breadth to keep scenario generation functional out of the box.
 *
 * THIS IS A PLACEHOLDER, not a finished generic dataset — currently only
 * six of the ~69 conditions category_pack_none.js's taxonomy covers have
 * an entry here (the rest fall back to the AI's general knowledge at
 * generation time — see category_pack_none.js's own header). Tim intends
 * to properly fill this out over time; don't treat the current count as
 * the intended end state, and don't hold it to the same accuracy bar as
 * cpg_pack_av.js — that file's content must stay verbatim from its real
 * source; this one is general knowledge and can be freely edited/
 * expanded by hand, key-by-key, matching cpg_pack_av.js's key names so
 * category_pack_none.js's mapping (shared with the AV pack) keeps
 * resolving correctly regardless of which pack is active.
 *
 * Same shape as cpg_pack_av.js (CPG_PACKAGES keyed object: cpg, title,
 * careObjectives, management, management_mica, notes) so nothing that
 * reads CPG_PACKAGES needs to know which pack is active. management_mica
 * is always [] here — this generic pack has no advanced/ALS-vs-MICA scope
 * split concept, everything is a single management list.
 *
 * Loaded together with category_pack_none.js by cpg_pack_loader.js — see
 * that file's header for why these two always load as a pair.
 */

const CPG_PACKAGES = {
  cardiac_arrest_medical: {
    cpg: "GEN-CA1",
    title: "Medical Cardiac Arrest",
    careObjectives: [
      "Recognise cardiac arrest promptly and begin high-quality CPR without delay",
      "Defibrillate a shockable rhythm as early as possible",
      "Identify and treat reversible causes where practical"
    ],
    management: [
      "Confirm unresponsive, not breathing normally, no pulse — start CPR immediately",
      "Attach a defibrillator/monitor as soon as available; follow its rhythm analysis",
      "Continuous chest compressions with minimal interruption; rotate compressors regularly to avoid fatigue",
      "Shockable rhythm (VF/pulseless VT): defibrillate, resume CPR immediately after each shock",
      "Non-shockable rhythm (asystole/PEA): continue CPR, reassess rhythm every 2 minutes",
      "Secure airway and provide ventilation once available; avoid interrupting compressions to do so",
      "Consider and treat reversible causes (hypoxia, hypovolaemia, hypo/hyperkalaemia, hypothermia, tension pneumothorax, tamponade, toxins, thrombosis)"
    ],
    management_mica: [],
    notes: "Generic placeholder entry — core cardiac arrest management common to virtually all EMS systems, not sourced from any specific service's guideline document."
  },
  acs: {
    cpg: "GEN-CD1",
    title: "Chest Pain / Suspected ACS",
    careObjectives: [
      "Identify chest pain that may represent acute coronary syndrome",
      "Provide symptomatic relief and prevent deterioration",
      "Transport promptly to an appropriate facility"
    ],
    management: [
      "12-lead ECG as early as possible; repeat if pain changes or deteriorates",
      "Aspirin (if no contraindication) as early as possible",
      "GTN for ongoing pain if systolic BP adequate and no contraindication",
      "Analgesia (e.g. opioid) if pain persists despite GTN",
      "Oxygen only if hypoxaemic — avoid routine high-flow oxygen in a normally-saturated patient",
      "Continuous ECG/vitals monitoring; be prepared for arrhythmia or deterioration"
    ],
    management_mica: [],
    notes: "Generic placeholder — general ACS first-response principles, not a specific service's protocol."
  },
  asthma: {
    cpg: "GEN-RE1",
    title: "Asthma",
    careObjectives: [
      "Relieve bronchospasm and hypoxia",
      "Recognise and escalate severe/life-threatening presentations early"
    ],
    management: [
      "Salbutamol via spacer or nebuliser, repeated as needed",
      "Ipratropium bromide added for moderate-severe presentations",
      "Oxygen titrated to maintain adequate saturation",
      "Sit the patient upright, calm and reassure — anxiety worsens bronchospasm",
      "Consider corticosteroid administration per local protocol for moderate-severe cases",
      "Life-threatening features (silent chest, exhaustion, altered consciousness, cyanosis) — treat as critical, prepare for ventilatory support"
    ],
    management_mica: [],
    notes: "Generic placeholder — standard asthma first-response principles."
  },
  anaphylaxis: {
    cpg: "GEN-ME1",
    title: "Anaphylaxis",
    careObjectives: [
      "Recognise anaphylaxis promptly",
      "Give IM adrenaline without delay — the single most important intervention",
      "Support airway, breathing and circulation"
    ],
    management: [
      "IM adrenaline into the outer mid-thigh, repeated every 5 minutes if no improvement",
      "Remove the trigger if identifiable and safe to do so",
      "High-flow oxygen",
      "Lay patient flat with legs raised unless respiratory distress makes this intolerable",
      "IV fluids for hypotension",
      "Monitor closely for biphasic reaction — do not discharge/downgrade care early"
    ],
    management_mica: [],
    notes: "Generic placeholder — core anaphylaxis management, adrenaline-first, common across EMS systems."
  },
  hypoglycaemia: {
    cpg: "GEN-ME2",
    title: "Hypoglycaemia",
    careObjectives: [
      "Correct low blood glucose promptly",
      "Identify and address the underlying cause where possible"
    ],
    management: [
      "Confirm with blood glucose measurement",
      "Conscious and able to swallow safely: oral glucose/carbohydrate",
      "Reduced consciousness or unsafe swallow: IV glucose, or IM glucagon if no IV access",
      "Recheck blood glucose after treatment; repeat as needed",
      "Encourage a follow-up meal/snack once alert to prevent recurrence"
    ],
    management_mica: [],
    notes: "Generic placeholder — standard hypoglycaemia correction sequence."
  },
  seizures: {
    cpg: "GEN-ME3",
    title: "Seizures / Status Epilepticus",
    careObjectives: [
      "Protect the patient from injury during the seizure",
      "Terminate prolonged/ongoing seizure activity",
      "Identify reversible causes (e.g. hypoglycaemia)"
    ],
    management: [
      "Protect from injury; do not restrain or put anything in the mouth",
      "Check blood glucose — treat hypoglycaemia if present",
      "Benzodiazepine (e.g. midazolam) for a seizure lasting beyond a few minutes or repeated seizures without recovery",
      "Airway and oxygen support as needed, especially post-ictally",
      "Position to protect airway once seizure activity stops",
      "Consider and manage other reversible causes where identifiable"
    ],
    management_mica: [],
    notes: "Generic placeholder — general seizure first-response principles."
  },
  major_trauma: {
    cpg: "GEN-TR1",
    title: "Major Trauma",
    careObjectives: [
      "Rapidly identify and control life threats",
      "Minimise scene time for time-critical trauma",
      "Transport to an appropriate trauma-capable facility"
    ],
    management: [
      "Rapid primary survey — control catastrophic haemorrhage first",
      "Airway management with cervical spine precautions where indicated",
      "Support breathing and treat life-threatening chest injuries (e.g. tension pneumothorax) as found",
      "Control external haemorrhage (direct pressure, tourniquet if indicated)",
      "IV access and fluid resuscitation guided by clinical status, avoiding over-resuscitation",
      "Full secondary survey once life threats are addressed and transport is underway",
      "Minimise on-scene time for time-critical patients — treat en route where practical"
    ],
    management_mica: [],
    notes: "Generic placeholder — general major trauma first-response sequence, not a specific service's protocol."
  }
};
