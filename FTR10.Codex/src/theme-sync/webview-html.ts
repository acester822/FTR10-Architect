
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as chokidar from 'chokidar';
import type { ThemeConfig } from './types';
import * as state from './state';

export function buildSessionCardsHtml(activePreset?: string): { defaults: string; sessions: string } {
  const all = Object.values(state.store.themeConfig.architectSessions)
    .sort((a, b) => {
      // Base cards first, ordered by preset list, then user cards by updatedAt desc
      const aIsBase = !!a.isBase; const bIsBase = !!b.isBase;
      if (aIsBase && !bIsBase) return -1;
      if (!aIsBase && bIsBase) return 1;
      if (aIsBase && bIsBase) {
        // preserve original preset order via createdAt (earlier created = earlier in list)
        return (a.createdAt ?? 0) - (b.createdAt ?? 0);
      }
      return b.updatedAt - a.updatedAt;
    });
  const gearIcon = `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M9.1 4.4L8.6 2H7.4l-.5 2.4-.7.3-2-1.3-.9.8 1.3 2-.2.7-2.4.5v1.2l2.4.5.3.8-1.3 2 .8.8 2-1.3.8.3.4 2.3h1.2l.5-2.4.8-.3 2 1.3.8-.8-1.3-2 .3-.8 2.3-.4V7.4l-2.4-.5-.3-.7 1.3-2-.8-.9-2 1.3-.7-.2zM9.4 1l.5 2.4L12 2.1l2 2-1.4 2.1 2.4.5v2.8l-2.4.5L14 12l-2 2-2.1-1.4-.5 2.4H6.6l-.5-2.4L4 14l-2-2 1.4-2.1L1 9.4V6.6l2.4-.5L2.1 4l2-2 2.1 1.4.5-2.4h2.8zM8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm0-1a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>`;
  const renderCard = (s: any): string => {
    const presetId = `arch-${s.id}`;
    const isActive = (activePreset ?? state.store.themeConfig.activePreset) === presetId;
    const c1 = escapeHtml(s.savedColors[0] || '#555555');
    const c2 = escapeHtml(s.savedColors[1] || '#555555');
    const c3 = escapeHtml(s.savedColors[2] || '#555555');
    const isBase = !!s.isBase;
    return `<div class="theme-card session-card${isActive ? ' active' : ''}${isBase ? ' base-card' : ''}" data-session-id="${escapeHtml(s.id)}" data-preset-id="${escapeHtml(presetId)}">
      <div class="card-top">
        <div class="swatches">
          <span class="swatch" style="background:${c1}"></span>
          <span class="swatch" style="background:${c2}"></span>
          <span class="swatch" style="background:${c3}"></span>
        </div>
        <div class="card-btns">
          <button class="gear-btn edit-btn" data-session-id="${escapeHtml(s.id)}" title="Edit in Architect">${gearIcon}</button>
          ${isBase ? '' : `<button class="del-btn" data-session-id="${escapeHtml(s.id)}" title="Delete session">✕</button>`}
        </div>
      </div>
      <div class="card-name">${escapeHtml(s.name)}${isBase ? ' <span class="base-badge">Base</span>' : ''}</div>
      <div class="card-desc">${escapeHtml(s.harmony)} harmony${isBase && s.basePresetId ? ` • ${escapeHtml(s.basePresetId)}` : ''}</div>
      ${isActive ? '<div class="card-active-badge">Active</div>' : ''}
    </div>`;
  };
  const defaults = all.filter(s => !!s.isBase).map(renderCard);
  const sessions = all.filter(s => !s.isBase).map(renderCard);
  return {
    defaults: defaults.length
      ? defaults.join('')
      : `<div class="empty-state">No default cards. Reset the extension to restore them.</div>`,
    sessions: sessions.length
      ? sessions.join('')
      : `<div class="empty-state">No saved sessions yet.<br>Open the Architect, design a palette, and click <strong>Save</strong> to create your first card.</div>`
  };
}

function buildPresetCardsHtml(_activePreset?: string): string { return ''; }

export function getSidebarHtml(activePreset?: string, accentColor?: string, values?: Record<string, string>): string {
  const accent = accentColor || '#7c3aed';
  const { defaults: defaultCards, sessions: sessionCards } = buildSessionCardsHtml(activePreset);
  // Bake the theme's font (and layout) vars onto :root so the sidebar cards render
  // with the configured font on first paint. The sidebar webview is isolated from the
  // workbench :root, and relayVars only arrives on live edits — without seeding these
  // here, .theme-card resolves --ftr10-font-sidebar to undefined and falls back to
  // sans-serif before any postMessage round-trip completes.
  const _sideFontKeys = ['--ftr10-font-sidebar','--ftr10-font-body','--ftr10-font-heading','--ftr10-font-code','--ftr10-body-font','--ftr10-heading-font','--ftr10-code-font'];
  let _rootVars = '--ftr10-accent-1: ' + escapeHtml(accent) + ';';
  if (values) { for (const k of _sideFontKeys) { const v = values[k]; if (v) _rootVars += ' ' + k + ': ' + escapeHtml(v) + ';'; } }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
<style>
  :root { ${_rootVars} }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Space Mono', monospace;
    color: var(--vscode-foreground);
    background: transparent;
    padding: 12px;
  }
  body { scrollbar-width: thin !important; scrollbar-color: #ffffff2e transparent; }
  body::-webkit-scrollbar { width: 6px !important; }
  body::-webkit-scrollbar-track { background: transparent; }
  body::-webkit-scrollbar-thumb { background: #ffffff2e; border-radius: 3px; }
  body::-webkit-scrollbar-thumb:hover { background: #ffffff52; }
  html { scrollbar-width: thin !important; scrollbar-color: #ffffff2e transparent; }
  html::-webkit-scrollbar { width: 6px !important; }
  html::-webkit-scrollbar-track { background: transparent; }
  html::-webkit-scrollbar-thumb { background: #ffffff2e; border-radius: 3px; }
  html::-webkit-scrollbar-thumb:hover { background: #ffffff52; }

  .header { margin-bottom: 14px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .header h2 { font-size: 14px; font-weight: 700; margin-bottom: 4px; }
  .header p { font-size: 11px; opacity: 0.6; line-height: 1.5; flex: 1 1 100%; order: 3; }
  .btn-layout {
    position: static; align-self: flex-end; margin: 0 14px 8px 0; order: -1;
    border: 1px solid rgba(var(--ui-accent-rgb), 0.35);
    background: rgba(0,8,20,0.7);
    color: rgba(var(--ui-accent-rgb), 0.95);
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.74rem; letter-spacing: 1px; text-transform: uppercase;
    padding: 6px 12px; border-radius: 6px; cursor: pointer;
    transition: background 0.15s, box-shadow 0.15s;
  }
  .btn-layout:hover { background: rgba(var(--ui-accent-rgb), 0.22); box-shadow: 0 0 20px rgba(var(--ui-accent-rgb), 0.4); }
  .btn-layout.active { background: rgba(var(--ui-accent-rgb), 0.35); box-shadow: 0 0 20px rgba(var(--ui-accent-rgb), 0.5); }

  .session-list { display: flex; flex-direction: column; gap: 10px; }

  .theme-card {
    padding: 12px;
    border-radius: 10px;
    border: 1px solid var(--vscode-panel-border, #ffffff14);
    background: #ffffff0d;
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
    position: relative;
    font-family: var(--ftr10-font-sidebar, var(--ftr10-body-font, var(--vscode-font-family, sans-serif)));
  }
  .theme-card:hover { border-color: var(--ftr10-accent-1); opacity: 0.85; }
  .theme-card.active {
    border-color: var(--ftr10-accent-1);
    box-shadow: 0 0 0 1px var(--ftr10-accent-1),
                0 0 12px color-mix(in srgb, var(--ftr10-accent-1) 30%, transparent);
  }
  .theme-card.base-card { border-style: dashed; border-color: #ffffff22; }
  .theme-card.base-card:hover { border-color: var(--ftr10-accent-1); }

  .card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .swatches { display: flex; gap: 6px; }
  .swatch { width: 18px; height: 18px; border-radius: 50%; border: 1px solid #ffffff26; }

  .card-btns { display: flex; gap: 4px; align-items: center; }

  .gear-btn, .del-btn {
    display: grid; place-items: center;
    width: 26px; height: 26px;
    border-radius: 6px;
    border: 1px solid transparent;
    background: #ffffff0a;
    color: var(--vscode-descriptionForeground, #888);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    font-size: 11px;
  }
  .gear-btn:hover, .del-btn:hover { background: #ffffff1a; color: var(--vscode-foreground); }
  .del-btn:hover { color: #ff5c75; }

  .card-name { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
  .card-desc { font-size: 11px; opacity: 0.55; line-height: 1.4; }

  .base-badge { font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 1px 5px; border-radius: 10px; background: #ffffff18; color: #ffffffaa; margin-left: 6px; vertical-align: middle; }

  .card-active-badge {
    position: absolute; bottom: 10px; right: 10px;
    font-size: 9px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.1em; padding: 2px 7px; border-radius: 20px;
    background: var(--ftr10-accent-1); color: white;
  }

  .bg-mode-btn {
    display: inline-flex; align-items: center; gap: 4px;
    margin-top: 8px; padding: 3px 9px;
    border-radius: 20px; border: 1px solid #ffffff20;
    background: #ffffff0a; color: var(--vscode-descriptionForeground, #888);
    font-size: 10px; font-weight: 600; cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
    line-height: 1.4;
  }
  .bg-mode-btn:hover { background: #ffffff18; border-color: #ffffff38; color: var(--vscode-foreground); }
  .bg-mode-btn.effects {
    border-color: color-mix(in srgb, var(--ftr10-accent-1) 45%, transparent);
    color: var(--ftr10-accent-1);
    background: color-mix(in srgb, var(--ftr10-accent-1) 10%, transparent);
  }
  .bg-mode-btn.solid { border-color: #ffffff28; color: var(--vscode-descriptionForeground, #888); }

  /* Architect entry card */
  .arch-entry-card {
    cursor: pointer;
    margin-bottom: 14px;
    background: linear-gradient(135deg, rgba(123,104,238,0.12), rgba(0,212,255,0.07));
    border-color: rgba(123,104,238,0.3);
  }
  .arch-entry-card:hover { border-color: rgba(123,104,238,0.7); opacity: 1; }
  .arch-entry-card .card-desc { font-size: 10px; opacity: 0.45; }
  .arch-entry-swatches { display: flex; gap: 6px; margin-bottom: 8px; }
  .arch-entry-swatches .swatch { transition: background 0.3s ease; }
  .arch-entry-open {
    display: inline-flex; align-items: center; gap: 4px;
    margin-top: 8px; padding: 3px 9px; border-radius: 20px;
    border: 1px solid rgba(123,104,238,0.5);
    background: linear-gradient(135deg, rgba(123,104,238,0.15), rgba(0,212,255,0.1));
    color: rgba(200,200,255,0.9);
    font-size: 10px; font-weight: 600; pointer-events: none;
  }

  .empty-state {
    padding: 18px 12px; text-align: center;
    font-size: 11px; opacity: 0.5; line-height: 1.7;
    border: 1px dashed #ffffff18; border-radius: 10px;
  }
  .empty-state strong { opacity: 0.8; }

  .section-label {
    font-size: 9px; font-weight: 700; letter-spacing: 0.12em;
    text-transform: uppercase; opacity: 0.35; margin-bottom: 6px; margin-top: 10px;
  }

  /* Collapsible card sections (Default Cards / Sessions) */
  .card-section { margin-top: 4px; }
  .card-section > summary.section-label {
    list-style: none; cursor: pointer; display: flex; align-items: center; gap: 6px;
    user-select: none; opacity: 0.5; transition: opacity 0.15s;
  }
  .card-section > summary.section-label::-webkit-details-marker { display: none; }
  .card-section > summary.section-label::before {
    content: '▸'; font-size: 8px; transform: rotate(90deg); transition: transform 0.15s; opacity: 0.7;
  }
  .card-section:not([open]) > summary.section-label::before { transform: rotate(0deg); }
  .card-section > summary.section-label:hover { opacity: 0.8; }
</style>
</head>
<body>
  <div class="header">
    <h2>FTR10 Architect</h2>
    <p>Base cards give you a starting point. They are fully editable — make them yours. Reset to restore defaults.</p>
  </div>

  <!-- Architect entry card — always visible, opens blank session -->
  <div class="theme-card arch-entry-card" id="CodexCard">
    <div class="card-top">
      <div class="arch-entry-swatches" id="dsCardSwatches">
        <span class="swatch" style="background:#7b68ee"></span>
        <span class="swatch" style="background:#00d4ff"></span>
        <span class="swatch" style="background:#ff6bca"></span>
      </div>
    </div>
    <div class="card-name">&#10022; New Session</div>
    <div class="card-desc">Open the Architect to create a new palette</div>
    <span class="arch-entry-open">Open Architect &rsaquo;</span>
  </div>

  <details class="card-section" open>
    <summary class="section-label">Default Cards</summary>
    <div class="session-list" id="defaultCardsList">
      ${defaultCards}
    </div>
  </details>

  <details class="card-section" open>
    <summary class="section-label">Sessions</summary>
    <div class="session-list" id="sessionList">
      ${sessionCards}
    </div>
  </details>

  <script>
    const vscode = acquireVsCodeApi();
    const _ftr10SidebarListeners = [];
    const sessionList = document.getElementById('sessionList');
    const defaultCardsList = document.getElementById('defaultCardsList');
    function sessionListHandler(e) {
      const editBtn = e.target.closest('.edit-btn');
      if (editBtn) {
        e.stopPropagation();
        vscode.postMessage({ command: 'editCard', sessionId: editBtn.getAttribute('data-session-id') });
        return;
      }
      const delBtn = e.target.closest('.del-btn');
      if (delBtn) {
        e.stopPropagation();
        vscode.postMessage({ command: 'deleteCard', sessionId: delBtn.getAttribute('data-session-id') });
        return;
      }
      const card = e.target.closest('.session-card');
      if (card) {
        vscode.postMessage({ command: 'applyCard', sessionId: card.getAttribute('data-session-id') });
      }
    }
    sessionList.addEventListener('click', sessionListHandler);
    defaultCardsList.addEventListener('click', sessionListHandler);
    _ftr10SidebarListeners.push(() => sessionList.removeEventListener('click', sessionListHandler));
    _ftr10SidebarListeners.push(() => defaultCardsList.removeEventListener('click', sessionListHandler));

    const codexCard = document.getElementById('CodexCard');
    function codexCardHandler() { vscode.postMessage({ command: 'openCodex' }); }
    codexCard.addEventListener('click', codexCardHandler);
    _ftr10SidebarListeners.push(() => codexCard.removeEventListener('click', codexCardHandler));

    function sidebarMsgHandler(e) {
      const msg = e.data;
      if (msg.command === 'syncActive') {
        if (msg.accentColor) {
          document.documentElement.style.setProperty('--ftr10-accent-1', msg.accentColor);
        }
        document.querySelectorAll('.theme-card').forEach((c) => {
          const presetId = c.getAttribute('data-preset-id');
          const isActive = presetId && presetId === msg.activePreset;
          c.classList.toggle('active', !!isActive);
          const badge = c.querySelector('.card-active-badge');
          if (isActive && !badge) {
            const b = document.createElement('div');
            b.className = 'card-active-badge';
            b.textContent = 'Active';
            c.appendChild(b);
          } else if (!isActive && badge) {
            badge.remove();
          }
        });
      }
      if (msg.command === 'syncSessions') {
        const dc = document.getElementById('defaultCardsList');
        const sl = document.getElementById('sessionList');
        if (dc) dc.innerHTML = msg.defaultCardsHtml || '';
        if (sl) sl.innerHTML = msg.sessionsHtml || '';
        if (msg.accentColor) {
          document.documentElement.style.setProperty('--ftr10-accent-1', msg.accentColor);
        }
      }
      if (msg.command === 'syncBgModes' && msg.bgModeMap) {
        document.querySelectorAll('.bg-mode-btn').forEach((btn) => {
          const id = btn.getAttribute('data-preset-id');
          const mode = msg.bgModeMap[id] || 'effects';
          btn.setAttribute('data-mode', mode);
          btn.className = 'bg-mode-btn ' + mode;
          btn.textContent = mode === 'effects' ? '✦ Effects' : '▣ Solid';
          btn.title = mode === 'effects'
            ? 'Using Thpace + transparent bg — click to switch to solid'
            : 'Using preset solid bg — click to switch to effects';
        });
      }
      if (msg.command === 'CodexColors' && msg.colors) {
        const row = document.getElementById('dsCardSwatches');
        if (row) {
          const swatches = row.querySelectorAll('.swatch');
          msg.colors.slice(0, 3).forEach((c, i) => {
            if (swatches[i]) swatches[i].style.background = c;
          });
        }
      }
      if (msg.command === 'relayVars' && msg.cssVars) {
        try { applyPanelFontVars(msg.cssVars); } catch(_) {}
        try { new BroadcastChannel('theme-sync').postMessage({ cssVars: msg.cssVars }); } catch(_) {}
      }
    }
    window.addEventListener('message', sidebarMsgHandler);
    _ftr10SidebarListeners.push(() => window.removeEventListener('message', sidebarMsgHandler));

    window.addEventListener('beforeunload', () => {
      _ftr10SidebarListeners.forEach(fn => { try { fn(); } catch(_){} });
    });
  </script>
</body>
</html>`;
}

export function getCodexHtml(initial?: {
  config: any;
  simpleGroups: any[];
  activePreset?: string;
  values: Record<string, any>;
  bgImages?: { name: string; dataUri?: string; uri?: string }[];
  session?: any;
  derivedValues?: Record<string, any>;
}): string {
  // Safely serialize initial data for embedding.  Escape </ so the JSON cannot
  // prematurely close the surrounding <script> tag inside the HTML string.
  const initJson = initial
    ? JSON.stringify(initial).replace(/<\//g, '<\\/')
    : 'null';
  return `<!DOCTYPE html>
<!-- Codex CONCEPT C — CyberPalette v3 -->
<!-- Inspired by: cyberpunk hue torus, perspective side-panels, dynamic ambient bg -->
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Codex — CyberPalette</title>
<script>
/* FTR10: initial panel data — baked at creation time so the Architect panel
   renders with real config/palette on the very first paint, without waiting
   for the async getConfig → architectConfig postMessage round-trip. */
window.__FTR10_INIT__ = ${initJson};
</script>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap" rel="stylesheet">
<style>
  :root {
    --ui-accent: #00d4ff;
    --ui-accent-rgb: 0,212,255;
  }
  * { margin:0; padding:0; box-sizing:border-box; }

  body, html {
    height: 100%;
    font-family: var(--ftr10-font-panel-top, var(--ftr10-body-font, 'Share Tech Mono', monospace));
    /* Transparent so the panel inherits the workbench background instead of painting
       its own opaque layer. */
    background: transparent;
    color: #b0d0ff;
    overflow-x: hidden;
  }
  body { scrollbar-width: thin; scrollbar-color: rgba(var(--ui-accent-rgb),0.13) transparent; }
  body::-webkit-scrollbar { width: 5px; }
  body::-webkit-scrollbar-thumb { background: rgba(var(--ui-accent-rgb),0.13); border-radius: 3px; }

  /* ── ambient background ─────────────────────────────────────── */
  #ambientBg {
    position: fixed; inset: 0; z-index: 0;
    transition: background 1.2s ease;
    /* starts dark; updates dynamically */
  }
  #ambientBg::after {
    content: '';
    position: absolute; inset: 0;
    background: transparent;
  }

  /* ── particle canvas ─────────────────────────────────────────── */
  #particles {
    position: fixed; inset: 0;
    width: 100vw; height: 100vh;
    z-index: 9999;
    pointer-events: none;
    will-change: transform;
  }

  /* ── layout ──────────────────────────────────────────────────── */
  .stage {
    position: relative; z-index: 2;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 22px 12px 40px;
  }

  /* ── title ───────────────────────────────────────────────────── */
  .cyber-title {
    font-family: 'Orbitron', sans-serif;
    font-size: clamp(1.1rem, 3.5vw, 1.7rem);
    font-weight: 900;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: var(--ui-accent);
    text-shadow:
      0 0 8px rgba(var(--ui-accent-rgb),0.8),
      0 0 22px rgba(var(--ui-accent-rgb),0.4),
      0 0 50px rgba(var(--ui-accent-rgb),0.2);
    margin-bottom: 4px;
  }
  .cyber-sub {
    font-size: 0.65rem;
    letter-spacing: 6px;
    color: rgba(var(--ui-accent-rgb),0.35);
    text-transform: uppercase;
    margin-bottom: 20px;
  }

  /* ── three-panel row (stone layout: swatches flank the wheel, centered) ── */
  .panel-row {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    gap: 12px;
    width: 100%;
    max-width: 1100px;
    margin: 0 auto 18px;
    min-height: 480px;
  }
  .center-col {
    flex: 0 0 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding-top: 0;
  }

  /* ── side swatch panels ──────────────────────────────────────── */
  .swatch-panel {
    flex: 0 0 auto;
    width: clamp(118px, 16vw, 168px);
    display: flex;
    flex-direction: column;
    gap: 10px;
    position: relative;
    z-index: 1;
    margin-top: 0;
  }

  /* ── electric border wrapper ─────────────────────────────────── */
  .ep-wrap {
    position: relative;
    flex: 0 0 auto;
    padding: 14px 12px;
    margin-top: -12px;
    border-radius: 18px;
    background: rgba(0,8,20,0.55);
    backdrop-filter: blur(4px);
    box-shadow: inset 0 0 14px rgba(var(--ui-accent-rgb),0.04);
  }
  .ep-wrap.left  { transform: perspective(420px) rotateY(22deg) rotateZ(-1deg) translateX(22px); }
  .ep-wrap.right { transform: perspective(420px) rotateY(-22deg) rotateZ(1deg) translateX(-22px); }

  .ep-canvas {
    position: absolute;
    top: -20px; left: -20px;
    width: calc(100% + 40px); height: calc(100% + 40px);
    border-radius: 18px;
    pointer-events: none;
    z-index: 10;
  }
  .ep-glow-1 {
    position: absolute;
    inset: 0;
    border-radius: 18px;
    border: 1.5px solid rgba(var(--ui-accent-rgb),0.6);
    filter: blur(1px);
    pointer-events: none;
  }
  .ep-glow-2 {
    position: absolute;
    inset: 0;
    border-radius: 18px;
    border: 1.5px solid var(--ui-accent);
    filter: blur(4px);
    pointer-events: none;
  }
  .ep-bg-glow {
    position: absolute;
    inset: 0;
    border-radius: 18px;
    filter: blur(28px);
    transform: scale(1.12);
    opacity: 0.22;
    z-index: 0;
    pointer-events: none;
    background: linear-gradient(-30deg, var(--ui-accent), transparent, var(--ui-accent));
  }

  .swatch-row {
    display: flex;
    gap: 8px;
    justify-content: center;
  }

  .ps {
    width: clamp(44px, 5.2vw, 68px);
    height: clamp(44px, 5.2vw, 68px);
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.12);
    box-shadow:
      0 2px 8px rgba(0,0,0,0.4),
      inset 0 1px 0 rgba(255,255,255,0.15);
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.3s;
    position: relative;
    overflow: hidden;
  }
  .ps::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 50%);
    border-radius: inherit;
    pointer-events: none;
  }
  .ps:hover {
    transform: scale(1.06) translateY(-2px);
    box-shadow:
      0 6px 18px rgba(0,0,0,0.5),
      0 0 12px var(--glow, rgba(0,212,255,0.3)),
      inset 0 1px 0 rgba(255,255,255,0.2);
  }

  /* ── hue ring container ──────────────────────────────────────── */
  .wheel-wrap {
    position: relative;
    width: 220px; height: 220px;
  }

  .wheel-glow {
    position: absolute;
    inset: -18px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(var(--ui-accent-rgb),0.28) 0%, rgba(var(--ui-accent-rgb),0.10) 45%, transparent 70%);
    filter: blur(14px);
    pointer-events: none;
    animation: wheelPulse 2.4s ease-in-out infinite;
    z-index: 0;
  }
  @keyframes wheelPulse {
    0%, 100% { opacity: 0.7; transform: scale(1); }
    50%       { opacity: 1;   transform: scale(1.12); }
  }

  #hueWheel {
    display: block;
    position: relative;
    z-index: 1;
    cursor: crosshair;
  }

  /* inner void glow */
  .wheel-void {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 82px; height: 82px;
    border-radius: 50%;
    background: radial-gradient(circle, #020408 60%, transparent 100%);
    pointer-events: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0;
  }
  .wheel-hue-num {
    font-family: 'Orbitron', sans-serif;
    font-size: 22px;
    font-weight: 900;
    line-height: 1.1;
    letter-spacing: 0;
    color: hsl(200, 90%, 75%);
    text-shadow: 0 0 10px hsl(200, 100%, 65%), 0 0 22px hsl(200, 100%, 55%);
    transition: color 0.1s, text-shadow 0.1s;
  }


  /* ── harmony buttons ─────────────────────────────────────────── */
  .harmony-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
    max-width: 280px;
  }

  .hbtn {
    padding: 5px 12px;
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.74rem;
    font-weight: 500;
    letter-spacing: 1px;
    text-transform: uppercase;
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(0,8,20,0.62);
    color: rgba(var(--ui-accent-rgb),0.85);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .hbtn:hover {
    background: rgba(var(--ui-accent-rgb),0.12);
    border-color: rgba(var(--ui-accent-rgb),0.5);
    color: var(--ui-accent);
    box-shadow: 0 0 8px rgba(var(--ui-accent-rgb),0.2);
  }
  .hbtn.active {
    background: rgba(var(--ui-accent-rgb),0.15);
    border-color: var(--ui-accent);
    color: var(--ui-accent);
    box-shadow: 0 0 10px rgba(var(--ui-accent-rgb),0.35), inset 0 0 6px rgba(var(--ui-accent-rgb),0.1);
  }

  /* ── name row ────────────────────────────────────────────────── */
  .name-row {
    display: flex;
    margin-bottom: 6px;
  }
  .session-name-input {
    width: 100%;
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.78rem;
    letter-spacing: 1px;
    padding: 5px 10px;
    border-radius: 4px;
    border: 1px solid rgba(var(--ui-accent-rgb),0.22);
    background: rgba(0,8,20,0.62);
    color: rgba(var(--ui-accent-rgb),0.85);
    outline: none;
    transition: border-color 0.15s;
  }
  .session-name-input::placeholder { color: rgba(var(--ui-accent-rgb),0.35); }
  .session-name-input:focus { border-color: rgba(var(--ui-accent-rgb),0.6); }

  /* ── action row ──────────────────────────────────────────────── */
  .action-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .btn-rand, .btn-apply {
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.78rem;
    font-weight: 500;
    letter-spacing: 2px;
    text-transform: uppercase;
    padding: 7px 16px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
    position: relative;
    overflow: hidden;
  }
  @keyframes btnPop {
    0%   { transform: scale(1); }
    30%  { transform: scale(0.93); }
    65%  { transform: scale(1.07); }
    100% { transform: scale(1); }
  }
  @keyframes btnRipple {
    0%   { transform: scale(0); opacity: 0.7; }
    100% { transform: scale(2.8); opacity: 0; }
  }
  .btn-ripple {
    position: absolute;
    border-radius: 50%;
    width: 120px; height: 120px;
    margin-left: -60px; margin-top: -60px;
    background: rgba(var(--ui-accent-rgb), 0.45);
    pointer-events: none;
    animation: btnRipple 0.55s ease-out forwards;
  }
  .btn-rand {
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(0,8,20,0.62);
    color: rgba(var(--ui-accent-rgb),0.75);
    font-weight: 500;
  }
  .btn-rand:hover {
    border-color: rgba(var(--ui-accent-rgb),0.5);
    color: var(--ui-accent);
    background: rgba(0,8,20,0.75);
  }
  .btn-apply {
    border: 1px solid rgba(255,255,255,0.2);
    background: rgba(0,8,20,0.62);
    color: var(--ui-accent);
    font-weight: 500;
    box-shadow: 0 0 12px rgba(var(--ui-accent-rgb),0.2);
  }
  .btn-apply:hover {
    background: rgba(var(--ui-accent-rgb),0.22);
    box-shadow: 0 0 20px rgba(var(--ui-accent-rgb),0.4);
  }
  .btn-apply:active {
    transform: scale(0.97);
  }
  .btn-save {
    border: 1px solid rgba(255,255,255,0.15);
    background: rgba(0,8,20,0.62);
    color: rgba(180,220,255,0.75);
    font-weight: 500;
  }
  .btn-save:hover {
    border-color: rgba(var(--ui-accent-rgb),0.45);
    color: rgba(var(--ui-accent-rgb),0.9);
    background: rgba(0,8,20,0.8);
  }

  .var-tables {
    margin-top: 10px;
    padding: 6px 10px 14px;
    border-top: 1px solid rgba(var(--ui-border-rgb), 0.25);
    max-height: 46vh;
    overflow-y: auto;
  }
  .var-tables .v-group { margin-bottom: 6px; }
  .var-tables .v-group-header {
    cursor: pointer;
    user-select: none;
    background: rgba(var(--ui-accent-rgb), 0.10);
    border: 1px solid rgba(var(--ui-accent-rgb), 0.18);
    border-radius: 6px;
    padding: 6px 10px;
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.74rem;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: rgba(var(--ui-accent-rgb), 0.95);
  }
  .var-tables .v-group-header:hover { background: rgba(var(--ui-accent-rgb), 0.18); }
  .var-tables .v-count {
    margin-left: auto;
    opacity: 0.6;
    font-size: 0.66rem;
  }
  .var-tables .v-group[open] > .v-group-header { border-bottom-left-radius: 0; border-bottom-right-radius: 0; }

  /* ── Edit-Layout mode: movable panels (varTables + legend wraps) ──
     The stone set (ep-wrap / center-col / clusters) never gets .draggable. */
  /* Default draggable sizing */
  .draggable { position: relative; }
  #varTables.draggable { position: relative; width: 100%; max-width: 720px; }
  /* A .dragged element has a SAVED position (from layoutOverrides) and keeps it
     applied ALWAYS — not just during edit mode — so the move persists on reload. */
  .draggable.dragged {
    position: absolute !important;
    left: var(--drag-x, 0px) !important;
    top: var(--drag-y, 0px) !important;
    right: auto !important;
    z-index: 50;
  }
  body.edit-layout .draggable {
    cursor: grab;
    outline: 1px dashed rgba(var(--ui-accent-rgb), 0.45);
    outline-offset: 2px;
    /* During edit, all draggables become absolute at their seeded --drag-x/y
       so they stay visually in place when we switch containing block to .stage. */
    position: absolute !important;
    left: var(--drag-x, 0px) !important;
    top: var(--drag-y, 0px) !important;
    right: auto !important;
    z-index: 60;
  }
  body.edit-layout .draggable:active { cursor: grabbing; }
  body.edit-layout .draggable.dragged { z-index: 61; }

  /* ── grab-to-pan (when not editing layout) ───────────────────── */
  :root { --pan-x: 0px; --pan-y: 0px; }
  .panel-row, .tables-below {
    transform: translate(var(--pan-x), var(--pan-y));
    will-change: transform;
  }
  .stage {
    cursor: default;
  }
  body:not(.edit-layout) .stage {
    cursor: grab;
  }
  body:not(.edit-layout) .stage:active {
    cursor: grabbing;
  }
  body.is-panning {
    cursor: grabbing !important;
    user-select: none;
  }
  body.is-panning .panel-row,
  body.is-panning .tables-below {
    transition: none;
  }

  /* ── color override modal ─────────────────────────────────────── */
  .override-modal-bg {
    display: none;
    position: fixed; inset: 0; z-index: 100;
    background: rgba(0,0,0,0.65);
    backdrop-filter: blur(4px);
    align-items: center;
    justify-content: center;
  }
  .override-modal-bg.open { display: flex; }
  .override-modal {
    background: rgba(2,6,18,0.96);
    border: 1px solid rgba(var(--ui-accent-rgb),0.3);
    border-radius: 14px;
    padding: 18px;
    box-shadow: 0 0 50px rgba(var(--ui-accent-rgb),0.18), inset 0 0 20px rgba(var(--ui-accent-rgb),0.04);
    backdrop-filter: blur(10px);
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 220px;
  }
  .override-modal-title {
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.74rem;
    font-weight: 500;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: rgba(var(--ui-accent-rgb),0.9);
    text-align: center;
  }
  .override-picker-row {
    display: flex;
    gap: 8px;
    align-items: stretch;
  }
  .sl-canvas {
    border-radius: 6px;
    cursor: crosshair;
    border: 1px solid rgba(255,255,255,0.1);
  }
  .hue-strip-canvas {
    border-radius: 4px;
    cursor: crosshair;
    border: 1px solid rgba(255,255,255,0.1);
  }
  .override-preview-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .override-preview-swatch {
    width: 38px; height: 38px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.15);
    flex-shrink: 0;
    box-shadow: 0 0 12px rgba(var(--ui-accent-rgb),0.2);
  }
  .override-preview-hex {
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.78rem;
    letter-spacing: 1.5px;
    color: rgba(255,255,255,0.92);
  }
  .override-btn-row {
    display: flex;
    gap: 7px;
  }
  .override-btn {
    flex: 1;
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.68rem;
    font-weight: 500;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    padding: 6px 8px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
    background: rgba(0,8,20,0.62);
    border: 1px solid rgba(255,255,255,0.12);
    color: rgba(var(--ui-accent-rgb),0.8);
  }
  .override-btn:hover {
    background: rgba(var(--ui-accent-rgb),0.12);
    border-color: rgba(var(--ui-accent-rgb),0.5);
    color: var(--ui-accent);
  }
  .override-btn.confirm {
    border-color: rgba(var(--ui-accent-rgb),0.4);
    color: var(--ui-accent);
  }
  .override-btn.confirm:hover {
    background: rgba(var(--ui-accent-rgb),0.2);
    box-shadow: 0 0 12px rgba(var(--ui-accent-rgb),0.3);
  }
  .ps.has-override {
    outline: 2px solid rgba(var(--ui-accent-rgb),0.45);
    outline-offset: 2px;
  }
  .ps-override-x {
    display: none;
    position: absolute;
    top: 3px; right: 3px;
    width: 14px; height: 14px;
    border-radius: 50%;
    background: rgba(10,12,24,0.82);
    border: 1px solid rgba(255,255,255,0.3);
    color: rgba(255,255,255,0.88);
    font-size: 9px;
    line-height: 12px;
    text-align: center;
    cursor: pointer;
    z-index: 4;
    pointer-events: all;
    font-family: sans-serif;
    transition: background 0.12s, border-color 0.12s;
  }
  .ps.has-override .ps-override-x { display: block; }
  .ps-override-x:hover {
    background: rgba(220,60,60,0.85);
    border-color: rgba(255,120,120,0.7);
  }

  /* ── hex list ────────────────────────────────────────────────── */
  #hexList {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    justify-content: center;
    max-width: 280px;
  }
  .hex-chip {
    font-size: 0.62rem;
    letter-spacing: 1px;
    padding: 3px 8px;
    border-radius: 3px;
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.04);
    cursor: pointer;
    transition: all 0.12s;
    color: #c0d0ff;
    font-family: 'Share Tech Mono', monospace;
  }
  .hex-chip:hover {
    border-color: rgba(255,255,255,0.3);
    background: rgba(255,255,255,0.08);
    color: #fff;
  }

  /* ── right-side role legend ─────────────────────────────────── */
  .legend-wrap {
    position: absolute;
    left: calc(100% + 8px);
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .legend-panel {
    width: clamp(176px, 18vw, 214px);
    max-height: min(62vh, 440px);
    overflow: auto;
    border: 1px solid rgba(var(--ui-accent-rgb),0.18);
    background: rgba(0,8,20,0.62);
    border-radius: 10px;
    padding: 8px;
    box-shadow: 0 0 18px rgba(var(--ui-accent-rgb),0.08), inset 0 0 10px rgba(var(--ui-accent-rgb),0.05);
    backdrop-filter: blur(3px);
  }
  .legend-panel.mobile {
    display: none;
    position: static;
    left: auto;
    top: auto;
    transform: none;
    width: min(94vw, 360px);
    max-height: 34vh;
    margin: 8px auto 0;
  }
  .legend-title {
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.74rem;
    font-weight: 500;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: rgba(var(--ui-accent-rgb),0.9);
    text-align: center;
    margin-bottom: 6px;
  }
  .legend-row {
    display: grid;
    grid-template-columns: 12px 1fr auto;
    align-items: center;
    gap: 8px;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 6px;
    background: rgba(255,255,255,0.03);
    padding: 5px 6px;
    margin-bottom: 5px;
  }
  .legend-dot {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    border: 1px solid rgba(255,255,255,0.28);
    box-shadow: 0 0 8px var(--lg, rgba(0,212,255,0.4));
  }
  .legend-name {
    font-size: 0.68rem;
    letter-spacing: 1px;
    color: rgba(220,235,255,0.95);
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .legend-meta {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }
  .legend-color-name {
    font-size: 0.6rem;
    letter-spacing: 0.7px;
    color: rgba(185,210,240,0.82);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .legend-hex {
    font-size: 0.64rem;
    letter-spacing: 0.8px;
    color: rgba(255,255,255,0.92);
    cursor: pointer;
    font-family: 'Share Tech Mono', monospace;
  }
  .legend-hex:hover {
    color: #fff;
    text-decoration: underline;
  }

  /* ── left cluster ──────────────────────────────────────────────── */
  .left-cluster {
    position: relative;
    display: flex;
    align-items: flex-start;
    flex: 0 0 auto;
  }
  .left-legend-wrap {
    position: absolute;
    right: calc(100% + 16px);
    top: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: clamp(172px, 17vw, 210px);
    z-index: 20;
  }

  .right-legend-wrap {
    position: absolute;
    left: calc(100% + 16px);
    top: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: clamp(172px, 17vw, 210px);
    z-index: 20;
  }

  .right-cluster {
    position: relative;
    display: flex;
    align-items: flex-start;
    flex: 0 0 auto;
  }

  /* shared quick-panel (Backgrounds / Fonts / Opacity) */
  .quick-panel {
    border: 1px solid rgba(var(--ui-accent-rgb),0.18);
    background: rgba(0,8,20,0.62);
    border-radius: 10px;
    padding: 8px;
    box-shadow: 0 0 18px rgba(var(--ui-accent-rgb),0.08), inset 0 0 10px rgba(var(--ui-accent-rgb),0.05);
    backdrop-filter: blur(3px);
  }
  .qp-row {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 5px;
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 5px;
    background: rgba(255,255,255,0.025);
    padding: 3px 6px;
    margin-top: 3px;
  }
  .qp-label {
    font-size: 0.56rem;
    letter-spacing: 0.9px;
    color: rgba(195,220,255,0.82);
    text-transform: uppercase;
    white-space: nowrap;
  }
  .qp-select {
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.56rem;
    padding: 2px 3px;
    border-radius: 4px;
    border: 1px solid rgba(var(--ui-accent-rgb),0.2);
    background: rgba(0,6,18,0.85);
    color: rgba(200,220,255,0.88);
    outline: none;
    max-width: 88px;
  }
  .qp-slider-wrap {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .qp-slider {
    width: 48px;
    accent-color: var(--ui-accent);
    height: 4px;
  }
  .qp-val {
    font-size: 0.56rem;
    color: rgba(var(--ui-accent-rgb),0.9);
    font-family: 'Share Tech Mono', monospace;
    min-width: 22px;
    text-align: right;
  }

  /* ── HUD corner ──────────────────────────────────────────────── */
  .hud {
    z-index: 10;
    font-size: 0.56rem;
    letter-spacing: 0;
    text-transform: uppercase;
    border: 1px solid rgba(var(--ui-accent-rgb),0.18);
    background: rgba(0,8,20,0.62);
    border-radius: 10px;
    padding: 8px;
    box-shadow: 0 0 18px rgba(var(--ui-accent-rgb),0.08), inset 0 0 10px rgba(var(--ui-accent-rgb),0.05);
    backdrop-filter: blur(3px);
    pointer-events: none;
  }
  .hud-title {
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.74rem;
    font-weight: 500;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: rgba(var(--ui-accent-rgb),0.9);
    text-align: center;
    margin-bottom: 6px;
  }
  .hud-row {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 8px;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 6px;
    background: rgba(255,255,255,0.03);
    padding: 5px 6px;
    margin-bottom: 5px;
  }
  .hud-row:last-child { margin-bottom: 0; }
  .hud-label {
    font-size: 0.58rem;
    letter-spacing: 1px;
    color: rgba(195,220,255,0.86);
    text-transform: uppercase;
    white-space: nowrap;
  }
  .hud-value {
    font-size: 0.56rem;
    letter-spacing: 0.8px;
    color: rgba(var(--ui-accent-rgb),0.9);
    font-family: 'Share Tech Mono', monospace;
    white-space: nowrap;
  }

  /* ── bg toggles ──────────────────────────────────────────────── */
  .bg-toggles {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-top: 8px;
  }
  .bg-toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 5px 8px;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 6px;
    background: rgba(255,255,255,0.03);
  }
  .bg-toggle-label {
    font-size: 0.58rem;
    letter-spacing: 1px;
    color: rgba(195,220,255,0.86);
    text-transform: uppercase;
    white-space: nowrap;
  }
  .bg-toggle-pill {
    position: relative;
    width: 32px;
    height: 16px;
    flex-shrink: 0;
  }
  .bg-toggle-pill input {
    opacity: 0;
    width: 0;
    height: 0;
    position: absolute;
  }
  .bg-toggle-track {
    position: absolute;
    inset: 0;
    border-radius: 999px;
    background: rgba(255,255,255,0.12);
    cursor: pointer;
    transition: background 0.22s;
  }
  .bg-toggle-track::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: rgba(180,205,255,0.55);
    transition: transform 0.22s, background 0.22s;
  }
  .bg-toggle-pill input:checked + .bg-toggle-track {
    background: rgba(var(--ui-accent-rgb),0.45);
  }
  .bg-toggle-pill input:checked + .bg-toggle-track::after {
    transform: translateX(16px);
    background: rgba(var(--ui-accent-rgb),1);
  }

  /* ── bg image gallery ─────────────────────────────────── */
  .bg-img-gallery {
    margin-top: 8px;
    display: block;
  }
  .bg-img-gallery > .qp-label { opacity: 0.5; margin-bottom: 4px; }
  .bg-img-thumbs {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
    gap: 5px;
    max-height: 168px;
    overflow-y: auto;
    padding: 5px;
    border-radius: 8px;
    background: rgba(0,0,0,0.25);
    border: 1px solid rgba(255,255,255,0.06);
  }
  .qp-btn {
    font-family: var(--ftr10-font-panel-top, 'Share Tech Mono', monospace);
    font-size: 0.62rem;
    padding: 3px 10px;
    border-radius: 5px;
    border: 1px solid rgba(var(--ui-accent-rgb),0.3);
    background: rgba(0,8,20,0.7);
    color: rgba(180,200,255,0.8);
    cursor: pointer;
    margin-top: 6px;
  }
  .qp-btn:hover { border-color: rgba(var(--ui-accent-rgb),0.7); color: #fff; }
  .bg-img-thumb {
    position: relative;
    aspect-ratio: 16 / 9;
    padding: 0;
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 6px;
    overflow: hidden;
    cursor: pointer;
    background: #000;
    transition: border-color 0.15s, box-shadow 0.15s, transform 0.12s;
  }
  .bg-img-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    pointer-events: none;
  }
  .bg-img-thumb:hover { transform: translateY(-1px); border-color: rgba(var(--ui-accent-rgb),0.6); }
  .bg-img-thumb.selected {
    border-color: rgba(var(--ui-accent-rgb),1);
    box-shadow: 0 0 0 1px rgba(var(--ui-accent-rgb),1), 0 0 12px rgba(var(--ui-accent-rgb),0.55);
  }

  /* ── responsive collapse ─────────────────────────────────────── */
  @media (max-width: 420px) {
    .swatch-panel { display: none; }
    .panel-row { justify-content: center; flex-wrap: wrap; }
    .legend-wrap { display: none; }
    .legend-panel.mobile {
      display: block;
      width: min(96vw, 340px);
      max-height: 30vh;
    }
    .left-legend-wrap, .right-legend-wrap { display: none; }
  }

  @media (max-width: 1400px) {
    .left-legend-wrap, .right-legend-wrap { width: clamp(158px, 15vw, 196px); }
  }
  @media (max-width: 1200px) {
    /* Keep both swatch clusters flanking the wheel; only shrink legend width */
    .left-legend-wrap, .right-legend-wrap { width: clamp(158px, 15vw, 196px); }
    .legend-panel.mobile { display: none; }
  }

  @media (max-width: 1280px) {
    .legend-wrap {
      left: calc(100% + 6px);
    }
    .legend-panel {
      width: clamp(168px, 20vw, 196px);
    }
  }

  @media (max-width: 1080px) {
    .legend-wrap { display: none; }
    .legend-panel.mobile { display: block; }
  }

  /* ── vars panel ───────────────────────────────────────────────── */
  .vars-panel {
    position: relative; z-index: 2;
    width: 100%;
    margin: 16px auto 30px;
    border: 1px solid rgba(var(--ui-accent-rgb),0.18);
    border-radius: 14px;
    background: rgba(0,8,20,0.62);
    backdrop-filter: blur(4px);
    box-shadow: 0 0 18px rgba(var(--ui-accent-rgb),0.07), inset 0 0 10px rgba(var(--ui-accent-rgb),0.04);
  }
  .vars-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px 10px;
    border-bottom: 1px solid rgba(var(--ui-accent-rgb),0.12);
  }
  .vars-panel-title {
    font-family: 'Orbitron', sans-serif;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: rgba(var(--ui-accent-rgb),0.85);
  }
  .vars-toggle-row { display: flex; align-items: center; gap: 8px; }
  .vars-toggle-label {
    font-size: 0.65rem;
    letter-spacing: 1.5px;
    color: rgba(var(--ui-accent-rgb),0.5);
    text-transform: uppercase;
  }
  .vars-toggle-btn {
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.7rem;
    padding: 3px 10px;
    border-radius: 4px;
    border: 1px solid rgba(var(--ui-accent-rgb),0.25);
    background: rgba(0,8,20,0.7);
    color: rgba(var(--ui-accent-rgb),0.7);
    cursor: pointer;
    letter-spacing: 1px;
    transition: all 0.15s;
  }
  .vars-toggle-btn:hover { border-color: rgba(var(--ui-accent-rgb),0.55); color: var(--ui-accent); }
  .vars-content { padding: 12px 14px 14px; }
  .v-empty {
    font-size: 0.7rem;
    letter-spacing: 0.8px;
    color: rgba(var(--ui-accent-rgb),0.35);
    text-align: center;
    padding: 18px 0;
  }
  .v-group {
    margin-bottom: 8px;
    border: 1px solid rgba(var(--ui-accent-rgb),0.1);
    border-radius: 8px;
    overflow: hidden;
    background: rgba(0,4,14,0.4);
  }
  .v-group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 12px;
    font-size: 0.68rem;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: rgba(var(--ui-accent-rgb),0.8);
    cursor: pointer;
    user-select: none;
    background: rgba(var(--ui-accent-rgb),0.06);
    list-style: none;
  }
  .v-group-header::-webkit-details-marker { display: none; }
  .v-count {
    font-size: 0.58rem;
    letter-spacing: 1px;
    color: rgba(var(--ui-accent-rgb),0.4);
    background: rgba(var(--ui-accent-rgb),0.08);
    border: 1px solid rgba(var(--ui-accent-rgb),0.12);
    border-radius: 3px;
    padding: 1px 5px;
  }
  .v-group-fields { padding: 8px 10px; display: flex; flex-direction: column; gap: 5px; }
  .v-field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .v-field-row:last-child { border-bottom: none; }
  .v-field-label {
    font-size: 0.65rem;
    letter-spacing: 0.8px;
    color: rgba(185,210,255,0.7);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: 'Share Tech Mono', monospace;
  }
  .v-field-input-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .v-field-input-wrap input[type="color"] {
    width: 28px; height: 24px;
    padding: 1px 2px;
    border-radius: 4px;
    border: 1px solid rgba(255,255,255,0.15);
    background: transparent;
    cursor: pointer;
    flex-shrink: 0;
  }
  .v-field-input-wrap input[type="text"] {
    flex: 1;
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.68rem;
    letter-spacing: 0.8px;
    padding: 3px 7px;
    border-radius: 4px;
    border: 1px solid rgba(var(--ui-accent-rgb),0.18);
    background: rgba(0,6,18,0.7);
    color: rgba(200,220,255,0.9);
    outline: none;
    min-width: 0;
  }
  .v-field-input-wrap input[type="text"]:focus { border-color: rgba(var(--ui-accent-rgb),0.5); }
  .v-alpha-wrap {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }
  .v-alpha-wrap input[type="range"] {
    width: 52px;
    accent-color: var(--sw, var(--ui-accent));
    height: 4px;
  }
  .v-alpha-label {
    font-size: 0.58rem;
    color: rgba(var(--ui-accent-rgb),0.5);
    white-space: nowrap;
    font-family: 'Share Tech Mono', monospace;
  }
  .v-select-wrap select {
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.65rem;
    padding: 3px 6px;
    border-radius: 4px;
    border: 1px solid rgba(var(--ui-accent-rgb),0.2);
    background: rgba(0,6,18,0.8);
    color: rgba(200,220,255,0.9);
    outline: none;
    width: 100%;
  }
</style>
</head>
<body>

<div id="ambientBg"></div>
<canvas id="particles"></canvas>

<div class="stage">
  <div class="cyber-title">FTR10 Codex</div>
  <div class="cyber-sub">Color Architect</div>
  <button class="btn-layout" id="editLayoutBtn" title="Toggle Edit-Layout mode (drag panels)">⚙ Edit Layout</button>

  <div class="panel-row">
    <!-- left cluster: swatches + floating left-side tables -->
    <div class="left-cluster">
    <div class="ep-wrap left">
      <canvas class="ep-canvas" id="epCanvasLeft"></canvas>
      <div class="ep-glow-1"></div>
      <div class="ep-glow-2"></div>
      <div class="ep-bg-glow"></div>
      <div class="swatch-panel" id="leftPanel">
        <div class="swatch-row">
          <div class="ps" id="lp0"><span class="ps-override-x">×</span></div>
          <div class="ps" id="lp1"><span class="ps-override-x">×</span></div>
        </div>
        <div class="swatch-row">
          <div class="ps" id="lp2"><span class="ps-override-x">×</span></div>
          <div class="ps" id="lp3"><span class="ps-override-x">×</span></div>
        </div>
        <div class="swatch-row">
          <div class="ps" id="lp4"><span class="ps-override-x">×</span></div>
          <div class="ps" id="lp5"><span class="ps-override-x">×</span></div>
        </div>
      </div>
    </div>

    <!-- left-side floating tables: Palette, Status, Backgrounds, Fonts, Opacity -->
    <div class="left-legend-wrap draggable">
      <div class="legend-panel desktop" id="colorLegendDesktop"></div>
      <div class="hud" style="pointer-events:none">
        <div class="hud-title">Status</div>
        <div class="hud-row"><span class="hud-label">Hue</span><span class="hud-value" id="hudHue">000°</span></div>
        <div class="hud-row"><span class="hud-label">Mode</span><span class="hud-value" id="hudHarmony">Complementary</span></div>
        <div class="hud-row"><span class="hud-label">Sync</span><span class="hud-value" id="hudSync">Active</span></div>
      </div>
      <div class="quick-panel">
        <div class="hud-title">Backgrounds</div>
        <div class="qp-row">
          <span class="qp-label">Thpace Particles</span>
          <label class="bg-toggle-pill">
            <input type="checkbox" id="thpaceToggle">
            <span class="bg-toggle-track"></span>
          </label>
        </div>
        <div class="qp-row">
          <span class="qp-label">Effect</span>
          <div class="qp-select-wrap">
            <select id="bgEffectSelect">
              <option value="none">None</option>
              <option value="kaleidoscope">Kaleidoscope</option>
              <option value="aurora">Aurora</option>
              <option value="nebula">Nebula</option>
              <option value="crt">CRT</option>
              <option value="circuit">Circuit</option>
              <option value="meshflow">Meshflow</option>
              <option value="playstation">Playstation</option>
              <!-- image effect temporarily disabled while investigating layering/lag -->
            </select>
          </div>
        </div>
        <div class="qp-row">
          <span class="qp-label">BG Effect</span>
          <label class="bg-toggle-pill">
            <input type="checkbox" id="bgEffectToggle">
            <span class="bg-toggle-track"></span>
          </label>
        </div>
      </div>
      <!-- Fonts and Opacity moved to right side -->
    </div>
    </div><!-- /left-cluster -->

    <!-- center wheel + controls -->
    <div class="center-col">
      <div class="wheel-wrap">
        <div class="wheel-glow"></div>
        <canvas id="hueWheel" width="220" height="220"></canvas>
        <div class="wheel-void">
          <span class="wheel-hue-num" id="wheelHueNum">200</span>
        </div>
      </div>

      <div class="harmony-row" id="harmonyRow">
        <button class="hbtn active" data-harmony="complementary">Comp</button>
        <button class="hbtn" data-harmony="triadic">Triadic</button>
        <button class="hbtn" data-harmony="split">Split</button>
        <button class="hbtn" data-harmony="analogous">Analog</button>
        <button class="hbtn" data-harmony="tetradic">Tetra</button>
        <button class="hbtn" data-harmony="monochromatic">Mono</button>
      </div>

      <div class="name-row">
        <input type="text" id="sessionNameInput" class="session-name-input" placeholder="Session name..." value="Untitled" maxlength="40" autocomplete="off" spellcheck="false">
      </div>
      <div class="action-row">
        <button class="btn-rand" id="randomBtn">⟳ Random</button>
        <button class="btn-save btn-rand" id="saveBtn">⊛ Save</button>
        <button class="btn-apply" id="applyBtn">⬡ Apply</button>
      </div>

      <!-- Per-section variable tables (replaces the removed Advanced Editor).
           Each section from varsState.sections renders as a collapsible table;
           edits write to the single varsState.values via liveUpdate. -->
      <div id="varTables" class="var-tables draggable"></div>

      <div class="legend-panel mobile" id="colorLegendMobile"></div>
    </div>

    <!-- right swatch panel + anchored legend -->
    <div class="right-cluster">
      <div class="ep-wrap right">
        <canvas class="ep-canvas" id="epCanvasRight"></canvas>
        <div class="ep-glow-1"></div>
        <div class="ep-glow-2"></div>
        <div class="ep-bg-glow"></div>
        <div class="swatch-panel" id="rightPanel">
          <div class="swatch-row">
            <div class="ps" id="rp0"><span class="ps-override-x">×</span></div>
            <div class="ps" id="rp1"><span class="ps-override-x">×</span></div>
          </div>
          <div class="swatch-row">
            <div class="ps" id="rp2"><span class="ps-override-x">×</span></div>
            <div class="ps" id="rp3"><span class="ps-override-x">×</span></div>
          </div>
          <div class="swatch-row">
            <div class="ps" id="rp4"><span class="ps-override-x">×</span></div>
            <div class="ps" id="rp5"><span class="ps-override-x">×</span></div>
          </div>
        </div>
      </div>
      <div class="right-legend-wrap draggable">
        <div class="quick-panel draggable" id="fontsPanel">
          <div class="hud-title">Fonts</div>
          <div style="font-size:0.56rem;padding:4px 2px;color:rgba(180,200,255,0.45)">Load config to edit.</div>
        </div>
        <div class="quick-panel draggable" id="opacityPanel">
          <div class="hud-title">Opacity</div>
          <div style="font-size:0.56rem;padding:4px 2px;color:rgba(180,200,255,0.45)">Load config to edit.</div>
        </div>
      </div>
    </div>
  </div>
  <div class="tables-below" style="display:none">
    <div class="quick-panel draggable" id="bgPanel_below">
      <div class="hud-title">Backgrounds</div>
      <div class="qp-row">
        <span class="qp-label">Thpace Particles</span>
        <label class="bg-toggle-pill"><input type="checkbox" id="thpaceToggle_below"><span class="bg-toggle-track"></span></label>
      </div>
      <div class="qp-row">
        <span class="qp-label">Effect</span>
        <div class="qp-select-wrap">
          <select id="bgEffectSelect_below">
            <option value="none">None</option>
            <option value="kaleidoscope">Kaleidoscope</option>
            <option value="aurora">Aurora</option>
            <option value="nebula">Nebula</option>
            <option value="crt">CRT</option>
            <option value="circuit">Circuit</option>
            <option value="meshflow">Meshflow</option>
            <option value="playstation">Playstation</option>
            <!-- image effect temporarily disabled while investigating layering/lag -->
          </select>
        </div>
      </div>
      <div class="qp-row">
        <span class="qp-label">BG Effect</span>
        <label class="bg-toggle-pill"><input type="checkbox" id="bgEffectToggle_below"><span class="bg-toggle-track"></span></label>
      </div>
    </div>
    <div class="quick-panel draggable" id="fontsPanel_below">
      <div class="hud-title">Fonts</div>
      <div style="font-size:0.56rem;padding:4px 2px;color:rgba(180,200,255,0.45)">Load config to edit.</div>
    </div>
    <div class="quick-panel draggable" id="opacityPanel_below">
      <div class="hud-title">Opacity</div>
      <div style="font-size:0.56rem;padding:4px 2px;color:rgba(180,200,255,0.45)">Load config to edit.</div>
    </div>
  </div>
</div>

<!-- ── apply overwrite confirm modal ─────────────────────────────────────── -->
<div class="override-modal-bg" id="saveConfirmModal">
  <div class="override-modal" style="max-width:320px;gap:12px;">
    <div class="override-modal-title">Save Session</div>
    <div style="font-size:0.72rem;letter-spacing:0.8px;color:rgba(185,210,255,0.82);text-align:center;line-height:1.5;">
      You are editing an existing session card.<br>What would you like to do?
    </div>
    <div class="override-btn-row" style="flex-direction:column;gap:6px;">
      <button class="override-btn confirm" id="saveConfirmOverwriteBtn">Overwrite existing card</button>
      <button class="override-btn" id="saveConfirmNewBtn">Save as new card</button>
      <button class="override-btn" id="saveConfirmCancelBtn" style="color:rgba(180,200,255,0.45);border-color:rgba(255,255,255,0.07);">Cancel</button>
    </div>
  </div>
</div>


<script>
(function() {
// ── stub vscode (replace with acquireVsCodeApi() in extension) ──────────────
const vscode = (typeof acquireVsCodeApi !== 'undefined')
  ? acquireVsCodeApi()
  : { postMessage: (m) => console.log('[vscode msg]', m) };

// ── webview tracer ─────────────────────────────────────────────────────────
// Forwards navigation/state events to the extension host, which appends them to
// ~/.ftr10/logs/ftr10-trace.log alongside host + shim events (unified timeline).
// Also mirrors to console + a local ring buffer you can grab from DevTools:
//   window.__ftr10WvTrace  (array)   /   __ftr10DumpTrace()
window.__ftr10WvTrace = window.__ftr10WvTrace || [];
function __wvTrace(event, data) {
  try {
    const entry = { t: Date.now(), src: 'architect', ev: event };
    if (data) entry.d = data;
    window.__ftr10WvTrace.push(entry);
    if (window.__ftr10WvTrace.length > 500) window.__ftr10WvTrace.shift();
    if (console && console.debug) console.debug('[FTR10-TRACE]', event, data || '');
    vscode.postMessage({ command: 'trace', source: 'architect', event, data });
  } catch (_e) {}
}
window.__ftr10DumpTrace = function() { try { console.table(window.__ftr10WvTrace); } catch (_e) { console.log(window.__ftr10WvTrace); } return window.__ftr10WvTrace; };
__wvTrace('architect-script-init', {});

// ── Edit-Layout mode: drag movable panels (varTables + legend wraps) ──
// Stone set (ep-wrap / center-col / clusters) is NEVER draggable.
(function initLayoutDrag() {
  const MOVABLE = ['varTables', 'left-legend-wrap', 'right-legend-wrap', 'fontsPanel', 'opacityPanel', 'fontsPanel_below', 'opacityPanel_below', 'bgPanel_below', 'colorLegendDesktop'];
  const stage = document.querySelector('.stage') || document.body;
  function elFor(id) {
    if (id === 'varTables') return document.getElementById('varTables');
    if (id.includes('Panel') || id.includes('Legend') || id.includes('Below')) {
      return document.getElementById(id) || document.querySelector('.' + id);
    }
    return document.getElementById(id) || document.querySelector('.' + id);
  }
  function commit(id, x, y) {
    const ov = Object.assign({}, window.__layoutOverrides || {});
    ov[id] = { x: Math.round(x), y: Math.round(y) };
    window.__layoutOverrides = ov;
    try { vscode.postMessage({ command: 'saveLayout', overrides: ov }); } catch(_e) {}
  }
  function commitRemoval(id) {
    const ov = Object.assign({}, window.__layoutOverrides || {});
    if (ov[id]) { delete ov[id]; window.__layoutOverrides = ov;
      try { vscode.postMessage({ command: 'saveLayout', overrides: ov }); } catch(_e) {}
    }
  }
  function applyOverrides(ov) {
    if (!ov) return;
    window.__layoutOverrides = Object.assign({}, window.__layoutOverrides || {}, ov);
    MOVABLE.forEach(id => {
      const el = elFor(id); if (!el || !ov[id]) return;
      el.style.setProperty('--drag-x', ov[id].x + 'px');
      el.style.setProperty('--drag-y', ov[id].y + 'px');
      el.classList.add('dragged');
    });
  }
  window.__applyLayoutOverrides = applyOverrides;
  // Also expose a way to clear a single override (reset position)
  window.__clearLayoutOverride = function(id) {
    const el = elFor(id); if (el) { el.classList.remove('dragged'); el.style.removeProperty('--drag-x'); el.style.removeProperty('--drag-y'); }
    commitRemoval(id);
  };
  const btn = document.getElementById('editLayoutBtn');
  if (!btn) return;
  let dragging = null; // { el, id, offX, offY, moved }
  const movedInSession = new Set();
  function enterEdit() {
    document.body.classList.add('edit-layout');
    btn.classList.add('active');
    movedInSession.clear();
    MOVABLE.forEach(id => {
      const el = elFor(id); if (!el) return;
      // Seed position from current bounding rect so switch to stage-absolute doesn't jump.
      // For already-dragged elements, the current rect already equals saved position, so seed is same.
      const r = el.getBoundingClientRect();
      const sr = stage.getBoundingClientRect();
      // If not yet seeded (no inline --drag-x), seed now. If already has saved pos, keep it but ensure consistent.
      if (!el.style.getPropertyValue('--drag-x')) {
        el.style.setProperty('--drag-x', (r.left - sr.left) + 'px');
        el.style.setProperty('--drag-y', (r.top - sr.top) + 'px');
      } else {
        // Re-sync from actual rect to avoid drift after window resize while in edit? Keep existing if dragged.
        if (!el.classList.contains('dragged')) {
          el.style.setProperty('--drag-x', (r.left - sr.left) + 'px');
          el.style.setProperty('--drag-y', (r.top - sr.top) + 'px');
        }
      }
    });
  }
  function exitEdit() {
    document.body.classList.remove('edit-layout');
    btn.classList.remove('active');
    MOVABLE.forEach(id => {
      const el = elFor(id); if (!el) return;
      if (el.classList.contains('dragged')) {
        // Has saved position — persist whatever current --drag-x/y is (seeded or moved)
        const x = parseFloat(el.style.getPropertyValue('--drag-x')) || 0;
        const y = parseFloat(el.style.getPropertyValue('--drag-y')) || 0;
        commit(id, x, y);
      } else {
        // Never dragged — clear seeded inline pos so it reverts to default layout
        el.style.removeProperty('--drag-x');
        el.style.removeProperty('--drag-y');
      }
    });
  }
  btn.addEventListener('click', () => {
    if (document.body.classList.contains('edit-layout')) exitEdit(); else enterEdit();
  });
  document.addEventListener('pointerdown', (e) => {
    if (!document.body.classList.contains('edit-layout')) return;
    const el = (e.target).closest('.draggable'); if (!el) return;
    const id = el.id || (el.classList.contains('left-legend-wrap') ? 'left-legend-wrap'
      : el.classList.contains('right-legend-wrap') ? 'right-legend-wrap' : null);
    if (!id) return;
    const r = el.getBoundingClientRect();
    dragging = { el, id, offX: e.clientX - r.left, offY: e.clientY - r.top, moved: false, startX: e.clientX, startY: e.clientY };
    try { el.setPointerCapture(e.pointerId); } catch(_){}
  });
  document.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragging.startX, dy = e.clientY - dragging.startY;
    if (!dragging.moved && Math.hypot(dx, dy) < 3) return; // threshold
    if (!dragging.moved) {
      dragging.moved = true;
      movedInSession.add(dragging.id);
      dragging.el.classList.add('dragged');
    }
    const sr = stage.getBoundingClientRect();
    const x = e.clientX - sr.left - dragging.offX;
    const y = e.clientY - sr.top - dragging.offY;
    dragging.el.style.setProperty('--drag-x', x + 'px');
    dragging.el.style.setProperty('--drag-y', y + 'px');
  });
  document.addEventListener('pointerup', (e) => {
    if (!dragging) return;
    const d = dragging; dragging = null;
    try { d.el.releasePointerCapture(e.pointerId); } catch (_) {}
    if (d.moved) {
      commit(d.id,
        parseFloat(d.el.style.getPropertyValue('--drag-x')) || 0,
        parseFloat(d.el.style.getPropertyValue('--drag-y')) || 0);
    }
  });
  // Double-click a dragged panel in edit mode to reset it to default position
  document.addEventListener('dblclick', (e) => {
    if (!document.body.classList.contains('edit-layout')) return;
    const el = (e.target).closest('.draggable.dragged'); if (!el) return;
    const id = el.id || (el.classList.contains('left-legend-wrap') ? 'left-legend-wrap'
      : el.classList.contains('right-legend-wrap') ? 'right-legend-wrap' : null);
    if (!id) return;
    e.preventDefault();
    el.classList.remove('dragged');
    el.style.removeProperty('--drag-x');
    el.style.removeProperty('--drag-y');
    // After clearing, re-seed so it doesn't jump while still in edit mode
    const r = el.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    // But we don't want it absolute anymore — remove edit absolute by temporarily clearing edit?
    // Instead, force it back to default flow by removing edit mode for this element?
    // Simplest: commit removal and exit/re-enter logic: just commitRemoval
    commitRemoval(id);
    // Re-seed for visual stability if staying in edit mode: compute default layout position after removal
    requestAnimationFrame(() => {
      if (!document.body.classList.contains('edit-layout')) return;
      const nr = el.getBoundingClientRect();
      const nsr = stage.getBoundingClientRect();
      el.style.setProperty('--drag-x', (nr.left - nsr.left) + 'px');
      el.style.setProperty('--drag-y', (nr.top - nsr.top) + 'px');
    });
  });
})();

// ── grab-to-pan: drag empty stage to move panel-row ───────────────────────
(function initPan() {
  const stage = document.querySelector('.stage');
  if (!stage) return;
  let panning = null; // { startX, startY, originX, originY }
  let panX = 0, panY = 0;

  // Elements that should NOT trigger pan (clickable / draggable)
  const NO_PAN_SEL = [
    'button', 'input', 'select', 'textarea', 'canvas',
    '.ps', '.swatch-panel', '.ep-wrap', '.wheel-wrap', '.harmony-row',
    '.name-row', '.action-row', '.quick-panel', '.legend-panel', '.hud',
    '.var-tables', '.override-modal', '.override-modal-bg', '#editLayoutBtn',
    '.draggable', 'a', '[contenteditable]'
  ].join(',');

  function isNoPanTarget(t) {
    try { return t.closest(NO_PAN_SEL); } catch { return false; }
  }

  stage.addEventListener('pointerdown', (e) => {
    if (document.body.classList.contains('edit-layout')) return;
    if (e.button !== 0) return; // left button / touch only
    if (isNoPanTarget(e.target)) return;
    // Only start pan if clicking directly on stage, panel-row empty gaps, center-col gaps
    // Allow if target is stage, panel-row, left-cluster, right-cluster, center-col
    const okParents = ['.stage', '.panel-row', '.left-cluster', '.right-cluster', '.center-col', '.cyber-title', '.cyber-sub'];
    const isOk = okParents.some(sel => {
      try { return e.target.closest(sel); } catch { return false; }
    });
    // If not inside an ok parent, don't pan
    if (!isOk && e.target !== stage) return;
    // Still check if inside a NO_PAN inside ok parent
    if (isNoPanTarget(e.target)) return;

    panning = {
      startX: e.clientX,
      startY: e.clientY,
      originX: panX,
      originY: panY
    };
    document.body.classList.add('is-panning');
    stage.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  });

  document.addEventListener('pointermove', (e) => {
    if (!panning) return;
    panX = panning.originX + (e.clientX - panning.startX);
    panY = panning.originY + (e.clientY - panning.startY);
    document.documentElement.style.setProperty('--pan-x', panX + 'px');
    document.documentElement.style.setProperty('--pan-y', panY + 'px');
  });

  function endPan(e) {
    if (!panning) return;
    panning = null;
    document.body.classList.remove('is-panning');
    try { stage.releasePointerCapture?.(e.pointerId); } catch {}
  }
  document.addEventListener('pointerup', endPan);
  document.addEventListener('pointercancel', endPan);

  // Double-click empty space to reset pan
  stage.addEventListener('dblclick', (e) => {
    if (document.body.classList.contains('edit-layout')) return;
    if (isNoPanTarget(e.target)) return;
    panX = 0; panY = 0;
    document.documentElement.style.setProperty('--pan-x', '0px');
    document.documentElement.style.setProperty('--pan-y', '0px');
  });

  // Optional: mouse wheel + shift to pan horizontally
  stage.addEventListener('wheel', (e) => {
    if (document.body.classList.contains('edit-layout')) return;
    // Only pan with middle button or alt key? Keep standard scroll for now.
    // If user holds Space or Middle mouse, allow pan via wheel.
    if (e.altKey || e.shiftKey) {
      // Allow the pan to accumulate from wheel
      panX -= e.deltaX;
      panY -= e.deltaY;
      document.documentElement.style.setProperty('--pan-x', panX + 'px');
      document.documentElement.style.setProperty('--pan-y', panY + 'px');
      e.preventDefault();
    }
  }, { passive: false });
})();

// ── wheel setup ──────────────────────────────────────────────────────────────
const canvas = document.getElementById('hueWheel');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const CX = W / 2, CY = H / 2;
const OUTER = 104, INNER = 66, INDICATOR_R = 87;
const TWO_PI = Math.PI * 2;

let baseHue = 200;
let harmony = 'complementary';
let palette = [];
let dragging = false;
const overrides = {};
let currentSessionId = null;
let sessionName = 'Untitled';
let activePresetId = null;
const HARMONIES = ['complementary', 'triadic', 'split', 'analogous', 'tetradic', 'monochromatic'];
const ROLE_NAMES = ['accent-1', 'accent-2', 'accent-3', 'accent-4', 'surface-1', 'surface-2'];

// ── draw wheel ────────────────────────────────────────────────────────────────
function drawWheel() {
  ctx.clearRect(0, 0, W, H);

  // hue ring — fill with hue segments
  const SEGMENTS = 360;
  for (let i = 0; i < SEGMENTS; i++) {
    const s = (i - 1) * TWO_PI / SEGMENTS - Math.PI / 2;
    const e = (i + 1) * TWO_PI / SEGMENTS - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(CX + INNER * Math.cos(s), CY + INNER * Math.sin(s));
    ctx.arc(CX, CY, OUTER, s, e);
    ctx.arc(CX, CY, INNER, e, s, true);
    ctx.closePath();
    ctx.fillStyle = \`hsl(\${i},90%,55%)\`;
    ctx.fill();
  }

  // grid overlay — concentric rings
  const ringCount = 5;
  for (let r = 0; r <= ringCount; r++) {
    const rad = INNER + (OUTER - INNER) * r / ringCount;
    ctx.beginPath();
    ctx.arc(CX, CY, rad, 0, TWO_PI);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // radial spokes
  const spokeCount = 24;
  for (let i = 0; i < spokeCount; i++) {
    const angle = i * TWO_PI / spokeCount - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(CX + INNER * Math.cos(angle), CY + INNER * Math.sin(angle));
    ctx.lineTo(CX + OUTER * Math.cos(angle), CY + OUTER * Math.sin(angle));
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // outer glow ring
  const gg = ctx.createRadialGradient(CX, CY, OUTER - 1, CX, CY, OUTER + 4);
  gg.addColorStop(0, \`hsla(\${baseHue},100%,65%,0.6)\`);
  gg.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.arc(CX, CY, OUTER + 2, 0, TWO_PI);
  ctx.strokeStyle = gg;
  ctx.lineWidth = 5;
  ctx.stroke();

  // inner edge glow
  const ig = ctx.createRadialGradient(CX, CY, INNER - 3, CX, CY, INNER + 1);
  ig.addColorStop(0, 'transparent');
  ig.addColorStop(1, \`hsla(\${baseHue},100%,70%,0.35)\`);
  ctx.beginPath();
  ctx.arc(CX, CY, INNER, 0, TWO_PI);
  ctx.strokeStyle = ig;
  ctx.lineWidth = 3;
  ctx.stroke();

  // indicator dot
  const angle = baseHue * Math.PI / 180 - Math.PI / 2;
  const ix = CX + INDICATOR_R * Math.cos(angle);
  const iy = CY + INDICATOR_R * Math.sin(angle);

  // outer ring
  ctx.beginPath();
  ctx.arc(ix, iy, 8, 0, TWO_PI);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // inner fill
  ctx.beginPath();
  ctx.arc(ix, iy, 5, 0, TWO_PI);
  ctx.fillStyle = \`hsl(\${baseHue},90%,65%)\`;
  ctx.fill();

  // glow halo on indicator
  const indGlow = ctx.createRadialGradient(ix, iy, 0, ix, iy, 14);
  indGlow.addColorStop(0, \`hsla(\${baseHue},100%,70%,0.6)\`);
  indGlow.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.arc(ix, iy, 14, 0, TWO_PI);
  ctx.fillStyle = indGlow;
  ctx.fill();
}

// ── harmony generation ────────────────────────────────────────────────────────
function hsl2hex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return '#' + [f(0), f(8), f(4)].map(v => v.toString(16).padStart(2,'0')).join('');
}

function generateHarmony() {
  const h = baseHue;
  const map = {
    complementary: [
      {h,s:88,l:55},{h:(h+180)%360,s:82,l:52},
      {h,s:60,l:38},{h:(h+180)%360,s:55,l:72},
      {h,s:30,l:82},{h:(h+180)%360,s:30,l:28}
    ],
    triadic: [
      {h,s:85,l:55},{h:(h+120)%360,s:80,l:52},{h:(h+240)%360,s:85,l:56},
      {h,s:40,l:38},{h:(h+120)%360,s:38,l:74},{h:(h+240)%360,s:42,l:82}
    ],
    split: [
      {h,s:85,l:54},{h:(h+150)%360,s:72,l:44},{h:(h+210)%360,s:76,l:56},
      {h,s:40,l:82},{h:(h+150)%360,s:55,l:30},{h:(h+210)%360,s:35,l:76}
    ],
    analogous: [
      {h,s:85,l:55},{h:(h+30)%360,s:78,l:52},{h:(h+330)%360,s:80,l:50},
      {h:(h+60)%360,s:60,l:42},{h,s:40,l:78},{h:(h+300)%360,s:45,l:32}
    ],
    tetradic: [
      {h,s:85,l:55},{h:(h+90)%360,s:80,l:52},{h:(h+180)%360,s:85,l:50},{h:(h+270)%360,s:78,l:54},
      {h,s:40,l:82},{h:(h+180)%360,s:38,l:28}
    ],
    monochromatic: [
      {h,s:85,l:60},{h,s:75,l:45},{h,s:60,l:32},
      {h,s:45,l:72},{h,s:30,l:82},{h,s:90,l:18}
    ]
  };
  return (map[harmony] || map.complementary).map(({h,s,l}) => hsl2hex(h,s,l));
}

// ── update all UI for new palette/hue ────────────────────────────────────────
// Debounced live push of the current palette's derived role colors to the
// workbench. Called on every palette finalize (drag end, click, harmony,
// random) so the theme recolors instantly without an explicit Save (Item 1, 1A).
let _paletteLiveTimer = null;
function schedulePaletteLiveUpdate() {
  clearTimeout(_paletteLiveTimer);
  _paletteLiveTimer = setTimeout(() => {
    const roleVars = ['--ftr10-accent-1','--ftr10-accent-2','--ftr10-accent-3','--ftr10-accent-4','--ftr10-surface-1','--ftr10-surface-2'];
    const next = { ...varsState.values };
    roleVars.forEach((v, i) => {
      const col = palette[i];
      if (col && /^#[0-9a-fA-F]{6,8}$/.test(col)) {
        // Mirror deriveCodexPreset tier-1 alpha conventions.
        next[v] = i < 4 ? (i === 0 ? col + 'd4' : col) : (i === 4 ? col + '30' : col + '18');
      }
    });
    varsState.values = next;
    vscode.postMessage({ command: 'liveUpdate', values: varsState.values });
  }, 300);
}

function updateUI(live = false) {
  palette = generateHarmony().map((col, i) => overrides[i] !== undefined ? overrides[i] : col);
  drawWheel();

  // center hue readout
  const hueNumEl = document.getElementById('wheelHueNum');
  if (hueNumEl) {
    const rh = Math.round(baseHue);
    hueNumEl.textContent = String(rh);
    hueNumEl.style.color = \`hsl(\${rh},90%,75%)\`;
    hueNumEl.style.textShadow = \`0 0 10px hsl(\${rh},100%,65%), 0 0 22px hsl(\${rh},100%,55%)\`;
  }

  // update dynamic accent color from primary palette color
  const [r0, g0, b0] = [parseInt(palette[0].slice(1,3),16), parseInt(palette[0].slice(3,5),16), parseInt(palette[0].slice(5,7),16)];
  document.documentElement.style.setProperty('--ui-accent', palette[0]);
  document.documentElement.style.setProperty('--ui-accent-rgb', \`\${r0},\${g0},\${b0}\`);

  // side panels
  for (let i = 0; i < 6; i++) {
    const col = palette[i] || '#111';
    const lp = document.getElementById(\`lp\${i}\`);
    const rp = document.getElementById(\`rp\${i}\`);
    if (lp) { lp.style.background = col; lp.style.setProperty('--glow', col + '88'); }
    if (rp) { rp.style.background = col; rp.style.setProperty('--glow', col + '88'); }
  }

  // ambient background
  updateAmbient(live);

  // right-side labeled legend (desktop) + under-buttons legend (mobile)
  updateLegend('colorLegendDesktop');
  updateLegend('colorLegendMobile');

  // wheel glow color — use rgba, not hex+alpha (avoids canvas filter bug)
  canvas.style.filter = \`drop-shadow(0 0 10px rgba(\${r0},\${g0},\${b0},0.75)) drop-shadow(0 0 30px rgba(\${r0},\${g0},\${b0},0.45))\`;

  // update wheel glow div color dynamically
  const wg = document.querySelector('.wheel-glow');
  if (wg) wg.style.background = \`radial-gradient(circle, rgba(\${r0},\${g0},\${b0},0.35) 0%, rgba(\${r0},\${g0},\${b0},0.14) 45%, transparent 70%)\`;

  // HUD
  document.getElementById('hudHue').textContent = \`\${String(Math.round(baseHue)).padStart(3,'0')}°\`;
  document.getElementById('hudHarmony').textContent = harmony.charAt(0).toUpperCase() + harmony.slice(1);
  // keep picker bridge in sync
  if (window._codexPalette) window._codexPalette = palette;
  // Update sidebar card swatches to reflect current palette on every finalize
  if (!live) {
    vscode.postMessage({ command: 'CodexUpdate', colors: palette });
    // Recolor the workbench live from the new palette (instant, pre-save).
    schedulePaletteLiveUpdate();
  }
}

function hex2rgba(hex, a) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return \`rgba(\${r},\${g},\${b},\${a})\`;
}

function updateAmbient(live) {
  const bg = document.getElementById('ambientBg');
  bg.style.background = 'transparent';
}

function copyHex(hex) {
  if (navigator.clipboard) navigator.clipboard.writeText(hex).catch(()=>{});
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16)
  };
}

function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === rn) h = 60 * (((gn - bn) / d) % 6);
    else if (max === gn) h = 60 * (((bn - rn) / d) + 2);
    else h = 60 * (((rn - gn) / d) + 4);
  }

  if (h < 0) h += 360;
  return { h, s: s * 100, l: l * 100 };
}

function getColorNameFromHex(hex) {
  const table = {
    "#f0f8ff": "Alice Blue", "#faebd7": "Antique White", "#00ffff": "Aqua", "#7fffd4": "Aquamarine", "#f0ffff": "Azure", 
    "#f5f5dc": "Beige", "#ffe4c4": "Bisque", "#000000": "Black", "#ffebcd": "Blanched Almond", "#0000ff": "Blue", 
    "#8a2be2": "Blue Violet", "#a52a2a": "Brown", "#deb887": "Burlywood", "#5f9ea0": "Cadet Blue", "#7fff00": "Chartreuse", 
    "#d2691e": "Chocolate", "#ff7f50": "Coral", "#6495ed": "Cornflower Blue", "#fff8dc": "Cornsilk", "#dc143c": "Crimson", 
    "#00008b": "Dark Blue", "#008b8b": "Dark Cyan", "#b8860b": "Dark Goldenrod", "#a9a9a9": "Dark Gray", "#006400": "Dark Green", 
    "#bdb76b": "Dark Khaki", "#8b008b": "Dark Magenta", "#556b2f": "Dark Olive Green", "#ff8c00": "Dark Orange", "#9932cc": "Dark Orchid", 
    "#8b0000": "Dark Red", "#e9967a": "Dark Salmon", "#8fbc8f": "Dark Sea Green", "#483d8b": "Dark Slate Blue", "#2f4f4f": "Dark Slate Gray", 
    "#00ced1": "Dark Turquoise", "#9400d3": "Dark Violet", "#ff1493": "Deep Pink", "#00bfff": "Deep Sky Blue", "#696969": "Dim Gray", 
    "#1e90ff": "Dodger Blue", "#b22222": "Firebrick", "#fffaf0": "Floral White", "#228b22": "Forest Green", "#dcdcdc": "Gainsboro", 
    "#f8f8ff": "Ghost White", "#ffd700": "Gold", "#daa520": "Goldenrod", "#808080": "Gray", "#008000": "Green", 
    "#adff2f": "Green Yellow", "#f0fff0": "Honeydew", "#ff69b4": "Hot Pink", "#cd5c5c": "Indian Red", "#4b0082": "Indigo", 
    "#fffff0": "Ivory", "#f0e68c": "Khaki", "#e6e6fa": "Lavender", "#fff0f5": "Lavender Blush", "#7cfc00": "Lawn Green", 
    "#fffacd": "Lemon Chiffon", "#add8e6": "Light Blue", "#f08080": "Light Coral", "#e0ffff": "Light Cyan", "#fafad2": "Light Goldenrod Yellow", 
    "#d3d3d3": "Light Gray", "#90ee90": "Light Green", "#ffb6c1": "Light Pink", "#ffa07a": "Light Salmon", "#20b2aa": "Light Sea Green", 
    "#87cefa": "Light Sky Blue", "#778899": "Light Slate Gray", "#b0c4de": "Light Steel Blue", "#ffffe0": "Light Yellow", "#00ff00": "Lime", 
    "#32cd32": "Lime Green", "#faf0e6": "Linen", "#ff00ff": "Magenta", "#800000": "Maroon", "#66cdaa": "Medium Aquamarine", 
    "#0000cd": "Medium Blue", "#ba55d3": "Medium Orchid", "#9370db": "Medium Purple", "#3cb371": "Medium Sea Green", "#7b68ee": "Medium Slate Blue", 
    "#00fa9a": "Medium Spring Green", "#48d1cc": "Medium Turquoise", "#c71585": "Medium Violet Red", "#191970": "Midnight Blue", "#f5fffa": "Mint Cream", 
    "#ffe4e1": "Misty Rose", "#ffe4b5": "Moccasin", "#ffdead": "Navajo White", "#000080": "Navy", "#fdf5e6": "Old Lace", 
    "#808000": "Olive", "#6b8e23": "Olive Drab", "#ffa500": "Orange", "#ff4500": "Orange Red", "#da70d6": "Orchid", 
    "#eee8aa": "Pale Goldenrod", "#98fb98": "Pale Green", "#afeeee": "Pale Turquoise", "#db7093": "Pale Violet Red", "#ffefd5": "Papaya Whip", 
    "#ffdab9": "Peach Puff", "#cd853f": "Peru", "#ffc0cb": "Pink", "#dda0dd": "Plum", "#b0e0e6": "Powder Blue", 
    "#800080": "Purple", "#663399": "Rebecca Purple", "#ff0000": "Red", "#bc8f8f": "Rosy Brown", "#4169e1": "Royal Blue", 
    "#8b4513": "Saddle Brown", "#fa8072": "Salmon", "#f4a460": "Sandy Brown", "#2e8b57": "Sea Green", "#fff5ee": "Seashell", 
    "#a0522d": "Sienna", "#c0c0c0": "Silver", "#87ceeb": "Sky Blue", "#6a5acd": "Slate Blue", "#708090": "Slate Gray", 
    "#fffafa": "Snow", "#00ff7f": "Spring Green", "#4682b4": "Steel Blue", "#d2b48c": "Tan", "#008080": "Teal", 
    "#d8bfd8": "Thistle", "#ff6347": "Tomato", "#40e0d0": "Turquoise", "#ee82ee": "Violet", "#f5deb3": "Wheat", 
    "#ffffff": "White", "#f5f5f5": "White Smoke", "#ffff00": "Yellow", "#9acd32": "Yellow Green"
  };

  const { r, g, b } = hexToRgb(hex);
  let closestName = "Unknown";
  let minDist = Infinity;

  for (const k in table) {
    if (Object.prototype.hasOwnProperty.call(table, k)) {
      const rc = parseInt(k.substring(1, 3), 16);
      const gc = parseInt(k.substring(3, 5), 16);
      const bc = parseInt(k.substring(5, 7), 16);
      
      const dist = Math.pow(r - rc, 2) + Math.pow(g - gc, 2) + Math.pow(b - bc, 2);
      if (dist < minDist) {
        minDist = dist;
        closestName = table[k];
      }
    }
  }

  return closestName;
}

function updateLegend(targetId) {
  const legend = document.getElementById(targetId);
  if (!legend) return;
  legend.innerHTML = '<div class="legend-title">Palette Roles</div>' +
    palette.map((hex, i) => {
      const role = ROLE_NAMES[i] || ('Color ' + (i + 1));
      const colorName = getColorNameFromHex(hex);
      return (
        '<div class="legend-row">' +
          '<span class="legend-dot" style="background:' + hex + ';--lg:' + hex + ';"></span>' +
          '<span class="legend-meta"><span class="legend-name">' + role + '</span><span class="legend-color-name">' + colorName + '</span></span>' +
          '<span class="legend-hex" data-hex="' + hex + '">' + hex.toUpperCase() + '</span>' +
        '</div>'
      );
    }).join('');
}

function bindLegendClicks(targetId) {
  const el = document.getElementById(targetId);
  if (!el) return;
  el.addEventListener('click', (e) => {
    const item = e.target.closest('.legend-hex');
    if (!item) return;
    const hex = item.getAttribute('data-hex');
    if (hex) copyHex(hex);
  });
}

bindLegendClicks('colorLegendDesktop');
bindLegendClicks('colorLegendMobile');

// ── pointer input ─────────────────────────────────────────────────────────────
function hueFromPointer(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = W / rect.width, scaleY = H / rect.height;
  const cx = e.clientX !== undefined ? e.clientX : e.touches[0].clientX;
  const cy = e.clientY !== undefined ? e.clientY : e.touches[0].clientY;
  const x = (cx - rect.left) * scaleX - CX;
  const y = (cy - rect.top)  * scaleY - CY;
  const dist = Math.sqrt(x*x + y*y);
  if (dist < INNER * 0.6 || dist > OUTER * 1.15) return null;
  return ((Math.atan2(y, x) * 180 / Math.PI + 90) + 360) % 360;
}

canvas.addEventListener('mousedown', e => {
  const h = hueFromPointer(e);
  if (h === null) return;
  dragging = true;
  baseHue = h;
  // Clear swatch overrides when user actively drags the wheel so hue takes effect
  Object.keys(overrides).forEach(k => delete overrides[k]);
  canvas.style.cursor = 'none';
  updateUI(true);
});
canvas.addEventListener('mousemove', e => {
  if (!dragging) return;
  const h = hueFromPointer(e);
  if (h === null) return;
  baseHue = h;
  updateUI(true);
});

canvas.addEventListener('mouseup', () => {
  dragging = false;
  canvas.style.cursor = 'crosshair';
  updateUI(false); // Finalize palette/UI after drag or click
});
canvas.addEventListener('click', (e) => {
  const h = hueFromPointer(e);
  if (h !== null) {
    baseHue = h;
    // Clear overrides so hue change is visible (same as drag-start)
    if (!dragging) { Object.keys(overrides).forEach(k => delete overrides[k]); }
    updateUI(false);
  }
});
window.addEventListener('mouseup', () => {
  if (dragging) {
    dragging = false;
    canvas.style.cursor = 'crosshair';
    updateUI(false);
  }
});
window.addEventListener('touchend', () => {
  if (dragging) {
    dragging = false;
    updateUI(false);
  }
});
window.addEventListener('touchcancel', () => {
  if (dragging) {
    dragging = false;
    updateUI(false);
  }
});
canvas.addEventListener('mouseleave', () => {
  if (dragging) {
    dragging = false;
    canvas.style.cursor = 'crosshair';
    updateUI(false); // Finalize if mouse leaves while dragging
  }
});
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const h = hueFromPointer(e);
  if (h === null) return;
  dragging = true;
  baseHue = h;
  Object.keys(overrides).forEach(k => delete overrides[k]);
  updateUI(true);
}, {passive: false});
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (!dragging) return;
  const h = hueFromPointer(e);
  if (h !== null) { baseHue = h; updateUI(true); }
}, {passive: false});
canvas.addEventListener('touchend', () => {
  dragging = false;
  updateUI(false); // Finalize palette/UI after touch interaction
});

// ── harmony buttons ───────────────────────────────────────────────────────────
document.getElementById('harmonyRow').addEventListener('click', e => {
  const btn = e.target.closest('.hbtn');
  if (!btn) return;
  harmony = btn.dataset.harmony;
  document.querySelectorAll('.hbtn').forEach(b => b.classList.toggle('active', b === btn));
  updateUI(false);
});

// ── button ripple helper ──────────────────────────────────────────────────────
function triggerBtnAnim(btn, e) {
  btn.style.animation = 'none';
  btn.offsetHeight; // reflow
  btn.style.animation = 'btnPop 0.35s ease';
  const rect = btn.getBoundingClientRect();
  const rip = document.createElement('span');
  rip.className = 'btn-ripple';
  rip.style.left = (e.clientX - rect.left) + 'px';
  rip.style.top  = (e.clientY - rect.top)  + 'px';
  btn.appendChild(rip);
  rip.addEventListener('animationend', () => rip.remove());
}

// ── random ────────────────────────────────────────────────────────────────────
document.getElementById('randomBtn').addEventListener('click', (e) => {
  triggerBtnAnim(document.getElementById('randomBtn'), e);
  baseHue = Math.random() * 360;
  harmony = HARMONIES[Math.floor(Math.random() * HARMONIES.length)];
  // Clear swatch overrides so all colors derive from the new hue
  Object.keys(overrides).forEach(k => delete overrides[k]);
  document.querySelectorAll('.hbtn').forEach((b) => {
    b.classList.toggle('active', b.dataset.harmony === harmony);
  });
  updateUI(false);
});

// ── apply ─────────────────────────────────────────────────────────────────────
function doApply(sessionId) {
  const name = (document.getElementById('sessionNameInput')?.value || '').trim() || 'Untitled';
  sessionName = name;
  vscode.postMessage({ command: 'applySession', sessionId, name, baseHue, harmony, swatchOverrides: JSON.parse(JSON.stringify(overrides)), colors: palette, bgEffect: (varsState.values['--ftr10-bg-effect'] || 'nebula'), thpaceEnabled: (varsState.values['--ftr10-thpace-enabled'] || 'true'), vars: JSON.parse(JSON.stringify(varsState.values)) });
  vscode.postMessage({ command: 'CodexUpdate', colors: palette });
  const btn = document.getElementById('applyBtn');
  btn.textContent = '\u2713 Applied';
  btn.style.boxShadow = \`0 0 28px rgba(\${document.documentElement.style.getPropertyValue('--ui-accent-rgb')},0.7)\`;
  setTimeout(() => {
    btn.textContent = '\u2B21 Apply';
    btn.style.boxShadow = '';
  }, 1200);
}

document.getElementById('applyBtn').addEventListener('click', (e) => {
  triggerBtnAnim(document.getElementById('applyBtn'), e);
  doApply(currentSessionId);
});

// ── save ──────────────────────────────────────────────────────────────────────
function doSave(sessionId) {
  const name = (document.getElementById('sessionNameInput')?.value || '').trim() || 'Untitled';
  sessionName = name;
  vscode.postMessage({ command: 'saveSession', sessionId, name, baseHue, harmony, swatchOverrides: JSON.parse(JSON.stringify(overrides)), colors: palette, bgEffect: (varsState.values['--ftr10-bg-effect'] || 'nebula'), thpaceEnabled: (varsState.values['--ftr10-thpace-enabled'] || 'true'), vars: JSON.parse(JSON.stringify(varsState.values)) });
  const btn = document.getElementById('saveBtn');
  btn.textContent = '\u2713 Saved';
  setTimeout(() => { btn.textContent = '\u229B Save'; }, 1200);
}
document.getElementById('saveBtn').addEventListener('click', (e) => {
  triggerBtnAnim(document.getElementById('saveBtn'), e);
  if (currentSessionId) {
    // Editing an existing card — prompt overwrite vs new
    document.getElementById('saveConfirmModal').classList.add('open');
  } else {
    doSave(null);
  }
});

// ── vars panel state ──────────────────────────────────────────────────────────
const varsState = { simpleGroups: [], values: {}, sections: [], advanced: false };

const FONT_OPTIONS_A = ["inherit",'Cartograph','DM Mono','Exo 2','Fira Code','JetBrains Mono','Monaspace Krypton','Monaspace Radon','Orbitron','Oxanium','Rajdhani','Recursive','Silkscreen','Space Grotesk','Victor Mono','Victor Mono NF'];
const SELECT_OPTIONS_A = {
      '--ftr10-bg-effect': ['none', 'kaleidoscope', 'aurora', 'nebula', 'crt', 'circuit', 'meshflow', 'playstation'],
  '--ftr10-code-font': FONT_OPTIONS_A, '--ftr10-font-activitybar': FONT_OPTIONS_A,
  '--ftr10-font-sidebar': FONT_OPTIONS_A, '--ftr10-font-panel-bottom': FONT_OPTIONS_A,
  '--ftr10-font-panel-top': FONT_OPTIONS_A, '--ftr10-font-auxiliarybar': FONT_OPTIONS_A
};

// Apply the theme's font (and a few layout) vars to THIS webview's own document so
// the Architect/Editor GUI itself follows the configured fonts. The workbench shim
// writes these to the workbench :root, but the webview is a separate document and
// only forwarded them via BroadcastChannel — never applied locally. Without this the
// GUI stays in its hardcoded font regardless of the user's font choice.
const __PANEL_FONT_KEYS = [
  '--ftr10-body-font', '--ftr10-heading-font', '--ftr10-code-font',
  '--ftr10-font-sidebar', '--ftr10-font-activitybar', '--ftr10-font-panel-bottom',
  '--ftr10-font-panel-top', '--ftr10-font-auxiliarybar'
];
function applyPanelFontVars(values) {
  if (!values) return;
  const root = document.documentElement;
  for (const k of __PANEL_FONT_KEYS) {
    const v = values[k];
    if (v) root.style.setProperty(k, v);
  }
}

function escapeHtmlA(s) { return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
function isHexA(v) { return /^#[0-9a-f]{6,8}$/i.test((v||'').trim()); }
function toPickerHexA(v) { const h=(v||'').trim(); return h.length>=7?h.slice(0,7):'#000000'; }
function hexAlphaA(v) { const h=(v||'').trim(); return h.length===9?Math.round(parseInt(h.slice(7,9),16)/255*100):100; }

function buildVarsFieldRow(key, value) {
  const opts = SELECT_OPTIONS_A[key];
  let html = '<div class="v-field-row">';
  html += '<div class="v-field-label" title="' + escapeHtmlA(key) + '">' + escapeHtmlA(key.replace('--ftr10-','')) + '</div>';
  html += '<div class="v-field-input-wrap">';
  if (opts) {
    html += '<div class="v-select-wrap"><select data-vkey="' + escapeHtmlA(key) + '">';
    opts.forEach(o => { html += '<option value="' + escapeHtmlA(o) + '"' + (o === value ? ' selected' : '') + '>' + escapeHtmlA(o) + '</option>'; });
    html += '</select></div>';
  } else {
    const sp = isHexA(value);
    const alpha = sp ? hexAlphaA(value) : 100;
    if (sp) {
      html += '<input type="color" data-vkey="' + escapeHtmlA(key) + '" data-vrole="picker" value="' + escapeHtmlA(toPickerHexA(value)) + '"/>';
      html += '<div class="v-alpha-wrap" style="--sw:' + escapeHtmlA(toPickerHexA(value)) + '">';
      html += '<input type="range" min="0" max="100" value="' + alpha + '" data-vkey="' + escapeHtmlA(key) + '" data-vrole="alpha"/>';
      html += '<span class="v-alpha-label" data-vkey="' + escapeHtmlA(key) + '" data-vrole="alpha-label">' + alpha + '%</span>';
      html += '</div>';
    }
    html += '<input type="text" data-vkey="' + escapeHtmlA(key) + '" data-vrole="text" value="' + escapeHtmlA(value||'') + '" placeholder="CSS value"/>';
  }
  html += '</div></div>';
  return html;
}

function renderVarsPanel() {
  const content = document.getElementById('varTables');
  if (!content) return;
  let html = '';
  const groups = varsState.advanced ? varsState.sections : varsState.simpleGroups;
  groups.forEach(group => {
    const label = group.label || group.name || '';
    const keys = (group.keys || []);
    if (keys.length === 0) return;
    html += '<details class="v-group" open>';
    html += '<summary class="v-group-header">' + escapeHtmlA(label) + '<span class="v-count">' + keys.length + '</span></summary>';
    html += '<div class="v-group-fields">';
    keys.forEach(k => { html += buildVarsFieldRow(k, varsState.values[k] !== undefined ? varsState.values[k] : ''); });
    html += '</div></details>';
  });
  if (!html) html = '<div class="v-empty">No variables loaded yet. Variables appear once a session is applied.</div>';
  content.innerHTML = html;
  wireVarsInputs(content);
  // Sync bg toggles to current state
  syncBgToggleState(varsState.values);
}

let _varsLiveTimer = null;
function scheduleVarsLiveUpdate() {
  clearTimeout(_varsLiveTimer);
  __wvTrace('liveUpdate:scheduled', { keys: Object.keys(varsState.values).length });
  _varsLiveTimer = setTimeout(() => {
    __wvTrace('liveUpdate:sent', { effect: varsState.values['--ftr10-bg-effect'] });
    vscode.postMessage({ command: 'liveUpdate', values: varsState.values });
  }, 400);
}

function wireVarsInputs(content) {
  content.querySelectorAll('input[data-vrole="picker"]').forEach(picker => {
    picker.addEventListener('input', () => {
      const key = picker.dataset.vkey;
      const alphaEl = content.querySelector('input[data-vrole="alpha"][data-vkey="' + CSS.escape(key) + '"]');
      const textEl = content.querySelector('input[data-vrole="text"][data-vkey="' + CSS.escape(key) + '"]');
      const alphaWrap = content.querySelector('.v-alpha-wrap:has(input[data-vkey="' + CSS.escape(key) + '"])');
      const alpha = alphaEl ? parseInt(alphaEl.value) : 100;
      const alphaHex = Math.round(alpha/100*255).toString(16).padStart(2,'0');
      const newVal = alpha === 100 ? picker.value : picker.value + alphaHex;
      varsState.values[key] = newVal;
      if (textEl && textEl !== document.activeElement) textEl.value = newVal;
      if (alphaWrap) alphaWrap.style.setProperty('--sw', picker.value);
      scheduleVarsLiveUpdate();
    });
  });
  content.querySelectorAll('input[data-vrole="alpha"]').forEach(slider => {
    slider.addEventListener('input', () => {
      const key = slider.dataset.vkey;
      const pickerEl = content.querySelector('input[data-vrole="picker"][data-vkey="' + CSS.escape(key) + '"]');
      const labelEl = content.querySelector('[data-vrole="alpha-label"][data-vkey="' + CSS.escape(key) + '"]');
      const textEl = content.querySelector('input[data-vrole="text"][data-vkey="' + CSS.escape(key) + '"]');
      if (labelEl) labelEl.textContent = slider.value + '%';
      if (pickerEl) {
        const alphaHex = Math.round(parseInt(slider.value)/100*255).toString(16).padStart(2,'0');
        const newVal = parseInt(slider.value) === 100 ? pickerEl.value : pickerEl.value + alphaHex;
        varsState.values[key] = newVal;
        if (textEl && textEl !== document.activeElement) textEl.value = newVal;
        scheduleVarsLiveUpdate();
      }
    });
  });
  content.querySelectorAll('input[data-vrole="text"]').forEach(txt => {
    txt.addEventListener('change', () => {
      varsState.values[txt.dataset.vkey] = txt.value;
      scheduleVarsLiveUpdate();
    });
  });
  content.querySelectorAll('select[data-vkey]').forEach(sel => {
    sel.addEventListener('change', () => {
      varsState.values[sel.dataset.vkey] = sel.value;
      scheduleVarsLiveUpdate();
    });
  });
}

// ── save confirm modal wiring ───────────────────────────────────────────────────
document.getElementById('saveConfirmOverwriteBtn').addEventListener('click', () => {
  document.getElementById('saveConfirmModal').classList.remove('open');
  doSave(currentSessionId);
});
document.getElementById('saveConfirmNewBtn').addEventListener('click', () => {
  document.getElementById('saveConfirmModal').classList.remove('open');
  doSave(null);
});
document.getElementById('saveConfirmCancelBtn').addEventListener('click', () => {
  document.getElementById('saveConfirmModal').classList.remove('open');
});
document.getElementById('saveConfirmModal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('saveConfirmModal')) {
    document.getElementById('saveConfirmModal').classList.remove('open');
  }
});

// ── session messages from extension ───────────────────────────────────────────
window.addEventListener('message', (e) => {
  const msg = e.data;
  function applySessionToUI(s, derivedValues) {
    // Cancel any pending deferred update from the previous session before switching
    clearTimeout(_varsLiveTimer);
    _varsLiveTimer = null;
    currentSessionId = s.id;
    sessionName = s.name;
    baseHue = typeof s.baseHue === 'number' ? s.baseHue : baseHue;
    harmony = s.harmony || harmony;
    // Restore swatch overrides
    Object.keys(overrides).forEach(k => delete overrides[k]);
    if (s.swatchOverrides) { Object.assign(overrides, s.swatchOverrides); }
    // Sync harmony buttons
    document.querySelectorAll('.hbtn').forEach(b => {
      b.classList.toggle('active', b.dataset.harmony === harmony);
    });
    // Update name input
    const ni = document.getElementById('sessionNameInput');
    if (ni) ni.value = sessionName;
    // Restore toggle values from session (always, not just when derivedValues present)
    if (s.bgEffect !== undefined) { varsState.values['--ftr10-bg-effect'] = s.bgEffect; }
    if (s.thpaceEnabled !== undefined) { varsState.values['--ftr10-thpace-enabled'] = s.thpaceEnabled; }
    // Restore extra Vars-panel edits stored on the session. These are a diff vs.
    // the palette-derived set; apply them on top so reopening a card reproduces
    // the user's edits even when the card isn't the active preset.
    if (s.varOverrides) { Object.assign(varsState.values, s.varOverrides); }
    // Update vars panel if derived values provided (active preset path)
    if (derivedValues) {
      // Live (derived) values MUST win over stale session varOverrides, otherwise
      // a re-applied override silently reverts the user's current UI edits.
      varsState.values = { ...(s.varOverrides || {}), ...derivedValues, '--ftr10-bg-effect': s.bgEffect || varsState.values['--ftr10-bg-effect'] || 'nebula', '--ftr10-thpace-enabled': s.thpaceEnabled || varsState.values['--ftr10-thpace-enabled'] || 'true' };
      renderVarsPanel();
    } else if (s.varOverrides) {
      // Card reopened but not the active preset — still render the stored edits
      renderVarsPanel();
    } else {
      renderVarsPanel();
    }
    syncBgToggleState(varsState.values);
    renderQuickPanels();
    // Push toggle/var state to extension so effects activate immediately
    vscode.postMessage({ command: 'liveUpdate', values: varsState.values });
    updateUI(false);
  }

  if (msg.command === 'loadSession' && msg.session) {
    applySessionToUI(msg.session, msg.derivedValues);
  }
  if (msg.command === 'sessionSaved') {
    currentSessionId = msg.sessionId;
    if (msg.name) {
      const ni = document.getElementById('sessionNameInput');
      if (ni) ni.value = msg.name;
    }
    // Refresh the Vars panel with the just-saved card's values so the user sees
    // their saved changes live (no need to leave and re-enter the session).
    if (msg.session) {
      applySessionToUI(msg.session, undefined);
    } else {
      renderVarsPanel();
    }
  }
  if (msg.command === 'activePresetChanged') {
    activePresetId = msg.activePreset || null;
  }
  if (msg.command === 'varsUpdated') {
    // Sync Architect palette swatches with direct var edits from vars panel
    const rv = msg.values || {};
    const roleVars = ['--ftr10-accent-1','--ftr10-accent-2','--ftr10-accent-3','--ftr10-accent-4','--ftr10-surface-1','--ftr10-surface-2'];
    roleVars.forEach((v, i) => {
      const val = rv[v];
      if (val && /^#[0-9a-fA-F]{6,8}$/.test(val.trim())) {
        overrides[i] = val.trim().slice(0, 7); // store as 6-char hex
      }
    });
    varsState.values = rv;
    syncBgToggleState(rv);
    applyPanelFontVars(rv);
    renderVarsPanel();
    renderQuickPanels();
    updateUI(false);
  }
  if (msg.command === 'architectConfig') {
    if (msg.config) {
      varsState.sections = msg.config.sections || [];
      if (msg.config.layoutOverrides && window.__applyLayoutOverrides) {
        try { window.__applyLayoutOverrides(msg.config.layoutOverrides); } catch(_e) {}
      }
    }
    // Only overwrite values on initial load (no values yet); skip if user has live in-flight edits
    if (!Object.keys(varsState.values).length) {
      varsState.values = msg.values || (msg.config && msg.config.values) || varsState.values;
    }
    if (msg.simpleGroups) varsState.simpleGroups = msg.simpleGroups;
    if (msg.bgImages) __bgImages = msg.bgImages;
    if (msg.activePreset !== undefined) activePresetId = msg.activePreset || null;
    syncBgToggleState(varsState.values);
    applyPanelFontVars(varsState.values);
    renderVarsPanel();
    renderQuickPanels();
    // Gallery is best-effort — never let it abort the rest of panel init.
    try { syncBgImageGallery(); } catch (e) {
      console.error('syncBgImageGallery failed:', e);
      showPanelError('BG gallery: ' + (e && e.message ? e.message : e));
    }
  }
});

// ── request config on load ───────────────────────────────────────────────────
vscode.postMessage({ command: 'getConfig' });

// ── quick panels (Fonts + Opacity) ───────────────────────────────────────────
const QP_FONT_ROWS = [
  { key: '--ftr10-font-activitybar',  label: 'Activity' },
  { key: '--ftr10-font-sidebar',      label: 'Sidebar'  },
  { key: '--ftr10-font-panel-bottom', label: 'Panel Bot'},
  { key: '--ftr10-font-panel-top',    label: 'Panel Top'},
  { key: '--ftr10-font-auxiliarybar', label: 'Aux Bar'  },
];
const QP_OPACITY_ROWS = [
  { key: '--ftr10-opacity-activitybar',  label: 'Activity' },
  { key: '--ftr10-opacity-sidebar',      label: 'Sidebar'  },
  { key: '--ftr10-opacity-panel-bottom', label: 'Panel Bot'},
  { key: '--ftr10-opacity-panel-top',    label: 'Panel Top'},
  { key: '--ftr10-opacity-auxiliarybar', label: 'Aux Bar'  },
];
const QP_FONT_NAMES = ['inherit','Cartograph','DM Mono','Exo 2','Fira Code','JetBrains Mono','Monaspace Krypton','Monaspace Radon','Orbitron','Oxanium','Rajdhani','Recursive','Silkscreen','Space Grotesk','Victor Mono','Victor Mono NF'];

function _qpFontValToName(val) {
  if (!val || val === 'inherit') return 'inherit';
  for (const n of QP_FONT_NAMES) {
    if (val.toLowerCase().includes(n.toLowerCase())) return n;
  }
  return val.split(',')[0].replace(/['"]/g,'').trim();
}

function renderQuickPanels() {
  // Determine if the floating side panels are visible or if we're in stacked mode
  const rlw = document.querySelector('.right-legend-wrap');
  const below = !rlw || getComputedStyle(rlw).display === 'none';
  const tb = document.querySelector('.tables-below');
  if (tb) tb.style.display = below ? 'flex' : 'none';

  let fp = below ? document.getElementById('fontsPanel_below') : document.querySelector('.right-legend-wrap #fontsPanel');
  let op = below ? document.getElementById('opacityPanel_below') : document.querySelector('.right-legend-wrap #opacityPanel');
  const vals = varsState.values;

  if (fp) {
    fp.innerHTML = '<div class="hud-title">Fonts</div>' +
      QP_FONT_ROWS.map(r => {
        const cur = _qpFontValToName(vals[r.key] || '');
        const opts = QP_FONT_NAMES.map(n =>
          '<option value="' + n + '"' + (cur === n ? ' selected' : '') + '>' + n + '</option>'
        ).join('');
        return '<div class="qp-row"><span class="qp-label">' + r.label + '</span><select class="qp-select" data-qpkey="' + r.key + '">' + opts + '</select></div>';
      }).join('');
    fp.querySelectorAll('.qp-select').forEach(sel => {
      sel.addEventListener('change', () => {
        const n = sel.value;
        varsState.values[sel.dataset.qpkey] = n === 'inherit' ? 'inherit' : "'" + n + "', monospace";
        scheduleVarsLiveUpdate();
      });
    });
  }

  if (op) {
    op.innerHTML = '<div class="hud-title">Opacity</div>' +
      QP_OPACITY_ROWS.map(r => {
        const cur = parseFloat(vals[r.key] || '0.4');
        const pct = Math.round(cur * 100);
        const elId = 'qpv_' + r.key.replace(/--ftr10-/,'').replace(/-/g,'_') + (below ? '_b' : '');
        return '<div class="qp-row"><span class="qp-label">' + r.label + '</span>' +
          '<div class="qp-slider-wrap">' +
          '<input type="range" class="qp-slider" min="0" max="1" step="0.05" value="' + cur + '" data-qpkey="' + r.key + '" data-qpvid="' + elId + '">' +
          '<span class="qp-val" id="' + elId + '">' + pct + '%</span>' +
          '</div></div>';
      }).join('');
    op.querySelectorAll('.qp-slider').forEach(sl => {
      const valEl = document.getElementById(sl.dataset.qpvid);
      sl.addEventListener('input', () => {
        if (valEl) valEl.textContent = Math.round(parseFloat(sl.value) * 100) + '%';
      });
      sl.addEventListener('change', () => {
        if (valEl) valEl.textContent = Math.round(parseFloat(sl.value) * 100) + '%';
        varsState.values[sl.dataset.qpkey] = parseFloat(sl.value).toFixed(2);
        scheduleVarsLiveUpdate();
      });
    });
  }
}

// ── bg image gallery ─────────────────────────────────────────────────────
// Renders a picker of available background images. Shown only when the
// selected effect is "image". Selection sets --ftr10-bg-image to a plain
// url("backgrounds/<file>") — the workbench origin serves backgrounds/
// via a symlink (~/.ftr10/backgrounds -> workbench/backgrounds), and the
// shim's applyVars() resolves "backgrounds/X" to the absolute workbench
// URL. We deliberately do NOT embed a base64 data: URI: that bloats
// vars.json/theme.json (polling lag) and forces the host to base64-encode
// every background on every config sync. Thumbnails use the webview-uri
// (asWebviewUri) the host sends, which reaches the same symlinked file.
let __bgImages = [];
function __bgDataUriByName(name) {
  for (const item of __bgImages) { if (item && item.name === name) return item.dataUri || ''; }
  return '';
}
function showPanelError(text) {
  try {
    let el = document.getElementById('ftr10-panel-error');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ftr10-panel-error';
      el.style.cssText = 'position:fixed;left:8px;bottom:8px;max-width:60%;z-index:9999;background:rgba(180,30,30,0.92);color:#fff;font:12px monospace;padding:8px 10px;border-radius:6px;white-space:pre-wrap;box-shadow:0 4px 20px rgba(0,0,0,0.5);';
      document.body.appendChild(el);
    }
    el.textContent = '[FTR10] ' + text;
    el.style.display = 'block';
  } catch (_) {}
}
function setBgImageFromGallery(name) {
  if (name) {
    // Store the plain symlinked path. The workbench serves backgrounds/ via a
    // symlink and the shim's applyVars() resolves it to the absolute URL. No
    // data: URI — keeps vars.json/theme.json tiny and avoids host base64.
    varsState.values['--ftr10-bg-image'] = 'url("backgrounds/' + name + '")';
    // Selecting a background implies the "image" effect so it actually shows.
    varsState.values['--ftr10-bg-effect'] = 'image';
  } else {
    varsState.values['--ftr10-bg-image'] = 'none';
  }
  syncBgToggleState(varsState.values);
  scheduleVarsLiveUpdate();
  syncBgImageGallery();
}
function __bgFilenameFromValue(v) {
  // Extract "<file>" from url("backgrounds/<file>") / url('backgrounds/<file>').
  if (!v || v === 'none') return '';
  const i = v.indexOf('backgrounds/');
  if (i === -1) return '';
  const s = i + 'backgrounds/'.length;
  let e = v.indexOf('"', s);
  if (e === -1) e = v.indexOf("'", s);
  if (e === -1) e = v.indexOf(')', s);
  if (e === -1) e = v.length;
  return v.substring(s, e).trim();
}
function syncBgImageGallery() {
  const curImg = (varsState.values['--ftr10-bg-image'] || 'none');
  // active item is matched by the backgrounds/<file> name in the stored value
  const activeFile = __bgFilenameFromValue(curImg);
  for (const sfx of ['', '_below']) {
    const host = document.getElementById('bgImgGallery' + sfx);
    if (!host) continue;
    // Show the picker whenever background images are available — it is no longer
    // gated behind the (now-removed) "image" effect option. Selecting a thumbnail
    // sets --ftr10-bg-effect to "image" so the chosen background actually renders.
    if (__bgImages.length === 0) {
      host.style.display = 'none';
      host.innerHTML = '';
      continue;
    }
    host.style.display = '';
    let html = '<div class="bg-img-thumbs">';
    for (const item of __bgImages) {
      const name = item && item.name ? item.name : '';
      const src = (item && item.uri) ? item.uri : (item && item.dataUri ? item.dataUri : '');
      const sel = name === activeFile ? ' selected' : '';
      html += "<button type='button' class='bg-img-thumb" + sel + "' data-bgimg='" + escapeHtmlA(name) + "' title='" + escapeHtmlA(name) + "'><img src='" + src + "' alt=''></button>";
    }
    html += "</div>";
    html += "<div class='qp-row'><span class='qp-label'>Image</span><button type='button' class='qp-btn' data-bgimg=''>None</button></div>";
    host.innerHTML = html;
    host.querySelectorAll('[data-bgimg]').forEach(function (btn) {
      btn.addEventListener('click', function () { setBgImageFromGallery(btn.getAttribute('data-bgimg')); });
    });
  }
}

// ── bg toggles ──────────────────────────────────────────────────────────────
let lastBgEffect = 'nebula';
function syncBgToggleState(values) {
  if (!values) return;
  const current = (values['--ftr10-bg-effect'] || 'none').trim().toLowerCase();
  if (current !== 'none') lastBgEffect = current;
  for (const sfx of ['', '_below']) {
    const thpaceEl = document.getElementById('thpaceToggle' + sfx);
    const effectEl = document.getElementById('bgEffectToggle' + sfx);
    const selectEl = document.getElementById('bgEffectSelect' + sfx);
    if (thpaceEl) thpaceEl.checked = (values['--ftr10-thpace-enabled'] || 'true').trim() !== 'false';
    if (effectEl) effectEl.checked = current !== 'none';
    if (selectEl) selectEl.value = current !== 'none' ? current : lastBgEffect || 'nebula';
  }
  try { syncBgImageGallery(); } catch (e) { console.error('syncBgImageGallery failed:', e); }
}

(function initBgToggles() {
  function wireBgToggles(sfx) {
    const thpaceEl = document.getElementById('thpaceToggle' + sfx);
    const effectEl = document.getElementById('bgEffectToggle' + sfx);
    const selectEl = document.getElementById('bgEffectSelect' + sfx);

    // Inject the image gallery container right after the effect <select> (if not present).
    // Visibility is managed by syncBgImageGallery() (shown whenever bg images exist).
    const selectWrap = selectEl ? selectEl.closest('.qp-select-wrap') : null;
    if (selectWrap && !document.getElementById('bgImgGallery' + sfx)) {
      const gal = document.createElement('div');
      gal.id = 'bgImgGallery' + sfx;
      gal.className = 'bg-img-gallery';
      const galLabel = document.createElement('div');
      galLabel.className = 'qp-label';
      galLabel.textContent = 'Background Image';
      gal.appendChild(galLabel);
      selectWrap.parentNode.insertBefore(gal, selectWrap.nextSibling);
    }
    if (thpaceEl) {
      thpaceEl.addEventListener('change', () => {
        varsState.values['--ftr10-thpace-enabled'] = thpaceEl.checked ? 'true' : 'false';
        syncBgToggleState(varsState.values);
        scheduleVarsLiveUpdate();
      });
    }

    if (selectEl) {
      selectEl.addEventListener('change', () => {
        const selected = selectEl.value.trim().toLowerCase() || 'none';
        lastBgEffect = selected !== 'none' ? selected : lastBgEffect || 'nebula';
        varsState.values['--ftr10-bg-effect'] = selected;
        // When switching TO image, default to the first available background
        // so the user sees something immediately (they can pick another in the gallery).
        if (selected === 'image' && __bgImages.length && (varsState.values['--ftr10-bg-image'] || 'none') === 'none') {
          setBgImageFromGallery(__bgImages[0]);
        }
        syncBgToggleState(varsState.values);
        scheduleVarsLiveUpdate();
      });
    }

    if (effectEl) {
      effectEl.addEventListener('change', () => {
        if (effectEl.checked) {
          const current = (varsState.values['--ftr10-bg-effect'] || 'none').trim().toLowerCase();
          varsState.values['--ftr10-bg-effect'] = current === 'none' ? (lastBgEffect || 'nebula') : current;
        } else {
          varsState.values['--ftr10-bg-effect'] = 'none';
        }
        syncBgToggleState(varsState.values);
        scheduleVarsLiveUpdate();
      });
    }
  }
  try {
    wireBgToggles('');
    wireBgToggles('_below');
  } catch (e) { console.error('initBgToggles failed:', e); try { showPanelError('initBgToggles: ' + (e && e.message ? e.message : e)); } catch(_) {} }
})();

window.addEventListener('resize', () => {
  renderQuickPanels();
  syncBgToggleState(varsState.values);
});

// ── floating sparkle particles ────────────────────────────────────────────────
(function initParticles() {
  const pc = document.getElementById('particles');
  const pctx = pc.getContext('2d');
  let pw, ph;
  function resize() {
    pw = pc.width  = window.innerWidth;
    ph = pc.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // Bright fallback colors — always visible against dark bg
  const FALLBACK_COLORS = ['#00d4ff','#7c6fff','#ff6ec7','#00ffb8','#ffb800','#ff4d6d'];

  const COUNT = 36;
  const particles = Array.from({length: COUNT}, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    size: Math.random() * 6 + 4,
    vx: (Math.random() - 0.5) * 0.35,
    vy: (Math.random() - 0.5) * 0.25 - 0.1,
    alpha: Math.random() * 0.4 + 0.45,
    da: (Math.random() - 0.5) * 0.003,
    colorIdx: Math.floor(Math.random() * 6),
    twinkle: Math.random() * TWO_PI
  }));

  function drawDiamond(cx, cy, s, col, a) {
    pctx.save();
    pctx.globalAlpha = a;
    pctx.beginPath();
    pctx.arc(cx, cy, s / 2, 0, Math.PI * 2);
    pctx.fillStyle = col;
    pctx.shadowColor = col;
    pctx.shadowBlur = s * 5;
    pctx.fill();
    pctx.restore();
  }

  function tick() {
    pctx.clearRect(0, 0, pw, ph);
    particles.forEach(p => {
      p.twinkle += 0.025;
      p.alpha += p.da;
      if (p.alpha > 0.85 || p.alpha < 0.3) p.da *= -1;
      p.x += p.vx;
      p.y += p.vy;
      if (p.y < -20) { p.y = ph + 10; p.x = Math.random() * pw; }
      if (p.x < -20) p.x = pw + 10;
      if (p.x > pw + 20) p.x = -10;

      // Use palette's 3 brightest slots (0,1,2) or bright fallbacks if palette not ready
      const palCol = palette.length >= 3 ? palette[p.colorIdx % 3] : null;
      const col = palCol || FALLBACK_COLORS[p.colorIdx % FALLBACK_COLORS.length];
      const pulse = 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(p.twinkle));
      drawDiamond(p.x, p.y, p.size, col, p.alpha * pulse);
    });
    requestAnimationFrame(tick);
  }
  // particles disabled
  // tick();
})();

// ── hydrate from data baked into HTML at panel creation time ─────────────────
// Runs synchronously before the first updateUI() so the panel shows real
// config/session data on the very first paint, without waiting for the async
// getConfig → architectConfig postMessage round-trip.  This mirrors the logic
// in the architectConfig and loadSession message handlers — any subsequent
// postMessages will merge on top of this initial state.
(function applyInitialData() {
  try {
    const init = window.__FTR10_INIT__;
    if (!init || typeof init !== 'object') { return; }

    // ── config / vars (mirrors architectConfig handler) ───────────────────
    if (init.config && init.config.sections) { varsState.sections = init.config.sections; }
    if (init.config && init.config.layoutOverrides && window.__applyLayoutOverrides) {
      try { window.__applyLayoutOverrides(init.config.layoutOverrides); } catch(_e) {}
    }
    if (init.simpleGroups && init.simpleGroups.length) { varsState.simpleGroups = init.simpleGroups; }
    if (init.bgImages) { __bgImages = init.bgImages; }
    if (init.activePreset !== undefined) { activePresetId = init.activePreset || null; }
    if (init.values && Object.keys(init.values).length) {
      varsState.values = Object.assign({}, varsState.values, init.values);
    }

    // ── session (mirrors loadSession handler) ─────────────────────────────
    if (init.session) {
      const s = init.session;
      if (s.id !== undefined) { currentSessionId = s.id; }
      if (s.name) {
        sessionName = s.name;
        const ni = document.getElementById('sessionNameInput');
        if (ni) { ni.value = s.name; }
      }
      if (typeof s.baseHue === 'number') { baseHue = s.baseHue; }
      if (s.harmony) {
        harmony = s.harmony;
        document.querySelectorAll('.hbtn').forEach(function(b) {
          b.classList.toggle('active', b.dataset.harmony === harmony);
        });
      }
      Object.keys(overrides).forEach(function(k) { delete overrides[k]; });
      if (s.swatchOverrides) { Object.assign(overrides, s.swatchOverrides); }
      if (s.bgEffect !== undefined) { varsState.values['--ftr10-bg-effect'] = s.bgEffect; }
      if (s.thpaceEnabled !== undefined) { varsState.values['--ftr10-thpace-enabled'] = s.thpaceEnabled; }
      if (s.varOverrides) { Object.assign(varsState.values, s.varOverrides); }
    }

    // derivedValues (live preset values) override varOverrides, same as loadSession
    if (init.derivedValues && Object.keys(init.derivedValues).length) {
      Object.assign(varsState.values, init.derivedValues);
    }

    syncBgToggleState(varsState.values);
    renderVarsPanel();
    renderQuickPanels();
    try { syncBgImageGallery(); } catch(e) { console.error('FTR10: init syncBgImageGallery failed', e); }
  } catch(e) {
    console.error('FTR10: init hydration failed', e);
  }
})();

// ── init ──────────────────────────────────────────────────────────────────────
updateUI(false);

// expose bridge for picker script
window._codexPalette = palette;
window._codexGenerateHarmony = generateHarmony;
window._codexSetOverride = (idx, hex) => {
  overrides[idx] = hex;
  palette = generateHarmony().map((col, i) => overrides[i] !== undefined ? overrides[i] : col);
  window._codexPalette = palette;
  updateLegend('colorLegendDesktop');
  updateLegend('colorLegendMobile');
  updateUI(false);
};
window._codexClearOverride = (idx) => {
  delete overrides[idx];
  updateUI(false);
  window._codexPalette = palette;
};
})();
</script>

<!-- Color override modal -->
<div class="override-modal-bg" id="overrideModalBg">
  <div class="override-modal">
    <div class="override-modal-title" id="overrideModalTitle">Override Primary</div>
    <div class="override-picker-row">
      <canvas class="sl-canvas" id="slCanvas" width="150" height="150"></canvas>
      <canvas class="hue-strip-canvas" id="hueStripCanvas" width="22" height="150"></canvas>
    </div>
    <div class="override-preview-row">
      <div class="override-preview-swatch" id="overridePreviewSwatch"></div>
      <span class="override-preview-hex" id="overridePreviewHex">#000000</span>
    </div>
    <div class="override-btn-row">
      <button class="override-btn" id="overrideBtnCancel">Cancel</button>
      <button class="override-btn confirm" id="overrideBtnConfirm">✓ Set</button>
    </div>
  </div>
</div>

<script>
(function() {
// ── color override picker ─────────────────────────────────────────────────────
let overrideIdx = -1;
let overrideOriginal = null;
let pickH = 0, pickS = 1, pickV = 1;
let slDragging = false, hueDragging = false;

const slCv = document.getElementById('slCanvas');
const slCtx2 = slCv.getContext('2d');
const hueCv = document.getElementById('hueStripCanvas');
const hueCtx2 = hueCv.getContext('2d');
const SW = slCv.width, SH = slCv.height;
const HW = hueCv.width, HH = hueCv.height;

function hsv2hex(h, s, v) {
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60)       { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else              { r = c; b = x; }
  return '#' + [r + m, g + m, b + m].map(n => Math.round(n * 255).toString(16).padStart(2, '0')).join('');
}

function hex2hsv(hex) {
  const r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r)      h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else                h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

function drawSLCanvas() {
  slCtx2.fillStyle = \`hsl(\${pickH},100%,50%)\`;
  slCtx2.fillRect(0, 0, SW, SH);
  const wg = slCtx2.createLinearGradient(0, 0, SW, 0);
  wg.addColorStop(0, 'rgba(255,255,255,1)');
  wg.addColorStop(1, 'rgba(255,255,255,0)');
  slCtx2.fillStyle = wg;
  slCtx2.fillRect(0, 0, SW, SH);
  const bg = slCtx2.createLinearGradient(0, 0, 0, SH);
  bg.addColorStop(0, 'rgba(0,0,0,0)');
  bg.addColorStop(1, 'rgba(0,0,0,1)');
  slCtx2.fillStyle = bg;
  slCtx2.fillRect(0, 0, SW, SH);
  const cx = pickS * SW, cy = (1 - pickV) * SH;
  slCtx2.beginPath();
  slCtx2.arc(cx, cy, 6, 0, Math.PI * 2);
  slCtx2.strokeStyle = 'rgba(255,255,255,0.92)';
  slCtx2.lineWidth = 2;
  slCtx2.stroke();
  slCtx2.beginPath();
  slCtx2.arc(cx, cy, 4, 0, Math.PI * 2);
  slCtx2.strokeStyle = 'rgba(0,0,0,0.5)';
  slCtx2.lineWidth = 1;
  slCtx2.stroke();
}

function drawHueStrip() {
  const grad = hueCtx2.createLinearGradient(0, 0, 0, HH);
  for (let i = 0; i <= 12; i++) grad.addColorStop(i / 12, \`hsl(\${i * 30},100%,50%)\`);
  hueCtx2.fillStyle = grad;
  hueCtx2.fillRect(0, 0, HW, HH);
  const y = (pickH / 360) * HH;
  hueCtx2.strokeStyle = 'rgba(255,255,255,0.9)';
  hueCtx2.lineWidth = 2;
  hueCtx2.beginPath();
  hueCtx2.moveTo(0, y);
  hueCtx2.lineTo(HW, y);
  hueCtx2.stroke();
}

function drawPicker() {
  drawSLCanvas();
  drawHueStrip();
  const hex = hsv2hex(pickH, pickS, pickV);
  document.getElementById('overridePreviewSwatch').style.background = hex;
  document.getElementById('overridePreviewHex').textContent = hex.toUpperCase();
  [\`lp\${overrideIdx}\`, \`rp\${overrideIdx}\`].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.style.background = hex; el.style.setProperty('--glow', hex + '88'); }
  });
}

function openOverrideModal(idx) {
  overrideIdx = idx;
  overrideOriginal = (window._codexPalette || [])[idx] || '#888888';
  const roleNames = ['Primary','Accent','Support','Contrast','Surface','Depth'];
  document.getElementById('overrideModalTitle').textContent = \`Override \${roleNames[idx] || 'Color ' + (idx + 1)}\`;
  const { h, s, v } = hex2hsv(overrideOriginal);
  pickH = h; pickS = s; pickV = v;
  document.getElementById('overrideModalBg').classList.add('open');
  drawPicker();
}

function closeOverrideModal(confirm) {
  document.getElementById('overrideModalBg').classList.remove('open');
  if (!confirm) {
    [\`lp\${overrideIdx}\`, \`rp\${overrideIdx}\`].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.style.background = overrideOriginal; el.style.setProperty('--glow', overrideOriginal + '88'); }
    });
  }
  overrideIdx = -1;
}

function handleSL(e) {
  const rect = slCv.getBoundingClientRect();
  const scaleX = SW / rect.width, scaleY = SH / rect.height;
  const cx = (e.clientX !== undefined ? e.clientX : e.touches[0].clientX) - rect.left;
  const cy = (e.clientY !== undefined ? e.clientY : e.touches[0].clientY) - rect.top;
  pickS = Math.max(0, Math.min(1, cx * scaleX / SW));
  pickV = Math.max(0, Math.min(1, 1 - (cy * scaleY / SH)));
  drawPicker();
}

function handleHue(e) {
  const rect = hueCv.getBoundingClientRect();
  const scaleY = HH / rect.height;
  const cy = (e.clientY !== undefined ? e.clientY : e.touches[0].clientY) - rect.top;
  pickH = Math.max(0, Math.min(359.9, (cy * scaleY / HH) * 360));
  drawPicker();
}

slCv.addEventListener('mousedown', e => { slDragging = true; handleSL(e); });
slCv.addEventListener('mousemove', e => { if (slDragging) handleSL(e); });
slCv.addEventListener('touchstart', e => { e.preventDefault(); slDragging = true; handleSL(e); }, { passive: false });
slCv.addEventListener('touchmove', e => { e.preventDefault(); if (slDragging) handleSL(e); }, { passive: false });
slCv.addEventListener('touchend', () => { slDragging = false; });
hueCv.addEventListener('mousedown', e => { hueDragging = true; handleHue(e); });
hueCv.addEventListener('mousemove', e => { if (hueDragging) handleHue(e); });
hueCv.addEventListener('touchstart', e => { e.preventDefault(); hueDragging = true; handleHue(e); }, { passive: false });
hueCv.addEventListener('touchmove', e => { e.preventDefault(); if (hueDragging) handleHue(e); }, { passive: false });
hueCv.addEventListener('touchend', () => { hueDragging = false; });
window.addEventListener('mouseup', () => { slDragging = false; hueDragging = false; });

document.getElementById('overrideBtnConfirm').addEventListener('click', () => {
  const hex = hsv2hex(pickH, pickS, pickV);
  if (window._codexSetOverride) window._codexSetOverride(overrideIdx, hex);
  [\`lp\${overrideIdx}\`, \`rp\${overrideIdx}\`].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('has-override');
  });
  closeOverrideModal(true);
});

document.getElementById('overrideBtnCancel').addEventListener('click', () => closeOverrideModal(false));

function clearOverride(idx) {
  if (window._codexClearOverride) window._codexClearOverride(idx);
  [\`lp\${idx}\`, \`rp\${idx}\`].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('has-override');
  });
}

document.getElementById('overrideModalBg').addEventListener('click', e => {
  if (e.target === document.getElementById('overrideModalBg')) closeOverrideModal(false);
});

['leftPanel', 'rightPanel'].forEach(panelId => {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  panel.addEventListener('click', e => {
    // X badge click = clear override
    const xbadge = e.target.closest('.ps-override-x');
    if (xbadge) {
      e.stopPropagation();
      const ps = xbadge.closest('.ps');
      if (!ps) return;
      const prefix = panelId === 'leftPanel' ? 'lp' : 'rp';
      const idx = parseInt(ps.id.replace(prefix, ''));
      if (!isNaN(idx)) clearOverride(idx);
      return;
    }
    // normal click = open picker
    const ps = e.target.closest('.ps');
    if (!ps) return;
    const prefix = panelId === 'leftPanel' ? 'lp' : 'rp';
    const idx = parseInt(ps.id.replace(prefix, ''));
    if (!isNaN(idx)) openOverrideModal(idx);
  });
});

window._codexOpenOverride = openOverrideModal;
})();
</script>
<script>
(function(){
  // Per-point state: current offset, target offset, velocity (for lerp)
  var state = null; // {offsets: Float32Array, targets: Float32Array}
  var PAD = 20;          // canvas overflow px so outward spikes aren't clipped
  var LERP = 0.18;       // how fast offsets chase their target (lower = smoother)
  var SPIKE_CHANCE = 0.018; // per-point per-frame chance of picking a new large target
  var MAX_JITTER = 12;   // max perpendicular displacement in px

  // jolt system — occasionally ramp up speed for a burst of frames
  var joltFrames = 0;
  var JOLT_CHANCE = 0.004;  // per-frame chance of a jolt starting (~once every ~4s)
  var JOLT_LERP = 0.65;     // lerp speed during jolt
  var JOLT_SPIKE = 0.12;    // spike chance during jolt
  var JOLT_DURATION = 10;   // frames the jolt lasts

  function roundedRectPts(x, y, w, h, r) {
    var pts = [];
    var arcSteps = Math.max(4, Math.round(r * Math.PI / 2 / 7));
    function addEdge(x1,y1,x2,y2) {
      var len = Math.hypot(x2-x1, y2-y1);
      var steps = Math.max(2, Math.round(len / 7));
      var nx = (y2-y1)/len, ny = -(x2-x1)/len;
      for (var i = 0; i < steps; i++) {
        var t = i/steps;
        pts.push({x: x1+t*(x2-x1), y: y1+t*(y2-y1), nx: nx, ny: ny});
      }
    }
    function addArc(cx,cy,a0,a1) {
      for (var i = 0; i < arcSteps; i++) {
        var a = a0 + (a1-a0)*i/arcSteps;
        pts.push({x: cx+r*Math.cos(a), y: cy+r*Math.sin(a), nx: Math.cos(a), ny: Math.sin(a)});
      }
    }
    addEdge(x+r, y, x+w-r, y);
    addArc(x+w-r, y+r, -Math.PI/2, 0);
    addEdge(x+w, y+r, x+w, y+h-r);
    addArc(x+w-r, y+h-r, 0, Math.PI/2);
    addEdge(x+w-r, y+h, x+r, y+h);
    addArc(x+r, y+h-r, Math.PI/2, Math.PI);
    addEdge(x, y+h-r, x, y+r);
    addArc(x+r, y+r, Math.PI, Math.PI*1.5);
    return pts;
  }

  function ensureState(n) {
    if (state && state.offsets.length === n) return;
    state = {
      offsets: new Float32Array(n),
      targets: new Float32Array(n)
    };
    for (var i = 0; i < n; i++) {
      state.targets[i] = (Math.random() - 0.5) * MAX_JITTER * 2;
    }
  }

  function stepState() {
    // maybe trigger a jolt
    if (joltFrames <= 0 && Math.random() < JOLT_CHANCE) joltFrames = JOLT_DURATION;
    var lerp = joltFrames > 0 ? JOLT_LERP : LERP;
    var spike = joltFrames > 0 ? JOLT_SPIKE : SPIKE_CHANCE;
    if (joltFrames > 0) joltFrames--;

    var o = state.offsets, t = state.targets;
    for (var i = 0; i < o.length; i++) {
      // occasionally snap to a new random target (electric spike)
      if (Math.random() < spike) {
        t[i] = (Math.random() - 0.5) * MAX_JITTER * 2;
      }
      // smoothly lerp offset toward target
      o[i] += (t[i] - o[i]) * lerp;
      // once close to target, relax target back toward zero
      if (Math.abs(t[i] - o[i]) < 0.5) {
        t[i] = (Math.random() - 0.5) * 4; // rest near zero with tiny noise
      }
    }
  }

  function drawBorder(cv, pts, accentHex) {
    var ctx = cv.getContext('2d');
    var W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);

    var o = state.offsets;

    // outer glow pass
    ctx.save();
    ctx.shadowColor = accentHex;
    ctx.shadowBlur = 16;
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(pts[0].x + pts[0].nx * o[0], pts[0].y + pts[0].ny * o[0]);
    for (var i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x + pts[i].nx * o[i], pts[i].y + pts[i].ny * o[i]);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // inner bright core — tighter offsets
    ctx.save();
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 0.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(pts[0].x + pts[0].nx * o[0] * 0.35, pts[0].y + pts[0].ny * o[0] * 0.35);
    for (var i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x + pts[i].nx * o[i] * 0.35, pts[i].y + pts[i].ny * o[i] * 0.35);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  function getAccent() {
    return getComputedStyle(document.documentElement).getPropertyValue('--ui-accent').trim() || '#00e5ff';
  }

  var canvases = Array.from(document.querySelectorAll('.ep-canvas'));
  var pts = null;
  var lastW = 0, lastH = 0;

  function tick() {
    var cv0 = canvases[0];
    if (cv0) {
      var p = cv0.parentElement;
      var W = p.offsetWidth, H = p.offsetHeight;
      if (W !== lastW || H !== lastH) {
        lastW = W; lastH = H;
        canvases.forEach(function(cv) { cv.width = W + PAD*2; cv.height = H + PAD*2; });
        pts = roundedRectPts(PAD + 3, PAD + 3, W - 6, H - 6, 18);
        ensureState(pts.length);
      }
    }
    if (pts && pts.length) {
      stepState();
      var accent = getAccent();
      canvases.forEach(function(cv) {
        if (cv.width > 0 && cv.height > 0) drawBorder(cv, pts, accent);
      });
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
</script>
</body>
</html>
`;
}


function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
