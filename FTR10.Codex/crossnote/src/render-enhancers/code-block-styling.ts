import { escape } from 'html-escaper';
import { BlockInfo } from '../lib/block-info/index';
import { scopeForLanguageName } from '../markdown-engine/extension-helper';
import defineIeleLanguage from '../prism/iele';
import defineKLanguage from '../prism/k';
import Prism from '../prism/prism';

Prism.hooks.add('wrap', (env) => {
  if (env.type !== 'keyword') {
    return;
  }
  env.classes.push(`keyword-${env.content}`);
});
// loadLanguages(); // Load all languages

// Add K and Iele languages syntax highlighting
defineKLanguage(Prism);
defineIeleLanguage(Prism);

const normalizeClassAttribute = (classAttr?: string): string => {
  if (!classAttr) {
    return '';
  }
  return classAttr
    .split(/\s+/)
    .map((className) =>
      className
        .trim()
        .replace(/^\./, '')
        .replace(/[{}=]/g, ''),
    )
    .filter((className) => className.length > 0)
    .join(' ');
};

export default async function enhance($: CheerioStatic): Promise<void> {
  // spaced code blocks
  // this is for pandoc parser
  $('pre>code').each((i, codeElement) => {
    const $codeElement = $(codeElement);
    const code = $codeElement.text();
    const $container = $codeElement.parent();
    $codeElement.replaceWith(escape(code));
    $container.addClass('language-text');
  });

  const normalizeClassNames = ($container: Cheerio) => {
    const classAttr = $container.attr('class');
    const normalized = normalizeClassAttribute(classAttr);
    if (normalized && normalized !== classAttr) {
      $container.attr('class', normalized);
    }
  };

  // fenced code blocks
  $('[data-role="codeBlock"]').each((i, container) => {
    const $container = $(container);
    normalizeClassNames($container);

    // hide this code block if hide=true in options or if any of previous enhances told so
    const hidden =
      $container.data('hiddenByEnhancer') ||
      ($container.data('normalizedInfo') as BlockInfo).attributes['hide'] ===
        true;
    if (hidden) {
      $container.remove();
      return;
    }

    // extract code text
    const code = $container.text();

    // determine code language
    const info: BlockInfo = $container.data('normalizedInfo');
    const language = guessPrismLanguage(
      scopeForLanguageName(info.language),
      code,
    );

    // try use Prism syntax highlighter
    try {
      const html = Prism.highlight(code, Prism.languages[language], language);
      $container.empty().append($(`<code></code>`).html(html));
    } catch (error) {
      // ...or regarded as plain text on failure
      $container.empty().append($(`<code></code>`).text(code));
    }

    $container.addClass(`language-${language || 'text'}`);
    // 'line-numbers' as a bare word (css line-numbers) is parsed by
    // parseBlockAttributes as a key → {line_numbers: true} (after snakeCase
    // normalisation), NOT added to attributes.class. Detect it here and add
    // the CSS class so addLineNumbersIfNecessary can see it.
    if (info.attributes['line_numbers'] || info.attributes['line-numbers']) {
      $container.addClass('line-numbers');
    }
    if (info.attributes['class']) {
      $container.addClass(info.attributes['class']);
    }
    addLineNumbersIfNecessary($container, code);
    // check highlight
    if (info.attributes['highlight']) {
      highlightLines($container, code, info.attributes['highlight']);
    }

    // previously used data is no longer needed, so removing it to reduce output size
    $container.removeAttr('data-parsed-info');
    $container.removeAttr('data-normalized-info');
  });
}

/**
 * helps color special cases (e.g. vega / vega lite json and yaml)
 * @param language
 * @param code
 */
function guessPrismLanguage(language: string, code: string) {
  if (language === 'vega' || language === 'vega-lite') {
    const firstChar = (code.match(/^\s*(.)/) ?? [])[1];
    return firstChar === '{' ? 'json' : 'yaml';
  }
  return language;
}

/**
 * Add line numbers to code block <pre> element
 * @param
 * @param code
 */
function addLineNumbersIfNecessary($container: Cheerio, code: string): void {
  // keep class names normalized before line number logic
  const normalizedClass = normalizeClassAttribute($container.attr('class'));
  if (normalizedClass) {
    $container.attr('class', normalizedClass);
  }

  if ($container.hasClass('numberLines')) {
    $container.addClass('line-numbers');
    $container.removeClass('numberLines');
  }

  if ($container.hasClass('line-numbers')) {
    if (!code.trim().length) {
      return;
    }
    const match = code.match(/\n(?!$)/g);
    const lineCount = match ? match.length + 1 : 1;
    let lines = '';
    for (let i = 0; i < lineCount; i++) {
      lines += '<span></span>';
    }
    $container.append(
      `<span aria-hidden="true" class="line-numbers-rows">${lines}</span>`,
    );
  }
}

/**
 * @param $container
 * @param code
 * @param highlight
 */
function highlightLines(
  $container: Cheerio,
  code: string,
  highlight: string | string[] | number,
): void {
  if (!code.trim().length) {
    return;
  }
  if (typeof highlight === 'number') {
    highlight = [highlight.toString()];
  } else if (typeof highlight === 'string') {
    highlight = highlight.split(',');
  }
  const match = code.match(/\n(?!$)/g);
  const lineCount = match ? match.length + 1 : 1;
  const highlightElements: string[] = [];
  highlight.forEach((h) => {
    h = h.toString();
    if (h.indexOf('-') > 0) {
      let [start, end] = h.split('-').map((x) => parseInt(x, 10));
      if (isNaN(start) || isNaN(end) || start < 0 || end < 0) {
        return;
      }
      if (start > end) {
        [start, end] = [end, start];
      }
      if (end > lineCount) {
        return;
      }
      let lineBreaks = '';
      for (let i = start; i <= end; i++) {
        lineBreaks += '\n';
      }
      let preLineBreaks = '';
      for (let i = 0; i < start - 1; i++) {
        preLineBreaks += '\n';
      }
      highlightElements.push(
        `<div class="line-highlight-wrapper">${preLineBreaks}<div aria-hidden="true" class="line-highlight" data-range="${start}-${end}" data-start="${start}" data-end="${end}">${lineBreaks}</div></div>`,
      );
    } else {
      let preLineBreaks = '';
      const start = parseInt(h, 10);
      if (isNaN(start) || start < 0 || start > lineCount) {
        return;
      }
      for (let i = 0; i < start - 1; i++) {
        preLineBreaks += '\n';
      }
      highlightElements.push(
        `<div class="line-highlight-wrapper">${preLineBreaks}<div aria-hidden="true" class="line-highlight" data-range="${h}" data-start="${h}">${'\n'}</div></div>`,
      );
    }
  });
  $container.append(highlightElements.join(''));
  $container.attr('data-line', highlight.join(','));
}