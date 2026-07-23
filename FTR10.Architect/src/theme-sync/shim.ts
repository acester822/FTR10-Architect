import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as chokidar from 'chokidar';
import type { ThemeConfig } from './types';

export function writeVarsJson(profilePathArg: string, cfg: ThemeConfig): void {
  const varsPath = path.join(profilePathArg, 'vars.json');
  fs.writeFileSync(varsPath, JSON.stringify({
    values: cfg.values,
    lastModified: Date.now()
  }));
}


export function buildWebviewVarsCss(cfg: ThemeConfig): string {
  const vals = cfg.values || {};
  let css = Object.keys(vals).length
    ? ':root {\n' + Object.entries(vals).map(([k, v]) => `  ${k}: ${v};`).join('\n') + '\n}\n'
    : '';
  if (cfg.customCss) css += '\n' + cfg.customCss + '\n';
  return css;
}

export function generateShim(profilePathArg: string, cfg: ThemeConfig): void {
  const shimPath = path.join(profilePathArg, 'shim.js');
  const baseCssFiles = cfg.cssImports?.length ? cfg.cssImports : ['css.files/colors.css', 'css.files/main.css', 'css.files/font_load.css'];
  const cssFiles = baseCssFiles.includes('css.files/effects.css') ? baseCssFiles : [...baseCssFiles, 'css.files/effects.css'];
  // Read each CSS file from disk NOW (in the extension host) and embed its content
  // directly as a <style> block. This removes ALL runtime dependency on code-server
  // following the css.files symlink — a symlinked dir under /out/ is not reliably
  // served by the static file handler, which is why the old <link href="__base+css.files/..">
  // approach silently failed to load any theme CSS. Inlining is self-contained.
  function readCssSafe(relPath: string): string {
    try {
      const p = path.join(profilePathArg, relPath);
      return fs.readFileSync(p, 'utf8');
    } catch (_) { return ''; }
  }
  const cssBlocks = cssFiles.map((f: string) => {
    const id = 'ftr10-' + f.replace(/[^a-zA-Z0-9]/g, '');
    let content = readCssSafe(f);
    // Rewrite @font-face url('../fonts/X'), url("../fonts/X"), url(../fonts/X)
    // and url('fonts/X') to a placeholder that the shim replaces with the runtime
    // workbench base URL. Inlined CSS resolves relative url()s against the CDN
    // origin (which has no ../fonts) -> 404 -> monospace fallback. The workbench
    // serves fonts/ via a symlink (see patchWorkbench), so __base + 'fonts/X' works.
    content = content.replace(/url\((['"]?)(?:\.\.\/)?fonts\//g, "url($1__FTR10_FONTBASE__fonts/");
    return { id, content };
  });
  function readJsSafe(relPath: string): string {
    try {
      const p = path.join(profilePathArg, relPath);
      return fs.readFileSync(p, 'utf8');
    } catch (_) { return ''; }
  }
  const thpaceLib = readJsSafe('css.files/thpace.min.js');
  const thpaceInit = readJsSafe('css.files/thpace-background.js');
  const contextMenu = readJsSafe('css.files/context-menu-codex.js');
  // Bake the LIVE persisted vars into the shim at generation time. The shim runs
  // in the BROWSER where fs/path/cfg do NOT exist, so live values must be embedded
  // here as literals — not read at runtime. This makes the first paint match the
  // saved card (no codepunk base flashes first) without any Node APIs in the shim.
  let liveValues: Record<string, string> = (cfg.values as Record<string, string>) || {};
  let liveLastMod = 0;
  try {
    const vp = path.join(profilePathArg, 'vars.json');
    const p = JSON.parse(fs.readFileSync(vp, 'utf8'));
    if (p && p.values && Object.keys(p.values).length) liveValues = p.values;
    if (p && typeof p.lastModified === 'number') liveLastMod = p.lastModified;
  } catch (_) {}
  const shim = `(function() {
var ID = 'theme-sync-live-style';
var el = document.getElementById(ID);
if (!el) { el = document.createElement('style'); el.id = ID; document.head.appendChild(el); }
// ── Runtime tracer (workbench origin) ──────────────────────────────────────
// Cannot write files here, so keep a ring buffer on window + console.debug.
// Inspect from Chrome DevTools:  copy(window.__ftr10TraceLog)  or  __ftr10Trace()
// Each entry also relays to the extension host (via BroadcastChannel) so it
// lands in ~/.ftr10/logs/ftr10-trace.log alongside host/webview events.
window.__ftr10TraceLog = window.__ftr10TraceLog || [];
var __ftr10TraceCh = null;
try { __ftr10TraceCh = new BroadcastChannel('ftr10-trace'); } catch (_e) {}
function __trace(ev, data) {
  try {
    var entry = { t: Date.now(), src: 'shim', ev: ev };
    if (data) entry.d = data;
    window.__ftr10TraceLog.push(entry);
    if (window.__ftr10TraceLog.length > 500) window.__ftr10TraceLog.shift();
    if (console && console.debug) console.debug('[FTR10-TRACE]', ev, data || '');
    if (__ftr10TraceCh) __ftr10TraceCh.postMessage(entry);
  } catch (_e) {}
}
window.__ftr10Trace = function() { try { console.table(window.__ftr10TraceLog); } catch (_e) { console.log(window.__ftr10TraceLog); } return window.__ftr10TraceLog; };
// High-res clock relative to shim execution start, so trace deltas show exactly
// how far apart the load stages are (the "three-stage flash" investigation).
var __ftr10T0 = (window.performance && performance.now) ? performance.now() : Date.now();
function __ms() { var n = (window.performance && performance.now) ? performance.now() : Date.now(); return Math.round((n - __ftr10T0) * 100) / 100; }
function __stage(name, extra) {
  var d = { ms: __ms(), ready: document.readyState, body: !!document.body };
  if (extra) for (var k in extra) d[k] = extra[k];
  __trace('STAGE:' + name, d);
}
__trace('shim-loaded', { href: location.href });
__stage('shim-start');
// Boot gate: hide the workbench chrome during code-server's ~800ms DOM build so
// it appears all-at-once (no progressive panel "pop-in" / three-stage reveal).
// The body+circuit paints immediately (pre-paint style); the chrome appears after.
// We use visibility:hidden (not opacity) because VS Code's boot animation drives
// .monaco-workbench opacity via inline styles that beat an opacity:0 !important
// rule in the cascade. visibility:hidden is not fought by that animation.
// The ftr10-splash overlay (in workbench.html) covers the whole boot; we fade it
// out + remove it here once the fresh, cache-busted shim has applied.
try { document.documentElement.classList.add('ftr10-booting'); } catch (_e) {}
// Splash timing: the workbench chrome is revealed as soon as it is ready, but the
// branded splash overlay is held on top for at least MIN_SPLASH_MS so the intro is
// an intentional, complete animation (>=3s) rather than a sub-second flash.
var __ftr10SplashT0 = (window.performance && performance.now) ? performance.now() : Date.now();
var __FTR10_MIN_SPLASH_MS = 3200;
var __ftr10SplashDismissed = false;
function __ftr10DismissSplash() {
  if (__ftr10SplashDismissed) return;
  __ftr10SplashDismissed = true;
  try {
    var splash = document.getElementById('ftr10-splash');
    if (splash) {
      splash.classList.add('ftr10-splash-hidden');
      setTimeout(function() { if (splash.parentNode) splash.parentNode.removeChild(splash); }, 550);
    }
  } catch (_e) {}
}
function __bootReveal() {
  try {
    // Reveal the workbench underneath immediately (no need to keep it hidden once
    // it is built) — the splash overlay covers it until the minimum time elapses.
    document.documentElement.classList.remove('ftr10-booting');
    var now = (window.performance && performance.now) ? performance.now() : Date.now();
    var elapsed = now - __ftr10SplashT0;
    if (elapsed >= __FTR10_MIN_SPLASH_MS) { __ftr10DismissSplash(); }
    else { setTimeout(__ftr10DismissSplash, __FTR10_MIN_SPLASH_MS - elapsed); }
  } catch (_e) {}
}
if (document.readyState === 'complete') { __bootReveal(); }
else { window.addEventListener('load', __bootReveal); }
// Fallback: never leave the workbench/splash stuck if load is slow/never fires.
// Kept above the minimum splash time so a slow boot still shows the full intro.
setTimeout(__bootReveal, 4500);
// Log the very next paint after the shim runs (stage 1 visual).
try { requestAnimationFrame(function() { __stage('raf-after-shim'); }); } catch (_e) {}
// Log when the DOM is interactive/complete.
try { document.addEventListener('DOMContentLoaded', function() { __stage('DOMContentLoaded'); }); } catch (_e) {}
try { window.addEventListener('load', function() { __stage('window-load'); }); } catch (_e) {}
var __base = (function() {
  // Used only for resolving background-image url("backgrounds/..") to an absolute
  // served path. The theme CSS itself is inlined below, so __base is best-effort.
  try {
    if (typeof globalThis._VSCODE_FILE_ROOT === 'string' && globalThis._VSCODE_FILE_ROOT.length) {
      var root = globalThis._VSCODE_FILE_ROOT;
      if (root.charAt(root.length - 1) !== '/') root += '/';
      return root + 'vs/code/browser/workbench/';
    }
  } catch (_) {}
  try { return new URL('./', import.meta.url).href; } catch (_) {}
  try { return new URL('.', location.href).href; } catch (_) {}
  return '/';
})();
// Inlined theme CSS (read from disk at generation time — no network/symlink needed)
${cssBlocks.map(b => `var __style_${b.id.replace(/-/g, '_')} = document.createElement('style');
__style_${b.id.replace(/-/g, '_')}.id = '${b.id}';
__style_${b.id.replace(/-/g, '_')}.textContent = (${JSON.stringify(b.content)}).replace(/__FTR10_FONTBASE__/g, __base);
if (!document.getElementById('${b.id}')) document.head.appendChild(__style_${b.id.replace(/-/g, '_')});`).join('\n')}
__stage('css-blocks-inserted', { count: ${cssBlocks.length} });

// Thpace + context menu: code-server's CSP sets script-src WITHOUT
// 'unsafe-inline', so dynamically-created INLINE <script> elements are
// BLOCKED and never execute (that's why Thpace was silently dead). script-src
// DOES allow 'blob:', so we inject these scripts via blob: object URLs instead
// of textContent — that satisfies CSP and they run normally.
function __injectScriptById(id, code, onload) {
  if (!id || !code || document.getElementById(id)) return;
  try {
    var __blob = new Blob([code], { type: 'application/javascript' });
    var __url = URL.createObjectURL(__blob);
    var __s = document.createElement('script');
    __s.id = id;
    __s.src = __url;
    if (typeof onload === 'function') __s.onload = onload;
    document.head.appendChild(__s);
  } catch (_e) {}
}
var __libId = 'ftr10-thpace-lib';
if (!document.getElementById(__libId) && ${JSON.stringify(thpaceLib)}.length) {
  __injectScriptById(__libId, ${JSON.stringify(thpaceLib)}, function() {
    __injectScriptById('ftr10-thpace-init', ${JSON.stringify(thpaceInit)});
  });
}

__injectScriptById('ftr10-context-menu-codex', ${JSON.stringify(contextMenu)});

// First paint must match the LIVE saved theme (baked in at generation time as
// __defaultVars below), not the preset that was active when this shim was built.
// vars.json is read in the extension host (Node) and inlined here, so no Node
// APIs run in the browser. Eliminates the "codepunk flashes first" glitch.
var __defaultVars = ${JSON.stringify(liveValues)};
var __nebulaCanvas = null, __nebulaRaf = null;
function __startNebulaParticles() {
  if (__nebulaCanvas && __nebulaCanvas.isConnected) return;
  var cv = document.createElement('canvas');
  cv.id = 'ftr10-nebula-particles';
  cv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:3;pointer-events:none;';
  document.body.appendChild(cv);
  __nebulaCanvas = cv;
  var ctx = cv.getContext('2d');
  function resize() { cv.width = window.innerWidth; cv.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);
  var COUNT = 55, TWO_PI = Math.PI * 2;
  var pts = Array.from({length: COUNT}, function() {
    return {
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      size: Math.random() * 3 + 1.2,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.2 - 0.06,
      alpha: Math.random() * 0.45 + 0.25,
      da: (Math.random() - 0.5) * 0.003,
      twinkle: Math.random() * TWO_PI,
      colIdx: Math.floor(Math.random() * 3)
    };
  });
  function getCol(idx) {
    var cs = getComputedStyle(document.documentElement);
    var key = idx === 0 ? '--ftr10-accent-1' : idx === 1 ? '--ftr10-accent-2' : '--ftr10-accent-3';
    var v = cs.getPropertyValue(key).trim().slice(0, 7);
    return v || ['#00d4ff','#9b59b6','#3498db'][idx];
  }
  function tick() {
    if (!__nebulaCanvas) return;
    var w = cv.width, h = cv.height;
    ctx.clearRect(0, 0, w, h);
    pts.forEach(function(p) {
      p.twinkle += 0.02;
      p.alpha += p.da;
      if (p.alpha > 0.7 || p.alpha < 0.08) p.da *= -1;
      p.x += p.vx; p.y += p.vy;
      if (p.y < -10) { p.y = h + 5; p.x = Math.random() * w; }
      if (p.x < -10) p.x = w + 5;
      if (p.x > w + 10) p.x = -5;
      var col = getCol(p.colIdx);
      var pulse = 0.5 + 0.5 * Math.sin(p.twinkle);
      ctx.save();
      ctx.globalAlpha = p.alpha * pulse;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size / 2, 0, TWO_PI);
      ctx.fillStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = p.size * 5;
      ctx.fill();
      ctx.restore();
    });
    __nebulaRaf = requestAnimationFrame(tick);
  }
  tick();
}
function __stopNebulaParticles() {
  if (__nebulaRaf) { cancelAnimationFrame(__nebulaRaf); __nebulaRaf = null; }
  if (__nebulaCanvas && __nebulaCanvas.isConnected) __nebulaCanvas.remove();
  __nebulaCanvas = null;
}
function __applyEffect(vals) {
  if (!document.body) { __stage('applyEffect-DEFERRED-no-body'); document.addEventListener('DOMContentLoaded', function() { __stage('applyEffect-deferred-fired'); __applyEffect(vals); }); return; }
  var effect = ((vals && vals['--ftr10-bg-effect']) || 'none').trim().toLowerCase();
  var prev = (document.body.getAttribute('data-ftr10-effect') || 'none');
  document.body.className = (document.body.className || '').replace(/\\bftr10-effect--\\S+/g, '').trim();
  if (effect !== 'none') document.body.classList.add('ftr10-effect--' + effect);
  document.body.setAttribute('data-ftr10-effect', effect);
  __stage('applyEffect-applied', { effect: effect });
  if (prev !== effect) __trace('effect-switch', { from: prev, to: effect });
  if (effect === 'nebula') { __startNebulaParticles(); } else { __stopNebulaParticles(); }
}
var applyVars = function(vars) {
  var __t0 = (window.performance && performance.now) ? performance.now() : Date.now();
  // Resolve tiny url("backgrounds/file") to absolute __base + backgrounds/file so
  // the injected :root style actually loads the image (the symlinked backgrounds/
  // dir is served from the workbench origin). Avoids storing 1MB data URIs in
  // vars.json (polling lag fix) while still resolving correctly at apply time.
  var resolved = {};
  for (var k in vars) {
    var v = vars[k];
    if ((k === '--ftr10-bg-image' || k === '--ftr10-bg-image-panels') && typeof v === 'string') {
      // Extract a backgrounds/ filename from url("backgrounds/X") or
      // url("../backgrounds/X") and resolve to the workbench-served absolute path.
      // IMPORTANT: do NOT use a regex literal with escapes here — esbuild mangles
      // '\\/' and '\\(' when bundling the shim, which breaks parsing. Use plain
      // string scanning instead (no regex at all).
      var idx = v.indexOf('backgrounds/');
      if (idx !== -1) {
        var start = idx + 'backgrounds/'.length;
        var end = v.indexOf('"', start);
        if (end === -1) end = v.indexOf("'", start);
        if (end === -1) end = v.length;
        var fname = v.substring(start, end);
        v = 'url("' + __base + 'backgrounds/' + fname + '")';
      }
    }
    resolved[k] = v;
  }
  // Surgical apply: only rewrite what actually changed since the last apply.
  // Rewriting the whole :root block forces a full style recalc and re-decodes the
  // background image on every apply — which during the 250ms burst poll made card
  // switches hang + lag. Skip entirely if nothing changed.
  var __changed = false;
  var __next = {};
  for (var kk in resolved) {
    if (window.__ftr10LastApplied && window.__ftr10LastApplied[kk] === resolved[kk]) continue;
    __changed = true;
    __next[kk] = resolved[kk];
  }
  window.__ftr10LastApplied = resolved;
  __applyEffect(resolved);
  // Reconcile Thpace against the live --ftr10-thpace-enabled var on EVERY apply
  // (both the changed and the skipped/idle-poll paths). Retries until the Thpace
  // lib is ready, so a cold reload (where the lib finishes loading after the
  // first applyVars) still respects the saved toggle instead of falling back to
  // the lib's localStorage default.
  __reconcileThpace(resolved);
  if (!__changed) {
    var __t1 = (window.performance && performance.now) ? performance.now() : Date.now();
    __trace('applyVars', { keys: 0, effect: (resolved['--ftr10-bg-effect'] || 'none').trim().toLowerCase(), thpace: (resolved['--ftr10-thpace-enabled'] || 'true').trim() !== 'false', ms: Math.round((__t1 - __t0) * 100) / 100, skipped: true });
    return;
  }
  // Write the FULL resolved set — el.textContent REPLACES the entire :root block,
  // so emitting only the changed subset would wipe every unchanged var (e.g.
  // --ftr10-bg-image / --ftr10-bg-effect), making the background image vanish on
  // any unrelated edit. The cost of a full :root rewrite is acceptable now that we
  // skip the entire apply when nothing changed (the common idle-poll case).
  el.textContent = ':root {' + Object.keys(resolved).map(function(k) { return ' ' + k + ': ' + resolved[k] + ' !important;'; }).join(' ') + ' }';
  var __t1 = (window.performance && performance.now) ? performance.now() : Date.now();
  __trace('applyVars', {
    keys: Object.keys(vars).length,
    effect: (resolved['--ftr10-bg-effect'] || 'none').trim().toLowerCase(),
    thpace: (resolved['--ftr10-thpace-enabled'] || 'true').trim() !== 'false',
    ms: Math.round((__t1 - __t0) * 100) / 100
  });
};
// Enable/disable the Thpace canvas to match --ftr10-thpace-enabled. If the Thpace
// lib hasn't finished loading yet, retry on a short timer (it self-cancels once it
// applies, so there's no lingering interval in the steady state).
// Also forwards numeric/color THPace params to the live instance so slider changes
// take effect immediately (not just on next page load).
function __reconcileThpace(resolved) {
  var on = (resolved['--ftr10-thpace-enabled'] || 'true').trim() !== 'false';
  if (window.ftr10Thpace) {
    if (window.__ftr10ThpaceLast !== on) {
      __trace('thpace-toggle', { enabled: on });
      window.__ftr10ThpaceLast = on;
    }
    on ? window.ftr10Thpace.enable() : window.ftr10Thpace.disable();
    window.__ftr10ThpaceRetries = 0;
    // Forward numeric and color THPace params to the live Thpace instance
    __applyThpaceParams(resolved);
    return;
  }
  if (window.__ftr10ThpaceRetries === undefined) window.__ftr10ThpaceRetries = 0;
  if (window.__ftr10ThpaceRetries > 100) return; // ~10s elapsed, give up
  window.__ftr10ThpaceRetries++;
  setTimeout(function() { __reconcileThpace(resolved); }, 100);
}
// Forward numeric/color THPace CSS vars to the live ftr10Thpace instance (opacity,
// zindex, triangle-size, bleed, noise, point-variation-*, animation-speed, max-fps,
// and color tokens).
function __applyThpaceParams(resolved) {
  if (!window.ftr10Thpace) return;
  var partial = {};
  var o = (resolved['--ftr10-thpace-opacity'] || '').trim();
  if (o) window.ftr10Thpace.setOpacity(parseFloat(o));
  var z = (resolved['--ftr10-thpace-zindex'] || '').trim();
  if (z) window.ftr10Thpace.setZIndex(parseInt(z,10));
  var ts = parseFloat(resolved['--ftr10-thpace-triangle-size']);
  if (ts > 0) partial.triangleSize = ts;
  var bl = parseFloat(resolved['--ftr10-thpace-bleed']);
  if (bl >= 0) partial.bleed = bl;
  var ns = parseFloat(resolved['--ftr10-thpace-noise']);
  if (ns >= 0) partial.noise = ns;
  var pvx = parseFloat(resolved['--ftr10-thpace-point-variation-x']);
  if (pvx > 0) partial.pointVariationX = pvx;
  var pvy = parseFloat(resolved['--ftr10-thpace-point-variation-y']);
  if (pvy > 0) partial.pointVariationY = pvy;
  var spd = parseFloat(resolved['--ftr10-thpace-animation-speed']);
  if (spd > 0) partial.pointAnimationSpeed = spd;
  var fps = parseInt(resolved['--ftr10-thpace-max-fps'], 10);
  if (fps > 0) partial.maxFps = fps;
  // Refresh color tokens when any thpace-* key changed
  if (resolved['--ftr10-thpace-colors'] || resolved['--ftr10-thpace-1'] || resolved['--ftr10-thpace-2'] || resolved['--ftr10-thpace-3']) {
    window.ftr10Thpace.refreshColors();
  }
  if (Object.keys(partial).length) {
    __trace('thpace-params', partial);
    window.ftr10Thpace.updateSettings(partial);
  }
}
__stage('applyVars-default-begin');
applyVars(__defaultVars);
__stage('applyVars-default-end');
// Boot paint sampler: record how the workbench chrome paints in over the first
// ~2s (the "multi-stage flash" window between shim apply and DOMContentLoaded).
// Samples via rAF so each entry is a real paint frame.
(function() {
  var __bt0 = (window.performance && performance.now) ? performance.now() : Date.now();
  var __lastSig = '';
  function __sample() {
    var now = (window.performance && performance.now) ? performance.now() : Date.now();
    var el = document.getElementById('theme-sync-live-style');
    var mw = document.querySelector('.monaco-workbench');
    var split = document.querySelector('.split-view-view');
    var editor = document.querySelector('.editor-instance, .monaco-editor');
    var bodyBg = document.body ? getComputedStyle(document.body).backgroundColor : '';
    var sig = [!!mw, !!split, !!editor, bodyBg, document.readyState].join('|');
    if (sig !== __lastSig) {
      __lastSig = sig;
      __stage('paint-sample', { mw: !!mw, split: !!split, editor: !!editor, bodyBg: bodyBg, live: !!el });
    }
    if (now - __bt0 < 2500) requestAnimationFrame(__sample);
  }
  requestAnimationFrame(__sample);
})();

// Poll vars.json for live updates from the extension host.
// __base resolves to the local workbench dir where vars.json is symlinked
// (see __base resolution above), so a direct fetch is reliable.
// Adaptive scheduling: a short burst (300 ms) for 2 s after a change is detected,
// idle mode (30 s) otherwise. The burst used to be 250 ms for 8 s, which — combined
// with the shim re-applying the whole :root block (incl. re-decoding the bg image)
// on every poll — made card switches hang and lag. applyVars is now diff-aware, and
// the burst is short, so switching stays snappy without the long lag tail.
// Seed __lastMod with the live vars.json lastModified (baked at generation time)
// so the first poll sees "already current" and skips — __defaultVars already
// painted the correct state, so re-applying would cause a redundant shift.
var __lastMod = ${liveLastMod};
var __pollTimer = null;
var __burstUntil = 0;
function __pollVars() {
  fetch(__base + 'vars.json?t=' + Date.now())
    .then(function(r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
    .then(function(data) {
      if (data && data.lastModified && data.lastModified !== __lastMod) {
        __stage('poll-REAPPLY', { lastMod: data.lastModified, seeded: __lastMod });
        __trace('poll-change', { lastMod: data.lastModified });
        __lastMod = data.lastModified;
        __burstUntil = Date.now() + 2000;
        if (data.values) applyVars(data.values);
      } else {
        __stage('poll-noop', { lastMod: data && data.lastModified, seeded: __lastMod });
      }
    })
    .catch(function() {})
    .finally(function() {
      __pollTimer = setTimeout(__pollVars, Date.now() < __burstUntil ? 300 : 30000);
    });
}
__pollTimer = setTimeout(__pollVars, 1000);

// Also keep BroadcastChannel + postMessage as fallbacks
try {
  var __ch = new BroadcastChannel('theme-sync');
  __ch.onmessage = function(e) {
    var d = e.data || {};
    if (d.cssVars) applyVars(d.cssVars);
  };
} catch(e) {}
window.addEventListener('message', function(e) {
  if (e.data?.type === 'theme-sync-update' && e.data.cssVars) applyVars(e.data.cssVars);
});
})();`;
  fs.writeFileSync(shimPath, shim);
}
