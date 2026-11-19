/**
 * Small, allocation-conscious HTML helpers for untrusted page content.
 *
 * These helpers intentionally avoid "sanitising" HTML with a sequence of
 * regular-expression replacements. Chained replacements are easy to bypass
 * (`<scr<script>ipt>`) and can turn encoded text into live markup. Instead we
 * decode entities exactly once and then scan the string as a token stream:
 * every `<...>` construct is removed rather than rewritten.
 *
 * The output is plain text, not HTML. Consumers may render it through React
 * (which escapes text again) or include it in an AI prompt as untrusted data.
 */

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
};

/**
 * Decode HTML character references exactly once.
 *
 * A single pass matters: `&amp;lt;` must become the literal text `&lt;`, not
 * `<`. Repeatedly applying named replacements would decode the result again
 * and turn untrusted data into markup.
 */
export function decodeHtmlEntitiesOnce(value: string): string {
  return value.replace(
    /&(?:#x([0-9a-f]+)|#([0-9]+)|([a-z][a-z0-9]+));/gi,
    (match, hex: string | undefined, decimal: string | undefined, named: string | undefined) => {
      if (hex) return codePointToString(parseInt(hex, 16), match);
      if (decimal) return codePointToString(parseInt(decimal, 10), match);
      if (named) return NAMED_ENTITIES[named.toLowerCase()] ?? match;
      return match;
    }
  );
}

function codePointToString(codePoint: number, fallback: string): string {
  if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return fallback;
  // Surrogate code points are not valid Unicode scalar values.
  if (codePoint >= 0xd800 && codePoint <= 0xdfff) return fallback;
  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return fallback;
  }
}

const BLOCK_TAGS = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'br',
  'dd',
  'div',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul',
]);

const DEFAULT_SKIPPED_ELEMENTS = new Set(['script', 'style', 'noscript', 'template']);

interface ParsedTag {
  name: string;
  attributes: string;
  closing: boolean;
  selfClosing: boolean;
  end: number;
}

/** Parse the tag beginning at `start` (which must point at `<`). */
function parseTag(input: string, start: number): ParsedTag | null {
  if (input[start] !== '<') return null;
  let index = start + 1;
  let closing = false;
  if (input[index] === '/') {
    closing = true;
    index++;
  }
  while (index < input.length && /\s/.test(input[index])) index++;

  const nameStart = index;
  while (index < input.length && /[a-z0-9:-]/i.test(input[index])) index++;
  if (index === nameStart) return null;
  const name = input.slice(nameStart, index).toLowerCase();

  let quote: string | null = null;
  let end = index;
  for (; end < input.length; end++) {
    const char = input[end];
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '>') {
      break;
    }
  }
  if (end >= input.length) return null;

  const attributes = input.slice(index, end);
  return {
    name,
    attributes,
    closing,
    selfClosing: !closing && /\/\s*$/.test(attributes),
    end,
  };
}

/** Find the matching close tag for an element whose content starts at `from`. */
function findClosingTag(
  input: string,
  tagName: string,
  from: number
): { start: number; end: number } | null {
  let index = from;
  while (index < input.length) {
    const next = input.indexOf('</', index);
    if (next < 0) return null;
    const tag = parseTag(input, next);
    if (tag && tag.closing && tag.name === tagName) {
      return { start: next, end: tag.end };
    }
    index = next + 2;
  }
  return null;
}

export interface HtmlToTextOptions {
  /** Element names whose contents and tags are removed entirely. */
  skipElements?: Iterable<string>;
  /** Collapse all whitespace to single spaces (default true). */
  collapseWhitespace?: boolean;
  /** Maximum number of characters to return. */
  maxLength?: number;
}

/**
 * Extract plain text from an untrusted HTML fragment.
 *
 * The scanner never emits `<`, so the result cannot contain a tag or a
 * reconstructed `<script>` sequence even when the input contains malformed,
 * nested or encoded markup.
 */
export function htmlToText(input: string, options: HtmlToTextOptions = {}): string {
  if (!input) return '';

  const skipped = new Set([...(options.skipElements ?? [])].map((name) => name.toLowerCase()));
  for (const name of DEFAULT_SKIPPED_ELEMENTS) skipped.add(name);

  // Decode once before scanning. Encoded markup (`&lt;script&gt;`) is then
  // treated as a tag and removed, rather than becoming literal markup later.
  const source = decodeHtmlEntitiesOnce(input);
  let output = '';
  let index = 0;

  while (index < source.length) {
    const char = source[index];

    if (char === '<') {
      if (source.startsWith('<!--', index)) {
        const commentEnd = source.indexOf('-->', index + 4);
        if (commentEnd < 0) break;
        index = commentEnd + 3;
        continue;
      }

      if (source[index + 1] === '!' || source[index + 1] === '?') {
        const declarationEnd = source.indexOf('>', index + 2);
        if (declarationEnd < 0) break;
        index = declarationEnd + 1;
        continue;
      }

      const tag = parseTag(source, index);
      if (!tag) {
        // A stray `<` with no complete tag: discard the remainder rather than
        // leaking a partial tag into text or a prompt.
        break;
      }

      if (!tag.closing && skipped.has(tag.name) && !tag.selfClosing) {
        const close = findClosingTag(source, tag.name, tag.end + 1);
        if (!close) break;
        output += ' ';
        index = close.end + 1;
      } else {
        if (BLOCK_TAGS.has(tag.name)) output += ' ';
        index = tag.end + 1;
      }
      continue;
    }

    output += char;
    index++;
  }

  if (options.collapseWhitespace !== false) {
    output = output.replace(/\s+/g, ' ').trim();
  }

  if (options.maxLength != null && output.length > options.maxLength) {
    output = output.slice(0, options.maxLength);
  }

  return output;
}

export interface ExtractedElement {
  attributes: string;
  content: string;
}

/**
 * Extract the raw contents of every matching element. Used only to locate
 * JSON-LD blocks, not as an HTML security boundary.
 */
export function extractElements(input: string, tagName: string): ExtractedElement[] {
  const wanted = tagName.toLowerCase();
  const elements: ExtractedElement[] = [];
  let index = 0;

  while (index < input.length) {
    const next = input.indexOf('<', index);
    if (next < 0) break;

    if (input.startsWith('<!--', next)) {
      const commentEnd = input.indexOf('-->', next + 4);
      if (commentEnd < 0) break;
      index = commentEnd + 3;
      continue;
    }

    if (input[next + 1] === '!' || input[next + 1] === '?') {
      const declarationEnd = input.indexOf('>', next + 2);
      if (declarationEnd < 0) break;
      index = declarationEnd + 1;
      continue;
    }

    const tag = parseTag(input, next);
    if (!tag) {
      index = next + 1;
      continue;
    }

    if (!tag.closing && tag.name === wanted && !tag.selfClosing) {
      const close = findClosingTag(input, wanted, tag.end + 1);
      if (!close) break;
      elements.push({
        attributes: tag.attributes,
        content: input.slice(tag.end + 1, close.start),
      });
      index = close.end + 1;
      continue;
    }

    index = tag.end + 1;
  }

  return elements;
}
