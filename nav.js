// ============================================================
// nav.js — Shared hamburger nav, sidebar, and Settings modal
// for the Scenario Trainer suite (scenario.html, generator.html,
// index.html). Reuses the host page's own Supabase client
// (exposed on window.__avSupabaseClient) if one already exists,
// to avoid multiple GoTrueClient instances sharing the same
// auth storage key in the same tab. Falls back to creating its
// own client for pages that don't set one up.
//
// Usage per page:
//   1. Include the Supabase CDN script BEFORE this file.
//   2. Add <div id="avnav-slot"></div> somewhere in the topbar.
//   3. Add <script src="nav.js"></script> before </body>.
//   4. (Optional but recommended) add the anti-flash theme
//      snippet in <head> — see scenario.html for the pattern.
// ============================================================
(function () {
  'use strict';

  var SUPABASE_URL = 'https://befsjenbaruxqrntuhpn.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlZnNqZW5iYXJ1eHFybnR1aHBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MjA5MjAsImV4cCI6MjA4ODE5NjkyMH0.hOFFbIvd1wAgu-QyghupQ-7ttSpg7sxz_UsJbXyXztA';
  var ADMIN_UUID = 'fe1f2d3f-2139-44ec-bbe0-14ad6bb748ac';

  // Per-million-token USD pricing for AI usage cost tracking.
  // Add a new entry here whenever a new model is used anywhere in the suite.
  var MODEL_PRICING = {
    'claude-sonnet-4-6': { input: 3, output: 15 },
    'claude-haiku-4-5-20251001': { input: 1, output: 5 }
  };
  var SEARCH_COST = 0.01; // per web_search call

  if (typeof supabase === 'undefined') {
    console.error('nav.js: supabase-js must be loaded before nav.js');
    return;
  }
  // Reuse the host page's client if it already created one (scenario.html,
  // generator.html, index.html all do). Only create a fresh one otherwise.
  var _sb = window.__avSupabaseClient || supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  if (!window.__avSupabaseClient) window.__avSupabaseClient = _sb;

  var _session = null;
  var _profile = null;
  var _adminUsers = [];
  var _adminUsersScenarios = {};
  var _avatarPickerTarget = null; // null = editing own avatar; else a user id (admin editing someone else)

  // ------------------------------------------------------------------
  // Service packs — swappable role/level taxonomy + attribution text.
  // The base app ships "none": generic, tied to no real-world service.
  // Loading a pack (currently just "av") swaps the Settings/Edit-User
  // role & level dropdowns to that service's own taxonomy and shows its
  // attribution text at the bottom of the sidebar. Nothing else in the
  // app hardcodes a specific service's role/level terminology — the
  // stored profile fields (av_role/level) are just opaque strings to
  // every other page, so adding a second pack later is only ever a new
  // entry here, no other file needs touching. Active pack persists
  // per-browser in localStorage (av_service), same mechanism as
  // av_theme — see setServicePack()/activeServicePack() below.
  // ------------------------------------------------------------------
  var DEFAULT_SERVICE_ID = 'none';
  var SERVICE_PACKS = {
    none: {
      label: 'None (generic)',
      roles: [
        ['', 'Select role…'],
        ['Instructor', 'Instructor'],
        ['Student', 'Student'],
        ['Other', 'Other']
      ],
      levels: [
        ['', 'Select level…'],
        ['Basic', 'Basic'],
        ['Advanced', 'Advanced'],
        ['NA', 'Other/NA']
      ],
      copyrightHtml: '',
      legal: null
    },
    av: {
      label: 'Ambulance Victoria',
      roles: [
        ['', 'Select role…'],
        ['CI', 'Clinical Instructor (CI)'],
        ['PE', 'Paramedic Educator (PE)'],
        ['GAP', 'Graduate Ambulance Paramedic (GAP)'],
        ['CSO', 'Clinical Support Officer (CSO)'],
        ['OnRoad', 'On Road'],
        ['UniStudent', 'University Student'],
        ['NonAV', 'Non-AV'],
        ['Other', 'Other']
      ],
      levels: [
        ['', 'Select level…'],
        ['MICA', 'MICA'],
        ['ALS', 'ALS'],
        ['ACO', 'ACO'],
        ['CERT', 'CERT'],
        ['NA', 'Other/NA']
      ],
      copyrightHtml: 'Role, level, and clinical-guideline terminology in this pack are modelled on Ambulance Victoria classifications, for training purposes only. Not affiliated with or endorsed by Ambulance Victoria.',
      // Longer-form legal/attribution text used by scenario.html's page
      // footer and per-scenario footer — null on any pack without real
      // sourced clinical content (i.e. "none") so those call sites can
      // render nothing at all rather than a generic placeholder.
      legal: {
        cpgSourceLabel: 'Ambulance Victoria Clinical Practice Guidelines (CPGs) Version 3.13.0',
        clinicalContentNoticeHtml: 'The clinical scenarios, drug doses, CPG references, and assessment criteria contained in this tool are based on <strong>Ambulance Victoria Clinical Practice Guidelines (CPGs) Version 3.13.0</strong>. Clinical content derived from AV CPGs remains the intellectual property of Ambulance Victoria. This tool reproduces CPG-based clinical content for educational and assessment purposes only. AV CPGs are publicly available documents intended to guide clinical practice; reproduction of scenario-based educational content derived from these guidelines is undertaken in good faith for non-commercial training use.',
        affiliationNoticeHtml: 'This tool is <strong>not affiliated with, endorsed by, or approved by Ambulance Victoria</strong>. It is an independent educational aid. All clinical content should be verified against current official AV CPGs before use in formal assessment.',
        scenarioFooterNotAffiliatedShort: 'Not an official AV product.'
      }
    }
  };

  function activeServicePackId() {
    var id = localStorage.getItem('av_service') || DEFAULT_SERVICE_ID;
    return SERVICE_PACKS[id] ? id : DEFAULT_SERVICE_ID;
  }
  function activeServicePack() {
    return SERVICE_PACKS[activeServicePackId()];
  }
  function servicePackOptionsHtml() {
    var activeId = activeServicePackId();
    return Object.keys(SERVICE_PACKS).map(function (id) {
      return '<option value="' + id + '"' + (id === activeId ? ' selected' : '') + '>' + escapeHtml(SERVICE_PACKS[id].label) + '</option>';
    }).join('');
  }
  function renderCopyrightFooter() {
    var el = document.getElementById('avnav-copyright');
    if (!el) return;
    var html = activeServicePack().copyrightHtml;
    el.style.display = html ? 'block' : 'none';
    el.innerHTML = html;
  }
  // Swaps which service pack is active. Rebuilds any role/level dropdown
  // currently in the DOM in place (rather than requiring a reload) so
  // switching pack while Settings is open reflects immediately.
  function setServicePack(id) {
    if (!SERVICE_PACKS[id]) return;
    localStorage.setItem('av_service', id);
    var roleSel = document.getElementById('avnav-settings-role');
    var levelSel = document.getElementById('avnav-settings-level');
    if (roleSel) roleSel.innerHTML = optionsHtml(activeServicePack().roles, roleSel.value);
    if (levelSel) levelSel.innerHTML = optionsHtml(activeServicePack().levels, levelSel.value);
    var serviceSel = document.getElementById('avnav-service-select');
    if (serviceSel) serviceSel.value = activeServicePackId();
    renderCopyrightFooter();
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function optionsHtml(list, selected) {
    return list.map(function (r) {
      return '<option value="' + r[0] + '"' + (r[0] === (selected || '') ? ' selected' : '') + '>' + escapeHtml(r[1]) + '</option>';
    }).join('');
  }

  function avatarHtmlFor(name, avatarUrl) {
    if (avatarUrl) return '<img src="' + escapeHtml(avatarUrl) + '" alt="">';
    var initials = (name || '').split(/\s+/).filter(Boolean).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase() || '?';
    return escapeHtml(initials);
  }

  async function sbFetch(path, opts) {
    opts = opts || {};
    var token = (_session && _session.access_token) || SUPABASE_KEY;
    var res = await fetch(SUPABASE_URL + '/rest/v1/' + path, Object.assign({}, opts, {
      headers: Object.assign({
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Prefer': opts.prefer || 'return=representation'
      }, opts.headers || {})
    }));
    if (!res.ok) {
      var err = await res.json().catch(function () { return {}; });
      throw new Error(err.message || ('Supabase error ' + res.status));
    }
    var text = await res.text();
    return text ? JSON.parse(text) : [];
  }

  function isAdmin() {
    return (_profile && _profile.role === 'admin') || (_session && _session.user.id === ADMIN_UUID);
  }

  // Guests never get a Supabase session for browsing (login.html just sets this
  // flag) — scenario reads are public via RLS so no auth is needed to view.
  // The flag is cleared the moment a real session shows up (see init()) so a
  // stale flag from a previous visit never shadows a real signed-in user.
  // A real Supabase session with is_anonymous=true (created on-demand when a
  // guest joins a quiz as a player) also counts as guest.
  function isGuest() {
    if (_session) return !!_session.user.is_anonymous;
    return localStorage.getItem('av_guest_mode') === 'true';
  }

  // Shared AI usage/cost logger. Call after any Anthropic API call from any
  // tool in the suite. Fire-and-forget: never throws, never blocks the caller.
  //   AVNav.logAIUsage({ source: 'generator', model: 'claude-sonnet-4-6',
  //     input_tokens, output_tokens, search_count, label: 'optional context' })
  async function logAIUsage(opts) {
    try {
      opts = opts || {};
      var pricing = MODEL_PRICING[opts.model] || { input: 0, output: 0 };
      var inTok = opts.input_tokens || 0;
      var outTok = opts.output_tokens || 0;
      var searches = opts.search_count || 0;
      var cost = (inTok / 1e6 * pricing.input) + (outTok / 1e6 * pricing.output) + (searches * SEARCH_COST);
      await sbFetch('ai_usage_log', {
        method: 'POST',
        prefer: 'return=minimal',
        body: JSON.stringify({
          source: opts.source || 'unknown',
          label: opts.label || null,
          model: opts.model || 'unknown',
          input_tokens: inTok,
          output_tokens: outTok,
          search_count: searches,
          cost_usd: Number(cost.toFixed(5)),
          user_id: _session ? _session.user.id : null,
          user_name: (_profile && _profile.display_name) || (_session && _session.user.email) || null
        })
      });
    } catch (e) {
      console.error('AVNav.logAIUsage failed:', e.message);
    }
  }

  // Sums search_count logged today (local calendar day) for the current user
  // and a given source. Returns null on failure — callers should treat null
  // as "assume the limit is reached" (fail closed on cost control).
  async function getTodaySearchCount(source) {
    try {
      var uid = _session ? _session.user.id : null;
      if (!uid) return null;
      var startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      var rows = await sbFetch('ai_usage_log?select=search_count&source=eq.' + encodeURIComponent(source) +
        '&user_id=eq.' + encodeURIComponent(uid) + '&created_at=gte.' + encodeURIComponent(startOfDay.toISOString()));
      return rows.reduce(function (sum, r) { return sum + (r.search_count || 0); }, 0);
    } catch (e) {
      console.error('AVNav.getTodaySearchCount failed:', e.message);
      return null;
    }
  }

  function identity() {
    return {
      uuid: _session ? _session.user.id : '',
      name: (_profile && _profile.display_name) || (_session && _session.user.email) || '',
      svcNum: (_profile && _profile.svc_num) || '',
      avRole: (_profile && _profile.av_role) || '',
      level: (_profile && _profile.level) || '',
      branch: (_profile && _profile.branch) || '',
      avatarUrl: (_profile && _profile.avatar_url) || ''
    };
  }

  var THEME_CSS = ''
    + '[data-theme="arctic"]{--navy:#0277BD;--navy-dark:#01579B;--navy-light:#0288D1;--amber:#0288D1;--amber-light:#E1F5FE;--btn-accent:#E87A00;--green:#00897B;--green-light:#E0F2F1;--blue:#1565C0;--blue-light:#E3F2FD;--purple:#6A1B9A;--purple-light:#F3E5F5;--red:#C62828;--red-light:#FFEBEE;--grey:#546E7A;--light:#EEF5FB;--white:#FFFFFF;--text:#0D2137;--border:#B8D4EA;--shadow:0 2px 8px rgba(2,119,189,0.13);}'
    + '[data-theme="rose"]{--navy:#8B3A52;--navy-dark:#6B2A3E;--navy-light:#A84E68;--amber:#D45C78;--amber-light:#FDEEF2;--btn-accent:#D4A000;--green:#4A7C5A;--green-light:#EBF4EE;--blue:#3D6B9E;--blue-light:#E8F0F8;--purple:#7B4FA0;--purple-light:#F3ECF8;--red:#B71C3C;--red-light:#FDECF0;--grey:#8A6070;--light:#FDF5F7;--white:#FFFFFF;--text:#2A0D18;--border:#E8C8D0;--shadow:0 2px 8px rgba(139,58,82,0.12);}'
    + '[data-theme="sage"]{--navy:#2D5A3D;--navy-dark:#1E3E2A;--navy-light:#3D7050;--amber:#3D8B5A;--amber-light:#EAF5EE;--btn-accent:#D47A00;--green:#2E7D52;--green-light:#E8F5EE;--blue:#2E6D9E;--blue-light:#E8F0F8;--purple:#5A3D8A;--purple-light:#F0ECF8;--red:#A62828;--red-light:#FDECEC;--grey:#6A8A72;--light:#F2F8F4;--white:#FFFFFF;--text:#0F2218;--border:#C0D9C8;--shadow:0 2px 8px rgba(45,90,61,0.12);}'
    + '[data-theme="sand"]{--navy:#7C5A2A;--navy-dark:#5A3E18;--navy-light:#9A7038;--amber:#C8882A;--amber-light:#FDF3E3;--btn-accent:#C85A00;--green:#4A6A3A;--green-light:#EDF4E8;--blue:#3A6080;--blue-light:#E8EEF4;--purple:#6A4A7A;--purple-light:#F0ECF8;--red:#A03020;--red-light:#FDECEC;--grey:#8A7258;--light:#FAF6EE;--white:#FFFDF8;--text:#2C1A00;--border:#E0CFA8;--shadow:0 2px 8px rgba(124,90,42,0.12);}'
    + '[data-theme="mint"]{--navy:#1A6B6B;--navy-dark:#0E4848;--navy-light:#228888;--amber:#00B8A0;--amber-light:#E0FAF6;--btn-accent:#E07000;--green:#1A9060;--green-light:#E0F5EC;--blue:#1A60A0;--blue-light:#E0EEF8;--purple:#5A3A8A;--purple-light:#F0ECF8;--red:#A02828;--red-light:#FDECEC;--grey:#4A8A80;--light:#F0FAF8;--white:#FFFFFF;--text:#082020;--border:#B0DDD8;--shadow:0 2px 8px rgba(26,107,107,0.13);}'
    + '[data-theme="paper"]{--navy:#1A1A1A;--navy-dark:#000000;--navy-light:#333333;--amber:#333333;--amber-light:#EEECE8;--btn-accent:#1A5BAA;--green:#2A5A2A;--green-light:#E8F4E8;--blue:#1A3A6A;--blue-light:#E8EEF8;--purple:#3A1A6A;--purple-light:#F0ECF8;--red:#8A1A1A;--red-light:#FDECEC;--grey:#6A6A6A;--light:#F5F2ED;--white:#FDFBF7;--text:#111111;--border:#D8D0C4;--shadow:0 2px 8px rgba(0,0,0,0.10);}'
    + '[data-theme="midnight"]{--navy:#0D1B2A;--navy-dark:#060E18;--navy-light:#162438;--amber:#00E5FF;--amber-light:rgba(0,229,255,0.12);--btn-accent:#00E5FF;--green:#00E676;--green-light:rgba(0,230,118,0.12);--blue:#448AFF;--blue-light:rgba(68,138,255,0.12);--purple:#E040FB;--purple-light:rgba(224,64,251,0.12);--red:#FF5252;--red-light:rgba(255,82,82,0.12);--grey:#7A90A8;--light:#162535;--white:#1E3048;--text:#DDE8F4;--border:#2A4060;--shadow:0 2px 12px rgba(0,0,0,0.6);}'
    + '[data-theme="forest"]{--navy:#162618;--navy-dark:#0C1A0E;--navy-light:#1F3622;--amber:#FFD600;--amber-light:rgba(255,214,0,0.12);--btn-accent:#FFD600;--green:#69F0AE;--green-light:rgba(105,240,174,0.12);--blue:#40C4FF;--blue-light:rgba(64,196,255,0.12);--purple:#EA80FC;--purple-light:rgba(234,128,252,0.12);--red:#FF6E6E;--red-light:rgba(255,110,110,0.12);--grey:#7A9E80;--light:#1A3020;--white:#223828;--text:#E0EEE2;--border:#2E4A34;--shadow:0 2px 12px rgba(0,0,0,0.5);}'
    + '[data-theme="ocean"]{--navy:#0A2038;--navy-dark:#061828;--navy-light:#0E2E4E;--amber:#00C8A0;--amber-light:rgba(0,200,160,0.12);--btn-accent:#00C8A0;--green:#00E676;--green-light:rgba(0,230,118,0.12);--blue:#40C4FF;--blue-light:rgba(64,196,255,0.12);--purple:#CE93D8;--purple-light:rgba(206,147,216,0.12);--red:#FF6E6E;--red-light:rgba(255,110,110,0.12);--grey:#5A8898;--light:#112438;--white:#183A54;--text:#CCE8F0;--border:#1E4468;--shadow:0 2px 12px rgba(0,0,0,0.6);}'
    + '[data-theme="dusk"]{--navy:#2A1E3A;--navy-dark:#1A1228;--navy-light:#362850;--amber:#FF9A6C;--amber-light:rgba(255,154,108,0.12);--btn-accent:#FF9A6C;--green:#80CBC4;--green-light:rgba(128,203,196,0.12);--blue:#82B1FF;--blue-light:rgba(130,177,255,0.12);--purple:#CE93D8;--purple-light:rgba(206,147,216,0.12);--red:#FF8A80;--red-light:rgba(255,138,128,0.12);--grey:#8A7AA8;--light:#221830;--white:#302044;--text:#E8DCF4;--border:#44305E;--shadow:0 2px 12px rgba(0,0,0,0.55);}'
    + '[data-theme="midnight"],[data-theme="forest"],[data-theme="ocean"],[data-theme="dusk"]{color-scheme:dark;}';

  var THEME_LIST = [
    ['default','Default','linear-gradient(135deg,#1C3A6E 50%,#E8921A 50%)'],
    ['arctic','Arctic','linear-gradient(135deg,#0277BD 50%,#EEF5FB 50%)'],
    ['rose','Rose','linear-gradient(135deg,#8B3A52 50%,#FDF5F7 50%)'],
    ['sage','Sage','linear-gradient(135deg,#2D5A3D 50%,#F2F8F4 50%)'],
    ['sand','Sand','linear-gradient(135deg,#7C5A2A 50%,#FAF6EE 50%)'],
    ['mint','Mint','linear-gradient(135deg,#1A6B6B 50%,#F0FAF8 50%)'],
    ['paper','Paper','linear-gradient(135deg,#1A1A1A 50%,#F5F2ED 50%)'],
    ['midnight','Midnight','linear-gradient(135deg,#0D1B2A 50%,#00E5FF 50%)'],
    ['forest','Forest','linear-gradient(135deg,#162618 50%,#FFD600 50%)'],
    ['ocean','Ocean','linear-gradient(135deg,#0A2038 50%,#00C8A0 50%)'],
    ['dusk','Dusk','linear-gradient(135deg,#2A1E3A 50%,#FF9A6C 50%)']
  ];

  // Pre-made avatar images living in /avatars on the deployed site.
  // Hardcoded list — GitHub Pages has no directory-listing API.
  var PRESET_AVATARS = [
    'pixellab-colourful-comic-book-style-clo-1782880385465.png',
    'pixellab-colourful-comic-book-style-clo-1782880557678.png',
    'pixellab-colourful-comic-book-style-clo-1782880591652.png',
    'pixellab-colourful-comic-book-style-clo-1782880626100.png',
    'pixellab-colourful-comic-book-style-clo-1782880658631.png',
    'pixellab-colourful-comic-book-style-clo-1782880767231.png',
    'pixellab-colourful-comic-book-style-clo-1782880813234.png',
    'pixellab-colourful-comic-book-style-clo-1782880854386.png',
    'pixellab-colourful-comic-book-style-clo-1782880889045.png',
    'pixellab-colourful-comic-book-style-clo-1782880919712.png',
    'pixellab-colourful-comic-book-style-clo-1782881079295.png',
    'pixellab-colourful-comic-book-style-clo-1782881229101.png',
    'pixellab-colourful-comic-book-style-clo-1782881317919.png',
    'pixellab-colourful-comic-book-style-clo-1782881356639.png',
    'pixellab-colourful-comic-book-style-clo-1782881399033.png',
    'pixellab-colourful-comic-book-style-clo-1782881468621.png',
    'pixellab-colourful-comic-book-style-clo-1782881752735.png',
    'pixellab-colourful-comic-book-style-clo-1782881821786.png'
  ];

  var NAV_CSS = ''
    + '#avnav-hamburger{background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);color:white;width:44px;height:44px;border-radius:8px;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}'
    + '#avnav-hamburger:active{background:rgba(255,255,255,0.3);}'
    + '#avnav-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:900;}'
    + '#avnav-overlay.open{display:block;}'
    + '#avnav-sidebar{width:300px;min-width:300px;background:var(--white);border-right:1px solid var(--border);display:flex;flex-direction:column;position:fixed;top:0;left:0;bottom:0;overflow-y:auto;z-index:901;transform:translateX(-100%);transition:transform 0.28s cubic-bezier(0.4,0,0.2,1);box-shadow:4px 0 20px rgba(0,0,0,0.15);}'
    + '#avnav-sidebar.open{transform:translateX(0);}'
    + '.avnav-user-card{display:flex;align-items:center;gap:10px;padding:16px;background:var(--navy);color:white;flex-shrink:0;}'
    + '.avnav-avatar{width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;flex-shrink:0;overflow:hidden;}'
    + '.avnav-avatar img{width:100%;height:100%;object-fit:cover;}'
    + '.avnav-user-info{flex:1;min-width:0;}'
    + '.avnav-user-name{font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
    + '.avnav-user-meta{font-size:11px;opacity:0.75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;}'
    + '.avnav-admin-badge{display:inline-block;background:var(--amber);color:white;font-size:9px;font-weight:700;padding:1px 6px;border-radius:8px;margin-left:6px;vertical-align:middle;}'
    + '.avnav-settings-btn{background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);color:white;width:36px;height:36px;border-radius:8px;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}'
    + '.avnav-settings-btn:active{background:rgba(255,255,255,0.3);}'
    + '.avnav-links{padding:6px 0;border-bottom:1px solid var(--border);}'
    + '.avnav-link{display:flex;align-items:center;gap:10px;padding:12px 16px;font-size:13px;font-weight:600;color:var(--text);text-decoration:none;cursor:pointer;min-height:48px;}'
    + '.avnav-link:active{background:var(--light);}'
    + '.avnav-link .avnav-icon{width:20px;text-align:center;flex-shrink:0;}'
    + '.avnav-bottom{margin-top:auto;padding:12px;border-top:2px solid var(--border);background:var(--light);flex-shrink:0;}'
    + '.avnav-signout-btn{width:100%;padding:12px;border:none;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;background:var(--red);color:white;min-height:48px;}'
    + '.avnav-signout-btn:active{opacity:0.85;}';

  NAV_CSS += ''
    + '.avnav-modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:950;align-items:center;justify-content:center;padding:16px;}'
    + '.avnav-modal-overlay.open{display:flex;}'
    + '.avnav-modal{background:var(--white);border-radius:12px;max-width:420px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.3);}'
    + '.avnav-modal.avnav-modal-wide{max-width:520px;}'
    + '.avnav-modal.avnav-modal-usage{max-width:min(920px,95vw);}'
    + '.avnav-modal-header{background:var(--navy);color:white;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;border-radius:12px 12px 0 0;gap:10px;}'
    + '.avnav-modal-header h2{font-size:16px;font-weight:700;}'
    + '.avnav-modal-close{background:rgba(255,255,255,0.15);border:none;color:white;width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:14px;flex-shrink:0;}'
    + '.avnav-modal-body{padding:20px;color:var(--text);}'
    + '.avnav-form-group{margin-bottom:14px;}'
    + '.avnav-form-group label{display:block;font-size:12px;font-weight:600;color:var(--grey);margin-bottom:5px;}'
    + '.avnav-form-group input,.avnav-form-group select{width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;font-size:14px;font-family:inherit;background:var(--white);color:var(--text);}'
    + '.avnav-readonly{font-size:13px;color:var(--grey);padding:6px 0;}'
    + '.avnav-submit-btn{width:100%;padding:12px;background:var(--navy);color:white;border:none;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer;min-height:44px;}'
    + '.avnav-submit-btn:active{background:var(--navy-dark);}'
    + '.avnav-avatar-upload-row{display:flex;align-items:center;gap:14px;margin-bottom:18px;}'
    + '.avnav-avatar-preview{width:64px;height:64px;border-radius:50%;background:var(--light);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px;color:var(--navy);flex-shrink:0;overflow:hidden;}'
    + '.avnav-avatar-preview img{width:100%;height:100%;object-fit:cover;}'
    + '.avnav-avatar-upload-btn{background:var(--light);border:1px solid var(--border);color:var(--text);padding:8px 12px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;}'
    + '.avnav-avatar-upload-btn:active{background:var(--border);}'
    + '.avnav-avatar-hint{font-size:11px;color:var(--grey);margin-top:6px;}'
    + '.avnav-avatar-picker-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;}'
    + '.avnav-avatar-picker-item{width:100%;aspect-ratio:1;border-radius:50%;overflow:hidden;cursor:pointer;border:3px solid transparent;background:var(--light);}'
    + '.avnav-avatar-picker-item:active{border-color:var(--navy);}'
    + '.avnav-avatar-picker-item img{width:100%;height:100%;object-fit:cover;display:block;}'
    + '.avnav-theme-swatches{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;}'
    + '.avnav-theme-swatch{width:100%;aspect-ratio:1;border-radius:8px;cursor:pointer;border:2px solid transparent;}'
    + '.avnav-theme-swatch.active{border-color:var(--navy);}'
    + '.avnav-scenario-item{display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid var(--border);}'
    + '.avnav-scenario-title{font-size:13px;font-weight:600;color:var(--text);}'
    + '.avnav-scenario-sub{font-size:11px;color:var(--grey);margin-top:2px;}'
    + '.avnav-scenario-load-btn{padding:7px 11px;background:var(--light);color:var(--text);border:1px solid var(--border);border-radius:6px;font-size:12px;font-weight:600;text-decoration:none;flex-shrink:0;}'
    + '.avnav-scenario-delete-btn{padding:7px 11px;background:var(--red-light);color:var(--red);border:1px solid var(--red);border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;flex-shrink:0;}'
    + '.avnav-scenario-delete-btn:active{background:var(--red);color:white;}';

  function injectStyle() {
    var style = document.createElement('style');
    style.textContent = THEME_CSS + NAV_CSS;
    document.head.appendChild(style);
  }

  function swatchesHtml() {
    return THEME_LIST.map(function (t) {
      return '<div class="avnav-theme-swatch" data-theme="' + t[0] + '" title="' + t[1] + '" style="background:' + t[2] + '" onclick="AVNav.applyTheme(\'' + t[0] + '\')"></div>';
    }).join('');
  }

  function injectMarkup() {
    var slot = document.getElementById('avnav-slot');
    if (slot) {
      slot.innerHTML = '<button id="avnav-hamburger" onclick="AVNav.toggle()" title="Menu">☰</button>';
    }

    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div id="avnav-overlay" onclick="AVNav.close()"></div>' +
      '<div id="avnav-sidebar">' +
        '<div class="avnav-user-card">' +
          '<div class="avnav-avatar" id="avnav-avatar">?</div>' +
          '<div class="avnav-user-info">' +
            '<div class="avnav-user-name"><span id="avnav-user-name-text">—</span><span class="avnav-admin-badge" id="avnav-admin-badge" style="display:none">ADMIN</span></div>' +
            '<div class="avnav-user-meta" id="avnav-user-meta">—</div>' +
          '</div>' +
          '<button class="avnav-settings-btn" id="avnav-settings-btn" onclick="AVNav.openSettings()" title="Settings">⚙</button>' +
        '</div>' +
        '<div class="avnav-links">' +
          '<a class="avnav-link" href="index.html"><span class="avnav-icon">🏠</span> Home</a>' +
          '<a class="avnav-link" href="scenario.html"><span class="avnav-icon">⚡</span> DASH</a>' +
        '</div>' +
        '<div class="avnav-links" id="avnav-guest-notice" style="display:none">' +
          '<div style="padding:12px 16px;font-size:12px;color:var(--grey);line-height:1.5">👀 Browsing as a guest — view only. Sign in with Google to save, rate, or generate content.</div>' +
        '</div>' +
        '<div class="avnav-links" id="avnav-member-links">' +
          '<div class="avnav-link" id="avnav-myscenarios-link" onclick="AVNav.openMyScenarios()"><span class="avnav-icon">📁</span> My Scenarios</div>' +
          '<div class="avnav-link" id="avnav-managemine-link" onclick="AVNav.openManageMine()"><span class="avnav-icon">⚙</span> Manage My Scenarios</div>' +
          '<div class="avnav-link" id="avnav-users-link" style="display:none" onclick="AVNav.openUsers()"><span class="avnav-icon">👥</span> Users</div>' +
          '<div class="avnav-link" id="avnav-usage-link" style="display:none" onclick="AVNav.openUsageLog()"><span class="avnav-icon">💲</span> Usage &amp; Costs</div>' +
          '<a class="avnav-link" id="avnav-cpg-link" href="cpg_editor.html" style="display:none"><span class="avnav-icon">📖</span> CPG Editor</a>' +
          '<a class="avnav-link" id="avnav-simconfig-link" href="sim_config_admin.html" style="display:none"><span class="avnav-icon">🛠</span> Sim Config</a>' +
        '</div>' +
        '<div class="avnav-bottom"><button class="avnav-signout-btn" id="avnav-signout-btn" onclick="AVNav.signOut()">⎋ Sign out</button>' +
          '<div id="avnav-copyright" style="display:none;font-size:10px;color:var(--grey);line-height:1.4;margin-top:10px;padding-top:10px;border-top:1px solid var(--border)"></div>' +
        '</div>' +
      '</div>' +
      '<div class="avnav-modal-overlay" id="avnav-settings-modal">' +
        '<div class="avnav-modal">' +
          '<div class="avnav-modal-header"><h2>⚙ Settings</h2><button class="avnav-modal-close" onclick="AVNav.closeSettings()">✕</button></div>' +
          '<div class="avnav-modal-body">' +
            '<div class="avnav-avatar-upload-row">' +
              '<div class="avnav-avatar-preview" id="avnav-settings-avatar-preview">?</div>' +
              '<div>' +
                '<button class="avnav-avatar-upload-btn" onclick="document.getElementById(\'avnav-avatar-file-input\').click()">📷 Change Photo</button>' +
                '<button class="avnav-avatar-upload-btn" onclick="AVNav.openAvatarPicker()" style="margin-left:6px">🖼 Choose Preset</button>' +
                '<input type="file" id="avnav-avatar-file-input" accept="image/png,image/jpeg,image/webp,image/gif" style="display:none" onchange="AVNav.uploadAvatar(this.files[0])">' +
                '<div class="avnav-avatar-hint">JPG, PNG, WebP or GIF, up to 2MB</div>' +
              '</div>' +
            '</div>' +
            '<div class="avnav-form-group"><label>Email</label><div id="avnav-settings-email" class="avnav-readonly"></div></div>' +
            '<div class="avnav-form-group"><label>Display Name</label><input type="text" id="avnav-settings-name" maxlength="60"></div>' +
            '<div class="avnav-form-group"><label>Service Number</label><input type="text" id="avnav-settings-svcnum" maxlength="20"></div>' +
            '<div class="avnav-form-group"><label>Role *</label><select id="avnav-settings-role">' + optionsHtml(activeServicePack().roles, '') + '</select></div>' +
            '<div class="avnav-form-group"><label>Level *</label><select id="avnav-settings-level">' + optionsHtml(activeServicePack().levels, '') + '</select></div>' +
            '<div class="avnav-form-group"><label>Branch / Location</label><input type="text" id="avnav-settings-branch" maxlength="60"></div>' +
            '<div class="avnav-form-group"><label>🎨 Theme</label><div class="avnav-theme-swatches" id="avnav-theme-swatches">' + swatchesHtml() + '</div></div>' +
            '<div class="avnav-form-group" id="avnav-service-group" style="display:none"><label>🏥 Service Pack (admin — affects role/level options for everyone using this browser)</label><select id="avnav-service-select" onchange="AVNav.setServicePack(this.value)">' + servicePackOptionsHtml() + '</select></div>' +
            '<button class="avnav-submit-btn" onclick="AVNav.saveSettings()">💾 Save Changes</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap);

    document.getElementById('avnav-settings-modal').addEventListener('click', function (e) {
      if (e.target === e.currentTarget) AVNav.closeSettings();
    });
  }

  function toggle() {
    var sb = document.getElementById('avnav-sidebar');
    var ov = document.getElementById('avnav-overlay');
    var open = sb.classList.contains('open');
    sb.classList.toggle('open', !open);
    ov.classList.toggle('open', !open);
  }
  function close() {
    document.getElementById('avnav-sidebar').classList.remove('open');
    document.getElementById('avnav-overlay').classList.remove('open');
  }

  function applyTheme(theme) {
    if (theme === 'default') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('av_theme', theme);
    updateThemeSwatches();
  }
  function initTheme() { updateThemeSwatches(); }
  function updateThemeSwatches() {
    var active = localStorage.getItem('av_theme') || 'default';
    document.querySelectorAll('.avnav-theme-swatch').forEach(function (el) {
      el.classList.toggle('active', el.dataset.theme === active);
    });
  }

  function renderAvatarInto(elId, id) {
    var el = document.getElementById(elId);
    if (!el) return;
    if (id.avatarUrl) {
      el.innerHTML = '<img src="' + id.avatarUrl + '" alt="">';
    } else {
      var initials = (id.name || '').split(/\s+/).filter(Boolean).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase() || '?';
      el.textContent = initials;
    }
  }

  function renderUserCard() {
    var id = identity();
    var nameEl = document.getElementById('avnav-user-name-text');
    if (!nameEl) return;
    var guest = isGuest();
    nameEl.textContent = guest ? 'Guest' : (id.name || 'Unknown');
    var meta = [id.avRole, id.level, id.branch].filter(Boolean).join(' · ') || (id.svcNum ? 'Service #' + id.svcNum : '');
    document.getElementById('avnav-user-meta').textContent = guest ? 'View only' : meta;
    var badge = document.getElementById('avnav-admin-badge');
    if (badge) badge.style.display = isAdmin() ? 'inline-block' : 'none';
    var usersLink = document.getElementById('avnav-users-link');
    if (usersLink) usersLink.style.display = isAdmin() ? 'flex' : 'none';
    var usageLink = document.getElementById('avnav-usage-link');
    if (usageLink) usageLink.style.display = isAdmin() ? 'flex' : 'none';
    var cpgLink = document.getElementById('avnav-cpg-link');
    if (cpgLink) cpgLink.style.display = isAdmin() ? 'flex' : 'none';
    var simConfigLink = document.getElementById('avnav-simconfig-link');
    if (simConfigLink) simConfigLink.style.display = isAdmin() ? 'flex' : 'none';
    // Guests get no writes at all — settings, avatar, my-scenarios, and manage-mine
    // all require a real account, so hide them and show a plain sign-in prompt instead.
    var settingsBtn = document.getElementById('avnav-settings-btn');
    if (settingsBtn) settingsBtn.style.display = guest ? 'none' : 'flex';
    var myScenariosLink = document.getElementById('avnav-myscenarios-link');
    if (myScenariosLink) myScenariosLink.style.display = guest ? 'none' : 'flex';
    var manageMineLink = document.getElementById('avnav-managemine-link');
    if (manageMineLink) manageMineLink.style.display = guest ? 'none' : 'flex';
    var guestNotice = document.getElementById('avnav-guest-notice');
    if (guestNotice) guestNotice.style.display = guest ? 'block' : 'none';
    var signoutBtn = document.getElementById('avnav-signout-btn');
    if (signoutBtn) {
      signoutBtn.textContent = guest ? '🔑 Sign in with Google' : '⎋ Sign out';
      signoutBtn.onclick = guest
        ? function () { window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.pathname.split('/').pop() || 'index.html'); }
        : function () { signOut(); };
    }
    if (guest) {
      var avatarEl = document.getElementById('avnav-avatar');
      if (avatarEl) avatarEl.textContent = '👀';
    } else {
      renderAvatarInto('avnav-avatar', id);
    }
    renderCopyrightFooter();
  }

  function openSettings() {
    var id = identity();
    document.getElementById('avnav-settings-email').textContent = (_session && _session.user.email) || '';
    document.getElementById('avnav-settings-name').value = (_profile && _profile.display_name) || '';
    document.getElementById('avnav-settings-svcnum').value = id.svcNum;
    document.getElementById('avnav-settings-role').innerHTML = optionsHtml(activeServicePack().roles, id.avRole);
    document.getElementById('avnav-settings-level').innerHTML = optionsHtml(activeServicePack().levels, id.level);
    document.getElementById('avnav-settings-branch').value = id.branch;
    renderAvatarInto('avnav-settings-avatar-preview', id);
    updateThemeSwatches();
    var serviceGroup = document.getElementById('avnav-service-group');
    if (serviceGroup) serviceGroup.style.display = isAdmin() ? 'block' : 'none';
    var serviceSel = document.getElementById('avnav-service-select');
    if (serviceSel) serviceSel.value = activeServicePackId();
    close();
    document.getElementById('avnav-settings-modal').classList.add('open');
  }
  function closeSettings() {
    document.getElementById('avnav-settings-modal').classList.remove('open');
  }

  async function saveSettings() {
    var displayName = (document.getElementById('avnav-settings-name').value || '').trim();
    var svcNum = (document.getElementById('avnav-settings-svcnum').value || '').trim();
    var avRole = (document.getElementById('avnav-settings-role').value || '').trim();
    var level = (document.getElementById('avnav-settings-level').value || '').trim();
    var branch = (document.getElementById('avnav-settings-branch').value || '').trim();
    if (!avRole) { alert('Please select your role'); return; }
    if (!level) { alert('Please select your level'); return; }
    if (!_session) { alert('No active session — please reload'); return; }
    try {
      await sbFetch('profiles?id=eq.' + _session.user.id, {
        method: 'PATCH',
        body: JSON.stringify({ display_name: displayName || null, svc_num: svcNum || null, av_role: avRole, level: level, branch: branch || null })
      });
      if (_profile) {
        _profile.display_name = displayName || null;
        _profile.svc_num = svcNum || null;
        _profile.av_role = avRole;
        _profile.level = level;
        _profile.branch = branch || null;
      }
      renderUserCard();
      closeSettings();
    } catch (e) {
      alert('Failed to save: ' + e.message);
    }
  }

  async function uploadAvatar(file) {
    if (!file) return;
    if (!_session) { alert('No active session'); return; }
    if (file.size > 2 * 1024 * 1024) { alert('Image must be under 2MB'); return; }
    var ext = (file.name.split('.').pop() || 'png').toLowerCase();
    var path = _session.user.id + '/' + Date.now() + '.' + ext;
    var prevUrl = _profile && _profile.avatar_url;
    try {
      var up = await _sb.storage.from('avatars').upload(path, file, { contentType: file.type });
      if (up.error) throw up.error;
      var pub = _sb.storage.from('avatars').getPublicUrl(path);
      var publicUrl = pub.data.publicUrl;
      await sbFetch('profiles?id=eq.' + _session.user.id, {
        method: 'PATCH',
        body: JSON.stringify({ avatar_url: publicUrl })
      });
      if (_profile) _profile.avatar_url = publicUrl;
      renderUserCard();
      renderAvatarInto('avnav-settings-avatar-preview', identity());
      renderAvatarInto('svcnum-avatar-preview', identity());
      if (prevUrl) {
        var marker = '/object/public/avatars/';
        var idx = prevUrl.indexOf(marker);
        if (idx >= 0) {
          var oldPath = prevUrl.slice(idx + marker.length);
          _sb.storage.from('avatars').remove([oldPath]).catch(function () {});
        }
      }
    } catch (e) {
      alert('Avatar upload failed: ' + e.message);
    }
  }

  function openAvatarPicker(targetUserId) {
    _avatarPickerTarget = targetUserId || null;
    var modal = ensureModal('avnav-avatar-picker-modal', '🖼 Choose an Avatar');
    var body = modal.querySelector('.avnav-modal-body');
    body.innerHTML = '<div class="avnav-avatar-picker-grid">' +
      PRESET_AVATARS.map(function (f) {
        return '<div class="avnav-avatar-picker-item" onclick="AVNav.selectPresetAvatar(\'' + f + '\')"><img src="avatars/' + f + '" alt="" loading="lazy"></div>';
      }).join('') +
    '</div>';
    modal.classList.add('open');
  }

  async function selectPresetAvatar(filename) {
    if (!_session) { alert('No active session'); return; }
    var newUrl = 'avatars/' + filename;
    var editingOther = !!_avatarPickerTarget;
    var targetId = editingOther ? _avatarPickerTarget : _session.user.id;
    var targetProfile = editingOther ? _adminUsers.filter(function (u) { return u.id === targetId; })[0] : null;
    var prevUrl = editingOther ? (targetProfile && targetProfile.avatar_url) : (_profile && _profile.avatar_url);
    try {
      await sbFetch('profiles?id=eq.' + encodeURIComponent(targetId), {
        method: 'PATCH',
        body: JSON.stringify({ avatar_url: newUrl })
      });
      if (editingOther) {
        if (targetProfile) targetProfile.avatar_url = newUrl;
        renderAvatarInto('avnav-edit-user-avatar-preview', { name: targetProfile ? targetProfile.display_name : '', avatarUrl: newUrl });
        renderUsersList();
      } else {
        if (_profile) _profile.avatar_url = newUrl;
        renderUserCard();
        renderAvatarInto('avnav-settings-avatar-preview', identity());
        renderAvatarInto('svcnum-avatar-preview', identity());
      }
      document.getElementById('avnav-avatar-picker-modal').classList.remove('open');
      // best-effort cleanup if the previous avatar was an uploaded (not preset) file
      if (prevUrl) {
        var marker = '/object/public/avatars/';
        var idx = prevUrl.indexOf(marker);
        if (idx >= 0) {
          var oldPath = prevUrl.slice(idx + marker.length);
          _sb.storage.from('avatars').remove([oldPath]).catch(function () {});
        }
      }
    } catch (e) {
      alert('Failed to set avatar: ' + e.message);
    }
  }

  // Fire-and-forget: called when a user finishes the profile-completion step
  // without picking an avatar. Runs silently — no loading UI — and just
  // updates the avatar wherever it's shown once it resolves.
  async function generateAvatarInBackground() {
    if (!_session) return;
    try {
      var res = await fetch(SUPABASE_URL + '/functions/v1/generate-avatar', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + _session.access_token,
          'Content-Type': 'application/json'
        }
      });
      var data = await res.json();
      if (!res.ok || !data.avatar_url) throw new Error(data.error || 'Generation failed');
      if (_profile) _profile.avatar_url = data.avatar_url;
      renderUserCard();
      renderAvatarInto('avnav-settings-avatar-preview', identity());
      renderAvatarInto('svcnum-avatar-preview', identity());
    } catch (e) {
      console.error('Background avatar generation failed:', e.message);
    }
  }

  function ensureModal(id, title, extraClass) {
    var modal = document.getElementById(id);
    if (!modal) {
      modal = document.createElement('div');
      modal.id = id;
      modal.className = 'avnav-modal-overlay';
      modal.innerHTML = '<div class="avnav-modal avnav-modal-wide' + (extraClass ? ' ' + extraClass : '') + '">' +
        '<div class="avnav-modal-header"><h2 id="' + id + '-title"></h2>' +
        '<button class="avnav-modal-close" onclick="document.getElementById(\'' + id + '\').classList.remove(\'open\')">✕</button></div>' +
        '<div class="avnav-modal-body"></div></div>';
      modal.addEventListener('click', function (e) { if (e.target === modal) modal.classList.remove('open'); });
      document.body.appendChild(modal);
    }
    document.getElementById(id + '-title').textContent = title;
    return modal;
  }

  // Generic yes/no confirm dialog. Returns a Promise<boolean> — true if the
  // person clicked confirm, false for cancel or clicking outside the modal.
  //   const ok = await AVNav.confirmModal({ title, message, confirmLabel, cancelLabel });
  function confirmModal(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var modal = document.getElementById('avnav-confirm-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'avnav-confirm-modal';
        modal.className = 'avnav-modal-overlay';
        modal.innerHTML = '<div class="avnav-modal" style="max-width:420px">' +
          '<div class="avnav-modal-header"><h2 id="avnav-confirm-title"></h2></div>' +
          '<div class="avnav-modal-body">' +
            '<p id="avnav-confirm-message" style="margin:0 0 18px;color:var(--text)"></p>' +
            '<div style="display:flex;gap:10px;justify-content:flex-end">' +
              '<button class="avnav-avatar-upload-btn" id="avnav-confirm-cancel-btn"></button>' +
              '<button id="avnav-confirm-ok-btn" style="width:auto;padding:8px 16px;border-radius:8px;border:none;background:var(--amber);color:#1a1a1a;font-weight:700;font-size:13px;cursor:pointer;"></button>' +
            '</div>' +
          '</div></div>';
        document.body.appendChild(modal);
      }
      document.getElementById('avnav-confirm-title').textContent = opts.title || 'Confirm';
      document.getElementById('avnav-confirm-message').textContent = opts.message || '';
      var okBtn = document.getElementById('avnav-confirm-ok-btn');
      var cancelBtn = document.getElementById('avnav-confirm-cancel-btn');
      okBtn.textContent = opts.confirmLabel || 'Continue';
      cancelBtn.textContent = opts.cancelLabel || 'Cancel';
      function finish(result) {
        modal.classList.remove('open');
        modal.removeEventListener('click', overlayHandler);
        okBtn.onclick = null;
        cancelBtn.onclick = null;
        resolve(result);
      }
      function overlayHandler(e) { if (e.target === modal) finish(false); }
      okBtn.onclick = function () { finish(true); };
      cancelBtn.onclick = function () { finish(false); };
      modal.addEventListener('click', overlayHandler);
      modal.classList.add('open');
    });
  }

  async function openMyScenarios() {
    close();
    var modal = ensureModal('avnav-myscenarios-modal', '📁 My Scenarios');
    var body = modal.querySelector('.avnav-modal-body');
    body.innerHTML = '<p style="text-align:center;color:var(--grey);padding:20px">Loading…</p>';
    modal.classList.add('open');
    try {
      var uuid = _session ? _session.user.id : '';
      var rows = await sbFetch('scenarios?is_builtin=eq.false&creator_uuid=eq.' + encodeURIComponent(uuid) +
        '&select=id,title,subtitle,category,ai_generated,created_at&order=created_at.desc');
      if (!rows.length) {
        body.innerHTML = '<div style="text-align:center;padding:24px;color:var(--grey)"><div style="font-size:36px;margin-bottom:12px">📋</div><p>You haven\u2019t created any scenarios yet.</p></div>';
        return;
      }
      body.innerHTML = rows.map(function (s) {
        return '<div class="avnav-scenario-item"><div><div class="avnav-scenario-title">' + escapeHtml(s.title) + '</div>' +
          '<div class="avnav-scenario-sub">' + escapeHtml(s.subtitle || s.category || '') + (s.ai_generated ? ' · AI' : ' · Manual') + '</div></div>' +
          '<a class="avnav-scenario-load-btn" href="scenario.html?id=' + encodeURIComponent(s.id) + '">Load</a></div>';
      }).join('');
    } catch (e) {
      body.innerHTML = '<p style="color:var(--red);padding:16px">Failed to load: ' + escapeHtml(e.message) + '</p>';
    }
  }

  async function openManageMine() {
    close();
    var admin = isAdmin();
    var modal = ensureModal('avnav-manage-modal', admin ? '⚙ Manage My Scenarios (Admin: all users)' : '⚙ Manage My Scenarios');
    var body = modal.querySelector('.avnav-modal-body');
    body.innerHTML = '<p style="text-align:center;color:var(--grey);padding:20px">Loading…</p>';
    modal.classList.add('open');
    try {
      var uuid = _session ? _session.user.id : '';
      var filter = admin ? '' : ('&creator_uuid=eq.' + encodeURIComponent(uuid));
      var rows = await sbFetch('scenarios?is_builtin=eq.false' + filter +
        '&select=id,title,subtitle,category,creator_name,ai_generated,created_at&order=created_at.desc');
      if (!rows.length) {
        body.innerHTML = '<div style="text-align:center;padding:24px;color:var(--grey)"><div style="font-size:36px;margin-bottom:12px">📋</div><p>No custom scenarios yet.</p></div>';
        return;
      }
      body.innerHTML = '<p style="font-size:12px;color:var(--grey);margin-bottom:12px">' + rows.length + ' scenario' + (rows.length !== 1 ? 's' : '') + '.</p>' +
        rows.map(function (s) {
          return '<div class="avnav-scenario-item"><div><div class="avnav-scenario-title">' + escapeHtml(s.title) + '</div>' +
            '<div class="avnav-scenario-sub">' + escapeHtml(s.subtitle || s.category || '') + (admin ? ' · ' + escapeHtml(s.creator_name || 'Unknown') : '') + '</div></div>' +
            '<a class="avnav-scenario-load-btn" href="scenario.html?id=' + encodeURIComponent(s.id) + '">Load</a>' +
            '<button class="avnav-scenario-delete-btn" onclick="AVNav.deleteScenario(\'' + s.id + '\')">Delete</button></div>';
        }).join('');
    } catch (e) {
      body.innerHTML = '<p style="color:var(--red);padding:16px">Failed to load: ' + escapeHtml(e.message) + '</p>';
    }
  }

  async function openUsers() {
    close();
    if (!isAdmin()) return;
    var modal = ensureModal('avnav-users-modal', '👥 Users');
    var body = modal.querySelector('.avnav-modal-body');
    body.innerHTML = '<p style="text-align:center;color:var(--grey);padding:20px">Loading…</p>';
    modal.classList.add('open');
    try {
      var profiles = await sbFetch('profiles?select=id,display_name,svc_num,branch,av_role,level,avatar_url,created_at&order=display_name.asc');
      var scenarios = await sbFetch('scenarios?is_builtin=eq.false&select=id,title,category,creator_uuid,created_at&order=created_at.desc');
      var byUser = {};
      scenarios.forEach(function (s) {
        var key = s.creator_uuid || '';
        (byUser[key] = byUser[key] || []).push(s);
      });
      _adminUsers = profiles;
      _adminUsersScenarios = byUser;
      renderUsersList();
    } catch (e) {
      body.innerHTML = '<p style="color:var(--red);padding:16px">Failed to load: ' + escapeHtml(e.message) + '</p>';
    }
  }

  function renderUsersList() {
    var modal = document.getElementById('avnav-users-modal');
    if (!modal) return;
    var body = modal.querySelector('.avnav-modal-body');
    if (!_adminUsers.length) {
      body.innerHTML = '<div style="text-align:center;padding:24px;color:var(--grey)"><div style="font-size:36px;margin-bottom:12px">👥</div><p>No users found.</p></div>';
      return;
    }
    body.innerHTML = _adminUsers.map(function (p) {
      var userScenarios = _adminUsersScenarios[p.id] || [];
      var meta = [p.av_role, p.level, p.branch].filter(Boolean).join(' · ');
      var scenarioListHtml = userScenarios.length
        ? userScenarios.map(function (s) {
            return '<div class="avnav-scenario-item"><div><div class="avnav-scenario-title">' + escapeHtml(s.title) + '</div>' +
              '<div class="avnav-scenario-sub">' + escapeHtml(s.category || '') + '</div></div>' +
              '<a class="avnav-scenario-load-btn" href="scenario.html?id=' + encodeURIComponent(s.id) + '">Load</a></div>';
          }).join('')
        : '<p style="font-size:12px;color:var(--grey);padding:8px 0 0">No scenarios created.</p>';
      return '<div style="display:flex;gap:12px;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid var(--border)">' +
        '<div class="avnav-avatar" style="width:44px;height:44px">' + avatarHtmlFor(p.display_name, p.avatar_url) + '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">' +
            '<div style="font-weight:700;font-size:14px;color:var(--text)">' + escapeHtml(p.display_name || 'Unnamed') + '</div>' +
            '<button class="avnav-avatar-upload-btn" onclick="AVNav.openEditUser(\'' + p.id + '\')">✎ Edit</button>' +
          '</div>' +
          '<div style="font-size:11px;color:var(--grey);margin:4px 0 8px">' + (p.svc_num ? 'Service #' + escapeHtml(p.svc_num) : 'No service number') + (meta ? ' · ' + escapeHtml(meta) : '') + '</div>' +
          '<div class="avnav-link" style="padding:4px 0;min-height:auto;font-size:12px" onclick="AVNav.toggleUserScenarios(\'' + p.id + '\')">' +
            '<span id="avnav-scen-arrow-' + p.id + '">▸</span>&nbsp;' + userScenarios.length + ' scenario' + (userScenarios.length !== 1 ? 's' : '') +
          '</div>' +
          '<div id="avnav-scen-list-' + p.id + '" style="display:none">' + scenarioListHtml + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function toggleUserScenarios(userId) {
    var list = document.getElementById('avnav-scen-list-' + userId);
    var arrow = document.getElementById('avnav-scen-arrow-' + userId);
    if (!list) return;
    var willOpen = list.style.display === 'none';
    list.style.display = willOpen ? 'block' : 'none';
    if (arrow) arrow.textContent = willOpen ? '▾' : '▸';
  }

  async function openUsageLog() {
    close();
    if (!isAdmin()) return;
    var modal = ensureModal('avnav-usage-modal', '💲 Usage &amp; Costs', 'avnav-modal-usage');
    modal.classList.add('open');
    fetchUsageLog(_usageLogRange);
  }

  var _usageLogRange = 'all';

  function usageRangeStartISO(range) {
    var now = new Date();
    if (range === 'today') {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    }
    if (range === 'week') {
      var day = now.getDay();
      var diff = (day === 0 ? 6 : day - 1); // days since Monday
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff).toISOString();
    }
    if (range === 'month') {
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    }
    return null; // all time — no filter
  }

  async function fetchUsageLog(range) {
    _usageLogRange = range;
    var body = document.querySelector('#avnav-usage-modal .avnav-modal-body');
    if (body) body.innerHTML = '<p style="text-align:center;color:var(--grey);padding:20px">Loading…</p>';
    try {
      var startISO = usageRangeStartISO(range);
      var query = 'ai_usage_log?select=*&order=created_at.desc&limit=5000';
      if (startISO) query += '&created_at=gte.' + encodeURIComponent(startISO);
      var rows = await sbFetch(query);
      renderUsageLog(rows, range);
    } catch (e) {
      if (body) body.innerHTML = '<p style="color:var(--red);padding:16px">Failed to load: ' + escapeHtml(e.message) + '</p>';
    }
  }

  function renderUsageLog(rows, range) {
    var modal = document.getElementById('avnav-usage-modal');
    if (!modal) return;
    var body = modal.querySelector('.avnav-modal-body');
    var ranges = [['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['all', 'All time']];
    var filterHtml = '<div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">' +
      ranges.map(function (r) {
        var active = r[0] === range;
        return '<button onclick="AVNav.fetchUsageLog(\'' + r[0] + '\')" style="padding:6px 12px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;border:1.5px solid ' +
          (active ? 'var(--navy);background:var(--navy);color:white' : 'var(--border);background:white;color:var(--grey)') +
          '">' + r[1] + '</button>';
      }).join('') +
      '</div>';
    if (!rows.length) {
      body.innerHTML = filterHtml + '<div style="text-align:center;padding:24px;color:var(--grey)"><div style="font-size:36px;margin-bottom:12px">💲</div><p>No AI usage logged for this period.</p></div>';
      return;
    }
    var totalCost = 0, bySource = {};
    rows.forEach(function (r) {
      totalCost += Number(r.cost_usd) || 0;
      var s = r.source || 'unknown';
      bySource[s] = (bySource[s] || 0) + (Number(r.cost_usd) || 0);
    });
    var avgCost = totalCost / rows.length;
    var rangeLabel = ranges.filter(function (r) { return r[0] === range; })[0][1];
    var cappedNote = rows.length >= 5000 ? ' (capped at 5000)' : '';
    var summaryHtml = filterHtml + '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px">' +
      '<div style="flex:1;min-width:120px;padding:10px 14px;border:2px solid var(--amber);border-radius:10px;background:var(--amber-light)">' +
        '<div style="font-size:11px;color:var(--grey)">Avg / generation</div>' +
        '<div style="font-size:18px;font-weight:700">$' + avgCost.toFixed(4) + '</div></div>' +
      '<div style="flex:1;min-width:120px;padding:10px 14px;border:2px solid var(--border);border-radius:10px">' +
        '<div style="font-size:11px;color:var(--grey)">Total (' + rangeLabel + ', ' + rows.length + ')' + cappedNote + '</div>' +
        '<div style="font-size:18px;font-weight:700">$' + totalCost.toFixed(4) + '</div></div>' +
      Object.keys(bySource).sort().map(function (s) {
        return '<div style="flex:1;min-width:120px;padding:10px 14px;border:2px solid var(--border);border-radius:10px">' +
          '<div style="font-size:11px;color:var(--grey)">' + escapeHtml(s) + '</div>' +
          '<div style="font-size:18px;font-weight:700">$' + bySource[s].toFixed(4) + '</div></div>';
      }).join('') +
      '</div>';
    var rowsHtml = '<div style="max-height:60vh;overflow-y:auto">' +
      '<table style="width:100%;border-collapse:collapse;font-size:12px">' +
      '<thead><tr style="text-align:left;border-bottom:2px solid var(--border)">' +
        '<th style="padding:6px 8px">When</th><th style="padding:6px 8px">Source</th>' +
        '<th style="padding:6px 8px">User</th><th style="padding:6px 8px">Cost</th>' +
        '<th style="padding:6px 8px">Model</th><th style="padding:6px 8px">Label</th>' +
        '<th style="padding:6px 8px">In</th><th style="padding:6px 8px">Out</th>' +
        '<th style="padding:6px 8px">Searches</th></tr></thead><tbody>' +
      rows.map(function (r) {
        var when = new Date(r.created_at).toLocaleString();
        return '<tr style="border-bottom:1px solid var(--border)">' +
          '<td style="padding:6px 8px;white-space:nowrap">' + escapeHtml(when) + '</td>' +
          '<td style="padding:6px 8px">' + escapeHtml(r.source || '') + '</td>' +
          '<td style="padding:6px 8px">' + escapeHtml(r.user_name || 'Unknown') + '</td>' +
          '<td style="padding:6px 8px;white-space:nowrap;font-weight:700">$' + Number(r.cost_usd || 0).toFixed(4) + '</td>' +
          '<td style="padding:6px 8px;white-space:nowrap">' + escapeHtml(r.model || '') + '</td>' +
          '<td style="padding:6px 8px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + escapeHtml(r.label || '') + '">' + escapeHtml(r.label || '') + '</td>' +
          '<td style="padding:6px 8px">' + (r.input_tokens || 0) + '</td>' +
          '<td style="padding:6px 8px">' + (r.output_tokens || 0) + '</td>' +
          '<td style="padding:6px 8px">' + (r.search_count || 0) + '</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table></div>';
    body.innerHTML = summaryHtml + rowsHtml;
  }

  function openEditUser(userId) {
    var p = _adminUsers.filter(function (u) { return u.id === userId; })[0];
    if (!p) return;
    var modal = ensureModal('avnav-edit-user-modal', '✎ Edit User');
    var body = modal.querySelector('.avnav-modal-body');
    body.innerHTML =
      '<div class="avnav-avatar-upload-row">' +
        '<div class="avnav-avatar-preview" id="avnav-edit-user-avatar-preview">' + avatarHtmlFor(p.display_name, p.avatar_url) + '</div>' +
        '<button class="avnav-avatar-upload-btn" onclick="AVNav.openAvatarPicker(\'' + p.id + '\')">🖼 Choose Preset</button>' +
      '</div>' +
      '<div class="avnav-form-group"><label>Display Name</label><input type="text" id="avnav-edit-user-name" maxlength="60" value="' + escapeHtml(p.display_name || '') + '"></div>' +
      '<div class="avnav-form-group"><label>Service Number</label><input type="text" id="avnav-edit-user-svcnum" maxlength="20" value="' + escapeHtml(p.svc_num || '') + '"></div>' +
      '<div class="avnav-form-group"><label>Role</label><select id="avnav-edit-user-role">' + optionsHtml(activeServicePack().roles, p.av_role) + '</select></div>' +
      '<div class="avnav-form-group"><label>Level</label><select id="avnav-edit-user-level">' + optionsHtml(activeServicePack().levels, p.level) + '</select></div>' +
      '<div class="avnav-form-group"><label>Branch / Location</label><input type="text" id="avnav-edit-user-branch" maxlength="60" value="' + escapeHtml(p.branch || '') + '"></div>' +
      '<button class="avnav-submit-btn" onclick="AVNav.saveEditUser(\'' + p.id + '\')">💾 Save Changes</button>';
    modal.classList.add('open');
  }

  async function saveEditUser(userId) {
    var displayName = (document.getElementById('avnav-edit-user-name').value || '').trim();
    var svcNum = (document.getElementById('avnav-edit-user-svcnum').value || '').trim();
    var avRole = (document.getElementById('avnav-edit-user-role').value || '').trim();
    var level = (document.getElementById('avnav-edit-user-level').value || '').trim();
    var branch = (document.getElementById('avnav-edit-user-branch').value || '').trim();
    try {
      await sbFetch('profiles?id=eq.' + encodeURIComponent(userId), {
        method: 'PATCH',
        body: JSON.stringify({ display_name: displayName || null, svc_num: svcNum || null, av_role: avRole || null, level: level || null, branch: branch || null })
      });
      var p = _adminUsers.filter(function (u) { return u.id === userId; })[0];
      if (p) {
        p.display_name = displayName || null;
        p.svc_num = svcNum || null;
        p.av_role = avRole || null;
        p.level = level || null;
        p.branch = branch || null;
      }
      document.getElementById('avnav-edit-user-modal').classList.remove('open');
      renderUsersList();
      if (userId === (_session && _session.user.id) && _profile) {
        _profile.display_name = displayName || null;
        _profile.svc_num = svcNum || null;
        _profile.av_role = avRole || null;
        _profile.level = level || null;
        _profile.branch = branch || null;
        renderUserCard();
      }
    } catch (e) {
      alert('Failed to save: ' + e.message);
    }
  }

  async function deleteScenario(id) {
    if (!confirm('Delete this scenario? This cannot be undone.')) return;
    try {
      await sbFetch('scenarios?id=eq.' + encodeURIComponent(id), { method: 'DELETE', prefer: 'return=minimal' });
      if (/scenario\.html/i.test(window.location.pathname)) window.location.reload();
      else openManageMine();
    } catch (e) {
      alert('Delete failed: ' + e.message);
    }
  }

  async function signOut() {
    localStorage.removeItem('av_guest_mode');
    await _sb.auth.signOut();
    var page = window.location.pathname.split('/').pop() || 'index.html';
    window.location.href = 'login.html?redirect=' + encodeURIComponent(page);
  }

  async function refreshProfile() {
    if (!_session) return;
    try {
      var profileResult = await _sb.from('profiles').select('*').eq('id', _session.user.id).single();
      _profile = profileResult.data;
      renderUserCard();
    } catch (e) {
      // best-effort — leave existing _profile in place if this fails
    }
  }

  async function init() {
    injectStyle();
    initTheme();

    var loginBtn = document.getElementById('topbar-login-btn');

    var sessionResult = await _sb.auth.getSession();
    _session = sessionResult.data.session;

    if (_session && !_session.user.is_anonymous) {
      localStorage.removeItem('av_guest_mode'); // real session always wins over a stale guest flag
    }

    if (_session) {
      injectMarkup();
      var profileResult = await _sb.from('profiles').select('*').eq('id', _session.user.id).single();
      _profile = profileResult.data;
      if (!_profile) {
        // Self-heal: the profiles-row trigger should have created this on signup, but
        // if it didn't (e.g. row was manually deleted, or the trigger failed), create
        // a minimal one now rather than looping the "complete your profile" prompt forever.
        var meta = _session.user.user_metadata || {};
        try {
          var upsertResult = await _sb.from('profiles').upsert({
            id: _session.user.id,
            email: _session.user.email,
            display_name: meta.full_name || _session.user.email
          }, { onConflict: 'id' }).select().single();
          _profile = upsertResult.data;
        } catch (e) {
          console.error('Profile self-heal failed:', e.message);
        }
      }
      renderUserCard();
      if (loginBtn) loginBtn.style.display = 'none';
    } else if (isGuest()) {
      // Guest browsing (login.html "Continue as Guest") — no Supabase session at
      // all, just render the trimmed guest sidebar so nav/menu still work.
      injectMarkup();
      renderUserCard();
      if (loginBtn) loginBtn.style.display = 'none';
    }
    // No session and not a guest — don't render sidebar at all, leave login button visible
  }

  window.AVNav = {
    toggle: toggle,
    close: close,
    openSettings: openSettings,
    closeSettings: closeSettings,
    saveSettings: saveSettings,
    uploadAvatar: uploadAvatar,
    openAvatarPicker: openAvatarPicker,
    selectPresetAvatar: selectPresetAvatar,
    generateAvatarInBackground: generateAvatarInBackground,
    openMyScenarios: openMyScenarios,
    openManageMine: openManageMine,
    openUsers: openUsers,
    openUsageLog: openUsageLog,
    fetchUsageLog: fetchUsageLog,
    logAIUsage: logAIUsage,
    getTodaySearchCount: getTodaySearchCount,
    confirmModal: confirmModal,
    toggleUserScenarios: toggleUserScenarios,
    openEditUser: openEditUser,
    saveEditUser: saveEditUser,
    deleteScenario: deleteScenario,
    signOut: signOut,
    refreshProfile: refreshProfile,
    applyTheme: applyTheme,
    setServicePack: setServicePack,
    getServicePack: activeServicePack,
    isAdmin: isAdmin,
    isGuest: isGuest
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
