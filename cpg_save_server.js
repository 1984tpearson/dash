/**
 * CPG Editor Save Server
 * Run with: node cpg_save_server.js
 * Listens on http://localhost:3456
 * Receives updated CPG package objects and writes them into cpg_packages_combined.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const CPG_FILE = path.join(__dirname, 'cpg_packages_combined.js');
const PORT = 3456;

const server = http.createServer((req, res) => {
  // CORS headers so the browser page can call this
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'POST' && req.url === '/save-package') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { key, pkg } = JSON.parse(body);
        if (!key || !pkg) throw new Error('Missing key or pkg');

        // Read current file
        let src = fs.readFileSync(CPG_FILE, 'utf8');

        // Build new JSON string for this package value (pretty, 2-space indent)
        const newJson = JSON.stringify(pkg, null, 2);

        // We need to replace the value for this key inside CPG_PACKAGES = { ... }
        // Strategy: find the key entry and replace its entire object value.
        // We locate the key comment + key declaration, then find the matching closing brace.
        const keyPattern = new RegExp(
          '(\\/\\/\\s*-+[\\s\\S]*?\\n\\s*)' +   // optional comment block above
          '(' + escapeRegex(key) + '\\s*:\\s*)(\\{)',  // key: {
          'm'
        );

        let match = keyPattern.exec(src);
        if (!match) {
          // Try without comment
          const simplePattern = new RegExp('(' + escapeRegex(key) + '\\s*:\\s*)(\\{)', 'm');
          match = simplePattern.exec(src);
          if (!match) throw new Error('Key "' + key + '" not found in file');
        }

        const openBraceIdx = match.index + match[0].length - 1;

        // Walk forward to find the matching closing brace
        let depth = 0, i = openBraceIdx, inStr = false, strChar = '';
        while (i < src.length) {
          const ch = src[i];
          if (inStr) {
            if (ch === '\\') { i += 2; continue; }
            if (ch === strChar) inStr = false;
          } else {
            if (ch === '"' || ch === "'" || ch === '`') { inStr = true; strChar = ch; }
            else if (ch === '{' || ch === '[') depth++;
            else if (ch === '}' || ch === ']') { depth--; if (depth === 0) break; }
          }
          i++;
        }
        const closeBraceIdx = i; // index of closing }

        // Extract the key prefix (e.g. "  cardiac_arrest_medical: ")
        const keyStart = src.lastIndexOf('\n', openBraceIdx) + 1;
        const keyPrefix = src.slice(keyStart, openBraceIdx); // "  key: " or with comment above

        // Indent the JSON to match file style (2 extra spaces)
        const indented = newJson.replace(/^/gm, '  ').replace(/^  /, '');

        // Replace old block
        src = src.slice(0, openBraceIdx) + indented + src.slice(closeBraceIdx + 1);

        fs.writeFileSync(CPG_FILE, src, 'utf8');
        console.log('[OK] Saved package: ' + key);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        console.error('[ERR]', e.message);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(e.message);
      }
    });
    return;
  }

  res.writeHead(404); res.end('Not found');
});

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

server.listen(PORT, '127.0.0.1', () => {
  console.log('CPG Save Server running at http://localhost:' + PORT);
  console.log('Open cpg_editor.html in your browser, then edit and save packages.');
  console.log('Press Ctrl+C to stop.');
});
