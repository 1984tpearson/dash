/**
 * Chooses and synchronously loads the right CPG pack pair — cpg_pack_<id>.js
 * + category_pack_<id>.js — for whichever service pack is active, before any
 * other script on the page runs (so CPG_PACKAGES/CATEGORIES/etc are defined
 * by the time page-init code needs them, same as if they were plain <script
 * src> tags — this file just picks WHICH two tags, at parse time).
 *
 * Reads localStorage's av_service directly rather than waiting on nav.js's
 * AVNav object, since this script typically loads before nav.js does (nav.js
 * is conventionally included near </body>, per its own header comment) and
 * the two need to agree on the active pack independently. Keep the id space
 * here in sync with nav.js's SERVICE_PACKS keys — 'none' and 'av' today.
 *
 * Uses document.write deliberately: this only works because it's itself a
 * plain, non-deferred, synchronous <script src> tag encountered during the
 * initial HTML parse, in the exact position the two tags it replaces used to
 * occupy — do not add `defer`/`async` to this tag, and do not call this
 * script after the page has finished loading.
 */
(function () {
  var KNOWN_PACKS = ['none', 'av'];
  var id = localStorage.getItem('av_service') || 'none';
  if (KNOWN_PACKS.indexOf(id) === -1) id = 'none'; // unknown/stale id — fall back safely rather than 404
  document.write('<script src="cpg_pack_' + id + '.js"><\/script>');
  document.write('<script src="category_pack_' + id + '.js"><\/script>');
})();
