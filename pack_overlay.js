/**
 * Shared cross-pack scenario-overlay generation.
 *
 * Loaded by both generator.html (to dual-build a generic KQ set alongside
 * a real-pack generation) and scenario.html (to fill in a missing overlay
 * on-demand, the first time a scenario is viewed under a pack it wasn't
 * generated under). Kept as one shared file rather than duplicated across
 * those two already-huge pages — see CLAUDE.md's service-pack Gotchas
 * entry for the overall design this fits into.
 *
 * Two operations, deliberately asymmetric:
 *
 *   PackOverlay.buildGenericKQ(scenario) — Sonnet only, no classification.
 *   Produces a 5-question, untagged, non-paramedic-specific knowledge-
 *   question set from the scenario's OWN narrative content (dispatch,
 *   provisional diagnosis, ddx, presentation) — deliberately NOT from any
 *   CPG package lookup, since whichever pack happens to be loaded when
 *   this runs may not be the pack the scenario was actually built under
 *   (e.g. the on-demand fallback path: an AV-native scenario opened under
 *   the generic pack has the generic placeholder's CPG_PACKAGES loaded,
 *   which has nothing to do with the AV content this scenario was
 *   actually built from). This is also just correct for what "generic"
 *   questions are supposed to be — general topic knowledge, not citing
 *   any specific guideline text.
 *
 *   PackOverlay.buildRealPackOverlay(scenario) — Haiku classify + Sonnet
 *   generate, against WHICHEVER PACK IS CURRENTLY LOADED (CPG_PACKAGES /
 *   CATEGORY_TO_CPG / CPG_SUBTYPE_LABELS). This is safe specifically
 *   because callers only invoke it when the active pack IS the target —
 *   that's the whole reason an overlay is being built. Returns
 *   {cpg, extra_cpgs, kq} or null on failure (best-effort; caller decides
 *   what to show if it fails, same "never block on this" philosophy as
 *   classifyCPGFromText in generator.html). "cpg" is only the single most
 *   central classified key; any second, related-but-secondary key goes in
 *   "extra_cpgs" — same primary/secondary split generator.html's native
 *   cpg/additional_cpgs fields use, so scenario.html renders it as a small
 *   AI-suggested extra rather than an equally-weighted second primary.
 *
 * Both read the Anthropic key from Supabase app_config directly (same
 * query every AI call site in this codebase uses) rather than depending
 * on either host page's own cached-key variable.
 */
(function () {
  'use strict';

  var _cachedKey = null;
  async function _getAnthropicKey() {
    if (_cachedKey) return _cachedKey;
    var res = await fetch(SUPABASE_URL + '/rest/v1/app_config?key=eq.anthropic_api_key&select=value', {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    });
    if (res.ok) {
      var data = await res.json();
      if (data && data[0] && data[0].value) { _cachedKey = data[0].value; return _cachedKey; }
    }
    throw new Error('AI is temporarily unavailable — contact the administrator.');
  }

  // Same two-pass approach as generator.html's parseFirstJSON — first
  // matching {...} block, JSON.parse as-is, then a JS-comment-stripped
  // retry (models occasionally emit "// note" inside JSON).
  function _parseFirstJSON(raw) {
    var s = raw.replace(/```json|```/g, '').trim();
    var start = s.indexOf('{');
    if (start === -1) throw new Error('No JSON object found in response');
    var depth = 0, end = -1;
    for (var i = start; i < s.length; i++) {
      if (s[i] === '{') depth++;
      else if (s[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end === -1) throw new Error('Unterminated JSON object in response');
    var jsonStr = s.slice(start, end + 1);
    try { return JSON.parse(jsonStr); } catch (e1) {}
    var stripped = jsonStr.replace(/\/\/[^\n\r"]*/g, '');
    return JSON.parse(stripped);
  }

  function _logUsage(model, usage, label) {
    if (usage && window.AVNav && AVNav.logAIUsage) {
      AVNav.logAIUsage({ source: 'pack_overlay', model: model, input_tokens: usage.input_tokens, output_tokens: usage.output_tokens, label: label });
    }
  }

  async function _callClaude(model, maxTokens, systemPrompt, userPrompt, label) {
    var apiKey = await _getAnthropicKey();
    var response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: model, max_tokens: maxTokens, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] })
    });
    if (!response.ok) { var e = await response.json().catch(function () { return {}; }); throw new Error((e.error && e.error.message) || ('API error ' + response.status)); }
    var data = await response.json();
    _logUsage(model, data.usage, label);
    var text = (data.content || []).map(function (b) { return b.text || ''; }).join('');
    return _parseFirstJSON(text);
  }

  // Compact narrative summary of a scenario, pack-independent — used as
  // context for both operations below.
  function _scenarioNarrative(s) {
    return [
      s.title ? 'Title: ' + s.title : '',
      s.dispatch ? 'Dispatch: ' + s.dispatch : '',
      s.provisional ? 'Provisional diagnosis: ' + s.provisional : '',
      (s.ddx && s.ddx.length) ? 'Differentials considered: ' + s.ddx.join(', ') : '',
      s.arrival_hx ? 'Presentation on arrival: ' + s.arrival_hx : '',
      s.caller_hx ? 'Caller/bystander report: ' + s.caller_hx : '',
      (s.life_threats && s.life_threats.length) ? 'Immediate life-threat actions taken: ' + s.life_threats.join('; ') : ''
    ].filter(Boolean).join('\n');
  }

  async function buildGenericKQ(scenario) {
    try {
      var narrative = _scenarioNarrative(scenario);
      if (!narrative) return [];
      var systemPrompt = 'You write short-answer knowledge-recall questions for clinical training use across paramedic, nursing, and medical education, testing general knowledge of the clinical topic a scenario covers. Respond with valid JSON only — no markdown, no preamble. Format: {"kq":[{"q":"...","answer":"...","max":2}, ...]}. Write EXACTLY 5 questions. Do NOT write clinical vignettes or case presentations — never start a question with a patient description. Ask directly for a fact instead: a definition, a threshold/criterion, a general management principle, a contraindication, or what to do in a specific named situation relevant to this clinical topic. Do not reference this specific patient or scenario in the questions — these test broader knowledge of the topic area, not recall of this one case. Phrase questions in general clinical language, not paramedic-specific jargon (avoid "pre-hospital"/"on-scene"/ambulance-specific phrasing) — this content may be used for nursing or medical training as well as paramedic training. Ground every question in genuinely standard, widely-taught clinical knowledge — do not invent obscure or disputed facts. Answers should be short and direct, not paragraphs. Every question object\'s "max" field must be 2.';
      var userPrompt = 'Scenario summary:\n' + narrative + '\n\nWrite 5 general knowledge-recall questions (and model answers) about the clinical topic this scenario covers, per the rules above.';
      var parsed = await _callClaude('claude-sonnet-4-6', 1200, systemPrompt, userPrompt, 'generic KQ downgrade');
      var kq = Array.isArray(parsed && parsed.kq) ? parsed.kq : [];
      return kq.filter(function (q) { return q && q.q && q.answer; }).slice(0, 5).map(function (q) {
        return { q: q.q, answer: q.answer, max: 2 };
      });
    } catch (e) {
      console.error('PackOverlay.buildGenericKQ failed:', e.message);
      return [];
    }
  }

  function _buildCatalogue() {
    var seen = {};
    var lines = [];
    Object.keys(CATEGORY_TO_CPG || {}).forEach(function (catKey) {
      (CATEGORY_TO_CPG[catKey] || []).forEach(function (key) {
        if (seen[key]) return;
        seen[key] = true;
        var pkg = CPG_PACKAGES[key];
        var code = (pkg && pkg.cpg) || '';
        var title = (window.CPG_SUBTYPE_LABELS && CPG_SUBTYPE_LABELS[key]) || (pkg && pkg.title) || key;
        lines.push(key + ' | ' + catKey + ' | ' + code + ' | ' + title);
      });
    });
    return lines.join('\n');
  }

  function _contextForKeys(keys) {
    return keys.map(function (k) {
      var pkg = CPG_PACKAGES[k];
      if (!pkg) return '';
      var mgmtLines = '';
      if (Array.isArray(pkg.management) && pkg.management.length && typeof pkg.management[0] === 'object') {
        mgmtLines = pkg.management.map(function (step) {
          if (!step || !step.type) return '';
          switch (step.type) {
            case 'assess': return '  ASSESS: ' + (step.items || []).join(', ');
            case 'stop':   return '  STOP: ' + step.text;
            case 'header': return '  [' + step.text + ']';
            case 'subheader': return '    (' + step.text + ')';
            case 'action': return step.items ? '  - ' + step.items.join('; ') : '  - ' + step.text;
            case 'note':   return step.items ? '  NOTE: ' + step.items.join('; ') : '  NOTE: ' + step.text;
            case 'mica':   return step.items ? '  MICA: ' + step.items.join('; ') : '  MICA: ' + step.text;
            default: return '';
          }
        }).filter(Boolean).join('\n');
      } else if (Array.isArray(pkg.management)) {
        mgmtLines = pkg.management.filter(Boolean).map(function (s) { return '  - ' + s; }).join('\n');
      }
      return '--- CPG: ' + pkg.title + ' (' + pkg.cpg + ') ---\n' +
        'Care objectives: ' + (pkg.careObjectives || []).join('; ') + '\n' +
        'Management:\n' + mgmtLines + '\n' +
        (pkg.notes ? 'Additional clinical context: ' + pkg.notes + '\n' : '');
    }).filter(Boolean).join('\n');
  }

  // Haiku classify (map this scenario's presentation to the currently-
  // loaded pack's CPG catalogue) + Sonnet generate (3 CPG-grounded, tagged
  // knowledge questions). Only meaningful when a real pack with actual CPG
  // content is the one currently loaded — callers should check
  // hasAvLegalPack()/AVNav.getServicePack().legal first. Returns
  // {cpg, kq} or null (best-effort — never throws to the caller).
  async function buildRealPackOverlay(scenario) {
    try {
      var narrative = _scenarioNarrative(scenario);
      if (!narrative) return null;
      var catalogue = _buildCatalogue();
      if (!catalogue) return null;

      var classifySystem = 'You are classifying a clinical scenario summary against a fixed catalogue of CPG codes. Respond with valid JSON only — no markdown, no preamble. Format: {"keys":["key1","key2"]}. Rules: (1) Only use keys that appear exactly as written in the catalogue below (the first column before the first "|"). (2) Return the 1-2 keys that are the CLOSEST clinically appropriate match, even if no exact match exists — pick the nearest reasonable fit rather than returning nothing. (3) Only return an empty array if the summary gives genuinely no clinical signal to classify. (4) Order matters — put the single most central/primary condition first.\n\nCATALOGUE (key | category | code | title):\n' + catalogue;
      var classifyUser = 'Scenario summary:\n' + narrative + '\n\nReturn the best-fitting CPG key(s) as JSON.';
      var classifyParsed = await _callClaude('claude-haiku-4-5-20251001', 200, classifySystem, classifyUser, 'pack overlay classification');
      var validKeys = {};
      Object.keys(CPG_PACKAGES || {}).forEach(function (k) { validKeys[k] = true; });
      var keys = (Array.isArray(classifyParsed && classifyParsed.keys) ? classifyParsed.keys : []).filter(function (k) { return validKeys[k]; }).slice(0, 2);
      if (!keys.length) return null;

      var context = _contextForKeys(keys);
      var kqSystem = 'You write short-answer knowledge-recall questions for clinical training, testing direct factual knowledge of the CPG content provided. All clinical content must come exclusively from the CPG content provided — no invented facts. Respond with valid JSON only, no markdown. Format: {"kq":[{"q":"...","answer":"...","cpgCode":"...","max":2}, ...]}. Write EXACTLY 3 questions. Each item must include a "cpgCode" field set to the exact CPG code of the guideline that question is testing, taken from the "--- CPG: title (code) ---" headers below — never leave it blank or invent a code that is not shown. Do NOT write a clinical vignette or case presentation — never start with a patient description. Ask directly for the fact instead: a dose/route, a threshold/criterion, a contraindication, an indication, a definition, or what to do in a specific named situation from the CPG. Answers should be short and direct, not paragraphs. Every question object\'s "max" field must be 2.\n\n' + context;
      var kqUser = 'Scenario summary (for topical relevance only — do not reference it in the questions):\n' + narrative + '\n\nWrite 3 CPG-grounded, tagged knowledge questions per the rules above.';
      var kqParsed = await _callClaude('claude-sonnet-4-6', 1200, kqSystem, kqUser, 'pack overlay KQ generation');
      var kq = (Array.isArray(kqParsed && kqParsed.kq) ? kqParsed.kq : []).filter(function (q) { return q && q.q && q.answer && q.cpgCode; }).slice(0, 3).map(function (q) {
        return { q: q.q, answer: q.answer, cpgCode: q.cpgCode, max: 2 };
      });
      if (!kq.length) return null;

      // keys[0] is the single most central/primary condition (per the classify
      // prompt's rule 4) — only that one becomes the primary "cpg". Any second
      // key is a related-but-secondary guideline, so it goes in "extra_cpgs"
      // instead, same as generator.html's native "additional_cpgs" field —
      // otherwise scenario.html renders every classified key as an equally-
      // weighted primary CPG (e.g. an anaphylaxis scenario also showing
      // "Essential Airway Management" as a second primary, just because
      // airway is clinically related, not because it's a distinct primary
      // condition here).
      var codes = keys.map(function (k) { return CPG_PACKAGES[k] && CPG_PACKAGES[k].cpg; }).filter(Boolean);
      return { cpg: codes[0] || '', extra_cpgs: codes.slice(1), kq: kq };
    } catch (e) {
      console.error('PackOverlay.buildRealPackOverlay failed:', e.message);
      return null;
    }
  }

  window.PackOverlay = {
    buildGenericKQ: buildGenericKQ,
    buildRealPackOverlay: buildRealPackOverlay
  };
})();
