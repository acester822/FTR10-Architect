import {
  mdiCodeTags,
  mdiContentCopy,
  mdiIdentifier,
  mdiImage,
  mdiOpenInNew,
  mdiPencilOutline,
} from '@mdi/js';
import Icon from '@mdi/react';
import classNames from 'classnames';
import * as FileSaver from 'file-saver';
import { toBlob } from 'html-to-image';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import PreviewContainer from '../containers/preview';
import { copyBlobToClipboard, copyTextToClipboard } from '../lib/utility';

const ITEM_SPACING = 36;
const TOGGLE_SIZE = 28;
const HOT_PAD = 10; // extra padding around bounding box

function ensureGooFilter() {
  if (document.getElementById('gooey-filter-svg')) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'gooey-filter-svg';
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('version', '1.1');
  svg.style.cssText =
    'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';
  svg.innerHTML = `<defs>
    <filter id="goo-filter">
      <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="4" />
      <feColorMatrix in="blur" mode="matrix"
        values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
      <feComposite in2="goo" in="SourceGraphic" result="mix" />
    </filter>
  </defs>`;
  document.body.appendChild(svg);
}

function ensureCopyFlashStyle() {
  if (document.getElementById('gooey-copy-flash-style')) return;
  const style = document.createElement('style');
  style.id = 'gooey-copy-flash-style';
  style.textContent = `
    @keyframes gooey-copy-flash {
      0%   { outline: 2px solid rgba(0, 245, 255, 0);    outline-offset: 3px; }
      20%  { outline: 2px solid rgba(0, 245, 255, 0.85); outline-offset: 3px; }
      100% { outline: 2px solid rgba(0, 245, 255, 0);    outline-offset: 6px; }
    }
    .gooey-copy-flash {
      animation: gooey-copy-flash 600ms ease-out forwards;
      border-radius: 6px;
    }
  `;
  document.head.appendChild(style);
}

export default function FloatingActions() {
  const {
    highlightElement,
    getHighlightElementLineRange,
    inlineEditElement,
    isVSCode,
    isVSCodeWebExtension,
    markdown,
    postMessage,
    setInlineEditElement,
    sourceUri,
  } = PreviewContainer.useContainer();

  const [isOpen, setIsOpen] = useState(false);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [menuTop, setMenuTop] = useState(0);
  const [menuLeft, setMenuLeft] = useState(0);
  // activeEl persists while the mouse transitions from the pre to the menu buttons
  const [activeEl, setActiveEl] = useState<HTMLElement | null>(null);
  const activeElRef = useRef<HTMLElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    ensureGooFilter();
    ensureCopyFlashStyle();
  }, []);

  // Adopt a new highlight element; only cancel close when it's a genuinely new element.
  // If it's the same element (e.g. cursor moved back left onto it), let the close timer run.
  useEffect(() => {
    if (!highlightElement) return;
    if (highlightElement === activeElRef.current) return;
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setIsOpen(false);
    setActiveEl(highlightElement);
    activeElRef.current = highlightElement;
  }, [highlightElement]);

  useLayoutEffect(() => {
    if (!activeEl) return;
    const update = () => {
      const rect = activeEl.getBoundingClientRect();
      // Centre toggle vertically on element, 8px outside its right edge
      // Clamp left so the rightmost fan item never clips off-screen
      const desiredLeft = rect.right + 8;
      const maxLeft = window.innerWidth - ITEM_SPACING - TOGGLE_SIZE - HOT_PAD - 4;
      setMenuTop(rect.top + rect.height / 2 - TOGGLE_SIZE / 2);
      setMenuLeft(Math.min(desiredLeft, maxLeft));
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [activeEl]);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    closeTimer.current = setTimeout(() => {
      setIsOpen(false);
      setActiveEl(null);
      activeElRef.current = null;
    }, 300);
  }, []);

  const flashCopied = useCallback(
    (_label: string) => {
      const el = activeElRef.current;
      if (el) {
        el.classList.remove('gooey-copy-flash');
        void el.offsetWidth;
        el.classList.add('gooey-copy-flash');
        setTimeout(() => el.classList.remove('gooey-copy-flash'), 650);
      }
    },
    [],
  );

  const copyMarkdown = useCallback(() => {
    const el = activeElRef.current;
    if (!el) return;
    const range = getHighlightElementLineRange(el);
    if (!range) return;
    const [start, end] = range;
    const lines = markdown.split('\n').slice(start, end);
    copyTextToClipboard(
      lines.join('\n').replace(/\n$/, '').replace(/^\n/, ''),
    );
    flashCopied('Markdown copied!');
  }, [getHighlightElementLineRange, markdown, flashCopied]);

  const copyId = useCallback(() => {
    const el = activeElRef.current;
    if (!el?.id) return;
    copyTextToClipboard(el.id);
    flashCopied(`"${el.id}" copied!`);
  }, [flashCopied]);

  const exportAsPng = useCallback(() => {
    const el = activeElRef.current;
    if (!el) return;
    setIsExportingImage(true);
    el.classList.remove('highlight-active');
    toBlob(el).then((blob) => {
      setIsExportingImage(false);
      el.classList.add('highlight-active');
      if (!blob) return;
      FileSaver.saveAs(blob, 'highlight.png');
      copyBlobToClipboard(blob);
    });
  }, []);

  const copyCode = useCallback(() => {
    const el = activeElRef.current;
    if (!el) return;
    const codeEl = el.matches('pre[data-role="codeBlock"]')
      ? el
      : el.querySelector('pre[data-role="codeBlock"]');
    if (!codeEl) return;
    copyTextToClipboard((codeEl.textContent || '').trim());
    flashCopied('Code copied!');
  }, [flashCopied]);

  useEffect(() => {
    if (!activeEl || !isOpen) return;
    document.body.classList.add('floating-action-open');
    return () => document.body.classList.remove('floating-action-open');
  }, [isOpen, activeEl]);

  const menuItems = useMemo(() => {
    if (!activeEl) return [];
    const hasCodeBlock = !!(
      activeEl.matches('pre[data-role="codeBlock"]') ||
      activeEl.querySelector('pre[data-role="codeBlock"]')
    );
    const showOpenInVSCode = isVSCode || isVSCodeWebExtension;
    return [
      ...(hasCodeBlock
        ? [{ icon: mdiCodeTags, title: 'Copy Code', onClick: copyCode }]
        : []),
      { icon: mdiPencilOutline, title: 'Edit in place', onClick: () => setInlineEditElement(activeEl) },
      { icon: mdiContentCopy, title: 'Copy Markdown', onClick: copyMarkdown },
      ...(activeEl.id
        ? [
            {
              icon: mdiIdentifier,
              title: `Copy ID: ${activeEl.id}`,
              onClick: copyId,
            },
          ]
        : []),
      ...(showOpenInVSCode
        ? [
            {
              icon: mdiOpenInNew,
              title: 'Open in VS Code',
              onClick: () => postMessage('openExternalEditor', [sourceUri.current]),
            },
          ]
        : []),
      ...(!isVSCodeWebExtension
        ? [{ icon: mdiImage, title: 'Export as PNG', onClick: exportAsPng }]
        : []),
    ];
  }, [
    activeEl,
    isVSCodeWebExtension,
    setInlineEditElement,
    copyCode,
    copyMarkdown,
    copyId,
    exportAsPng,
  ]);

  if (!activeEl) return null;
  if (inlineEditElement) return null;

  // Hot zone: one invisible div that covers toggle (collapsed) or toggle+full fan (open).
  // Owns all mouse enter/leave — entering keeps menu alive, leaving schedules close.
  const hotZone = isOpen
    ? {
        left: -HOT_PAD,
        top: -(ITEM_SPACING + TOGGLE_SIZE / 2 + HOT_PAD),
        width: ITEM_SPACING + TOGGLE_SIZE + HOT_PAD * 2,
        height: (ITEM_SPACING + TOGGLE_SIZE / 2 + HOT_PAD) * 2,
      }
    : {
        left: 0,
        top: 0,
        width: TOGGLE_SIZE,
        height: TOGGLE_SIZE,
      };

  return createPortal(
    <div
      className={classNames(
        'select-none z-[9999]',
        isExportingImage ? 'hidden' : '',
      )}
      style={{
        position: 'fixed',
        top: menuTop,
        left: menuLeft,
        width: 0,
        height: 0,
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      {/* single hot-zone: covers toggle when closed, expands to cover full fan when open.
          Owns all enter/leave — entering cancels close, leaving schedules it. */}
      <div
        style={{
          position: 'absolute',
          left: hotZone.left,
          top: hotZone.top,
          width: hotZone.width,
          height: hotZone.height,
          pointerEvents: 'auto',
        }}
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
      />
      <nav className="gooey-menu">
        {menuItems.map((item, i) => {
          const total = menuItems.length;
          // Semicircle fan: -90° (top) → 0° (right) → 90° (bottom)
          const startAngle = -Math.PI / 2;
          const endAngle = Math.PI / 2;
          const a =
            total === 1
              ? 0
              : startAngle + (i / (total - 1)) * (endAngle - startAngle);
          const dx = Math.round(Math.cos(a) * ITEM_SPACING);
          const dy = Math.round(Math.sin(a) * ITEM_SPACING);
          return (
            <button
              key={i}
              className="gooey-item"
              title={item.title}
              style={{
                transform: isOpen
                  ? `translate3d(${dx}px, ${dy}px, 0)`
                  : 'translate3d(0, 0, 0)',
                transitionDuration: isOpen ? `${80 + 100 * (i + 1)}ms` : '180ms',
                transitionTimingFunction: isOpen
                  ? 'cubic-bezier(0.935, 0.000, 0.340, 1.330)'
                  : 'ease-out',
              }}
              onMouseEnter={cancelClose}
              onClick={item.onClick}
            >
              <Icon path={item.icon} size={0.55} />
            </button>
          );
        })}
        <button
          className={classNames('gooey-toggle', isOpen && 'gooey-toggle--open')}
          onMouseEnter={cancelClose}
          onClick={() => setIsOpen((v) => !v)}
          title={isOpen ? 'Close' : 'More actions'}
        >
          <span
            className={classNames('gooey-ham', 'gooey-ham-1', isOpen && 'is-open')}
          />
          <span
            className={classNames('gooey-ham', 'gooey-ham-2', isOpen && 'is-open')}
          />
          <span
            className={classNames('gooey-ham', 'gooey-ham-3', isOpen && 'is-open')}
          />
        </button>
      </nav>
    </div>,
    document.body,
  );
}
