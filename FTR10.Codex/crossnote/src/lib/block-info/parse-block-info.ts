import { BlockAttributes, parseBlockAttributes } from '../block-attributes';
import { BlockInfo } from './types';

export const parseBlockInfo = (raw = ''): BlockInfo => {
  let language: string | undefined;
  let attributesAsString: string;
  let attributes: BlockAttributes;
  const trimmedParams = raw.trim();

  // Extra class words that appear between the language and a `{...}` block,
  // e.g. "css line-numbers {data-source-line="59"}" → extraWords = ['line-numbers']
  let extraWords: string[] = [];

  if (trimmedParams.indexOf('{') !== -1) {
    // Format: "lang [word ...] { attrs }"
    const braceMatch = trimmedParams.match(/^(.*?)\{(.*?)\}/);
    if (braceMatch) {
      const beforeBrace = braceMatch[1].trim().split(/\s+/).filter(Boolean);
      language = beforeBrace[0] || '';
      extraWords = beforeBrace.slice(1);
      attributesAsString = braceMatch[2];
    } else {
      language = trimmedParams;
      attributesAsString = '';
    }
  } else {
    const match = trimmedParams.match(/^([^\s]+)\s+(.+?)$/);
    if (match) {
      if (match[1].length) {
        language = match[1];
      }
      attributesAsString = match[2];
    } else {
      language = trimmedParams;
      attributesAsString = '';
    }
  }

  if (attributesAsString) {
    try {
      attributes = parseBlockAttributes(attributesAsString);
    } catch (e) {
      attributes = {};
    }
  } else {
    attributes = {};
  }

  // Inject extra words (e.g. "line-numbers" from "css line-numbers {...}")
  // as boolean attributes so downstream code can detect them.
  for (const word of extraWords) {
    if (word && !(word in attributes)) {
      attributes[word] = true;
    }
  }

  let classNames = attributes.class ? attributes.class.split(/\s+/) : [];
  classNames = classNames
    .map((className) =>
      className
        .trim()
        .replace(/^\./, '')
        .replace(/[{}=]/g, ''),
    )
    .filter((className) => className.length > 0);

  if (!language) {
    language = classNames[0] || '';
  }

  if (!classNames.includes(language)) {
    classNames = [language, ...classNames.filter((cn) => cn !== language)];
  }

  if (classNames.length > 0) {
    attributes.class = classNames.join(' ');
  } else {
    delete attributes.class;
  }

  return { language, attributes };
};