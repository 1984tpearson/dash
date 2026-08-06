/**
 * AV Scenario Trainer — CPG Packages
 * Source: Ambulance Victoria ALS-MICA Clinical Practice Guidelines v3.13.1 (December 2025)
 *
 * ============================================================
 * ⚠️  CRITICAL WARNING — READ BEFORE MODIFYING THIS FILE ⚠️
 * ============================================================
 *
 * The fields careObjectives, management, and management_mica are PROTECTED.
 * Their content must be VERBATIM from the AV CPG source document only.
 *
 * DO NOT:
 *   - Add management steps not present in the CPG
 *   - Infer, summarise, or paraphrase clinical content
 *   - Add drug doses, drug names, or clinical rules from memory
 *   - Modify these fields without Tim's explicit instruction
 *
 * EXAMPLE OF THE KIND OF ERROR TO AVOID:
 *   A previous version added a thiamine administration step inferred from
 *   a Wernicke's encephalopathy differential — this was NOT in the CPG.
 *   This type of error is clinically dangerous.
 *
 * The 'notes' field is the ONLY field that may contain non-verbatim content.
 * It is used for AI scenario generation context only and is never displayed.
 *
 * If you are asked to update clinical content, ask Tim to confirm before proceeding.
 * ============================================================
 *
 * Structure:
 *   careObjectives  — verbatim from CPG "Care Objectives" section
 *   management      — ALS-scope steps, verbatim, flat string array
 *   management_mica — MICA-only steps, verbatim, flat string array
 *   notes           — optional AI context only, non-displayed
 *
 * ALS/MICA split rules:
 *   - ALS-scope steps (including "consult for X") → management
 *   - MICA-only steps (infusions, intubation, BiPAP/NIV detail, vasopressors,
 *     finger thoracostomy, thrombolysis, RSI drugs) → management_mica
 *   - Steps appear in one array only, never both
 */

// =============================================================
// ADULT CPGs — A SERIES
// =============================================================

const CPG_PACKAGES = {

  // -----------------------------------------------------------
  // A0001 Oxygen Therapy
  // -----------------------------------------------------------
  oxygen_therapy: {
    cpg: "A0001",
    title: "Oxygen Therapy",
    careObjectives: [
      "Provide oxygen therapy for patients with hypoxaemia or critical illness as required",
      "Provide targeted oxygen therapy to avoid harms associated with excessive oxygen administration",
      "Provide continuous high flow oxygen regardless of SpO\u2082 for management of specific conditions where required"
    ],
    management: [
      "Oxygen is a treatment specifically for hypoxaemia and has no impact on the sensation of breathlessness in patients without hypoxaemia",
      "Administer oxygen to achieve the target SpO\u2082 while continuously monitoring for changes in condition",
      "Oxygen should not be administered unless indicated as it may be harmful",
      "Target SpO\u2082 92\u201396% (most patients)",
      "Target SpO\u2082 88\u201392% if risk of hypercapnic respiratory failure: COPD, neuromuscular disorders, cystic fibrosis, bronchiectasis, severe kyphoscoliosis, obesity, any patient prescribed home BiPAP",
      "Prioritise administering oxygen before assessing SpO\u2082 in acutely breathless or critically ill patients \u2014 titrate to target once stable",
      "If pulse oximetry unavailable or unreliable: 2\u20136 L/min via nasal cannulae, or 15 L/min via NRB mask if severe hypoxaemia suspected",
      "Standard nasal cannulae: FiO\u2082 0.24\u20130.44 at 1\u20136 L/min",
      "Non-rebreather mask: FiO\u2082 0.6\u20130.9 at 10\u201315 L/min. Do not use at flow rates < 10 L/min (CO\u2082 retention risk)",
      "Position conscious patient upright if possible",
      "Severe hypoxaemia / critical illness (cardiac arrest, major trauma, shock, severe sepsis, anaphylaxis): administer high flow oxygen regardless of hypercapnic failure risk; titrate once haemodynamically stable and reliable SpO\u2082 obtained",
      "Maintain oxygen therapy regardless of SpO\u2082 in: suspected toxic gas inhalation (CO, cyanide, house fires), cluster headache (patient confirms diagnosis), decompression illness, sickle cell acute crisis",
      "Paraquat poisoning: target SpO\u2082 85\u201388% (oxygen potentiates lung injury)"
    ],
    management_mica: [],
    notes: "Core supportive CPG applied across almost all clinical scenarios. Key teaching points: avoid hyperoxia, hypercapnic failure risk in COPD/chronic lung disease, high flow unrestricted in critical illness."
  },

  // -----------------------------------------------------------
  // A0201-1 Medical Cardiac Arrest
  // -----------------------------------------------------------
  cardiac_arrest_medical: {
    cpg: "A0201-1",
    title: "Medical Cardiac Arrest",
    careObjectives: [
      "High quality chest compressions with minimal interruptions.",
      "Rapid defibrillation of VF / pulseless VT (if in doubt, shock).",
      "Advanced care (e.g. adrenaline, antiarrhythmics, intubation) where it does not interrupt high-quality compressions / defibrillation.",
      "Address correctable causes where possible."
    ],
    management: [
      { type: "note", items: ["Unconscious and pulseless OR unsure of the presence of a pulse in the setting of gasping / agonal respirations", "If history, mechanism or injuries suggest traumatic cause of cardiac arrest — manage as per CPG A0201-2 Traumatic Cardiac Arrest"] },
      { type: "stop", text: "HP-CPR: High quality compressions / minimise interruptions. Charge defibrillator during chest compressions. On-screen interpretation in manual mode. Pulse checks only for potentially perfusing rhythms." },
      { type: "header", text: "VF / Pulseless VT \u2014 Prioritise HP-CPR and timely defibrillation" },
      { type: "action", text: "Defibrillate 200 J" },
      { type: "action", text: "Immediately recommence chest compressions \u2014 2-minute cycle finishes" },
      { type: "action", text: "Amiodarone 300 mg IV if VF / VT after 3rd shock" },
      { type: "action", text: "Lidocaine 100 mg IV if VF / VT after 5th shock" },
      { type: "action", text: "Amiodarone 150 mg IV if VF / VT after 7th shock" },
      { type: "action", text: "Lidocaine 50 mg IV if VF / VT after 9th shock" },
      { type: "header", text: "Asystole / PEA \u2014 Prioritise HP-CPR" },
      { type: "action", text: "Disarm" },
      { type: "action", text: "Immediately recommence chest compressions" },
      { type: "note", items: ["PEA: Consider reversible causes \u2014 Hypovolaemia, Hypoxia, Hyperkalaemia, Hypothermia, Anaphylaxis, Asthma, Upper airway obstruction, Tension pneumothorax, Pulmonary embolism, Toxins"] },
      { type: "header", text: "All cardiac arrest patients" },
      { type: "action", text: "SGA (CPR ratio 15:1 post insertion)" },
      { type: "action", text: "IV access / Normal saline TKVO" },
      { type: "action", text: "Adrenaline 1 mg IV repeat every 2nd cycle (every 4 minutes) \u2014 Shockable: after 2nd shock; Non-shockable: as soon as resources permit" },
      { type: "action", text: "Flush all medications with 20\u201330 mL Normal saline" },
      { type: "action", text: "ETCO\u2082 and OG tube through SGA (where time permits)" },
      { type: "mica", text: "ETT if placement can be achieved with NO additional pause in compressions; early ETT if copious vomitus or SGA failure" },
      { type: "header", text: "Special circumstances" },
      { type: "subheader", text: "Hypovolaemia / anaphylaxis / asthma:" },
      { type: "action", text: "Normal saline 1000\u20132000 mL IV" },
      { type: "subheader", text: "Witnessed arrest and known or strongly suspected PE:" },
      { type: "mica", text: "Thrombolysis following consultation with AV Medical Advisor and if sufficient resources are available to continue HP-CPR uninterrupted" },
      { type: "subheader", text: "Interfering CPR-induced consciousness:" },
      { type: "mica", text: "Ketamine 50\u2013100 mg IV every 1\u20132 minutes (no max. dose)" },
      { type: "mica", text: "Ketamine 200 mg IM if no IV access (single dose)" },
      { type: "mica", text: "Consider Rocuronium 150 mg IV following at least 1.5 mg/kg Ketamine, if required to facilitate intubation" },
      { type: "subheader", text: "Hyperkalaemia or significant crush injury:" },
      { type: "action", text: "Calcium gluconate 10% 6.6 mmol (3g) IV (slow push)" },
      { type: "action", text: "Sodium bicarbonate 8.4% 100 mL IV" },
      { type: "subheader", text: "TCA toxicity:" },
      { type: "action", text: "Sodium bicarbonate 8.4% 100 mL IV" },
      { type: "subheader", text: "Calcium channel blocker toxicity:" },
      { type: "action", text: "Calcium gluconate 10% 6.6 mmol (3g) IV (slow push)" }
    ],
    notes: "HP-CPR is the priority. Defib 200 J. Adrenaline every 2nd cycle. Double the interval for adrenaline, amiodarone and lidocaine doses if ROSC is unlikely."
  },

  // -----------------------------------------------------------
  // A0201-2 Traumatic Cardiac Arrest
  // -----------------------------------------------------------
  cardiac_arrest_traumatic: {
    cpg: "A0201-2",
    title: "Traumatic Cardiac Arrest",
    careObjectives: [
      "Major haemorrhage control over all other interventions.",
      "Management of correctable causes in order of clinical need: hypoxia, tension pneumothorax, hypovolaemia.",
      "Standard cardiac arrest management concurrent to addressing correctable causes (if resources permit)."
    ],
    management: [
      { type: "stop", text: "Major haemorrhage control" },
      { type: "action", text: "Attach pads / interpret rhythm" },
      { type: "subheader", text: "Penetrating truncal trauma with PEA:" },
      { type: "action", text: "Immediate transport and early notification if MTS within 20 minutes from loss of vital signs" },
      { type: "header", text: "Airway" },
      { type: "action", text: "Airway manoeuvres and positioning" },
      { type: "action", text: "SGA" },
      { type: "mica", text: "ETT" },
      { type: "mica", text: "Cricothyroidotomy if trauma prevents other airway Mx" },
      { type: "header", text: "Breathing" },
      { type: "action", text: "Ventilation" },
      { type: "action", text: "Needle thoracostomy bilateral" },
      { type: "mica", text: "Finger thoracostomy bilateral (if credentialled)" },
      { type: "header", text: "Circulation" },
      { type: "action", text: "Normal Saline 2 L IV" },
      { type: "action", text: "Pelvic splint" },
      { type: "mica", text: "PRBCs in preference to normal saline if available (no max dose)" },
      { type: "header", text: "Other cardiac arrest care" },
      { type: "action", text: "Mx as per CPG A0201-1 Medical Cardiac Arrest (in parallel to the above if resources permit)" },
      { type: "mica", text: "Consider ultrasound (if credentialled)" },
      { type: "header", text: "Special circumstances" },
      { type: "subheader", text: "Severe crush injury:" },
      { type: "action", text: "Calcium gluconate 10% 6.6 mmol (3g) IV (slow push)" },
      { type: "action", text: "Sodium bicarbonate 8.4% 100 mL IV" }
    ],
    notes: "Haemorrhage control first. Bilateral needle thoracostomy. Address reversible traumatic causes. Standard arrest Mx runs in parallel."
  },

  // -----------------------------------------------------------
  // A0202 ROSC Management
  // -----------------------------------------------------------
  rosc_management: {
    cpg: "A0202",
    title: "ROSC Management",
    careObjectives: [
      "Optimise oxygenation and perfusion following return of spontaneous circulation.",
      "Identify and manage post-cardiac arrest complications.",
      "Determine appropriate transport destination."
    ],
    management: [
      { type: "note", items: ["Post cardiac arrest \u2014 Return of spontaneous circulation (ROSC)"] },
      { type: "header", text: "Unintubated \u2014 GCS < 10 post ROSC" },
      { type: "mica", text: "Collapse to ROSC > 10 minutes: RSI as per CPG A0302 Endotracheal Intubation" },
      { type: "mica", text: "Collapse to ROSC < 10 minutes: RSI as per CPG A0302 Endotracheal Intubation if coma persists despite initial oxygenation and perfusion Mx" },
      { type: "mica", text: "Target ETCO\u2082 30\u201340 mmHg" },
      { type: "header", text: "Perfusion Mx" },
      { type: "action", text: "Titrate Adrenaline and Normal Saline as per CPG A0407 Inadequate Perfusion (Cardiogenic causes): Target SBP 100 mmHg; Max total Normal Saline 20 mL/kg during arrest and post ROSC; Max Adrenaline infusion rate 250 mcg/min" },
      { type: "action", text: "Accurately assess pulse during moving/loading to ensure output maintained throughout" },
      { type: "action", text: "Mx as per appropriate CPG if condition changes" },
      { type: "stop", text: "Do not administer Amiodarone unless breakthrough VF/VT occurs" },
      { type: "header", text: "Consider PHT" },
      { type: "action", text: "12 lead ECG" },
      { type: "action", text: "Consider PHT as per CPG A0408 STEMI management" },
      { type: "header", text: "Transport" },
      { type: "action", text: "VF/VT arrest OR suspected cardiac cause OR post PHT: Transport to 24 hour PCI facility where available; consider AAV vs time to closest hospital" },
      { type: "action", text: "Suspected non-cardiac cause: Transport to the closest appropriate hospital with notification" }
    ],
    notes: "No amiodarone post-ROSC unless breakthrough VF/VT. Target SBP 100 mmHg. PCI facility for cardiac cause."
  },

  // -----------------------------------------------------------
  // A0203-1 Withholding or Ceasing Resuscitation
  // -----------------------------------------------------------
  withholding_resuscitation: {
    cpg: "A0203-1",
    title: "Withholding or Ceasing Resuscitation",
    careObjectives: [
      "Identify patients who will not benefit from resuscitation or where there is a legal requirement to withhold resuscitation.",
      "Provide guidance for the cessation of resuscitation following an unsuccessful resuscitation attempt."
    ],
    management: [
      { type: "header", text: "Withhold resuscitation if:" },
      { type: "stop", text: "Obvious death: injuries incompatible with life, rigor mortis, postmortem lividity, putrefaction / decomposition, death declared by a doctor who is or was at the scene" },
      { type: "stop", text: "Goals of care preclude resuscitation: resuscitation not consistent with patient\u2019s wishes as indicated by Advance Care Directive or Medical Treatment Decision Maker" },
      { type: "header", text: "Prolonged cardiac arrest \u2014 Withhold if:" },
      { type: "subheader", text: "Medical:" },
      { type: "stop", text: "Initial presenting rhythm is asystole or agonal (HR < 20) UNLESS: bystander witnessed collapse within 10 minutes of AV arrival, OR paramedic witnessed arrest, OR received defibrillation prior to ambulance arrival" },
      { type: "subheader", text: "Trauma:" },
      { type: "stop", text: "Arrest not witnessed by paramedics AND initial presenting rhythm is asystole or agonal (HR < 20)" },
      { type: "header", text: "Expected death \u2014 Withhold if:" },
      { type: "stop", text: "Death was expected due to the progression of a specific, advanced incurable disease" },
      { type: "header", text: "If withholding resuscitation:" },
      { type: "action", text: "Withhold resuscitation (if unable to immediately confirm details, commence resuscitation while continuing to gather information)" },
      { type: "action", text: "Consult the AV Clinician if there is any uncertainty" },
      { type: "action", text: "Confirm determinants of death and consider Verification of Death form" },
      { type: "action", text: "Provide initial bereavement support and referral if required" },
      { type: "header", text: "Cessation of resuscitation \u2014 Cease if ALL met:" },
      { type: "stop", text: "Minimum duration of ALS resuscitation provided: initial presenting rhythm shockable (VF/VT): 45 min; initial presenting rhythm non-shockable: 30 min" },
      { type: "stop", text: "AND no compelling reasons to continue including: CPR-induced consciousness, spontaneous respiratory efforts, POCUS indicates cardiac contractility (if credentialled), periods of ROSC, witnessed arrests with defibrillation prior to ambulance arrival, normal or near-normal ETCO\u2082 readings, persistent narrow complex PEA" },
      { type: "header", text: "If ceasing resuscitation:" },
      { type: "action", text: "Cease resuscitation" },
      { type: "action", text: "Confirm determinants of death and consider Verification of Death form" },
      { type: "action", text: "Provide initial bereavement support and referral if required" }
    ],
    notes: "Default is to commence resuscitation if in doubt. Consult AV Clinician if uncertain about withholding."
  },

  // -----------------------------------------------------------
  // A0301 Essential Airway Management
  // -----------------------------------------------------------
  essential_airway: {
    cpg: "A0301",
    title: "Essential Airway Management",
    careObjectives: [
      "Safe and effective maintenance of airway patency, oxygenation, and ventilation."
    ],
    management: [
      { type: "assess", items: ["Conscious state assessment", "Requirement for supportive ventilation", "Clinical trajectory"] },
      { type: "header", text: "Altered conscious state with adequate ventilation" },
      { type: "action", text: "Airway manoeuvres and positioning \u2014 if supine positioning required, place patient in neutral position, otherwise place patient in lateral position" },
      { type: "action", text: "Monitor with nasal end-tidal capnography" },
      { type: "note", items: ["If inadequate response / deterioration (e.g. hypoventilation, airway obstruction): manage as per Altered conscious state with inadequate ventilation; escalate care"] },
      { type: "header", text: "Altered conscious state with inadequate ventilation" },
      { type: "action", text: "Escalate care" },
      { type: "action", text: "Airway manoeuvres and positioning \u2014 sniffing position, triple airway manoeuvre" },
      { type: "action", text: "Ventilate (confirm with end-tidal capnography)" },
      { type: "subheader", text: "Use appropriate adjunct:" },
      { type: "action", text: "Oropharyngeal Airway AND/OR Nasopharyngeal Airway/s OR Supraglottic Airway (SGA)" },
      { type: "header", text: "Supraglottic airway" },
      { type: "stop", text: "DO NOT insert Supraglottic Airway if: intact gag reflex or resistance to insertion, strong jaw tone or trismus, suspected epiglottitis or upper airway obstruction" },
      { type: "note", items: [
        "Primary indications: unconscious patient without gag reflex; anticipated need for prolonged assisted ventilation (no obviously reversible cause of bradypnoea / hypoventilation)",
        "iGel sizes: 2.5 (25\u201335 kg, GT 12), 3.0 (30\u201360 kg, GT 12), 4.0 (50\u201390 kg, GT 12), 5.0 (90+ kg, GT 14)"
      ]}
    ],
    notes: "SGA contraindicated with intact gag, trismus, or suspected epiglottitis. Confirm ventilation with ETCO\u2082 waveform."
  },

  // -----------------------------------------------------------
  // A0302 Endotracheal Intubation
  // -----------------------------------------------------------
  endotracheal_intubation: {
    cpg: "A0302",
    title: "Endotracheal Intubation",
    careObjectives: [
      "To safely and effectively undertake endotracheal intubation in patients who cannot be managed with other airway techniques."
    ],
    management: [
      { type: "note", items: [
        "Indications: airway not patent; respiratory failure refractory to non-invasive ventilation and medical therapies; requiring ongoing assisted manual ventilation; targeted treatment required (e.g. status epilepticus, drug-induced hyperthermia, TCA toxicity, TBI, ROSC, airway burns)"
      ]},
      { type: "stop", text: "Consult AV Medical Advisor via AV Clinician for patients aged 12\u201315 years where RSI is indicated due to severe chronic medical condition (e.g. lung disease)" },
      { type: "header", text: "Patient and provider optimisation" },
      { type: "action", text: "Equipment prepared and tested \u2014 video laryngoscopy using a Macintosh blade and a bougie is the default intubation approach; ensure access to cricothyroidotomy kit" },
      { type: "action", text: "Position optimised \u2014 MILS if suspected c-spine injury; patient positioned \u2018ear to sternal notch\u2019 if MILS not required" },
      { type: "action", text: "IV / IO access safely secured \u2014 consider second IV access where possible" },
      { type: "action", text: "Perfusion optimisation \u2014 prior to intubation, prepare metaraminol and manage shock" },
      { type: "action", text: "Pre-oxygenation \u2014 BVM with at least 5 cmH\u2082O PEEP and FiO\u2082 of 1 OR BiPAP if adequate spontaneous ventilation" },
      { type: "action", text: "Team preparation \u2014 ensure adequate resources, identify team leader, brief team, allocate roles, and complete RSI Checklist" },
      { type: "header", text: "Standard RSI \u2014 all other indications" },
      { type: "mica", text: "Ketamine 2 mg/kg IV (max 200 mg)" },
      { type: "mica", text: "Rocuronium IV: < 80 kg \u2014 Rocuronium 100 mg IV; \u2265 80 kg \u2014 Rocuronium 150 mg IV" },
      { type: "header", text: "Dose-Adjusted RSI \u2014 physiologically difficult airway, increased frailty, active bleeding, shock index > 1" },
      { type: "mica", text: "Metaraminol 0.5\u20131 mg IV" },
      { type: "mica", text: "Ketamine 0.5\u20131 mg/kg IV (max 200 mg)" },
      { type: "mica", text: "Rocuronium IV: < 80 kg \u2014 Rocuronium 100 mg IV; \u2265 80 kg \u2014 Rocuronium 150 mg IV" },
      { type: "header", text: "High GCS RSI \u2014 impending airway compromise (e.g. airway burns); MFP Only: suicidal behaviour" },
      { type: "stop", text: "MICA: Consult with AV Medical Advisor before proceeding" },
      { type: "mica", text: "Manage pain as per CPG A0501-1 Pain Relief" },
      { type: "mica", text: "Ketamine 2 mg/kg IV (max 200 mg) \u2014 ensure dissociation occurs (60\u201390 seconds)" },
      { type: "mica", text: "Rocuronium IV: < 80 kg \u2014 Rocuronium 100 mg IV; \u2265 80 kg \u2014 Rocuronium 150 mg IV" },
      { type: "header", text: "Delayed Sequence Intubation \u2014 agitation and/or hypoxia preventing preoxygenation despite management" },
      { type: "mica", text: "Ketamine IV as per Standard or Dose-adjusted RSI as appropriate" },
      { type: "mica", text: "Oxygenate for 3 minutes; if patient remains indicated for intubation: Rocuronium IV: < 80 kg \u2014 100 mg IV; \u2265 80 kg \u2014 150 mg IV" },
      { type: "header", text: "Crash RSI (MFP Only) \u2014 unconscious and peri-arrest, immediate need to secure airway, airway reflexes present" },
      { type: "mica", text: "Ketamine 20\u201330 mg IV" },
      { type: "mica", text: "Rocuronium IV: < 80 kg \u2014 Rocuronium 100 mg IV; \u2265 80 kg \u2014 Rocuronium 150 mg IV" },
      { type: "header", text: "If unable to obtain Grade 1 or 2 view" },
      { type: "mica", text: "Consider \u2018head, scope, throat\u2019; problem-solve airway view using additional head lift plus any combination of: lip retraction, external laryngeal manipulation, jaw support / mouth opening" },
      { type: "mica", text: "If unable to improve view, manage as per CPG A0303 Difficult Airway Guideline" },
      { type: "header", text: "Endotracheal intubation confirmation" },
      { type: "stop", text: "Remove the ETT immediately if there is any doubt about tracheal placement and commence management as per CPG A0303 Difficult Airway Guideline" },
      { type: "mica", text: "Sight the ETT pass through the vocal cords and note length at tips" },
      { type: "mica", text: "Immediately confirm placement using monitor AND portable capnograph" },
      { type: "header", text: "Ongoing sedation +/- paralysis" },
      { type: "mica", text: "Ketamine 20\u201340 mg IV as required until infusion established" },
      { type: "mica", text: "Fentanyl / Midazolam Infusion IV (via syringe pump): Fentanyl 300 mcg and Midazolam 30 mg diluted to 30 mL with Dextrose 5% or Normal Saline (50 mL syringe); Volume: 1\u201315 mL/hr; Fentanyl dose: 10\u2013150 mcg/hr; Midazolam dose: 1\u201315 mg/hr" },
      { type: "mica", text: "Consider need for on-going paralysis: Rocuronium 100 mg IV every hour OR Rocuronium infusion 100 mg/hr IV" },
      { type: "header", text: "General post-intubation care" },
      { type: "stop", text: "If appropriate, consider pre-hospital ICU bypass" },
      { type: "mica", text: "Mechanical Ventilation as per CPG A0307" },
      { type: "mica", text: "Manage perfusion as per CPG A0705 Shock, CPG A0407 Inadequate Perfusion (Cardiogenic) or CPG A0810 Major Trauma" },
      { type: "mica", items: [
        "Position patient semi-recumbent at 30\u00b0 unless contraindicated",
        "Insert bite block",
        "Suction ETT and oropharynx as required",
        "Tape eyes",
        "Insert OG / NG tube if required",
        "Check ETT cuff pressure and ensure 20\u201330 cmH\u2082O",
        "Maintain normothermia \u2014 consider insertion of oesophageal temperature probe"
      ]}
    ],
    notes: "Video laryngoscopy with Macintosh blade and bougie is default. MILS for c-spine. Confirm ETT with waveform capnography. Remove ETT immediately if any doubt."
  },

  // -----------------------------------------------------------
  // A0303 Difficult Airway Guideline
  // -----------------------------------------------------------
  difficult_airway: {
    cpg: "A0303",
    title: "Difficult Airway Guideline",
    careObjectives: [
      "Safe oxygenation and ventilation of patients receiving endotracheal intubation.",
      "Escalation of airway interventions in response to unsuccessful attempts at securing the airway."
    ],
    management: [
      { type: "header", text: "Plan A \u2014 First attempt" },
      { type: "action", text: "OPTIMISED first attempt at intubation with standard video laryngoscopy and bougie" },
      { type: "action", text: "If Grade 3 or 4 view and clinically safe, perform \u2018Head-Scope-Throat\u2019 analysis" },
      { type: "action", text: "Confirm endotracheal placement with ETCO\u2082 waveform" },
      { type: "stop", text: "Return to safe oxygenation strategy for re-optimisation prior to progressing to Plan B" },
      { type: "header", text: "Plan B \u2014 Second attempt" },
      { type: "action", text: "OPTIMISED ALTERNATIVE second attempt at intubation" },
      { type: "action", text: "If Grade 3 or 4 view and clinically safe, perform \u2018Head-Scope-Throat\u2019 analysis" },
      { type: "action", text: "Confirm endotracheal placement with ETCO\u2082 waveform" },
      { type: "stop", text: "Verbalise: \u201cUnable to intubate, moving to rescue airway strategy\u201d" },
      { type: "header", text: "Plan C \u2014 Rescue airway" },
      { type: "action", text: "Insert SGA or BVM as alternative" },
      { type: "note", items: ["Paediatrics: Consult with AV Medical Advisor for care planning"] },
      { type: "stop", text: "Verbalise: \u201cCan\u2019t intubate, can\u2019t oxygenate, moving to surgical airway\u201d" },
      { type: "header", text: "Plan D \u2014 Surgical airway" },
      { type: "mica", text: "If patient \u2265 12 years: Surgical Cricothyroidotomy" },
      { type: "mica", text: "If patient < 12 years: Needle Cricothyroidotomy (if credentialled)" },
      { type: "action", text: "Confirm endotracheal placement with ETCO\u2082 waveform" }
    ],
    notes: "Four escalating plans A\u2013D. Verbalise transitions. Plan D is surgical airway \u2014 \u2265 12 years surgical cricothyroidotomy, < 12 years needle (if credentialled)."
  },

  // -----------------------------------------------------------
  // A0601 Asthma
  // -----------------------------------------------------------
  asthma: {
    cpg: "A0601",
    title: "Asthma",
    careObjectives: [
      "Assess severity.",
      "Bronchodilation: inhaled bronchodilators in patients with adequate ventilation; parenteral adrenaline (IM or IV) in patients without adequate ventilation.",
      "NIV or early intubation in patients with respiratory failure unresponsive to initial treatment.",
      "Magnesium for severe or life-threatening asthma.",
      "Reduce airway inflammation with systemic corticosteroids for all but the most mild presentations."
    ],
    management: [
      { type: "assess", items: ["Severity", "If patient has individual patient management plan, this should be followed", "Risk factors for severe asthma"] },
      { type: "stop", text: "Consider anaphylaxis if: sudden onset, food allergy Hx, hypotension in conscious patient, skin symptoms, no Hx of asthma" },
      { type: "header", text: "Mild \u2013 moderate" },
      { type: "note", items: ["Alert and active", "Speech: Sentences / phrases", "WOB: Increased", "HR: Normal or mild tachycardia"] },
      { type: "action", text: "Salbutamol pMDI and spacer: 4 \u2013 12 doses, repeat at 20 minute intervals as required" },
      { type: "action", text: "Dexamethasone 8 mg Oral in all but most mild cases" },
      { type: "subheader", text: "Paramedic-initiated VVED referral if:" },
      { type: "action", items: ["Dyspnoea resolved / significant improvement 10\u201320 mins following initial treatment", "Known history of asthma"] },
      { type: "action", text: "OR Transport" },
      { type: "header", text: "Severe" },
      { type: "note", items: ["Distressed / agitated", "Speech: Words", "WOB: Markedly increased", "HR: Tachycardia"] },
      { type: "action", text: "Salbutamol 5 mg nebulised every 20 minutes or more frequently as required" },
      { type: "action", text: "Ipratropium Bromide 500 mcg nebulised (single dose)" },
      { type: "action", text: "Dexamethasone 8 mg IV / IM / Oral" },
      { type: "action", text: "Request MICA" },
      { type: "action", text: "Prepare for deterioration prior to extrication (IV access, adrenaline)" },
      { type: "subheader", text: "Inadequate response (no significant response after 20 minutes):" },
      { type: "mica", text: "Magnesium Sulfate 10 mmol (2.5 g) IV infusion over 20 minutes" },
      { type: "header", text: "Life threat" },
      { type: "note", items: ["Altered conscious / drowsy / exhausted", "Speech: Unable to speak", "WOB: Maximal or poor respiratory effort", "HR: Marked tachycardia, bradycardia or deteriorating heart rate", "Skin: Cyanosis"] },
      { type: "action", text: "Salbutamol via continuous nebulisation" },
      { type: "action", text: "Ipratropium 500 mcg nebulised (single dose)" },
      { type: "action", text: "Adrenaline 500 mcg IM (1:1000) \u2014 repeat at 5 minute intervals (no max)" },
      { type: "action", text: "Request MICA" },
      { type: "action", text: "Dexamethasone 8 mg IV / IM" },
      { type: "action", text: "Prepare for deterioration prior to extrication (IV access, adrenaline)" },
      { type: "note", items: ["If no response to initial IM adrenaline, consult the AV Clinician for: Adrenaline 20 mcg IV at 2 minute intervals"] },
      { type: "mica", text: "BiPAP NIV \u2014 IPAP: 10 cmH\u2082O, EPAP: 5 cmH\u2082O, FiO\u2082: 1.0" },
      { type: "mica", text: "Salbutamol 12 doses pMDI with in-line connector every 5\u201320 minutes as required" },
      { type: "mica", text: "Magnesium Sulfate 10 mmol (2.5 g) IV infusion over 20 minutes (via second point of IV access)" },
      { type: "mica", items: [
        "If no response to initial IM adrenaline or inadequate ventilation:",
        "Adrenaline 50\u2013100 mcg IV at 2 minute intervals if peri arrest or delay to adrenaline infusion",
        "Adrenaline infusion 5\u201325 mcg/min (5\u201325 mL/hr) IV"
      ]},
      { type: "header", text: "Asthma (Unconscious)" },
      { type: "note", items: ["Unconscious / becomes unconscious with poor or no ventilation but still with cardiac output"] },
      { type: "action", text: "Ventilate if poor or no ventilation: 5\u20138 ventilations/minute, moderately high inspiratory pressure, allow for prolonged expiratory phase" },
      { type: "action", text: "Adrenaline as per CPG A0601 Asthma \u2013 Life Threat" },
      { type: "action", text: "Consider intubation if inadequate response" },
      { type: "header", text: "Asthma (Loss of Cardiac Output)" },
      { type: "stop", text: "Stop ventilations / disconnect ventilator, pause and reassess (\u2264 15 seconds)" },
      { type: "action", text: "If no ROSC, Mx as per CPG A0201 Cardiac Arrest with focus on: chest compressions, no ventilations for 1 minute, prioritise IV adrenaline (IM if any delay to IV access), Normal saline" },
      { type: "action", text: "Early intubation (if not already intubated)" }
    ],
    notes: "Consider anaphylaxis in all asthma presentations. Life threat: parenteral adrenaline. Magnesium for severe/life-threat."
  },

  // -----------------------------------------------------------
  // A0602 COPD
  // -----------------------------------------------------------
  copd: {
    cpg: "A0602",
    title: "COPD",
    careObjectives: [
      "Reduce airflow obstruction with bronchodilators.",
      "Controlled oxygen therapy if hypoxaemic to avoid risks associated with hypercapnia.",
      "Reduce inflammation with corticosteroids to improve symptoms and decrease recovery time.",
      "NIV for management of respiratory failure with inadequate response to initial treatment.",
      "Select appropriate disposition \u2014 VVED or ED."
    ],
    management: [
      { type: "assess", items: ["Respiratory status assessment \u2014 consider patient\u2019s usual baseline", "Patient\u2019s COPD Action Plan", "Comorbidities / differential diagnosis", "Goals of care"] },
      { type: "header", text: "All exacerbations of COPD" },
      { type: "action", text: "Salbutamol 4\u201312 puffs via pMDI every 1 hour as required (preferred)" },
      { type: "action", text: "OR if unable to use pMDI: Salbutamol 5 mg nebulised every 1 hour as required" },
      { type: "action", text: "Ipratropium Bromide 500 mcg nebulised every 1 hour as required (if unable to use pMDI)" },
      { type: "action", text: "Oxygen as per CPG A0001 \u2014 Target SpO\u2082 88\u201392%; limit oxygen therapy as much as possible outside target range" },
      { type: "action", text: "Dexamethasone 8 mg Oral / IV / IM" },
      { type: "header", text: "Adequate response" },
      { type: "note", items: ["Improved or progressing towards baseline respiratory status following management"] },
      { type: "action", text: "VVED referral if all criteria met: SpO\u2082 \u2265 88% on room air or home oxygen, no signs of severe exacerbation, mobilising normally for patient, adequate social support and able to cope at home" },
      { type: "action", text: "OR Transport if patient does not meet all criteria" },
      { type: "header", text: "Inadequate response / deterioration" },
      { type: "note", items: ["Minimal or no improvement in respiratory status", "Ongoing oxygen requirement"] },
      { type: "action", text: "Assess ventilation and consider management as per Severe exacerbation" },
      { type: "action", text: "Transport" },
      { type: "header", text: "Severe exacerbation" },
      { type: "note", items: [
        "Severe respiratory distress with either:",
        "Persistent or worsening hypoxia (relative to normal SpO\u2082) OR",
        "Signs of respiratory muscle fatigue (e.g. accessory muscle use, intercostal retraction, paradoxical abdominal movement, or exhaustion)"
      ]},
      { type: "action", text: "Request MICA" },
      { type: "mica", text: "CPAP NIV 7.5 cm H\u2082O \u2014 consult AV Clinician at earliest opportunity for critical care advice; consider initiating and stabilising on CPAP prior to extrication" },
      { type: "mica", text: "Consider Salbutamol 4\u201312 puffs via pMDI every 1 hour with in-line connector" },
      { type: "mica", text: "BiPAP NIV \u2014 IPAP: 10 cmH\u2082O, EPAP: 5 cmH\u2082O, FiO\u2082: 1.0" },
      { type: "mica", text: "Increase IPAP to 15 cm H\u2082O if no improvement in ventilation; EPAP remains at 5 cm H\u2082O" },
      { type: "mica", text: "Titrate FiO\u2082 to SpO\u2082 88\u201392% once treatment established and effective" },
      { type: "header", text: "Poor or no ventilation" },
      { type: "action", text: "Ventilate" },
      { type: "mica", text: "Consider ETT as per CPG A0302 Endotracheal Intubation" }
    ],
    notes: "Target SpO\u2082 88\u201392% in COPD. VVED referral if meets criteria. NIV for severe exacerbation."
  },

  // -----------------------------------------------------------
  // A0603 Upper Airway Obstruction
  // -----------------------------------------------------------
  upper_airway_obstruction: {
    cpg: "A0603",
    title: "Upper Airway Obstruction",
    careObjectives: [
      "To urgently identify and manage potential airway obstruction (where appropriate) indicated by stridor in adults."
    ],
    management: [
      { type: "stop", text: "Imminent risk of life-threatening airway obstruction \u2014 MICA MUST be requested" },
      { type: "stop", text: "Manage anaphylaxis as per CPG A0704 Anaphylaxis" },
      { type: "stop", text: "Manage choking as per CPG A0308 Choking" },
      { type: "assess", items: ["Acute or chronic", "Respiratory status"] },
      { type: "action", text: "Escalate care" },
      { type: "action", text: "Adrenaline 5 mg nebulised \u2014 consult AV Medical Advisor via AV Clinician for repeat dose if required" },
      { type: "action", text: "Dexamethasone 8 mg IV / IM" },
      { type: "subheader", text: "If known history of inducible laryngeal obstruction and unresponsive to other management:" },
      { type: "mica", text: "Consider CPAP 5 cm H\u2082O" },
      { type: "mica", text: "Consult with AV Medical Advisor via AV Clinician for further management advice" },
      { type: "subheader", text: "If severe respiratory distress:" },
      { type: "mica", text: "Consider intubation as per CPG A0302 Endotracheal Intubation" },
      { type: "mica", text: "Prepare with dual setup as per CPG A0303 Difficult Airway Guideline" }
    ],
    notes: "Stridor = emergency. MICA mandatory. Adrenaline nebulised first line. Distinguish from anaphylaxis and choking."
  },

  // -----------------------------------------------------------
  // A0604 Dyspnoea
  // -----------------------------------------------------------
  dyspnoea: {
    cpg: "A0604",
    title: "Dyspnoea",
    careObjectives: [
      "Identify and manage the underlying cause of dyspnoea."
    ],
    management: [
      { type: "note", items: ["Dyspnoea (non-traumatic)"] },
      { type: "assess", items: ["Respiratory status assessment", "History and physical exam: acute, subacute or chronic dyspnoea; other signs and symptoms; 12 Lead ECG; goals of care"] },
      { type: "stop", text: "Dyspnoea \u2014 manage as per relevant CPG: Asthma (A0601), COPD (A0602), Cardiogenic pulmonary oedema (A0406), Upper airway obstruction (A0603), Choking (A0308), Anaphylaxis (A0704), Pneumothorax (A0802), Palliative care (A0712), DKA (A0713), Pulmonary embolism (A0605), Hyperventilation as per CPG notes" }
    ],
    notes: "Dyspnoea is a symptom \u2014 direct management to the underlying cause CPG."
  },

  // -----------------------------------------------------------
  // A0605 Pulmonary Embolism
  // -----------------------------------------------------------
  pulmonary_embolism: {
    cpg: "A0605",
    title: "Pulmonary Embolism",
    careObjectives: [
      "Identify patients in whom pulmonary embolism is a likely diagnosis.",
      "Maintain adequate oxygenation and perfusion through supportive care.",
      "Provide targeted management of pulmonary embolism in the setting of cardiac arrest."
    ],
    management: [
      { type: "assess", items: ["Risk factors", "Clinical signs", "Consider differential diagnoses"] },
      { type: "header", text: "Suspected PE" },
      { type: "action", text: "Oxygen as per CPG A0001 Oxygen Therapy" },
      { type: "action", text: "Pain relief" },
      { type: "action", text: "Manage shock as per CPG A0407 Inadequate Perfusion (Cardiogenic)" },
      { type: "header", text: "Cardiac arrest with known or strongly suspected PE" },
      { type: "mica", text: "Consider consultation with AV Medical Advisor via AV Clinician for intra-arrest thrombolysis or transport with mCPR for ECMO" }
    ],
    notes: "Supportive care only in pre-arrest. Intra-arrest thrombolysis consideration is MICA with consultation."
  },

  // -----------------------------------------------------------
  // A0701 Nausea and Vomiting
  // -----------------------------------------------------------
  nausea_vomiting: {
    cpg: "A0701",
    title: "Nausea and Vomiting",
    careObjectives: [
      "Identify and treat the underlying cause.",
      "Provide symptomatic relief of nausea and vomiting.",
      "Correct dehydration where present."
    ],
    management: [
      { type: "note", items: ["Actual or potential for nausea and vomiting"] },
      { type: "assess", items: ["Nausea and vomiting, or potential spinal injury, potential eye trauma, potential motion sickness, vertigo"] },
      { type: "stop", text: "Prochlorperazine must not be given IV" },
      { type: "header", text: "Undifferentiated nausea and vomiting" },
      { type: "action", text: "Ondansetron 4 mg ODT orally \u2014 repeat 4 mg after 5\u201310 minutes if symptoms persist (max. 8 mg ODT, IV or in combination); if unable to tolerate ODT or IV is in situ, Ondansetron 8 mg IV" },
      { type: "action", text: "If known allergy or C/I to Ondansetron and \u2265 21 years: Prochlorperazine 12.5 mg IM" },
      { type: "header", text: "Vestibular nausea (motion sickness, planned aeromedical evacuation, vertigo)" },
      { type: "action", text: "If patient age \u2265 21 years: Prochlorperazine 12.5 mg IM" },
      { type: "action", text: "If patient age < 21 years: Ondansetron as per nausea and vomiting" },
      { type: "header", text: "Prophylaxis (potential spinal injuries, eye trauma)" },
      { type: "action", text: "Ondansetron as per nausea and vomiting" },
      { type: "action", text: "If known allergy or C/I to Ondansetron and \u2265 21 years: Prochlorperazine 12.5 mg IM" },
      { type: "header", text: "Dehydrated" },
      { type: "subheader", text: "Less than adequate perfusion:" },
      { type: "action", text: "Consider Normal Saline IV (max. 40 mL/kg) titrated to patient response; consult for further fluid; if consult unavailable repeat Normal Saline 20 mL/kg IV (total 60 mL/kg)" },
      { type: "subheader", text: "Adequate perfusion but significant dehydration:" },
      { type: "action", text: "Consider Normal Saline 20 mL/kg IV over 30 minutes" },
      { type: "note", items: ["VVED may be appropriate for some presentations in parallel to other management"] }
    ],
    notes: "Prochlorperazine IM only \u2014 never IV. Max Ondansetron 8 mg combined ODT/IV."
  },

  // -----------------------------------------------------------
  // A0702 Hypoglycaemia
  // -----------------------------------------------------------
  hypoglycaemia: {
    cpg: "A0702",
    title: "Hypoglycaemia",
    careObjectives: [
      "Identify and correct hypoglycaemia.",
      "Identify patients at high risk requiring transport.",
      "Address underlying cause where possible."
    ],
    management: [
      { type: "stop", text: "Consider other causes of altered conscious state. Patients at risk of adrenal insufficiency require concurrent management as per CPG A0715 Adrenal Insufficiency. Some patients may be aggressive prior to correction of hypoglycaemia." },
      { type: "header", text: "Hypoglycaemia suitable for oral intake \u2014 BGL < 4 mmol/L, responding to commands" },
      { type: "action", text: "Glucose 15 g oral \u2014 if inadequate response after 15 minutes, repeat Glucose 15 g oral once" },
      { type: "note", items: ["If nausea and/or vomiting is the only factor preventing oral intake, manage as per CPG A0701 Nausea and Vomiting and consider oral glucose prior to escalating to Glucagon or Dextrose 10%", "If inadequate response following 2 doses of oral glucose, treat as per hypoglycaemia unsuitable for oral intake"] },
      { type: "header", text: "Hypoglycaemia unsuitable for oral intake \u2014 BGL < 4 mmol/L, NOT responding to commands" },
      { type: "subheader", text: "Adult:" },
      { type: "action", text: "Dextrose 10% 15 g (150 mL) IV \u2014 if inadequate response after 10 minutes, repeat Dextrose 10% 10 g (100 mL) IV until normalisation of BGL" },
      { type: "action", text: "If unable to obtain IV access: Glucagon 1 IU IM" },
      { type: "subheader", text: "Paediatric:" },
      { type: "action", text: "Glucagon IM: < 25 kg \u2014 Glucagon 0.5 IU IM; \u2265 25 kg \u2014 Glucagon 1 IU IM; consult PIPER via AV Clinician for patients < 3 months of age" },
      { type: "action", text: "If profoundly unconscious or no response to Glucagon: Dextrose 10% 200 mg/kg (2 mL/kg) IV; Normal Saline 10 mL IV flush; repeat if inadequate response after 10 minutes" },
      { type: "header", text: "High Risk \u2014 Transport and Monitor" },
      { type: "note", items: [
        "Incomplete recovery to normal conscious state",
        "Cause of hypoglycaemia requires investigation (unknown cause, infection, intentional overdose)",
        "Required > 2 doses of IV dextrose",
        "Seizures or acute focal neurological change",
        "Pregnancy",
        "Diagnosed eating disorder",
        "Previous gastric bypass surgery"
      ]}
    ],
    notes: "High risk criteria mandate transport. Glucagon less reliable in malnourished or alcohol-dependent patients."
  },

  // -----------------------------------------------------------
  // A0713 Hyperglycaemia and Ketosis
  // -----------------------------------------------------------
  hyperglycaemia: {
    cpg: "A0713",
    title: "Hyperglycaemia and Ketosis",
    careObjectives: [
      "Identify and manage symptomatic hyperglycaemia and ketosis.",
      "Differentiate mild-moderate from severe presentation.",
      "Fluid resuscitation for severe hyperglycaemia / DKA / HHS."
    ],
    management: [
      { type: "assess", items: ["BGL \u2265 11 mmol/L OR ketones \u2265 0.6 mmol/L AND history or clinical signs of diabetes"] },
      { type: "note", items: ["Diabetic patients taking SGLT2 inhibitors may present with raised ketones but normal BGL"] },
      { type: "header", text: "Mild to moderate hyperglycaemia / ketosis" },
      { type: "note", items: ["BGL 11\u201327.8 AND/OR ketones 0.6\u20133 mmol/L AND does not meet criteria for severe hyperglycaemia"] },
      { type: "action", text: "Exclude other causes that may require emergency department care (e.g. ACS, infection / sepsis)" },
      { type: "action", text: "VVED referral" },
      { type: "header", text: "Severe hyperglycaemia / ketosis" },
      { type: "note", items: [
        "Any of: BGL > 27.8 AND/OR ketones > 3 mmol/L; less than adequate perfusion; clinical features of DKA (altered conscious state, Kussmaul breathing/tachypnoea, ketotic breath, dehydration, profound thirst, nausea/vomiting, abdominal pain); clinical features of HHS (altered conscious state, dehydration)"
      ]},
      { type: "action", text: "Cardiac monitoring and ECG" },
      { type: "action", text: "Request MICA support" },
      { type: "subheader", text: "Adult:" },
      { type: "action", text: "Normal Saline 1000\u20132000 mL IV \u2014 administer over 1 hour if BP > 90 mmHg; consult AV Medical Advisor via AV Clinician if inadequate response" },
      { type: "subheader", text: "Adult \u2014 inadequate response to IV fluid:" },
      { type: "mica", text: "Consider vasopressors as per CPG A0705 Shock" },
      { type: "subheader", text: "Paediatric:" },
      { type: "action", text: "Normal Saline 10 mL/kg IV titrated to perfusion status \u2014 consult AV Medical Advisor via AV Clinician if no response to IV fluid" },
      { type: "action", text: "Transport" }
    ],
    notes: "SGLT2 inhibitors can cause euglycaemic DKA. Severe = transport. IV fluid is mainstay of pre-hospital management."
  },

  // -----------------------------------------------------------
  // A0703 Seizures
  // -----------------------------------------------------------
  seizures: {
    cpg: "A0703",
    title: "Seizures",
    careObjectives: [
      "Airway management and oxygenation.",
      "Terminate seizure activity with benzodiazepines.",
      "Levetiracetam for refractory seizures.",
      "Identify and treat precipitating causes."
    ],
    management: [
      { type: "stop", text: "Consider other causes of altered conscious state. Some patients may be aggressive during postictal phase. If patient has individual management plan, follow it. Patients who are pregnant should be managed concurrently under CPG M0202 Pre-Eclampsia / Eclampsia." },
      { type: "header", text: "Non-Convulsive Status Epilepticus" },
      { type: "note", items: ["Seizure activity on-going for \u2265 10 minutes with altered conscious state OR multiple seizures without return to baseline consciousness"] },
      { type: "header", text: "Convulsive Status Epilepticus" },
      { type: "note", items: ["Seizure activity on-going for \u2265 5 minutes OR multiple seizures without return to baseline consciousness"] },
      { type: "action", text: "Airway manoeuvres and positioning" },
      { type: "action", text: "Oxygen" },
      { type: "action", text: "Ventilation if required" },
      { type: "action", text: "Confirm BGL" },
      { type: "action", text: "Request MICA if administering Midazolam" },
      { type: "subheader", text: "Adult:" },
      { type: "action", text: "Midazolam IM / IV \u2014 first dose should be provided IM if IV access not already established" },
      { type: "subheader", text: "Paediatric:" },
      { type: "action", text: "Midazolam IM" },
      { type: "subheader", text: "Adult \u2014 if second dose of Midazolam administered, regardless of whether seizure terminated:" },
      { type: "mica", text: "Levetiracetam Infusion 60 mg/kg (max 4500 mg) over 5 minutes once only" },
      { type: "subheader", text: "Paediatric \u2014 Midazolam IV (first dose IM if no IV access); if second dose administered:" },
      { type: "mica", text: "Levetiracetam Infusion 60 mg/kg (max 4500 mg) over 5 minutes once only" },
      { type: "header", text: "Adult / Paediatric \u2014 refractory to Midazolam and Levetiracetam" },
      { type: "mica", text: "Consider intubation as per CPG A0302 / P0301 \u2014 NCSE unlikely to require intubation unless impairment of airway or oxygenation" }
    ],
    notes: "Midazolam dose per CPG. Levetiracetam after 2nd Midazolam regardless of seizure termination. Check BGL in all seizure patients."
  },

  // -----------------------------------------------------------
  // A0704 Anaphylaxis
  // -----------------------------------------------------------
  anaphylaxis: {
    cpg: "A0704",
    title: "Anaphylaxis",
    careObjectives: [
      "Rapidly identify and treat anaphylaxis with adrenaline.",
      "All patients who receive adrenaline for anaphylaxis must be transported to hospital.",
      "Monitor for biphasic reaction."
    ],
    management: [
      { type: "stop", text: "Stop the trigger (cease infusion, remove food, wash exposed skin)" },
      { type: "stop", text: "ANY patient with anaphylaxis (including resolved or possible anaphylaxis) or any patient who has received Adrenaline for any reason MUST be transported to hospital as per CPG A0108 Clinical Flags / Patient Safety" },
      { type: "stop", text: "Patients require continuous monitoring as deterioration can occur suddenly" },
      { type: "assess", items: [
        "Anaphylaxis criteria: sudden onset (usually < 30 min or up to 4 hours) AND two or more of R.A.S.H. +/- confirmed exposure to antigen: Respiratory distress, Abdominal symptoms, Skin/mucosal symptoms, Hypotension",
        "OR isolated hypotension (SBP < 90 mmHg) following exposure to known antigen",
        "OR isolated respiratory distress following exposure to known antigen"
      ]},
      { type: "stop", text: "Do not sit or walk the patient if possible" },
      { type: "action", text: "Adrenaline 500 mcg IM (1:1,000) \u2014 repeat at 5 minute intervals as required" },
      { type: "action", text: "Request MICA if Risk Factors (see gen notes) OR not responsive to initial Adrenaline" },
      { type: "action", text: "Insert IV" },
      { type: "action", text: "O\u2082 as per CPG A0001 Oxygen Therapy (Critical Illness)" },
      { type: "subheader", text: "Inadequate response after 2 doses Adrenaline IM:" },
      { type: "mica", text: "Adrenaline infusion as per CPG A0705 Shock" }
    ],
    notes: "Transport mandatory after any adrenaline dose. Do not sit/walk patient. Adrenaline 500 mcg IM is first-line, not IV bolus."
  },

  // -----------------------------------------------------------
  // A0705 Shock
  // -----------------------------------------------------------
  shock: {
    cpg: "A0705",
    title: "Shock",
    careObjectives: [
      "Identify and treat the cause of shock.",
      "Restore adequate perfusion with fluid and vasopressors as needed.",
      "Escalate to MICA for vasopressor therapy."
    ],
    management: [
      { type: "stop", text: "Stop and consider PANDA enrolment. Use metaraminol while assessing eligibility criteria." },
      { type: "stop", text: "Consider and treat as per the relevant CPG: Adrenal Insufficiency (A0715), Anaphylaxis (A0704), Cardiogenic (A0407), Dehydration (A0701), Major Trauma (A0810), Pulmonary Embolism (A0407), Sepsis (A0729), Spinal Injury (A0804), Tension Pneumothorax (A0802)" },
      { type: "header", text: "Inadequate / extremely poor perfusion" },
      { type: "action", text: "Oxygen" },
      { type: "subheader", text: "First line:" },
      { type: "action", text: "Normal Saline 1000\u20132000 mL IV (see dose table)" },
      { type: "subheader", text: "Second line \u2014 inadequate response following approx. 500\u20131000 mL fluid OR initial profound hypotension (BP < 70):" },
      { type: "mica", text: "Metaraminol 0.5\u20131 mg IV at 2 minute intervals" },
      { type: "subheader", text: "Third line \u2014 inadequate response to 1\u20132 doses of metaraminol:" },
      { type: "mica", text: "Noradrenaline infusion: Start 5 mcg/min (5 mL/hr); Increase 5 mcg/min at 2 minute intervals; Target MAP \u2265 65 OR SBP > 100; Max 25 mcg/min" },
      { type: "subheader", text: "Fourth line \u2014 inadequate response to max. noradrenaline infusion:" },
      { type: "mica", text: "Adrenaline infusion: Start 5 mcg/min (5 mL/hr); Increase 5 mcg/min at 2 minute intervals; Target MAP \u2265 65 OR SBP > 100; Max 25 mcg/min" },
      { type: "mica", text: "If second syringe pump unavailable: Metaraminol 0.5\u20131 mg IV at 2 minute intervals" },
      { type: "mica", text: "Continue Normal Saline IV titrated to patient response" }
    ],
    notes: "Address reversible cause first. Metaraminol before infusions. PANDA trial enrolment consideration."
  },

  // -----------------------------------------------------------
  // A0711 Suspected Stroke or TIA
  // -----------------------------------------------------------
  stroke: {
    cpg: "A0711",
    title: "Suspected Stroke or TIA",
    careObjectives: [
      "Rapid identification of suspected stroke using MASS assessment.",
      "Time-critical transport to appropriate stroke centre.",
      "ECR eligibility assessment and pre-notification."
    ],
    management: [
      { type: "assess", items: [
        "Determine symptom onset time",
        "Consider stroke mimics \u2014 if unable to exclude stroke treat as per this guideline",
        "Consider co-morbidities",
        "Perform MASS Assessment (if positive < 24 hours perform ACT-FAST Assessment)",
        "Assess ECG for possible AF"
      ]},
      { type: "header", text: "MASS Positive \u2265 12 hours AND ACT-FAST Negative OR Suspected TIA" },
      { type: "action", text: "Non-urgent transport to the closest thrombolysing stroke centre" },
      { type: "header", text: "MASS Positive < 12 hours AND ACT-FAST Negative \u2014 Non-ECR eligible" },
      { type: "action", text: "IV access: 18G in large vein with reflux valve" },
      { type: "action", text: "Transport urgently to nearest thrombolysing stroke centre" },
      { type: "action", text: "Consider R/V with MSU if within response area" },
      { type: "action", text: "Pre-notify hospital with clinical details, name, and DOB" },
      { type: "header", text: "MASS Positive < 24 hours AND ACT-FAST Positive at time of loading \u2014 Possible ECR eligible" },
      { type: "action", text: "IV access: 18G in large vein with reflux valve" },
      { type: "action", text: "Consider R/V with MSU or transport urgently to ECR centre if transport time equivalent to a thrombolysing stroke centre" },
      { type: "action", text: "Rural: Transport urgently to nearest VST centre; pre-notify VST stroke physician via Clinician" },
      { type: "action", text: "Otherwise transport urgently to nearest thrombolysing stroke centre" },
      { type: "action", text: "Pre-notify hospital with clinical details, name, and DOB" },
      { type: "mica", text: "In all cases if airway concerns present consider ETT as per CPG A0302 Endotracheal Intubation" }
    ],
    notes: "MASS = Melbourne Ambulance Stroke Screen. ACT-FAST for large vessel occlusion. Onset time is critical. 18G IV with reflux valve for all transport patients."
  },

  // -----------------------------------------------------------
  // A0715 Adrenal Insufficiency
  // -----------------------------------------------------------
  adrenal_insufficiency: {
    cpg: "A0715",
    title: "Adrenal Insufficiency",
    careObjectives: [
      "Identify adrenal insufficiency / crisis.",
      "Administer hydrocortisone and fluid resuscitation.",
      "Manage precipitating cause and transport."
    ],
    management: [
      { type: "assess", items: [
        "PAI: Past history of Primary Adrenal Insufficiency (PAI) including Addison\u2019s Disease",
        "SAI: Prolonged steroid therapy at any point within the last 12 months"
      ]},
      { type: "header", text: "S/S of Adrenal Insufficiency / Crisis" },
      { type: "note", items: ["Cardiovascular: hypotension", "Neurological: altered conscious state, delirium, seizure", "Fatigue: severe weakness (e.g. inability to walk)", "Gastrointestinal: severe abdominal pain, severe vomiting/diarrhoea", "Hypoglycaemia"] },
      { type: "header", text: "Potential insufficiency (PAI only)" },
      { type: "note", items: ["History of PAI + potential psychological or physiological precipitating cause regardless of S/S: trauma incl. large deep laceration/fracture/MVA, probable infection/sepsis/febrile illness > 38.5\u00b0C, recent surgery, labour, extreme emotional stress, acute illness incl. diarrhoea and vomiting, MI, environmental exposure/hot weather"] },
      { type: "header", text: "Initial care" },
      { type: "action", text: "Hydrocortisone 100 mg IM / IV \u2014 if delay to IV access, administer IM" },
      { type: "action", text: "Normal Saline 1000 mL IV \u2014 in case of major trauma, IV fluid management as per CPG A0810 Major Trauma" },
      { type: "header", text: "Perfusion management" },
      { type: "subheader", text: "If borderline or inadequate perfusion following initial care:" },
      { type: "action", text: "Additional Normal Saline 1000 mL IV" },
      { type: "subheader", text: "Inadequate response to normal saline:" },
      { type: "mica", text: "Metaraminol, Noradrenaline, Adrenaline as per Shock (CPG A0705)" },
      { type: "header", text: "Precipitating Cause \u2014 Other care" },
      { type: "action", text: "Manage pain (CPG A0501)" },
      { type: "action", text: "Manage nausea (CPG A0701)" },
      { type: "action", text: "Manage hypoglycaemia (CPG A0702)" },
      { type: "action", text: "Transport to closest hospital preferably with ICU" }
    ],
    notes: "Hydrocortisone IM if no IV. Always transport. Concurrent hypoglycaemia management required."
  },

  // -----------------------------------------------------------
  // A0724 Hyperkalaemia
  // -----------------------------------------------------------
  hyperkalaemia: {
    cpg: "A0724",
    title: "Hyperkalaemia",
    careObjectives: [
      "Identification of patients with suspected hyperkalaemia.",
      "Stabilisation of cardiac membrane.",
      "Shift potassium intracellularly.",
      "Transport to nearest ED with ICU."
    ],
    management: [
      { type: "assess", items: [
        "Significant risk: renal failure, severe crush injury, rhabdomyolysis",
        "WITH progressive or clinically correlated ECG changes consistent with hyperkalaemia: bradycardia, peaked T waves, prolonged PR interval, absent P wave, wide QRS, \u2018Sine Wave\u2019 pattern",
        "Confirmation with point of care testing, where available"
      ]},
      { type: "action", text: "Escalate care / request MICA \u2014 consider early consultation with AV Clinician" },
      { type: "action", text: "Manage precipitating or co-existing conditions: CPG A0705 Shock, CPG A0713 Hyperglycaemia, CPG A0715 Adrenal Insufficiency" },
      { type: "note", items: ["MICA preference: adrenaline infusion over noradrenaline for shock in hyperkalaemia"] },
      { type: "header", text: "Membrane stabilisation" },
      { type: "action", text: "Calcium Gluconate 10% 2.2 mmol (1 g) IV (slow push) \u2014 repeat at 10\u201315 minute intervals whilst ECG changes persist" },
      { type: "header", text: "Shift potassium" },
      { type: "action", text: "Salbutamol 10 mg nebulised \u2014 repeat at 10\u201315 minute intervals" },
      { type: "subheader", text: "If strong suspicion of metabolic acidosis (or confirmed with point of care testing):" },
      { type: "mica", text: "Consult AV Medical Advisor via AV Clinician for Sodium Bicarbonate 8.4% 50 mL IV \u2014 infuse over 10 minutes via syringe pump" },
      { type: "header", text: "Disposition" },
      { type: "action", text: "Transport to nearest ED with ICU" },
      { type: "action", text: "If distance to ED with ICU is prohibitive, transport to nearest ED with early notification" }
    ],
    notes: "Calcium gluconate 1 g (not 3 g \u2014 that\u2019s the arrest dose). Salbutamol shifts K+ intracellularly. Transport to ICU-capable centre."
  },

  // -----------------------------------------------------------
  // A0810 Major Trauma
  // -----------------------------------------------------------
  major_trauma: {
    cpg: "A0810",
    title: "Major Trauma",
    careObjectives: [
      "Major haemorrhage control.",
      "Airway management and oxygenation.",
      "Permissive hypotension for haemorrhagic shock without TBI (SBP 70\u201390 mmHg).",
      "Higher BP target (SBP > 120) for shock with TBI.",
      "Rapid transport to definitive care."
    ],
    management: [
      { type: "stop", text: "Major haemorrhage control" },
      { type: "header", text: "Airway" },
      { type: "action", text: "Airway manoeuvres and positioning \u2014 NPA only if airway not patent; OPA if NPA unsuccessful" },
      { type: "action", text: "SGA if no gag reflex and prolonged ventilation is required" },
      { type: "mica", text: "RSI as per CPG A0302 Endotracheal Intubation if indicated" },
      { type: "mica", text: "Cricothyroidotomy if airway / facial trauma prevents oxygenation / ventilation" },
      { type: "header", text: "Breathing" },
      { type: "action", text: "Oxygen as per CPG A0001 Oxygen Therapy OR ventilate if required: Vt 6\u20138 mL/kg; Rate 12\u201316 initially and adjust to ETCO\u2082 target; SpO\u2082 > 94%; ETCO\u2082 30\u201335 mmHg" },
      { type: "action", text: "Consider chest decompression as per CPG A0802 Chest Injury" },
      { type: "header", text: "Circulation \u2014 First line" },
      { type: "action", text: "Fluid resuscitation \u2014 target SBP 70\u201390 (shock without TBI) or SBP > 120 (shock with TBI): Normal saline 250 mL IV as required (max 2 L); consult AV Medical Advisor via AV Clinician for further Mx if inadequate response" },
      { type: "action", text: "PRBC 1 unit IV in preference to normal saline if available \u2014 reassess after each unit and repeat as required (no max dose)" },
      { type: "action", text: "Pelvic splint if blunt trauma to the pelvis or for all unconscious multi-trauma patients" },
      { type: "action", text: "Consider other causes of shock: haemorrhage control, chest decompression, pelvic splint, ventilator strategy, anaphylaxis to medications" },
      { type: "header", text: "Circulation \u2014 Second line" },
      { type: "subheader", text: "TBI: inadequate response following approx. 500\u20131000 mL fluid / PRBC 1\u20132 units" },
      { type: "subheader", text: "No TBI: inadequate response following approx. 1000\u20132000 mL fluid / PRBC 2\u20134 units" },
      { type: "mica", text: "Metaraminol 0.5\u20131 mg IV at 2-minute intervals" },
      { type: "mica", text: "Continued fluid resuscitation" },
      { type: "header", text: "Circulation \u2014 Third line (inadequate response to 1\u20132 doses metaraminol)" },
      { type: "mica", text: "Noradrenaline infusion: Start 5 mcg/min (5 mL/hr); Increase 5 mcg/min at 2 minute intervals; Max 25 mcg/min" },
      { type: "header", text: "Circulation \u2014 Fourth line (inadequate response to max. noradrenaline)" },
      { type: "mica", text: "Adrenaline infusion: Start 5 mcg/min (5 mL/hr); Increase 5 mcg/min at 2 minute intervals; Max 25 mcg/min" },
      { type: "mica", text: "If second syringe pump unavailable: Metaraminol 0.5\u20131 mg IV at 2-min intervals" },
      { type: "mica", text: "Consult AV Medical Advisor via AV Clinician for further management" },
      { type: "mica", text: "Consider reducing vasopressor infusion if target BP achieved \u2014 vasopressors should be reduced prior to stopping fluid" }
    ],
    notes: "Permissive hypotension SBP 70\u201390 without TBI; SBP > 120 with TBI. PRBC preferred over saline. Max NS 2 L."
  },

  // -----------------------------------------------------------
  // A0803 Traumatic Head Injury
  // -----------------------------------------------------------
  head_injury: {
    cpg: "A0803",
    title: "Traumatic Head Injury",
    careObjectives: [
      "Moderate-Severe TBI: optimise airway patency, oxygenation, ventilation, and cerebral perfusion pressure to prevent secondary brain injury.",
      "Mild TBI / other head injuries: identify high risk (triage to neurosurgical facility), moderate risk (transport to ED for CT), low risk (refer to community with self-care advice)."
    ],
    management: [
      { type: "header", text: "High risk \u2014 Trauma time critical" },
      { type: "stop", text: "Any of: Moderate\u2013Severe TBI (GCS < 13); penetrating head injury; LOC > 5 minutes; skull fracture; vomiting more than once; neurological deficit; seizure; worsening signs and symptoms" },
      { type: "action", text: "Mx as per CPG A0810 Major Trauma: airway management; breathing \u2014 ventilation/oxygenation; circulation \u2014 avoid hypotension if moderate-severe TBI suspected; supportive care" },
      { type: "action", text: "Transport as per CPG A0105 Trauma Triage" },
      { type: "header", text: "Moderate risk" },
      { type: "note", items: [
        "Any of: altered mental status (from baseline); dangerous mechanism of injury (motor/cyclist impact > 30 km/h, high speed MCA > 60 km/h, pedestrian impact, ejection from vehicle, prolonged extrication, fall from height > 3 m, struck on head by object falling > 3 m, explosion); amnesia \u2265 30 minutes; intoxication; age \u2265 65; coagulopathy / anti-coagulant / antiplatelet (not aspirin)"
      ]},
      { type: "action", text: "Transport (CT scan or observation required)" },
      { type: "action", text: "Consider VVED if age and/or coagulopathy are the only risk factors and no other concerning features" },
      { type: "header", text: "Low risk" },
      { type: "note", items: ["No high or moderate risk criteria AND competent adult available to monitor patient for 4 hours"] },
      { type: "action", text: "Concussion symptoms: self-care, safety netting, provide health information sheet, GP follow-up (within 2\u20133 days)" },
      { type: "action", text: "No symptoms: safety netting, provide health information sheet" }
    ],
    notes: "Avoid hypotension and hypoxia in TBI. SBP target > 120 mmHg (TBI). ETCO\u2082 30\u201335 mmHg if ventilated."
  },

  // -----------------------------------------------------------
  // A0802 Chest Injury
  // -----------------------------------------------------------
  chest_injury: {
    cpg: "A0802",
    title: "Chest Injury",
    careObjectives: [
      "Adequate oxygenation.",
      "Effective pain relief to assist in maintaining adequate ventilation.",
      "Early identification and management of tension pneumothorax."
    ],
    management: [
      { type: "header", text: "All patients with a chest injury" },
      { type: "action", text: "Position sitting upright if possible" },
      { type: "action", text: "Oxygen (as per CPG A0001 Oxygen Therapy)" },
      { type: "action", text: "Pain relief" },
      { type: "header", text: "Pneumothorax (open or closed)" },
      { type: "note", items: ["Mechanism: trauma, iatrogenic, spontaneous", "Signs: unequal breath sounds, subcutaneous emphysema, SpO\u2082 < 92% on room air", "Ultrasound (if credentialled): absent lung sliding, absent B lines, lung point"] },
      { type: "action", text: "Monitor closely for deterioration" },
      { type: "action", text: "Do not occlude open pneumothorax" },
      { type: "action", text: "Apply standard dressing if significant haemorrhage" },
      { type: "header", text: "Tension pneumothorax \u2014 clinical deterioration AND suspected pneumothorax" },
      { type: "note", items: ["Inadequate perfusion; increasing respiratory distress; SpO\u2082 < 92% despite oxygen; increased peak inspiratory pressure / stiff bag; decreased ETCO\u2082"] },
      { type: "subheader", text: "Peri-arrest \u2014 responsive to pain or unresponsive (AVPU) AND BP < 70:" },
      { type: "action", text: "Needle thoracostomy on affected side" },
      { type: "subheader", text: "All patients:" },
      { type: "action", text: "Needle thoracostomy on affected side \u2014 1\u20132 mL Lidocaine 1% local anaesthetic for patients responsive to voice/alert (per side)" },
      { type: "mica", text: "Consider finger thoracostomy (if credentialled) where: patient is intubated AND no delays to chest decompression or needle thoracostomy has already been performed" }
    ],
    notes: "Do not occlude open pneumothorax. Needle thoracostomy for tension. Lidocaine LA for alert patients. Finger thoracostomy is MICA-credentialled."
  },

  // -----------------------------------------------------------
  // A0804 Spinal Injury
  // -----------------------------------------------------------
  spinal_injury: {
    cpg: "A0804",
    title: "Spinal Injury",
    careObjectives: [
      "Identify patients with potential spinal cord injury.",
      "Spinal immobilisation where indicated.",
      "Haemodynamic management of neurogenic shock.",
      "Appropriate triage and transport."
    ],
    management: [
      { type: "header", text: "Suspected SCI or Major trauma" },
      { type: "note", items: ["Major trauma following blunt trauma to head or trunk OR neurological deficit"] },
      { type: "action", text: "Spinal immobilisation" },
      { type: "action", text: "Extricate on combi-carrier if necessary" },
      { type: "action", text: "Consider prophylactic antiemetic" },
      { type: "action", text: "Transport as per CPG A0105 Trauma Triage" },
      { type: "header", text: "Isolated spinal cord injury" },
      { type: "action", text: "Nasal capnography" },
      { type: "action", text: "Normal saline 500 mL IV if BP < 120 mmHg" },
      { type: "action", text: "Atropine as per CPG A0402 Bradycardia if bradycardia and hypotension" },
      { type: "mica", text: "Metaraminol and Noradrenaline as per CPG A0705 Shock if inadequate response to fluid and/or atropine" },
      { type: "header", text: "Cervical spine NOT cleared \u2014 C-spine clearance criteria" },
      { type: "note", items: [
        "Increased injury risk: age \u2265 65; Hx vertebral disease / abnormalities",
        "Difficult assessment: altered conscious state; intoxication; significant distracting injury",
        "Evidence of structural injury: midline pain / tenderness on palpation",
        "Reduced neck range of motion: unable to rotate neck 45\u00b0 left and right"
      ]},
      { type: "action", text: "ONE or more criteria present \u2014 spinal immobilisation" },
      { type: "action", text: "Extricate on combi-carrier if necessary" },
      { type: "action", text: "Consider self-extrication if patient is: conscious and co-operative, not intoxicated, not prevented by injury" },
      { type: "action", text: "Consider prophylactic antiemetic" }
    ],
    notes: "SBP target \u2265 120 mmHg in isolated SCI (neurogenic shock). Atropine for bradycardia. Consider self-extrication if criteria met."
  },

  // -----------------------------------------------------------
  // A0805 Burns
  // -----------------------------------------------------------
  burns: {
    cpg: "A0805",
    title: "Burns",
    careObjectives: [
      "Paramedic safety \u2014 ensure removal from burn mechanism.",
      "Airway management for suspected inhalation injury.",
      "Cool the burn, warm the patient.",
      "Fluid resuscitation for burns > 15% TBSA.",
      "Effective analgesia."
    ],
    management: [
      { type: "stop", text: "Paramedic safety is paramount \u2014 ensure safety and removal from burn mechanism; avoid chemical contamination" },
      { type: "assess", items: ["Signs/symptoms of airway burns", "Mechanism of injury", "Severity of injury (%TBSA, estimated depth, other injuries, comorbidities)"] },
      { type: "header", text: "Suspected airway burns" },
      { type: "action", text: "Consider ETT as per CPG A0302 Endotracheal Intubation \u2014 consult Medical Advisor via AV Clinician if GCS \u2265 10; use RSI method unless contraindicated" },
      { type: "header", text: "All burns" },
      { type: "action", text: "Rx pain as per CPG A0501 Pain Relief" },
      { type: "action", text: "Cool the burn, warm the patient" },
      { type: "action", text: "Apply appropriate dressing" },
      { type: "action", text: "Transport to an appropriate facility" },
      { type: "header", text: "Partial or full thickness burns \u2014 TBSA > 15%" },
      { type: "action", text: "Normal Saline \u2014 %TBSA \u00d7 Pt wt (kg) = vol (mL) \u2014 administered over 2 hours from time of the burn" }
    ],
    notes: "Burns fluid formula: %TBSA \u00d7 weight (kg) = mL Normal Saline over 2 hours. Cool burn, warm patient. Early airway consideration for inhalation injury."
  },

  // -----------------------------------------------------------
  // A0722 Opioid Toxicity
  // -----------------------------------------------------------
  opioid_toxicity: {
    cpg: "A0722",
    title: "Opioid Toxicity",
    careObjectives: [
      "Airway patency and adequate ventilation.",
      "Reversal with naloxone titrated to adequate ventilation, not full consciousness.",
      "Safe referral or transport decision."
    ],
    management: [
      { type: "stop", text: "Consider other causes of altered conscious state. Some patients become aggressive following naloxone administration." },
      { type: "note", items: ["Opioid toxicity: unable to maintain airway OR SpO\u2082 < 92% on room air"] },
      { type: "header", text: "ADULT Uncomplicated IV opioid toxicity" },
      { type: "action", text: "Airway / ventilation" },
      { type: "action", text: "Naloxone 800 mcg IM \u2014 repeat once at 10 minutes if required" },
      { type: "note", items: ["Adequate response: consider referral", "Inadequate response: transport, consider SGA"] },
      { type: "mica", text: "Consider ETT" },
      { type: "header", text: "ADULT Complex opioid toxicity (prescription opioids, polydrug, iatrogenic, unknown cause)" },
      { type: "action", text: "Naloxone 100 mcg IV \u2014 repeat at 2 minute intervals (total max. 2000 mcg); target return of adequate ventilation; SAT of -1 is acceptable in AV care; if no IV access: Naloxone 400 mcg IM (single dose)" },
      { type: "action", text: "Consider SGA" },
      { type: "mica", text: "Consider ETT" },
      { type: "header", text: "PAEDIATRIC \u2014 Opioid-na\u00efve" },
      { type: "action", text: "Naloxone 10 mcg/kg IM (max. 800 mcg) \u2014 repeat once at 10 minutes if required" },
      { type: "mica", text: "Naloxone 10 mcg/kg IV (max. 100 mcg) \u2014 repeat at 2 minute intervals" },
      { type: "header", text: "PAEDIATRIC \u2014 Opioid-dependent" },
      { type: "action", text: "Naloxone 1\u20132 mcg/kg IM (max. 100 mcg) \u2014 repeat once at 10 minutes if required" },
      { type: "mica", text: "Naloxone 1\u20132 mcg/kg IV (max. 100 mcg) \u2014 repeat at 2 minute intervals" },
      { type: "header", text: "Transport criteria \u2014 ANY of:" },
      { type: "note", items: ["Unable to maintain airway", "SpO\u2082 < 92% on room air", "Age < 16 OR > 65", "Suspected aspiration", "APO", "Incomplete response to two doses of naloxone", "Suspected opioid other than heroin including synthetic opioids", "Pregnancy"] },
      { type: "header", text: "Referral criteria \u2014 ALL of:" },
      { type: "note", items: ["IV opioid only", "Normal vital signs including GCS 15", "SpO\u2082 \u2265 92% on room air", "Chest clear on auscultation", "Competent adult available to supervise for 4 hours"] },
      { type: "action", text: "Non-transport may be appropriate \u2014 supply intranasal naloxone to family/friends where community pack available; consider referral to drug support service; safety netting (avoid other sedating agents e.g. alcohol, benzodiazepines); provide opioid health information sheet" }
    ],
    notes: "Target adequate ventilation not full consciousness. SAT -1 acceptable. Uncomplicated IV opioid = 800 mcg IM. Complex = 100 mcg IV titrated."
  },

  // -----------------------------------------------------------
  // A0723 Tricyclic Antidepressant Toxicity
  // -----------------------------------------------------------
  tca_toxicity: {
    cpg: "A0723",
    title: "Tricyclic Antidepressant Toxicity",
    careObjectives: [
      "Early identification of severe TCA toxicity.",
      "Sodium bicarbonate for QRS widening, arrhythmias, seizures, or refractory hypotension.",
      "Airway management and haemodynamic support."
    ],
    management: [
      { type: "header", text: "Severe toxicity with isolated hypotension" },
      { type: "note", items: ["Adult: SBP < 90 mmHg; Paediatric age-appropriate thresholds"] },
      { type: "action", text: "Escalate care / request MICA" },
      { type: "subheader", text: "Adult:" },
      { type: "action", text: "Normal Saline 1000\u20132000 mL IV (see dose table)" },
      { type: "subheader", text: "Paediatric:" },
      { type: "action", text: "Normal Saline 10 mL/kg IV \u2014 repeat if inadequate perfusion" },
      { type: "header", text: "Severe toxicity \u2014 ANY of: hypotension (unresponsive to IV fluid), seizures, QRS > 120 ms, arrhythmias" },
      { type: "subheader", text: "Adult:" },
      { type: "mica", text: "Sodium Bicarbonate 8.4% 100 mL IV \u2014 administer bolus slowly over approx. 2 minutes; repeat once at 3\u20135 minutes" },
      { type: "mica", text: "ETT as per CPG A0302 Endotracheal Intubation \u2014 administer Sodium Bicarbonate on induction immediately prior to intubation if two doses not already given; ventilate to achieve target ETCO\u2082 25\u201330 mmHg" },
      { type: "subheader", text: "Paediatric:" },
      { type: "mica", text: "Sodium Bicarbonate 8.4% 1\u20132 mL/kg IV (max 100 mL) \u2014 administer bolus slowly over approx. 2 minutes; repeat once at 3\u20135 minutes" },
      { type: "header", text: "Shock persists \u2014 Second line (inadequate response to IV fluid AND sodium bicarbonate)" },
      { type: "subheader", text: "Adult:" },
      { type: "mica", text: "Metaraminol 0.5 mg IV at 2-minute intervals" },
      { type: "header", text: "Third line (inadequate response to 1\u20132 doses metaraminol)" },
      { type: "subheader", text: "Adult:" },
      { type: "mica", text: "Noradrenaline infusion: Start 5 mcg/min (5 mL/hr); Increase 5 mcg/min at 2 minute intervals; Target MAP \u2265 65 OR SBP > 100; Max 25 mcg/min" },
      { type: "header", text: "Fourth line (inadequate response to noradrenaline)" },
      { type: "subheader", text: "Adult:" },
      { type: "mica", text: "Adrenaline infusion: Start 5 mcg/min (5 mL/hr); Increase 5 mcg/min at 2 minute intervals; Target MAP \u2265 65 OR SBP > 100; Max 25 mcg/min; if syringe pump unavailable: Adrenaline 10\u201320 mcg IV at 2 minute intervals" },
      { type: "header", text: "Other care \u2014 Seizures" },
      { type: "action", text: "As per Seizures CPG A0703" }
    ],
    notes: "Sodium bicarb for QRS > 120, arrhythmias, seizures, refractory hypotension. Ventilate to ETCO\u2082 25\u201330 if intubated. Do NOT use physostigmine."
  },

  // -----------------------------------------------------------
  // A0717 Beta-Blocker Toxicity
  // -----------------------------------------------------------
  beta_blocker_toxicity: {
    cpg: "A0717",
    title: "Beta-Blocker Toxicity",
    careObjectives: [
      "Identify beta-blocker toxicity with bradycardia and hypotension.",
      "Fluid, atropine, then adrenaline infusion.",
      "Transthoracic pacing for refractory extreme bradycardia."
    ],
    management: [
      { type: "note", items: ["Suspected beta-blocker toxicity with bradycardia AND hypotension: Adult \u2265 16 years HR < 50 AND SBP < 90 mmHg; Paediatric age-appropriate thresholds"] },
      { type: "header", text: "First line" },
      { type: "action", text: "Escalate care / request MICA" },
      { type: "subheader", text: "Adult:" },
      { type: "action", text: "Normal Saline 1000\u20132000 mL IV (see dose table)" },
      { type: "action", text: "Atropine 600 mcg IV \u2014 repeat 1200 mcg after 3\u20135 minutes if inadequate response; target HR > 60" },
      { type: "subheader", text: "Paediatric:" },
      { type: "action", text: "Normal Saline 10 mL/kg IV \u2014 repeat if inadequate perfusion" },
      { type: "action", text: "Atropine 20 mcg/kg IV (max 600 mcg per dose) \u2014 repeat once after 3\u20135 minutes if inadequate response; target HR age-appropriate" },
      { type: "header", text: "Second line (bradycardia and hypotension remain following IV fluid and atropine)" },
      { type: "subheader", text: "Adult:" },
      { type: "mica", text: "Adrenaline infusion: Start 5 mcg/min (5 mL/hr); Increase 5 mcg/min at 2 minute intervals; Target MAP \u2265 65 OR SBP > 100; Max 10 mcg/min; if syringe pump unavailable: Adrenaline 10\u201320 mcg IV at 2 minute intervals" },
      { type: "subheader", text: "Paediatric:" },
      { type: "mica", text: "Adrenaline infusion: Start 0.05 mcg/kg/min (0.5 mL/kg/hr); Increase 0.05 mcg/kg/min at 2 minute intervals; Max 1.0 mcg/kg/min (max 10 mcg/min); if syringe pump unavailable: Adrenaline 0.1 mcg/kg IV at 2 minute intervals" },
      { type: "header", text: "Third line (patient remains extremely poorly perfused: altered/unconscious AND HR < 50 AND SBP < 60)" },
      { type: "subheader", text: "Adult:" },
      { type: "mica", text: "Transthoracic pacing as per CPG A0402 Bradycardia \u2014 capture may be difficult" },
      { type: "subheader", text: "Paediatric:" },
      { type: "mica", text: "Consult VPIC via AV Clinician" }
    ],
    notes: "Atropine first then adrenaline infusion. Max adrenaline 10 mcg/min (lower than standard shock). Pacing for extreme bradycardia refractory to all."
  },

  // -----------------------------------------------------------
  // A0718 Calcium Channel Blocker Toxicity
  // -----------------------------------------------------------
  ccb_toxicity: {
    cpg: "A0718",
    title: "Calcium Channel Blocker Toxicity",
    careObjectives: [
      "Identify CCB toxicity with bradycardia and hypotension.",
      "Calcium gluconate, atropine, then vasopressors.",
      "Differentiate dihydropyridines (noradrenaline) from non-dihydropyridines (adrenaline).",
      "Consider transport to ECMO centre for severe cardiogenic shock or cardiac arrest."
    ],
    management: [
      { type: "note", items: ["Suspected CCB toxicity with bradycardia AND hypotension: Adult \u2265 16 years HR < 50 AND SBP < 90 mmHg; Paediatric age-appropriate thresholds"] },
      { type: "header", text: "First line" },
      { type: "action", text: "Escalate care / request MICA" },
      { type: "subheader", text: "Adult:" },
      { type: "action", text: "Normal Saline 1000\u20132000 mL IV (see dose table)" },
      { type: "action", text: "Calcium Gluconate 10% 6.6 mmol (3g) (30 mL) IV \u2014 administer over 2\u20135 minutes; repeat at 20 minutes if required; further doses may be required \u2014 consult VPIC via Clinician" },
      { type: "action", text: "Atropine 600 mcg IV \u2014 repeat 1200 mcg after 3\u20135 minutes if inadequate response; target HR > 60" },
      { type: "subheader", text: "Paediatric:" },
      { type: "action", text: "Normal Saline 10 mL/kg IV \u2014 repeat if inadequate perfusion" },
      { type: "action", text: "Calcium Gluconate 10% 0.11 mmol/kg (0.5 mL/kg) IV (max 30 mL) \u2014 administer over 2\u20135 minutes; repeat at 20 minutes if required; further doses \u2014 consult VPIC via Clinician" },
      { type: "action", text: "Atropine 20 mcg/kg IV (max 600 mcg per dose) \u2014 repeat once after 3\u20135 minutes if inadequate response" },
      { type: "header", text: "Second line (bradycardia and hypotension remain following IV fluid and atropine)" },
      { type: "subheader", text: "Adult:" },
      { type: "mica", text: "Metaraminol 0.5 mg IV at 2 minute intervals" },
      { type: "subheader", text: "Paediatric:" },
      { type: "mica", text: "Consult VPIC via AV Clinician; where approved: Adrenaline 0.1 mcg/kg IV at 2 minute intervals" },
      { type: "header", text: "Third line (inadequate response to 1\u20132 doses metaraminol)" },
      { type: "subheader", text: "Adult \u2014 dihydropyridines (Amlodipine, Felodipine, Lercanidipine, Nifedipine, Nimodipine):" },
      { type: "mica", text: "Noradrenaline infusion: Start 5 mcg/min (5 mL/hr); Increase 5 mcg/min at 2 minute intervals; Target MAP \u2265 65 OR SBP > 100; Max 25 mcg/min" },
      { type: "subheader", text: "Adult \u2014 non-dihydropyridines (Verapamil, Diltiazem):" },
      { type: "mica", text: "Adrenaline infusion: Start 5 mcg/min (5 mL/hr); Increase 5 mcg/min at 2 minute intervals; Target MAP \u2265 65 OR SBP > 100; Max 25 mcg/min; if syringe pump unavailable: Adrenaline 10\u201320 mcg IV at 2 minute intervals" },
      { type: "header", text: "Fourth line (patient remains extremely poorly perfused: altered/unconscious AND HR < 50 AND SBP < 60)" },
      { type: "subheader", text: "Adult:" },
      { type: "mica", text: "Transthoracic pacing as per CPG A0402 Bradycardia \u2014 capture may be difficult" },
      { type: "subheader", text: "Paediatric:" },
      { type: "mica", text: "Consult VPIC via AV Clinician" },
      { type: "header", text: "Other care \u2014 Transport" },
      { type: "action", text: "Consider transport to ECMO centre if severe cardiogenic shock or cardiac arrest \u2014 consult VPIC and ARV/PIPER via AV Clinician" }
    ],
    notes: "Calcium gluconate 3 g (30 mL) adult dose. Non-DHP (verapamil/diltiazem) = adrenaline infusion; DHP = noradrenaline infusion. ECMO centre if refractory."
  },

  // -----------------------------------------------------------
  // A0709 Organophosphate Toxicity
  // -----------------------------------------------------------
  organophosphate_toxicity: {
    cpg: "A0709",
    title: "Organophosphate Toxicity",
    careObjectives: [
      "Recognise organophosphate toxicity / cholinergic toxidrome.",
      "Ensure scene safety and decontamination.",
      "Administer atropine and ensure sufficient supply."
    ],
    management: [
      { type: "stop", text: "Organophosphates can be absorbed via SKIN and INHALATION \u2014 apply PPE; decontamination where patient clothing/skin exposed to toxin (remove clothing, wash skin with soap and water); isolate emesis" },
      { type: "note", items: ["Common agents in Australia: chlorpyrifos, diazinon, dimethoate, fenthion, profenofos, malathion (labels may specify \u2018anticholinesterase\u2019). Also used for nerve agents (sarin, VX)."] },
      { type: "header", text: "Organophosphate toxicity with muscarinic effects" },
      { type: "note", items: ["Salivation compromising airway OR bronchospasm/bronchorrhoea OR +/- bradycardia or hypotension: Adult HR < 50 AND SBP < 80; Paediatric age-appropriate thresholds"] },
      { type: "header", text: "First line" },
      { type: "action", text: "Escalate care / request MICA \u2014 request further atropine supply" },
      { type: "subheader", text: "Adult:" },
      { type: "action", text: "IV access" },
      { type: "action", text: "Atropine 1200 mcg IV \u2014 repeat double the previous dose at 5 minute intervals; target clear chest, no wheeze, HR > 80, BP > 80" },
      { type: "subheader", text: "Paediatric:" },
      { type: "action", text: "Atropine 50 mcg/kg IV (max. 1200 mcg) \u2014 repeat double the previous dose at 5 minute intervals; target clear chest, no wheeze, age-appropriate HR and SBP" },
      { type: "action", text: "Inadequate response: consult VPIC via AV Clinician" },
      { type: "mica", text: "Consider ETT as per CPG A0302 / P0301" },
      { type: "header", text: "Other care \u2014 Seizures" },
      { type: "action", text: "As per Seizures CPG A0703" },
      { type: "header", text: "Other care \u2014 Shock" },
      { type: "subheader", text: "Adult:" },
      { type: "action", text: "Normal Saline IV as per Shock CPG A0705" },
      { type: "mica", text: "Metaraminol, noradrenaline and adrenaline as per Shock CPG A0705 if hypotension persists" },
      { type: "subheader", text: "Paediatric:" },
      { type: "action", text: "Normal Saline 10 mL/kg IV \u2014 repeat if inadequate perfusion" },
      { type: "mica", text: "Consult VPIC via AV Clinician" }
    ],
    notes: "Atropine start dose 1200 mcg adult IV, then double each time. Target: dry chest, no wheeze, HR > 80, BP > 80. Decontamination before treatment if possible."
  },

  // -----------------------------------------------------------
  // A0720 Cyanide Toxicity
  // -----------------------------------------------------------
  cyanide_toxicity: {
    cpg: "A0720",
    title: "Cyanide Toxicity",
    careObjectives: [
      "Scene safety \u2014 cyanide can penetrate skin.",
      "High-flow oxygen regardless of SpO\u2082.",
      "Hydroxocobalamin (Cyanokit) as antidote."
    ],
    management: [
      { type: "stop", text: "Cyanide can penetrate skin \u2014 apply PPE" },
      { type: "note", items: [
        "Mild\u2013moderate: CNS \u2014 headache, anxiety, dizziness; CVS \u2014 tachycardia; Resp \u2014 mild dyspnoea; GI \u2014 nausea and vomiting",
        "Severe: CNS \u2014 confusion, altered conscious state (drowsiness to coma), seizures; CVS \u2014 hypotension, arrhythmia, dusky skin tone; Resp \u2014 severe respiratory distress; metabolic acidosis \u2014 blood lactate > 10 mmol/L"
      ]},
      { type: "header", text: "All toxicity \u2014 First line" },
      { type: "action", text: "Escalate care / request MICA" },
      { type: "action", text: "Oxygen (regardless of SpO\u2082) \u2014 15 LPM via NRBM" },
      { type: "subheader", text: "Adult:" },
      { type: "action", text: "IV access (x 2 if possible)" },
      { type: "action", text: "Consult VPIC via AV Clinician for Hydroxocobalamin (Cyanokit) 5 g IV over 15 minutes \u2014 dose may be administered over 2\u20135 minutes if critically unwell/peri-arrest; dose may be repeated 30\u201360 minutes later pending VPIC consultation; administer if VPIC unavailable and exposure to cyanide is known" },
      { type: "action", text: "Inadequate/extremely poor perfusion: Normal Saline 1000\u20132000 mL IV" },
      { type: "subheader", text: "Paediatric:" },
      { type: "action", text: "IV access (x 2 if possible)" },
      { type: "action", text: "Normal Saline 10 mL/kg \u2014 repeat if inadequate perfusion" },
      { type: "action", text: "Consult VPIC via AV Clinician for Hydroxocobalamin (Cyanokit) 70 mg/kg IV (max 5 g) over 15 minutes \u2014 administer if VPIC not available and exposure to cyanide is known" }
    ],
    notes: "Oxygen 15 LPM regardless of SpO\u2082. Cyanokit 5 g adult, 70 mg/kg paediatric. Can give over 2\u20135 min if peri-arrest. Blood will appear cherry red after hydroxocobalamin \u2014 do not be alarmed."
  },

  // -----------------------------------------------------------
  // A0719 Drug Induced Hyperthermia
  // -----------------------------------------------------------
  drug_induced_hyperthermia: {
    cpg: "A0719",
    title: "Drug Induced Hyperthermia",
    careObjectives: [
      "Early identification.",
      "Control temperature \u2014 sedate, cool, hydrate.",
      "Supportive care."
    ],
    management: [
      { type: "stop", text: "Patient may be agitated \u2014 safety precautions as per CPG A0708 Acute Behavioural Disturbance" },
      { type: "note", items: ["Associated agents: amphetamines, cocaine, lithium, MAO inhibitors, MDMA/ecstasy, PCP, SSRIs/SNRIs, tramadol"] },
      { type: "header", text: "Moderate toxicity \u2014 hyperthermia 38\u201339\u00b0C AND altered conscious state/agitation AND tremor, increased muscle tone" },
      { type: "action", text: "Escalate care / request MICA" },
      { type: "action", text: "Sedate: Midazolam (see dose table)" },
      { type: "action", text: "Cool" },
      { type: "action", text: "Hydrate: Normal Saline 1000\u20132000 mL IV (cold IV fluid where available)" },
      { type: "header", text: "Severe toxicity \u2014 hyperthermia \u2265 39\u00b0C AND altered conscious state/severe agitation AND muscle rigidity, seizure activity" },
      { type: "subheader", text: "First line:" },
      { type: "action", text: "Manage as per Moderate Toxicity" },
      { type: "action", text: "Immediate safety risk \u2014 sedate patient as per CPG A0708" },
      { type: "action", text: "Prepare airway adjuncts and ventilation equipment" },
      { type: "mica", text: "Anticipate RSI" },
      { type: "subheader", text: "Second line \u2014 inadequate response OR airway/oxygenation/ventilation impairment:" },
      { type: "mica", text: "Consider intubation" },
      { type: "mica", text: "Post RSI maintenance as per CPG A0305 Airway Maintenance \u2014 consider independent midazolam and morphine infusions, priority for midazolam administration" },
      { type: "header", text: "Midazolam dose table (Adult)" },
      { type: "note", items: [
        "IM (IV access not available): 5\u201310 mg; repeat 5\u201310 mg after 10 minutes if required (once only). < 60 kg/frail/elderly/SBP < 100 mmHg: 2.5\u20135 mg; repeat once after 10 minutes if required.",
        "IV: 2.5\u20135 mg; repeat 2.5\u20135 mg at 5-minute intervals if required. < 60 kg/frail/elderly/SBP < 100 mmHg: 1\u20132 mg; repeat at 5-minute intervals if required.",
        "Maximum total dose 20 mg (IM and IV). Consult VPIC via AV Clinician for further doses if required."
      ]}
    ],
    notes: "Sedate first, then cool. Cold IV fluid where available. Target temp reduction. Moderate = 38\u201339\u00b0C; Severe \u2265 39\u00b0C with rigidity/seizures."
  },

  // -----------------------------------------------------------
  // A0721 Quetiapine Toxicity
  // -----------------------------------------------------------
  quetiapine_toxicity: {
    cpg: "A0721",
    title: "Quetiapine Toxicity",
    careObjectives: [
      "Airway management.",
      "Management of inadequate perfusion."
    ],
    management: [
      { type: "note", items: ["Suspected quetiapine toxicity: decreased conscious state, inadequate perfusion, respiratory depression, loss of airway control, anticholinergic toxidrome"] },
      { type: "header", text: "Hypotension" },
      { type: "note", items: ["Adult \u2265 16 years: SBP < 90 mmHg; Paediatric age-appropriate thresholds"] },
      { type: "header", text: "First line" },
      { type: "action", text: "Escalate care / request MICA" },
      { type: "subheader", text: "Adult:" },
      { type: "action", text: "Normal Saline 1000\u20132000 mL IV (see dose table)" },
      { type: "subheader", text: "Paediatric:" },
      { type: "action", text: "Normal Saline 10 mL/kg \u2014 repeat if inadequate perfusion" },
      { type: "header", text: "Second line (inadequate response following IV fluid)" },
      { type: "subheader", text: "Adult:" },
      { type: "mica", text: "Metaraminol 0.5\u20131 mg IV at 2-minute intervals" },
      { type: "subheader", text: "Paediatric:" },
      { type: "mica", text: "Consult VPIC via AV Clinician" },
      { type: "header", text: "Third line (inadequate response to 1\u20132 doses metaraminol)" },
      { type: "subheader", text: "Adult:" },
      { type: "mica", text: "Noradrenaline infusion: Start 5 mcg/min (5 mL/hr); Increase 5 mcg/min at 2 minute intervals; Target MAP \u2265 65 OR SBP > 100; Max 25 mcg/min; if inadequate response consult VPIC via AV Clinician" },
      { type: "header", text: "Other care" },
      { type: "action", text: "Manage seizures as per Seizures CPG A0703" },
      { type: "mica", text: "Consider ETT" }
    ],
    notes: "Anticholinergic toxidrome: dry, hot, dilated, tachycardic, confused. Fluid then metaraminol then noradrenaline. Seizures managed per A0703."
  },

  // -----------------------------------------------------------
  // A0501 Pain Relief
  // -----------------------------------------------------------
  pain_relief: {
    cpg: "A0501",
    title: "Pain Relief",
    careObjectives: [
      "Assess and document pain severity.",
      "Provide appropriate analgesia matched to pain severity.",
      "Titrate to patient response."
    ],
    management: [
      { type: "assess", items: ["Reported level of pain (using pain scale)", "Physical signs of discomfort (document)", "Acute vs. chronic pain", "Analgesia already taken", "Opioid tolerance", "Co-morbidities"] },
      { type: "action", text: "Consider non-pharmacological management options as appropriate (e.g. splinting, cold/heat therapy)" },
      { type: "header", text: "Mild pain" },
      { type: "action", text: "Paracetamol oral (1000 mg; OR 500 mg if < 60 kg / frail / elderly / malnourished / liver disease)" },
      { type: "note", items: ["Pain not controlled or rapid relief required: manage as per Moderate pain", "Paracetamol should not be used to treat chest pain in suspected acute coronary syndrome"] },
      { type: "header", text: "Moderate pain" },
      { type: "subheader", text: "First line \u2014 IV access available:" },
      { type: "action", text: "Morphine IV OR Fentanyl IV (if specifically indicated)" },
      { type: "subheader", text: "First line \u2014 IV access not required, delayed or unsuccessful:" },
      { type: "action", text: "Fentanyl IN (preferred in adolescents/elderly patients) OR Ketamine IN" },
      { type: "action", text: "All patients unless contraindicated: Paracetamol oral" },
      { type: "subheader", text: "Second line \u2014 other options unsuccessful / unavailable / contraindicated:" },
      { type: "action", text: "Ketamine IN (if minimal response to opioids)" },
      { type: "action", text: "Morphine IM (if opioid not already administered)" },
      { type: "subheader", text: "Third line OR Mild/moderate procedural pain:" },
      { type: "action", text: "Methoxyflurane inhaled" },
      { type: "note", items: ["Ketamine should not be used to treat chest pain in suspected acute coronary syndrome"] },
      { type: "header", text: "Severe pain" },
      { type: "subheader", text: "First line \u2014 IV access available:" },
      { type: "action", text: "Morphine IV OR Fentanyl IV AND Ketamine IN \u2014 consult for Ketamine IV if pain remains severe following 2\u20133 doses (3\u20135 minutes between each medication to assess effectiveness)" },
      { type: "mica", text: "Ketamine IV \u2013 analgesic dose" },
      { type: "subheader", text: "Second line \u2014 IV access unsuccessful or delayed:" },
      { type: "action", text: "Fentanyl IN and/or Ketamine IN and/or Methoxyflurane and/or Morphine IM (if opioid not already administered)" },
      { type: "subheader", text: "Third line \u2014 transport time prolonged / ongoing need for Ketamine:" },
      { type: "mica", text: "Ketamine infusion" },
      { type: "subheader", text: "Fourth line \u2014 uncontrolled extreme pain:" },
      { type: "mica", text: "Consider ETT as per CPG A0302 Endotracheal Intubation" },
      { type: "subheader", text: "Severe procedural pain:" },
      { type: "mica", text: "Consider Ketamine IV \u2013 procedural dose" }
    ],
    notes: "Dose table: Morphine IV up to 5 mg at 5-min intervals (consult after 20 mg); Fentanyl IV up to 50 mcg at 5-min intervals; Fentanyl IN 100 mcg (50 mcg if frail/elderly), repeat 50 mcg at 5-min (max 400 mcg IN); Ketamine IN 75 mg, repeat 50 mg at 20-min; Methoxyflurane 3 mL inhaled, repeat 3 mL (max 6 mL)."
  },

  // -----------------------------------------------------------
  // A0502 Headache
  // -----------------------------------------------------------
  headache: {
    cpg: "A0502",
    title: "Headache",
    careObjectives: [
      "Risk stratify patients with headache.",
      "Identify and transport high-risk presentations.",
      "Provide appropriate analgesia."
    ],
    management: [
      { type: "assess", items: ["Vital signs", "Blood glucose", "Nature of symptoms, onset, frequency and duration", "Provoking factors", "Comorbidities", "Established diagnosis of migraine (if any)", "If patient has individual patient management plan, this should be followed"] },
      { type: "header", text: "Low\u2013moderate risk \u2014 no high-risk features AND no other reason for transport to ED" },
      { type: "action", text: "Paracetamol 1000 mg oral if not already administered within past 4 hours (OR 500 mg if elderly/frail/< 60 kg/liver disease/malnourished)" },
      { type: "action", text: "If considered to be or previously diagnosed as a migraine: Prochlorperazine 12.5 mg IM (if patient age \u2265 21 years)" },
      { type: "action", text: "Cluster headache (history of medically diagnosed and consistent with previous episode): 10\u201315 L/min oxygen via non-rebreather mask" },
      { type: "action", text: "Paramedic initiated VVED referral" },
      { type: "header", text: "High-risk headache \u2014 Transport to ED" },
      { type: "stop", text: "Potential SAH or ICH: sudden onset \u2018thunderclap\u2019 headache; worst in life headache; acute onset neurological deficit; altered mentation; recent significant head trauma; previous ICH; known aneurysm; seizure without history of epilepsy" },
      { type: "stop", text: "Potential meningitis and/or encephalitis: meningism (fever, neck stiffness, photophobia); non-blanching rash; severe immunocompromise" },
      { type: "stop", text: "Potential lesion / raised ICP: history of neurosurgery or VP shunts; history of cancer or neoplasm" },
      { type: "stop", text: "Requires further investigation: headache different to usual presentation; potential poisoning/envenomation; use of amphetamines or cocaine; pregnancy or recently postpartum (~6 weeks); new onset severe headache in age > 50 or patients on anti-coagulants" },
      { type: "action", text: "Transport to ED" },
      { type: "action", text: "Paracetamol as per CPG A0501-1 Pain Relief" },
      { type: "subheader", text: "Severe headache \u2014 if headache remains severe 15 minutes post-paracetamol AND hospital > 15 minutes away:" },
      { type: "action", text: "Fentanyl IV / IN / IM as per CPG A0501-1 Pain Relief \u2014 aim to reduce pain to < 7" },
      { type: "note", items: ["Prochlorperazine is contraindicated in CNS depression"] }
    ],
    notes: "Thunderclap = SAH until proven otherwise. Meningism = transport. Prochlorperazine IM for migraine (\u2265 21 years). Prochlorperazine contraindicated in CNS depression."
  },

  // -----------------------------------------------------------
  // A0708 Acute Behavioural Disturbance
  // -----------------------------------------------------------
  acute_behavioural_disturbance: {
    cpg: "A0708",
    title: "Acute Behavioural Disturbance",
    careObjectives: [
      "Patient and paramedic safety.",
      "Identify and treat correctable causes.",
      "Safe and effective sedation when required.",
      "Post-sedation monitoring."
    ],
    management: [
      { type: "stop", text: "Patient and paramedic safety is paramount \u2014 ensure clear egress, watch for sharps, body fluids, potential violence, environmental stimuli" },
      { type: "assess", items: ["Potential / correctable causes: head injury, infection/sepsis, metabolic derangement, hypoxia, hypoglycaemia, post ictal, alcohol withdrawal, exposure to toxins, drug-induced hyperthermia, unmet needs (e.g. pain)", "Establish past history and usual care plan", "SAT score", "Frailty"] },
      { type: "action", text: "Treat correctable cause if possible" },
      { type: "header", text: "Able to manage without sedation or restraint" },
      { type: "action", text: "Continue verbal / environmental de-escalation strategies" },
      { type: "action", text: "Manage as per Requires restraint/sedation if level of agitation changes at any time" },
      { type: "action", text: "Consider consultation with mental health services (e.g. TelePROMPT) or transport to hospital" },
      { type: "header", text: "Requires restraint / sedation \u2014 agitation does not adequately respond to de-escalation AND patient presents a risk to themselves or others" },
      { type: "stop", text: "Ensure sufficient physical assistance and planning before attempting interventions. Prepare monitoring and resuscitation equipment BEFORE administering sedation." },
      { type: "action", text: "Complete Sedation Checklist prior to administering parenteral sedation" },
      { type: "action", text: "Aim for rousable drowsiness; apply and remove restraints as appropriate to level of risk at that time" },
      { type: "header", text: "Mild to moderate agitation \u2014 cooperative and consents to oral medication" },
      { type: "action", text: "Olanzapine ODT Oral" },
      { type: "header", text: "Moderate to severe agitation \u2014 serious and imminent risk to safety; not cooperative; does not consent to oral medicine" },
      { type: "action", text: "Droperidol IM / IV \u2014 preferred parenteral sedation in most circumstances; ensure minimum 15 minutes onset time prior to second dose; request MICA at point of deciding a repeat dose is required; consult AV Medical Advisor if inadequate response after two doses" },
      { type: "action", text: "OR Midazolam IM / IV \u2014 preferred if known Lewy body dementia, Parkinson\u2019s disease or known QT prolongation" },
      { type: "header", text: "Extreme safety risk \u2014 extreme and immediate risk to safety; risk of death or serious injury" },
      { type: "action", text: "Request MICA / police" },
      { type: "action", text: "Ketamine IM / IV \u2014 ALS must consult AV Medical Advisor prior to ketamine administration where droperidol or midazolam has already been administered; consult AV Medical Advisor via AV Clinician if patient remains agitated" },
      { type: "header", text: "Post-sedation care" },
      { type: "action", text: "Monitor the patient (see Supportive Care and Monitoring in general notes)" },
      { type: "action", text: "Reassess and manage potential clinical causes" },
      { type: "action", text: "If agitation reoccurs where episode of care exceeds initial medicine\u2019s duration of action: Olanzapine Oral if co-operative OR Droperidol IM/IV if unable to co-operate OR Midazolam IM/IV if droperidol contraindicated" },
      { type: "note", items: ["Notification required where: physically or mechanically restrained; escorted by police; current agitation (SAT > 0); current altered conscious state (SAT < 0)"] }
    ],
    notes: "Droperidol preferred first-line parenteral sedation. Midazolam preferred if Lewy body/Parkinson\u2019s/QT prolongation. Ketamine for extreme safety risk \u2014 consult Medical Advisor if droperidol/midazolam already given."
  },

  // -----------------------------------------------------------
  // A0712 Palliative Care
  // -----------------------------------------------------------
  palliative_care: {
    cpg: "A0712",
    title: "Palliative Care",
    careObjectives: [
      "Symptomatic management for palliative patients.",
      "Consult community palliative care service where available.",
      "Avoid unnecessary transport where symptoms can be managed."
    ],
    management: [
      { type: "note", items: ["Status: patient in care of a community palliative care service AND has followed their symptom management plan without resolution of symptoms"] },
      { type: "assess", items: ["Nausea/vomiting or pain causing distress or mild agitation or dyspnoea"] },
      { type: "header", text: "Community Palliative Care service unavailable" },
      { type: "stop", text: "Cross check calculations with partner and/or Clinician" },
      { type: "action", text: "Treat nausea/vomiting as per CPG A0701 Nausea and Vomiting" },
      { type: "action", text: "Treat distressing pain, mild agitation caused by pain, or dyspnoea with an appropriate dose of Morphine calculated via the AV CPG App (max 20 mg) and administered subcutaneously" },
      { type: "action", text: "Treat mild agitation not caused by pain with Midazolam 2.5 mg S/C" },
      { type: "action", text: "If symptoms are controlled following treatment and the patient/carers request transport, non-emergency patient transport (in a suitable timeframe) may be appropriate" },
      { type: "header", text: "Community Palliative Care service available" },
      { type: "action", text: "Consult for management \u2014 where available, two paramedics should confirm the details of any medications recommended by the community palliative care service" },
      { type: "action", text: "Assess patient and treat as per appropriate guideline" },
      { type: "action", text: "This may include transport to an appropriate medical facility" }
    ],
    notes: "Morphine S/C dose via AV CPG App (max 20 mg). Midazolam 2.5 mg S/C for agitation not caused by pain. Always cross-check subcutaneous doses with partner and/or Clinician."
  },

  // -----------------------------------------------------------
  // A0725 Syncope
  // -----------------------------------------------------------
  syncope: {
    cpg: "A0725",
    title: "Syncope",
    careObjectives: [
      "Identify patients suffering from syncope.",
      "Symptomatic management if required.",
      "Identify care pathway appropriate to condition and risk profile."
    ],
    management: [
      { type: "assess", items: ["History and physical examination", "Electrocardiogram", "Medication review", "If available, consider pregnancy and lactate testing", "Competing medical conditions"] },
      { type: "header", text: "Low-risk syncope \u2014 reflex syncope OR uncomplicated orthostatic hypotension" },
      { type: "action", text: "Symptom relief if required" },
      { type: "action", text: "VVED referral for potential community management" },
      { type: "header", text: "High-risk syncope \u2014 Transport; manage per appropriate CPG for condition" },
      { type: "stop", text: "Any of: absence of symptoms prior to collapse; associated with palpitations; cardiac device (pacemaker or implanted cardioverter defibrillator); chest pain; exertional onset or occurs when supine; family history of young sudden cardiac death (< 50 years); ischaemic or structural heart disease; persistent hypotension (SBP < 90); abnormal ECG (bradycardia < 50 bpm, pre-excited QRS complexes, second or third-degree AV block, SVT or paroxysmal atrial fibrillation); severe headache and/or neurological deficits" }
    ],
    notes: "High-risk syncope = transport. Low-risk = VVED referral may be appropriate. ECG mandatory in all syncope patients."
  },

  // -----------------------------------------------------------
  // A0729 Sepsis and Infection
  // -----------------------------------------------------------
  sepsis: {
    cpg: "A0729",
    title: "Sepsis and Infection",
    careObjectives: [
      "Identify and treat patients with clear signs of sepsis.",
      "Risk stratify patients with infection to inform appropriate disposition."
    ],
    management: [
      { type: "header", text: "Low risk \u2014 NEWS2 0\u20132 AND no risk factors" },
      { type: "action", text: "Safety netting; self-care advice; consider referral to GP" },
      { type: "header", text: "Moderate risk \u2014 NEWS2 3\u20134 OR risk factors (elderly/frail, severe obesity, diabetes, severe/complex chronic disease, clinician/carer concern, significant dental procedure, IV drug use, significant patient safety/social/environmental risk factors with inadequate support)" },
      { type: "action", text: "Consider VVED if any single moderate risk feature is present OR transport if multiple criteria present" },
      { type: "header", text: "High risk \u2014 NEWS2 5\u20136 (or score of 3 in any category) OR severe immunocompromise (chemotherapy within past 4 weeks, neutropenia, transplant) OR recent surgery/critical illness (~6 weeks) OR pregnant/recently pregnant (~6 weeks) OR indwelling medical devices" },
      { type: "action", text: "Transport to ED" },
      { type: "action", text: "Consider Mx as per Sepsis if sepsis is strongly suspected" },
      { type: "header", text: "Sepsis \u2014 two or more of: hypotension (SBP \u2264 100 mmHg), altered conscious state (GCS < 15), tachypnoea (RR \u2265 22) OR NEWS2 \u2265 7" },
      { type: "action", text: "Oxygen (as required per CPG A0001 Critical Illness: Sepsis)" },
      { type: "action", text: "Normal Saline 500\u20131000 mL IV regardless of blood pressure" },
      { type: "action", text: "Signal 1 transport + notification" },
      { type: "header", text: "Septic shock \u2014 hypotension persists OR lactate > 2 mmol/L (if available)" },
      { type: "action", text: "Normal Saline 500\u20131000 mL IV" },
      { type: "action", text: "Ceftriaxone 2 g IV / IM if transport time > 60 minutes (manage suspected meningococcal septicaemia as per CPG A0706)" },
      { type: "mica", text: "Metaraminol, noradrenaline and adrenaline as per CPG A0705 Shock if hypotension persists" }
    ],
    notes: "NEWS2 drives risk stratification. Sepsis = Signal 1. Fluid regardless of BP in sepsis. Ceftriaxone only if > 60 min transport. Vasopressors for septic shock."
  },

  // -----------------------------------------------------------
  // A0706 Meningococcal Septicaemia
  // -----------------------------------------------------------
  meningococcal: {
    cpg: "A0706",
    title: "Meningococcal Septicaemia",
    careObjectives: [
      "Early recognition of meningococcal septicaemia.",
      "Ceftriaxone administration.",
      "Fluid resuscitation and shock management."
    ],
    management: [
      { type: "stop", text: "PPE" },
      { type: "assess", items: [
        "Typical purpuric rash",
        "Septicaemia signs: fever, rigor, joint and muscle pain, cool hands and feet, tachycardia, hypotension, tachypnoea",
        "Meningeal signs: headache, photophobia, neck stiffness, nausea and vomiting, altered conscious state"
      ]},
      { type: "action", text: "Ceftriaxone 2 g IV / IM" },
      { type: "action", text: "Oxygen (as required per CPG A0001 Oxygen Therapy \u2013 Critical Illness: Sepsis)" },
      { type: "action", text: "Normal saline as per CPG A0729 Sepsis and Infection; perfusion management as per Shock CPG A0705" }
    ],
    notes: "Ceftriaxone 2 g IV or IM \u2014 give as soon as meningococcal septicaemia is suspected. PPE mandatory."
  },

  // -----------------------------------------------------------
  // A0107 Mental Health Conditions
  // -----------------------------------------------------------
  mental_health_conditions: {
    cpg: "A0107",
    title: "Mental Health Conditions",
    careObjectives: [
      "Identify patients presenting with a mental health issue.",
      "Assess for high-risk symptoms requiring transport.",
      "Connect patients with appropriate specialist mental health support.",
      "Initiate care plan for lower-risk presentations."
    ],
    management: [
      { type: "note", items: ["Intended for patients aged 16 years or older with high index of suspicion of presenting with a mental health issue"] },
      { type: "assess", items: ["Scene safety", "Complete Mental Status Assessment CPG A0106", "Assess and Mx clinical/organic causes (AEIOUTIPS, grief and pain)"] },
      { type: "header", text: "If danger present" },
      { type: "stop", text: "Withdraw from scene to safe distance; inform communications; request police assistance; only re-approach once escorted or instructed by police; violent or extremely agitated behaviour is immediately 'High Risk' \u2014 manage as per CPG A0708 Acute Behavioural Disturbance" },
      { type: "header", text: "High-risk symptoms \u2014 Transport to hospital" },
      { type: "stop", text: "Any of: current attempted suicide or self-harm requiring assessment/management at ED; intentional overdose or poisoning requiring ED; substance intoxication to the point patient unable to complete mental status assessment (CPG A0106); enacted Section 232 of the Mental Health Act 2022; requires sedation as per CPG A0708; patient in dangerous social situation (e.g. family or domestic violence); acute psychosis, mania or confusional state/delirium; patient has any Red Flags (CPG A0108)" },
      { type: "action", text: "Ascertain patient\u2019s home address and which mental health catchment they belong to (via AV Clinician or VACIS)" },
      { type: "action", text: "Transport patient to appropriate and/or nearest available hospital" },
      { type: "header", text: "Signs that patient requires specialist mental health assessment" },
      { type: "note", items: ["Any of: currently under care of a mental health service; recent discharge (< 28 days) from a psychiatric inpatient admission; unwillingness to accept help; current suicidal ideation or previous attempts of suicide or self-harm; patient lacks social or emotional support options; evidence of not coping \u2014 verbal statements, environmental cues"] },
      { type: "action", text: "Contact TelePROMPT by phoning 1800 067 549 \u2014 provide handover using IMIST AMBO; facilitate three-way assessment (Patient, TelePROMPT Mental Health Nurse and Paramedic)" },
      { type: "action", text: "If Mental Health Nurse unavailable: transport to appropriate hospital" },
      { type: "header", text: "No high-risk symptoms and specialist assessment not required" },
      { type: "action", text: "Obtain consent from patient for alternative service provision as per CPG A0111 and initiate care plan" },
      { type: "action", text: "Refer to patient\u2019s relevant health professional (mental health practitioner or GP)" },
      { type: "action", text: "Contact patient\u2019s family member or friend and wait for arrival (if necessary)" },
      { type: "action", text: "Provide Mental Health and Wellbeing Health Information sheet and discuss with patient" }
    ],
    notes: "TelePROMPT: 1800 067 549. High-risk = transport. Section 232 Mental Health Act 2022 = transport. AEIOUTIPS for organic causes."
  },

  // -----------------------------------------------------------
  // A0901 Hypothermia / Cold Exposure
  // -----------------------------------------------------------
  hypothermia: {
    cpg: "A0901",
    title: "Hypothermia / Cold Exposure",
    careObjectives: [
      "Prevent further heat loss.",
      "Manage potential major trauma concurrently.",
      "Caution with intubation in severe hypothermia due to arrhythmia risk."
    ],
    management: [
      { type: "assess", items: ["Perfusion status", "BGL if altered conscious state"] },
      { type: "header", text: "Hypothermia < 35\u00b0C" },
      { type: "action", text: "Protect the patient from heat loss using all available options: ensure ambulance heater remains on and rear of vehicle closed as much as possible; remove wet clothing and dry the patient; cover the patient above and below with a thermal wrap (sheet/space blanket/standard blanket) or if available, an active warming blanket device" },
      { type: "note", items: ["Intubation needs to be approached with caution in severe hypothermia, due to the risk of stimulating a lethal arrhythmia"] },
      { type: "mica", text: "If GCS < 10 consider ETT as per CPG A0302 Endotracheal Intubation" },
      { type: "header", text: "Potential Major Trauma regardless of T\u00b0" },
      { type: "action", text: "Manage as per relevant CPGs, whilst concurrently protecting the patient from heat loss: ensure ambulance heater on and rear of vehicle closed; minimise scene time as per CPG A0800 Principles of Major Trauma; remove wet clothing and dry the patient; cover above and below with thermal wrap or active warming blanket" },
      { type: "action", text: "If patient is a high risk trauma patient (Temp < 35\u00b0C or intubated or haemorrhagic shock): all above measures are an urgent priority and MUST be implemented as soon as possible, concurrently with other management" }
    ],
    notes: "Prevent further heat loss \u2014 warm vehicle, dry patient, thermal wrap. Intubation in severe hypothermia risks VF. Hypothermia + trauma = high priority concurrent warming."
  },

  // -----------------------------------------------------------
  // A0902 Hyperthermia / Heat Stress
  // -----------------------------------------------------------
  hyperthermia_environmental: {
    cpg: "A0902",
    title: "Hyperthermia / Heat Stress",
    careObjectives: [
      "Cool the patient.",
      "Fluid resuscitation.",
      "Differentiate environmental/exertional from toxin-induced hyperthermia."
    ],
    management: [
      { type: "stop", text: "This guideline is NOT FOR USE in the patient who is febrile due to suspected infection" },
      { type: "assess", items: ["Signs and symptoms: elevated temperature AND any of \u2014 altered consciousness/confusion/incoherent speech, dizziness/collapse, nausea/vomiting, abnormal gait, seizures", "BGL if altered conscious state", "Perfusion and hydration status"] },
      { type: "header", text: "Toxin induced \u2014 ingested a pro-serotonergic agent OR stimulant drug" },
      { type: "action", text: "See CPG A0719 Drug Induced Hyperthermia" },
      { type: "header", text: "Environmental / Exertional (athletic training in hot conditions, manual labour in heavy clothing, elderly/frail in hot environment, sauna, direct sunlight)" },
      { type: "action", text: "Cooling techniques: remove patient from hot environment; strip / spray / fan (aggressive fanning); junctional ice packs" },
      { type: "subheader", text: "Elderly / frail patient:" },
      { type: "action", text: "Cold Normal Saline IV (max. 20 mL/kg) \u2014 reassess after each 500 mL increment" },
      { type: "subheader", text: "Young / fit / healthy patient:" },
      { type: "action", text: "Consider immediate ice bath or cold shower if facilities and resources allow while preparing for transport, otherwise cooling techniques" },
      { type: "action", text: "Cold Normal Saline IV (max. 40 mL/kg)" },
      { type: "mica", text: "Consider intubation as per CPG A0302 Endotracheal Intubation if required to facilitate cooling" }
    ],
    notes: "Not for febrile infection. Aggressive cooling: ice packs, fanning, cold IV fluid. Cold saline 20 mL/kg (elderly) or 40 mL/kg (young/fit). Differentiate from drug-induced hyperthermia (A0719)."
  },

  // -----------------------------------------------------------
  // A0726 Acute Alcohol Intoxication
  // -----------------------------------------------------------
  alcohol_intoxication: {
    cpg: "A0726",
    title: "Acute Alcohol Intoxication (Ethanol)",
    careObjectives: [
      "Exclude differential diagnoses and manage co-morbid conditions.",
      "Assess risk and determine appropriate disposition.",
      "Manage high-risk findings."
    ],
    management: [
      { type: "note", items: ["Status: recent ingestion of ethanol AND differential diagnoses excluded AND no other acute medical conditions"] },
      { type: "assess", items: [
        "Ongoing mental status examination and conscious state assessment",
        "Assessment of medical decision-making capacity (CPG A0111 Consent and Capacity)",
        "AUDIT-C Tool",
        "Assess for alcohol withdrawal",
        "High risk findings: red flags (CPG A0108), arrhythmia, aspiration or significant aspiration risk, head injury, hypoglycaemia, fever or hypothermia, moderate to severe agitation, moderate to severe alcohol withdrawal syndrome, unmanaged pain or nausea, inability to walk with minimal assistance, chronic renal failure or liver disease"
      ]},
      { type: "action", text: "Airway and ventilation support if required" },
      { type: "action", text: "Manage nausea" },
      { type: "action", text: "Manage pain" },
      { type: "action", text: "Manage hypoglycaemia" },
      { type: "action", text: "Manage shock" },
      { type: "header", text: "Disposition" },
      { type: "action", text: "Self-care if low risk with competent adult present and able to care for patient" },
      { type: "action", text: "Referral if moderate risk and sobering services available in community" },
      { type: "action", text: "Transport if moderate risk and no sobering services available in community OR patient lacks capacity OR high risk findings present" }
    ],
    notes: "Exclude differentials before attributing to alcohol alone. High-risk findings mandate transport. AUDIT-C and capacity assessment required."
  },

  // -----------------------------------------------------------
  // A0727 Alcohol Withdrawal Syndrome
  // -----------------------------------------------------------
  alcohol_withdrawal: {
    cpg: "A0727",
    title: "Alcohol Withdrawal Syndrome",
    careObjectives: [
      "Identify and assess severity of alcohol withdrawal syndrome.",
      "Symptomatic management.",
      "Reduce risk of progression to severe alcohol withdrawal.",
      "Identify appropriate disposition."
    ],
    management: [
      { type: "assess", items: ["AUDIT-C", "Alcohol Withdrawal Scale (AWS)", "Mental Status Assessment", "Competing medical conditions or significant traumatic injury"] },
      { type: "header", text: "Mild alcohol withdrawal \u2014 AWS < 5" },
      { type: "action", text: "Antiemetic" },
      { type: "action", text: "Pain relief" },
      { type: "action", text: "Outpatient withdrawal management: consult patient\u2019s regular GP OR VVED if regular GP not available" },
      { type: "action", text: "Self-care advice: hydration, nutrition, thiamine supplementation, pain relief, psychosocial supports, withdrawal expectations" },
      { type: "header", text: "Moderate alcohol withdrawal \u2014 AWS 5\u201314" },
      { type: "note", items: ["Assess for features that increase likelihood of complex withdrawal: history of alcohol withdrawal delirium or seizure; previous withdrawal episodes; age > 65; comorbid illness (particularly TBI); long duration of heavy and regular alcohol consumption; seizure during current withdrawal episode; concomitant use of other addictive substances; signs and symptoms of co-occurring psychiatric disorder of moderate or greater severity"] },
      { type: "action", text: "Antiemetic" },
      { type: "action", text: "Pain relief" },
      { type: "action", text: "Consult with VVED for care planning" },
      { type: "action", text: "If patient commenced on outpatient withdrawal management: self-care advice (hydration, nutrition, thiamine supplementation, pain relief, psychosocial supports, withdrawal expectations)" },
      { type: "action", text: "FOLLOWING CONSULT WITH VVED/DACAS, if patient transported for inpatient management and symptoms causing significant discomfort or agitation: Midazolam 2.5\u20135 mg IV; repeat Midazolam 2.5\u20135 mg IV after 5 minutes (max. 20 mg) titrated to patient response, aiming for SAT score 0 or -1" },
      { type: "header", text: "Severe alcohol withdrawal \u2014 AWS > 14 / Delirium Tremens / Withdrawal seizures" },
      { type: "action", text: "Antiemetic" },
      { type: "action", text: "Pain relief" },
      { type: "action", text: "If symptoms causing significant distress or agitation: Midazolam 2.5\u20135 mg IV; repeat Midazolam 2.5\u20135 mg IV after 5 minutes (max. 20 mg) titrated to patient response, aiming for SAT of 0 or -1; if unable to gain IV access: Midazolam IM (same dose as IV)" },
      { type: "action", text: "Patient refractory to initial doses of Midazolam: escalate care / request MICA; Midazolam 2.5\u20135 mg IV; repeat Midazolam 2.5\u20135 mg IV after 5 minutes (total max. 30 mg) titrated to patient response, aiming for rousable drowsiness (SAT of 0 to -1); consult DACAS via AV Clinician if approaching 30 mg" },
      { type: "action", text: "Seizures: Mx as per CPG A0703 Seizures" },
      { type: "action", text: "Shock: Mx as per CPG A0705 Shock" }
    ],
    notes: "AWS scale drives severity. Midazolam for moderate\u2013severe (post VVED/DACAS consult for moderate). Severe: Midazolam titrated, max 20 mg initial; max 30 mg with MICA escalation. Target SAT 0 to -1."
  },



  // -----------------------------------------------------------
  // M0101-1 The Maternity Patient
  // -----------------------------------------------------------
  maternity_patient: {
    cpg: "M0101-1",
    title: "The Maternity Patient",
    careObjectives: [
      "Assessment and safe management of the pregnant patient",
      "Prioritise assessment and resuscitation of the mother – welfare of the fetus is optimised by providing best available care to the mother"
    ],
    management: [
      { type: "header", text: "Definitions" },
      { type: "note", items: [
        "Term: 37–42 weeks gestation. Preterm: 23–< 37 weeks gestation",
        "Imminent birth: active pushing/grunting; rectal pressure – urge to use bowels or bladder; anal pouting/bulging perineum; strong unstoppable urge to push; presenting part (baby's head) on view – crowning; mother's statement – 'I am going to have the baby'",
        "Precipitate birth: unusually rapid labour (less than 4 hours) with extremely quick birth"
      ]},
      { type: "header", text: "Position (if patient > 20 weeks pregnant)" },
      { type: "action", text: "Allow the woman to assume a safe position of comfort. If supine, a left lateral tilt can help to reduce aorta-caval compression and subsequent hypotension" },
      { type: "action", text: "A 30° tilt can be achieved by placing a wedge (using blankets or pillows if required) under the patient's right hip. This can significantly improve BP" },
      { type: "action", text: "If patient requires spinal immobilisation, then she should be packaged and tilted as an entire unit with a 15° tilt" },
      { type: "header", text: "Supplemental O₂" },
      { type: "action", text: "To maintain SpO₂ > 94%" },
      { type: "header", text: "IV Access and Fluid Therapy" },
      { type: "action", text: "Early IV access required in emergencies" },
      { type: "note", items: [
        "Consider high compensatory ability in pregnancy. The mother may lose up to 30–35% (2 L) circulating blood volume before showing signs of shock/hypotension",
        "Fetus may be compromised even when the mother appears stable"
      ]},
      { type: "header", text: "Stabilisation" },
      { type: "action", text: "Assessment and resuscitation of the mother must take priority as ultimately the welfare of the fetus is optimised by providing the best available care to the mother" },
      { type: "action", text: "If there is any doubt as to the application of any maternity CPG, consult with PIPER" },
      { type: "header", text: "Triage" },
      { type: "note", items: [
        "Fetal morbidity and mortality can occur with seemingly minor blunt trauma",
        "All injured pregnant women should have an obstetric assessment due to the risk of placental abruption",
        "Even minor injuries may be associated with complications such as feto-maternal haemorrhage"
      ]},
      { type: "stop", text: "Contact Paediatric Infant Perinatal Emergency Retrieval (PIPER) 24/7 via Clinician or on 1300 137 650" },
    ],
    notes: "Left lateral tilt > 20 weeks to prevent aorto-caval compression. High compensatory capacity — significant haemorrhage before signs of shock. Fetus may deteriorate even when mother appears stable. PIPER = 1300 137 650."
  },

  // -----------------------------------------------------------
  // M0202 Pre-eclampsia / Eclampsia
  // -----------------------------------------------------------
  preeclampsia_eclampsia: {
    cpg: "M0202",
    title: "Pre-eclampsia / Eclampsia",
    careObjectives: [
      "Time critical emergency requiring early recognition, intervention and prompt transport to reduce perinatal and maternal mortality"
    ],
    management: [
      { type: "assess", items: [
        "Hypertension",
        "Pre-eclampsia signs and symptoms",
        "Seizure activity",
        "Gestation > 20 weeks"
      ]},
      { type: "note", items: [
        "Signs and symptoms of pre-eclampsia include: headache; cerebral irritability/agitation; visual disturbances (flashing lights, shimmering); nausea and/or vomiting; heartburn/epigastric or abdominal pain; hyper-reflexia. An elevation of 20 mmHg above normal blood pressure may be sufficient to indicate pre-eclampsia if other signs or symptoms are present",
        "Uterine pain and/or PV bleeding may signify abruption",
        "The most common cause of seizures in pregnancy is pre-existing epilepsy. New onset seizures in the latter half of pregnancy are most commonly eclampsia",
        "Seizures may occur during or post birth, usually within 48 hours of birth. There are no reliable clinical indicators to predict eclampsia. Eclamptic seizures usually do not last longer than 90 seconds and are self-limiting",
        "The only definitive treatment is birth of the baby"
      ]},
      { type: "header", text: "Normal BP" },
      { type: "action", text: "Consider other causes of complaint. Manage symptomatically" },
      { type: "header", text: "Significant Hypertension (SBP 140–170 mmHg, DBP 90–110 mmHg)" },
      { type: "action", text: "Basic care. Left lateral tilt position" },
      { type: "header", text: "Severe Hypertension (SBP > 170 mmHg, DBP > 110 mmHg + pre-eclampsia S&S)" },
      { type: "action", text: "Consult with PIPER to manage hypertension" },
      { type: "header", text: "Seizure Activity – Eclampsia" },
      { type: "action", text: "Manage as per CPG A0703 Seizures. Left lateral tilt position. High flow O₂" },
      { type: "header", text: "Post Seizure" },
      { type: "action", text: "Assess for aspiration and manage symptomatically. Manage precipitous delivery as per CPG M0301 Normal Birth. Manage placental abruption as per CPG M0201 Antepartum Haemorrhage" },
      { type: "stop", text: "Provide early hospital notification. Contact PIPER via Clinician or on 1300 137 650" },
      { type: "header", text: "IHT – Nifedipine" },
      { type: "action", text: "Initial hospital dose is 10 mg oral, repeated after 30 minutes if inadequate response" },
      { type: "header", text: "MICA Only IHT Drugs" },
      { type: "note", items: ["Loading doses and infusions should be established prior to transport"] },
      { type: "mica", text: "IHT – IV Magnesium Sulphate: indicated for severe pre-eclampsia and for seizure prophylaxis. Infusion via a dedicated line and controlled infusion device with ECG monitoring in situ. A usual loading dose is 4 g IV over 10–15 minutes or via IM with maintenance infusion usually at 1 g/hr (4 mmol/hr) until at least 24 hours post delivery or last seizure" },
      { type: "mica", text: "IHT – IV Labetalol: initial IV bolus of 20 mg given slowly over 2 minutes. This can be repeated every 10 minutes until optimal BP is achieved or max. dose of 300 mg delivered. Alternatively a 20–160 mg/hr infusion can follow the initial bolus titrated to achieve optimal BP" },
      { type: "mica", text: "IHT – IV Hydralazine: initial IV bolus (usually 5–10 mg) over 5–10 minutes. This can be repeated two more times at 30 minute intervals. Maintenance infusion run at 5 mg/hr. Adjust rate to maintain BP between 140–160/90–100 mmHg. The BP should not fall below 140/80 mmHg as the placental circulation will have adapted to a higher BP" },
    ],
    notes: "Visual disturbances + headache + hypertension = pre-eclampsia until proven otherwise. New seizure in second half of pregnancy = eclampsia. Self-limiting seizures. Definitive treatment = birth. Magnesium sulphate for seizure prophylaxis (MICA IHT). PIPER for advice."
  },

  // -----------------------------------------------------------
  // M0301 Normal Birth
  // -----------------------------------------------------------
  normal_birth: {
    cpg: "M0301",
    title: "Normal Birth",
    careObjectives: [
      "Safe management of normal out-of-hospital birth"
    ],
    management: [
      { type: "assess", items: [
        "Maternity history",
        "Labour progression"
      ]},
      { type: "stop", text: "Opioid analgesics are C/I in late second stage labour" },
      { type: "header", text: "Normal Birth – Not Imminent" },
      { type: "action", text: "Reassure. Monitor regularly for change. Transport to appropriate maternity service facility using a left lateral tilt position. Provide analgesia as per CPG A0501 Pain Relief" },
      { type: "header", text: "Imminent Normal Birth – Preparation" },
      { type: "action", text: "Reassure including cultural considerations. Prepare equipment for normal birth. Provide a warm and clean environment. Provide analgesia as per CPG A0501 Pain Relief" },
      { type: "header", text: "Normal Birth – Birth of Head" },
      { type: "action", text: "As head advances, encourage the mother to push with each contraction" },
      { type: "action", text: "If head is birthing too fast, ask mother to pant with an open mouth during contractions instead" },
      { type: "action", text: "Place fingers on baby’s head to feel strength of descent of head" },
      { type: "action", text: "Apply gentle pressure to the perineum to reduce risk of perineal tears" },
      { type: "action", text: "If precipitous, apply gentle backward and downward pressure to control sudden expulsion of the head. Do not hold back forcibly" },
      { type: "action", text: "Note the time once head is delivered" },
      { type: "header", text: "Normal Birth – Umbilical Cord Check" },
      { type: "action", text: "Following the birth of the head, check for umbilical cord around neck" },
      { type: "action", text: "If loose and wrapped around neck: slip over baby’s head with appropriate traction. If tight: mother should be encouraged to push; where the baby does not descend and cord still cannot be loosened, clamp and cut cord" },
      { type: "header", text: "Normal Birth – Head Rotation" },
      { type: "action", text: "With the next contraction the head will turn to face one of the mother’s thighs (restitution). This indicates internal rotation of shoulders in preparation for birth of body" },
      { type: "header", text: "Normal Birth – Birth of the Shoulders and Body" },
      { type: "action", text: "May be passive or guided birth. Hold baby’s head between hands and if required apply gentle downwards pressure to deliver the anterior (top) shoulder. Once the baby’s anterior shoulder is visible, if necessary to assist birth, apply gentle upward pressure to birth posterior shoulder – the body will follow quickly" },
      { type: "action", text: "Support the baby. Note time of birth" },
      { type: "action", text: "Place baby skin to skin with mother on her chest to maintain warmth unless baby is not vigorous/requires resuscitation" },
      { type: "action", text: "Manage the vigorous newborn as per CPG N0101 Newborn Baby. Manage the non vigorous newborn as per CPG N0201 Newborn Resuscitation" },
      { type: "action", text: "If the body fails to deliver in < 60 sec after the head, manage as per CPG M0305 Shoulder Dystocia" },
      { type: "action", text: "Following delivery of baby, gently palpate abdomen to ensure second baby is not present" },
      { type: "header", text: "Normal Birth – Clamping and Cutting the Cord" },
      { type: "action", text: "There is no immediate urgency to cut the cord. Wait for the cord to stop pulsating, which commonly takes one to two minutes. Allow birthing partner to cut the cord if they wish. Ideally, cord cutting should be undertaken prior to extrication" },
      { type: "action", text: "To cut the cord, apply first clamp 10 cm from the baby and the second clamp a further 5 cm from the first, then cut between the two clamps" },
      { type: "action", text: "For uncomplicated births, a parental birthing preference where mother and baby are transported to hospital still attached is permissable e.g. lotus births" },
      { type: "header", text: "Normal Birth – Birthing Placenta (Third Stage)" },
      { type: "action", text: "Allow placental separation to occur spontaneously without intervention. This may take from 15 minutes up to 1 hour. Position mother sitting or squatting to allow gravity to assist expulsion. Breast feeding may assist separation or expulsion" },
      { type: "stop", text: "Do not pull on cord – wait for signs of separation: lengthening of cord; uterus becomes rounded, firmer, smaller; trickle or gush of blood from vagina; cramping/contractions return" },
      { type: "action", text: "Placenta and membranes are birthed by maternal effort. Ask mother to give a little push. Use two hands to support and remove placenta using a twisting ‘see saw’ motion to ease membranes slowly out of the vagina" },
      { type: "action", text: "Note time of delivery of placenta. Place placenta and blood clots into a container and transfer. Inspect placenta and membranes for completeness. Inspect that fundus is firm, contracted and central. Continue to monitor fundus though do not massage once firm" },
      { type: "action", text: "If fundus is not firm or blood loss > 500 mL, manage as per CPG M0401 Primary Postpartum Haemorrhage (PPH)" },
    ],
    notes: "Hands-off approach for delivery. Do not pull baby. Delayed cord clamping preferred unless resuscitation needed. Do not pull on cord in third stage. PIPER for complications."
  },

  // -----------------------------------------------------------
  // M0302 Breech / Compound Presentation
  // -----------------------------------------------------------
  breech_birth: {
    cpg: "M0302",
    title: "Breech / Compound Presentation",
    careObjectives: [
      "Safe management of breech or compound presentation birth"
    ],
    management: [
      { type: "assess", items: [
        "Stage of labour and birth imminent",
        "Buttocks or both feet presenting first",
        "One foot or hand/arm presenting first"
      ]},
      { type: "stop", text: "Opioid analgesics are C/I in late second stage labour. Do not attempt delivery of one foot or hand/arm presentation. Only proceed with delivery if birth is imminent" },
      { type: "note", items: [
        "Types: Frank breech – buttocks first, hips flexed and legs extended on the abdomen (most common = ½ of all breech presentations). Complete breech – buttocks first, hips and knees flexed. Footling – one or both feet present as neither hips nor knees are fully flexed",
        "It is normal for meconium to be passed as the baby’s buttocks are squeezed",
        "Cord prolapse is more common with breech presentation",
        "If a known breech and birth is not imminent, transport to a booked obstetric unit with capacity for surgical intervention. Provide early hospital notification",
        "In the setting of precipitous delivery with back not uppermost, consider positioning mother kneeling on all fours to allow restitution"
      ]},
      { type: "header", text: "Non Imminent Birth" },
      { type: "action", text: "General maternal care. Transport to booked appropriate maternity service unit with notification" },
      { type: "header", text: "One Foot, Hand or Arm Presenting" },
      { type: "action", text: "Do not attempt to deliver. Transport urgently to an appropriate maternity service unit with notification. Consult with PIPER for advice" },
      { type: "header", text: "Imminent Breech Birth – Buttocks or Both Feet Presenting" },
      { type: "action", text: "Keep mother informed of progress. Encourage mother to push hard with contractions. Position mother with buttocks to bed edge with legs supported (lithotomy position). A hands off approach encourages the baby to maintain a position of flexion, which simplifies birth. Only touch to gently support. If too much stimulus is provided the baby will extend flexed head. Main force of birth is maternal effort. Do not attempt to pull baby out. The key is to allow the birth to occur spontaneously with minimal handling of the newborn. Most additional manoeuvres are only required in the event of delay. Prevent hypothermia by maintaining a warm environment. Use available resources e.g. warm towels or bubble wrap to wrap the baby if the body is exposed for an extended period. Cool air may stimulate breathing which is not desirable if the head remains unborn" },
      { type: "header", text: "Buttocks First – Back Uppermost – Delivery of Body/Legs" },
      { type: "action", text: "This is the most common presentation. Do not attempt to pull the baby out. Encourage mother to push hard with contractions. Feet and legs should spring free. Await further descent. Keep body warm by wrapping in a towel or bubble wrap if needed. The body will further descend to the clavicles and arms should swing free. Let baby hang until the nape of neck is visible. The baby should face downward. Assist birth of the head using modified Mauriceau Smellie Veit Manoeuvre" },
      { type: "header", text: "Buttocks First – Back Uppermost – Modified Mauriceau Smellie Veit Manoeuvre" },
      { type: "action", text: "Place the index and ring finger of non dominant hand on the baby’s shoulders and middle finger on the occiput to assist with flexion of the head. Place dominant hand under the baby to support the body, with ring and index fingers on the baby’s cheekbones. Slowly lift the baby straight up in a circle onto the mother’s abdomen, allowing the head to birth slowly. An assistant can aid flexion of head by applying direct pressure behind the pubic bone" },
      { type: "header", text: "Buttocks First – Back Not Uppermost" },
      { type: "action", text: "The baby’s back needs to remain uppermost. If legs delivered and back is not uppermost: gently hold the baby by placing thumbs on bony sacrum with fingers around thighs. Do not squeeze the abdomen. Rotate/turn baby uppermost between contractions taking care of baby’s spine. Take great care to never pull the baby" },
      { type: "header", text: "Buttocks First – Legs Don’t Birth Spontaneously (Frank Breech)" },
      { type: "action", text: "If extended legs (frank breech): slip one hand along the leg of the baby lying anteriorly and place a finger behind the baby’s knee and deliver it by flexion and abduction" },
      { type: "header", text: "Buttocks First – Arms Don’t Birth Spontaneously – Lovsett’s Manoeuvre" },
      { type: "action", text: "Hold baby by the sacrum. Turn baby 90 degrees so that one shoulder is in the antero-posterior diameter. Insert a finger into the brachial plexus and sweep the arm down over the baby’s chest. Turn baby 180 degrees so that the opposite shoulder is in the antero-posterior diameter. Repeat the finger manoeuvre. Turn the baby 90 degrees again so that the back is uppermost. Await further descent. Do not pull or apply traction" },
      { type: "stop", text: "Contact PIPER via Clinician or on 1300 137 650 for advice" },
    ],
    notes: "Hands-off approach. Do not pull. Position = lithotomy. Cool air may stimulate breathing before head delivered. Cord prolapse risk higher with breech. PIPER for complex cases."
  },

  // -----------------------------------------------------------
  // M0304 Cord Prolapse
  // -----------------------------------------------------------
  cord_prolapse: {
    cpg: "M0304",
    title: "Cord Prolapse",
    careObjectives: [
      "Time critical emergency – early diagnosis, immediate intervention and prompt transport to reduce perinatal mortality"
    ],
    management: [
      { type: "assess", items: [
        "Cord visible at vulva",
        "Ruptured membranes",
        "Stage of labour"
      ]},
      { type: "stop", text: "This is a time critical emergency – early diagnosis, immediate intervention and prompt transport to an appropriate facility are effective in reducing the perinatal mortality rate. Notify the receiving hospital early. Contact PIPER via Clinician or on 1300 137 650 for advice" },
      { type: "note", items: [
        "In most instances caesarean section is the preferred method of birth; however if birth is imminent encourage mother to push – this ONLY applies when the presenting part is distending the perineum and the mother is pushing uncontrollably. Prepare for resuscitation of the newborn as per CPG N0201 Newborn Resuscitation",
        "Cord prolapse is usually associated with an unstable lie or malpresentation",
        "Cord handling should be kept to a minimum as this can lead to vasospasm or contraction of umbilical vessels",
        "Key history: time membranes ruptured, how long has the cord been visible, due date, fetal movement felt, onset of labour, contractions present, fetal presentation if known, PV bleeding"
      ]},
      { type: "header", text: "Birth Not Imminent – Management of Mother" },
      { type: "action", text: "Position patient semi-prone with hips elevated over folded towels. Provide explanation and reassurance. Oxygen as per CPG A0001 Oxygen Therapy" },
      { type: "header", text: "Birth Not Imminent – Management of Cord" },
      { type: "action", text: "Minimise cord handling. Keep cord warm and moist. Use 2 fingers to gently place cord in vagina. If unsuccessful cover with warm saline packs (if possible)" },
      { type: "header", text: "Birth Not Imminent – Management of Presenting Part" },
      { type: "action", text: "If there is pressure on the cord by the presenting part, insert fingers into vagina and push the presenting part (head) away from the cord. Maintain pressure until birth commences or advised to release" },
      { type: "header", text: "Birth Commencing" },
      { type: "action", text: "Instruct mother to push. Assist in delivery. Prepare for newborn resuscitation. Manage as per CPG M0301 Normal Birth and CPG N0201 Newborn Resuscitation" },
    ],
    notes: "Time critical. Minimise cord handling. C-section destination preferred. Push only if birth imminent. Keep cord warm and moist. PIPER immediately."
  },

  // -----------------------------------------------------------
  // M0305 Shoulder Dystocia
  // -----------------------------------------------------------
  shoulder_dystocia: {
    cpg: "M0305",
    title: "Shoulder Dystocia",
    careObjectives: [
      "Time critical – 5–7 minutes to deliver baby due to compression of the cord against the pelvic rim"
    ],
    management: [
      { type: "assess", items: [
        "Normal birthing procedure fails to accomplish delivery",
        "Prolonged head-to-body delivery time (> 60 sec)",
        "Difficulty with birth of face and chin",
        "Baby’s head retracts against perineum (turtle sign)",
        "Failure of baby’s head to restitute",
        "Failure of shoulders to descend",
        "Difficulty reaching neck when attempting to check for cord around neck",
        "Baby’s head colour turns purple then black"
      ]},
      { type: "note", items: [
        "Explain the situation to the mother to gain maximum co-operation",
        "It is important to note times of birth of head, timing of manoeuvres and delivery of body",
        "The newborn is likely to be compromised in this setting and require resuscitation",
        "During procedures, be prepared for a sudden release of resistance and be prepared to take hold of the baby",
        "The process of releasing the baby may cause injury, particularly clavicle fracture. Manage any such injury appropriately including arm immobilisation"
      ]},
      { type: "header", text: "Prolonged Head to Body Delivery Time (> 60 sec)" },
      { type: "action", text: "Note time of birth of head. Request urgent additional assistance. Explain to mother and ask her to push with focused effort when required. Position mother with buttocks at bed edge. Apply gentle downward traction to deliver anterior shoulder" },
      { type: "header", text: "Delivery Accomplished – Newborn" },
      { type: "action", text: "Manage as per CPG N0201 Newborn Resuscitation. Assess for clavicle injury and immobilise if necessary" },
      { type: "header", text: "Delivery Accomplished – Mother" },
      { type: "action", text: "Basic care. Reassure" },
      { type: "header", text: "Delivery Not Accomplished after 30–60 sec" },
      { type: "stop", text: "At no time attempt to rotate the baby’s head — rotate shoulders using pressure on the baby’s scapula instead" },
      { type: "action", text: "Alternate the following sequence until baby is delivered. Manage as per Delivery accomplished if successful at any time" },
      { type: "header", text: "McRobert’s Manoeuvre – Hyperflexion of Maternal Hips (knees to nipples)" },
      { type: "action", text: "Place mother in a recumbent position. Hips to edge of bed enabling better access for gentle downward traction. Assist mother to grasp her knees and pull her knees/thighs back as far as possible onto her abdomen (use assistant to help achieve and maintain position)" },
      { type: "header", text: "Suprapubic Pressure (whilst in McRobert’s position)" },
      { type: "action", text: "Hands in CPR position behind symphysis pubis, at 45° angle along baby’s back (trying to rotate baby forward). Apply 30 sec firm downward pressure, then 30 sec rocking motion to get shoulder out from under rim, at rate of approx 1 per sec" },
      { type: "header", text: "All Fours (Gaskin) Manoeuvre" },
      { type: "action", text: "Rotate mother to all fours. Hold baby’s head and apply gentle downward traction – attempting to dis-impact and deliver the posterior shoulder (now uppermost)" },
      { type: "header", text: "Delivery Remains Unaccomplished" },
      { type: "action", text: "Consult with PIPER regarding when to abandon manoeuvres and transport. If unable to consult, transport with notification. Transport in McRobert’s manoeuvre position with 30° left lateral tilt" },
    ],
    notes: "5–7 minute window. Prepare for newborn resuscitation. McRobert’s then suprapubic pressure then Gaskin (all fours). Never rotate the baby’s head. If unsuccessful – consult PIPER about transport vs continued attempts."
  },

  // -----------------------------------------------------------
  // N0101 The Newborn Baby
  // -----------------------------------------------------------
  the_newborn: {
    cpg: "N0101",
    title: "The Newborn Baby",
    careObjectives: [
      "Establish and maintain effective respiration",
      "Prevent hypothermia",
      "Transport to appropriate facility"
    ],
    management: [
      { type: "assess", items: [
        "Breathing",
        "Muscle tone"
      ]},
      { type: "note", items: [
        "Normal values: weight average 3.5 kg; blood volume 80 mL/kg; HR 110–170; RR 25–60; temperature 36.5–37.5°C; BGL 2.6–3.2 mmol/L",
        "Targeted SpO₂ post birth (pulse oximeter on right wrist/hand, pre-ductal): 1 min 60–70%; 3 mins 70–90%; 5 mins 80–90%; 7–10 mins > 90%",
        "Appearance: dusky and peripherally cyanosed in the first few minutes is normal. Blue-ish/purple hands and feet are normal in the first 24 hours after birth. Supplemental oxygen is generally not required where the newborn is breathing effectively and the HR is > 100",
        "APGAR scores should not be used as a guide for resuscitation. Conducted at 1 minute and 5 minutes post birth, then repeated at 5 minute intervals until APGAR score > 7"
      ]},
      { type: "header", text: "Breathing Adequately and Good Muscle Tone (Vigorous Newborn)" },
      { type: "action", text: "Continue to dry (especially the head). Maintain warm (skin-to-skin, blankets, hat). Routine suction is not recommended. Monitor HR (auscultation), breathing, tone and colour. If vital signs deteriorate or airway is obstructed at any stage, manage as per CPG N0201 Newborn Resuscitation" },
      { type: "header", text: "Apnoeic or Gasping or No Muscle Tone" },
      { type: "action", text: "Non vigorous newborn. Manage as per CPG N0201 Newborn Resuscitation" },
      { type: "header", text: "Normal Newborn: Resuscitation Not Required" },
      { type: "action", text: "Cut cord once cord has stopped pulsating (approx 1–2 mins) unless parental preference is to remain attached. Note APGAR when practicable" },
      { type: "header", text: "Warming by Gestational Age" },
      { type: "action", text: "Term/preterm (32–42 wks): place the newborn skin to skin on mother, simultaneously dry them, cover with fresh towels/blanket or bubble wrap, place a beanie" },
      { type: "action", text: "Very preterm (< 32 wks), witnessed: leave the newborn wet as the remaining fluid remains warm. Place straight into a polyethylene bag with a hole pre-cut for the head, dry head and place a beanie" },
      { type: "action", text: "Very preterm (< 32 wks), unwitnessed: dry the newborn as the remaining fluid is likely now cold. Place in a polyethene bag with a hole pre-cut for the head and place a beanie" },
      { type: "stop", text: "Chemical self-warming blankets must NOT be used to warm neonates" },
      { type: "header", text: "Suction" },
      { type: "action", text: "Routine suction is not required in vigorous newborns, even if the infant was born through meconium stained amniotic fluid. Suction is only indicated when airway obstruction is suspected" },
      { type: "header", text: "Transport Destination" },
      { type: "action", text: "> 36 weeks gestation, uncomplicated delivery, stable vital signs: transport to appropriate maternity service (e.g. pre-booked hospital)" },
      { type: "action", text: "32–36 weeks gestation AND stable vital signs: transport to a level 2 hospital (paediatrician and midwife on site 24/7) in consultation with PIPER" },
      { type: "action", text: "< 32 weeks gestation, or unstable vital signs: transport to tertiary centre in consultation with PIPER" },
      { type: "action", text: "Rural Victoria: transport to nearest base hospital or hospital with maternity service and contact PIPER" },
    ],
    notes: "Skin-to-skin for vigorous newborn. Polyethylene bag for very preterm (< 32 wks). SpO₂ norms are LOW at birth – targets increase over first 10 min. APGAR not a resuscitation guide. Routine suction not recommended. Chemical self-warming blankets contraindicated."
  },

  // -----------------------------------------------------------
  // N0201 Newborn Resuscitation
  // -----------------------------------------------------------
  newborn_resuscitation: {
    cpg: "N0201",
    title: "Newborn Resuscitation",
    careObjectives: [
      "Temperature: maintain normothermia",
      "Ventilation: establish and maintain effective ventilation",
      "Escalation of care: seek early backup, expert advice and ensure transport to appropriate facility"
    ],
    management: [
      { type: "note", items: [
        "Ventilation and temperature are the most important principles of newborn resuscitation. Other elements such as supplemental oxygen, IV access and adrenaline are not as important and are unlikely to add any value if they come at the expense of ventilation and temperature",
        "Newborn resuscitation is a complex, high acuity, low occurrence skill. Early backup and early expert advice from PIPER is essential",
        "Heart rate is the most important indicator of effective ventilation"
      ]},
      { type: "header", text: "Initial Assessment" },
      { type: "assess", items: [
        "Adequacy of breathing (regular spontaneous breathing usually occurs within 15–30 seconds with stimulation/drying)",
        "Muscle tone (moving all limbs, flexed posture)"
      ]},
      { type: "action", text: "Good muscle tone and adequate breathing: unlikely to need resuscitation. Manage as per CPG N0101 The Newborn Baby" },
      { type: "header", text: "Apnoeic/Gasping or Poor Muscle Tone" },
      { type: "action", text: "Position: cut cord if necessary to facilitate resuscitation. Move to resus area (fresh towel, bubble wrap)" },
      { type: "action", text: "Airway: neutral position (towel under shoulders). Suction only if airway obstruction suspected" },
      { type: "action", text: "Continue drying/stimulating while assessing (no more than 30 seconds)" },
      { type: "header", text: "Still Apnoeic/Gasping or Poor Muscle Tone or HR < 100" },
      { type: "action", text: "IPPV at 40–60 per minute on room air. Target chest rise and fall. PEEP 5 cm H₂O. Troubleshoot as required: mask size and fit; chin lift and open mouth; ensure neutral airway position; two person BVM technique; increase inspiratory pressure; swap operators; consider suction (if airway occlusion suspected)" },
      { type: "action", text: "Escalate care/PIPER via the AV Clinician if not already contacted. SpO₂ monitoring (right hand or right wrist). ECG monitoring if resources permit, low priority; do not apply to newborns < 28 wks. Reassess after 30 seconds" },
      { type: "header", text: "HR < 60" },
      { type: "action", text: "CPR 3:1 ratio with oxygen (5 L/min). SGA if ≥ 34 weeks. Reassess in two-minute cycles. Intubate only if inadequate ventilation with SGA, or SGA not indicated" },
      { type: "stop", text: "HR < 60 persists despite adequate ventilation: Adrenaline 10 mcg/kg IV 4 minutely" },
      { type: "stop", text: "HR < 60 persists despite adequate ventilation and adrenaline: Normal saline 10–20 mL/kg. Repeat if required (once only)" },
      { type: "header", text: "HR 60–100" },
      { type: "action", text: "Continue IPPV at 40–60 per minute on room air. Reassess after 30 seconds if continuous monitoring not already in place. HR < 100 persists: IPPV with oxygen (5 L/min). HR < 100 persists: SGA if HR < 100 persists (if ≥ 34 weeks)" },
      { type: "header", text: "HR > 100" },
      { type: "action", text: "Monitor closely. IPPV if HR drops below 100 at any stage" },
      { type: "header", text: "Breathing Laboured and/or SpO₂ < 90% Persists 5–10 Minutes Post-birth" },
      { type: "action", text: "Discuss with PIPER. If breathing laboured: IPPV at 40–60 per minute; titrate oxygen (1–5 L/min) if SpO₂ < 90% after 5–10 minutes. If breathing normally: titrate oxygen (1–2 L/min) nasal prongs, target SpO₂ 90%; decrease/discontinue oxygen if SpO₂ > 90%" },
      { type: "header", text: "CPR" },
      { type: "note", items: [
        "3:1 compression to ventilation ratio. Achieve 90 compressions and 30 ventilations per minute with a 0.5 second pause for ventilation (120 events/min). Compression depth approximately 1/3 the depth of the chest",
        "Two thumb, hand encircling technique is preferred. Two-finger technique may be performed if access to the tibia for IO insertion is required",
        "In single rescuer scenarios, focus on effective PPV until back-up arrives. Attempting to perform chest compressions and PPV at 3:1 as a single operator is unlikely to be effective"
      ]},
      { type: "header", text: "Shockable Rhythms" },
      { type: "action", text: "Shockable rhythms are extremely rare in newborns. If observed: apply multifunction electrode pads and defibrillate in manual mode using 4 J/kg at 2-minute intervals" },
      { type: "header", text: "Withholding Resuscitation" },
      { type: "action", text: "Resuscitative efforts should be withheld in newborns < 22 weeks gestation as there is no possibility of successful resuscitation. Where there is any doubt as to the gestation of the newborn, paramedics should attempt resuscitation and consult with PIPER via the AV Clinician" },
      { type: "note", items: [
        "Legal requirement: any infant born at ≥ 20 weeks gestation OR ≥ 400 g birth weight OR showing signs of life must be registered, regardless of gestation"
      ]},
      { type: "mica", text: "Advanced airway: EMMA capnograph with infant airway adaptor required for neonates. Both the monitor and EMMA capnograph should be used to confirm tube placement. Monitor ETCO₂ using the primary (e.g. the monitor) capnograph. Remove the EMMA to reduce strain on the tube but keep the adapter in place in case troubleshooting is required" },
      { type: "mica", text: "ETT sizes: Extremely preterm < 1 kg (< 28 wks) – 2.5 mm, lip length 6–7 cm, laryngoscope 00 straight Miller blade. Moderately preterm 1–3 kg (28–34 wks) – 3.0 mm, lip length 7–9 cm, laryngoscope 0 or 1 straight Miller blade, i-Gel size 1.0 for > 2 kg. Term/near term > 3 kg (≥ 35 wks) – 3.5 mm, lip length 9–10 cm, laryngoscope 0 or 1 straight Miller blade, i-Gel size 1.0 for > 2 kg" },
    ],
    notes: "Ventilation and warmth = highest priorities. HR rise = best indicator of adequate ventilation. 3:1 CPR ratio. PPV within 60 seconds. PIPER early. Do not resuscitate < 22 weeks. EMMA infant adaptor essential for MICA intubation."
  }

};

// Export for use in application
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.cpgPackages;
}
