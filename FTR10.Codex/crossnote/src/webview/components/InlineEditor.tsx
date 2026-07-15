import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import PreviewContainer from '../containers/preview';

/**
 * Inline Editor
 *
 * When `inlineEditElement` is set (double-click or FloatingActions "Edit in place"),
 * renders a glass textarea just below the element. Changes are sent to the preview
 * live as the user types (350 ms debounce). Escape or clicking outside saves.
 *
 * Keyboard:
 *   Enter / Shift+Enter  — newline (normal textarea behaviour)
 *   Escape               — save and close
 *   Click outside        — save and close
 */
export default function InlineEditor() {
  const {
    inlineEditElement,
    setInlineEditElement,
    getHighlightElementLineRange,
    markdown,
    postMessage,
    sourceUri,
  } = PreviewContainer.useContainer();

  const [value, setValue] = useState('');
  const [rect, setRect] = useState<DOMRect | null>(null);
  // Incremented on every open to force the textarea height recalculation even
  // when the new `value` is identical to the previous open (same text).
  const [editorKey, setEditorKey] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  // Local copy of the markdown so live updates don't race with container state updates
  const workingMarkdownRef = useRef<string>('');
  // [start, end] source line range; end tracks live changes in line count
  const lineRangeRef = useRef<[number, number] | null>(null);
  // Whether the user has typed anything (guards against re-saving unchanged content)
  const isDirtyRef = useRef(false);
  // Tracks the pending live-preview debounce so commit() can cancel it before final save
  const liveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirror of `value` state that is always up-to-date even before React re-renders.
  // commit() reads this so it never has a stale closure over value.
  const valueRef = useRef('');
  // Prevents the scroll-correction effect from running more than once per open.
  const didScrollRef = useRef(false);

  // On activation: snapshot markdown, capture source range and element rect.
  // Intentionally depends only on `inlineEditElement` — we don't want to re-run on
  // every markdown keystroke while the editor is open.
  useLayoutEffect(() => {
    if (!inlineEditElement) {
      setRect(null);
      return;
    }
    const range = getHighlightElementLineRange(inlineEditElement);
    if (!range) {
      setInlineEditElement(null);
      return;
    }
    const [start, end] = range;
    workingMarkdownRef.current = markdown;
    lineRangeRef.current = [start, end];
    isDirtyRef.current = false;
    const initial = markdown.split('\n').slice(start, end).join('\n');
    valueRef.current = initial;
    setValue(initial);
    setEditorKey((k) => k + 1);
    didScrollRef.current = false;
    // Add padding so the browser HAS room to scroll even when the editor opens
    // near the end of the document. Must happen before setRect so the page has
    // enough height when the [rect] scroll-correction effect fires.
    const prevPadding = document.body.style.paddingBottom;
    document.body.style.paddingBottom = '60vh';
    setRect(inlineEditElement.getBoundingClientRect());
    return () => {
      document.body.style.paddingBottom = prevPadding;
    };
  }, [inlineEditElement]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-resize textarea to content height (bounded by CSS max-height).
  // Depends on editorKey so it always runs on every open, even when the text
  // content is identical to the previous session.
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
  }, [value, editorKey]);

  // One-shot scroll per open: keep the element's bottom at ≤38% of viewport
  // height. The remaining 62% is enough for the editor panel (max-height: 48vh)
  // plus gap and padding. Targeting elRect.bottom (not top) is correct because
  // it's the element's bottom edge that determines where the overlay starts.
  useLayoutEffect(() => {
    if (didScrollRef.current) return;
    if (!inlineEditElement || !rect) return;
    didScrollRef.current = true;

    const elRect = inlineEditElement.getBoundingClientRect();
    const maxBottom = window.innerHeight * 0.38;
    if (elRect.bottom > maxBottom) {
      const scrollEl = (
        document.scrollingElement || document.documentElement
      ) as HTMLElement;
      scrollEl.scrollTop += elRect.bottom - maxBottom;
      setRect(inlineEditElement.getBoundingClientRect());
    }
  }, [rect]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live preview: push changes to the preview with a 350 ms debounce while typing.
  // Stores the timer in liveTimerRef so commit() can cancel it before the final save.
  useEffect(() => {
    if (!isDirtyRef.current || !lineRangeRef.current) return;
    const [start, end] = lineRangeRef.current;
    const snapshot = valueRef.current; // capture now; closure in setTimeout reads this
    if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
    liveTimerRef.current = setTimeout(() => {
      const newLines = snapshot.split('\n');
      const allLines = workingMarkdownRef.current.split('\n');
      const newContent = [
        ...allLines.slice(0, start),
        ...newLines,
        ...allLines.slice(end),
      ].join('\n');
      workingMarkdownRef.current = newContent;
      lineRangeRef.current = [start, start + newLines.length];
      postMessage('updateMarkdown', [sourceUri.current, newContent]);
      liveTimerRef.current = null;
    }, 350);
    // No cleanup return — liveTimerRef cancellation is handled explicitly in commit()
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus the textarea after the editor opens. Deferred past the mouseup from
  // the double-click that triggered the open, so the browser doesn't steal focus back.
  useEffect(() => {
    if (!inlineEditElement) return;
    const timer = setTimeout(() => {
      textareaRef.current?.focus();
    }, 80);
    return () => clearTimeout(timer);
  }, [inlineEditElement]);

  const close = useCallback(() => {
    setInlineEditElement(null);
  }, [setInlineEditElement]);

  // Cancel any pending live-preview debounce, do a final immediate save, then close.
  // Reads valueRef.current (not `value`) to always get the latest textarea content
  // regardless of whether React has re-rendered since the last onChange.
  const commit = useCallback(() => {
    if (liveTimerRef.current) {
      clearTimeout(liveTimerRef.current);
      liveTimerRef.current = null;
    }
    if (!isDirtyRef.current) { close(); return; }
    if (!lineRangeRef.current) { close(); return; }
    const [start, end] = lineRangeRef.current;
    const newLines = valueRef.current.split('\n');
    const allLines = workingMarkdownRef.current.split('\n');
    const newContent = [
      ...allLines.slice(0, start),
      ...newLines,
      ...allLines.slice(end),
    ].join('\n');
    postMessage('updateMarkdown', [sourceUri.current, newContent]);
    close();
  }, [postMessage, sourceUri, close]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter (with or without Shift) adds a newline — normal textarea behaviour
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation(); // prevent bubbling to the document ESC handler (TOC toggle)
        commit();
      }
    },
    [commit],
  );

  if (!inlineEditElement || !rect) return null;

  return createPortal(
    <>
      {/* Backdrop — clicking outside saves and closes */}
      <div className="inline-editor-backdrop" onClick={commit} />
      {/* Editor box — positioned just below the element being edited */}
      <div
        ref={overlayRef}
        className="inline-editor-overlay"
        style={{
          top: rect.bottom + 8,
          left: rect.left,
          width: Math.max(rect.width, 320),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <textarea
          ref={textareaRef}
          className="inline-editor-textarea"
          value={value}
          onChange={(e) => {
            isDirtyRef.current = true;
            valueRef.current = e.target.value;
            setValue(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          rows={1}
        />
      </div>
    </>,
    document.body,
  );
}
