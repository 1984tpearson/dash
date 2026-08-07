/**
 * dash — Generic Default CPG Package Data
 *
 * The "none" service pack has no clinical practice guideline content at all
 * — deliberately empty. Scenario generation for this pack (generator.html)
 * uses the AI's own general clinical knowledge directly and never injects
 * CPG text into the prompt; nothing in this pack's knowledge questions,
 * vitals, or presentation is grounded in a document. See generator.html's
 * buildCPGContext() — it short-circuits to a lightweight "which named
 * condition was picked" hint (from category_pack_none.js's
 * CPG_SUBTYPE_LABELS, plain taxonomy text, not clinical content) whenever
 * this pack is active, rather than reading anything from this file.
 *
 * This file used to carry a handful of hand-written generic entries
 * (cardiac arrest, ACS, asthma, anaphylaxis, hypoglycaemia, seizures, major
 * trauma) as a partial-coverage placeholder. Removed: partial coverage was
 * actively worse than none — it meant 7 of the ~69 taxonomy conditions got
 * a management/dose grounding block injected into the prompt while the
 * other ~62 got none, an inconsistency with no real justification once
 * "management is never written into the scenario record" was already the
 * rule for every condition regardless of pack. Kept as an empty object
 * (not a deleted file) purely for schema compatibility with code that does
 * `typeof CPG_PACKAGES !== 'undefined'` checks (e.g. quiz_host.html) — see
 * cpg_pack_av.js for the shape a real entry would need if this is ever
 * filled in again for a purpose that actually needs it.
 *
 * Loaded together with category_pack_none.js by cpg_pack_loader.js — see
 * that file's header for why these two always load as a pair.
 */

const CPG_PACKAGES = {};
