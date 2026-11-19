import { describe, expect, it } from 'vitest';
import {
  decodeHtmlEntitiesOnce,
  escapeHtmlAttribute,
  extractElements,
  htmlToText,
} from '@/lib/html/text';

describe('decodeHtmlEntitiesOnce', () => {
  it('decodes exactly once', () => {
    expect(decodeHtmlEntitiesOnce('&amp;lt;script&amp;gt;')).toBe('&lt;script&gt;');
    expect(decodeHtmlEntitiesOnce('&lt;b&gt;')).toBe('<b>');
    expect(decodeHtmlEntitiesOnce('&#39; &quot; &#x2F;')).toBe('\' " /');
  });

  it('leaves unknown and malformed entities untouched', () => {
    expect(decodeHtmlEntitiesOnce('&unknown; &amp no-semicolon')).toBe(
      '&unknown; &amp no-semicolon'
    );
    expect(decodeHtmlEntitiesOnce('&#x110000;')).toBe('&#x110000;');
  });
});

describe('escapeHtmlAttribute', () => {
  it('encodes attribute-terminating characters without changing URL syntax', () => {
    expect(escapeHtmlAttribute('https://cdn.example/a.jpg?w=100&h=200')).toBe(
      'https://cdn.example/a.jpg?w=100&h=200'
    );
    expect(escapeHtmlAttribute('https://cdn.example/" onerror="alert(1)')).toBe(
      'https://cdn.example/%22 onerror=%22alert(1)'
    );
    expect(escapeHtmlAttribute("https://cdn.example/'><script>")).not.toMatch(/['"<>]/);
  });
});

describe('htmlToText', () => {
  it('removes script and style elements including their contents', () => {
    const result = htmlToText(
      '<div>Before<script>alert(1)</script><style>body{display:none}</style>After</div>'
    );
    expect(result).toBe('Before After');
    expect(result).not.toContain('<');
    expect(result).not.toContain('alert(1)');
  });

  it('removes tags even when script end tags contain whitespace or attributes', () => {
    const result = htmlToText('<script>alert(1)</script >Safe<p>Price</p>');
    expect(result).toBe('Safe Price');
    expect(result).not.toContain('<');
  });

  it('cannot be bypassed by nested or encoded markup', () => {
    for (const input of [
      '<scr<script>ipt>alert(1)</script>Safe',
      '&lt;script&gt;alert(1)&lt;/script&gt;Safe',
      '<!-- <script>alert(1)</script> -->Safe',
      '<script><script>alert(1)</script></script>Safe',
    ]) {
      const result = htmlToText(input);
      expect(result, input).not.toContain('<');
      expect(result, input).toContain('Safe');
    }
  });

  it('drops an unterminated tag instead of leaking a partial tag', () => {
    expect(htmlToText('Safe<div class="broken')).toBe('Safe');
  });

  it('honours maxLength after cleaning', () => {
    expect(htmlToText('<p>abcdefghij</p>', { maxLength: 5 })).toBe('abcde');
  });
});

describe('extractElements', () => {
  it('extracts JSON-LD script contents without treating malformed end tags as content', () => {
    const html =
      '<script type="application/ld+json">{"@type":"Product","name":"A"}</script >' +
      '<script>alert(1)</script>';
    const scripts = extractElements(html, 'script');
    expect(scripts).toHaveLength(2);
    expect(scripts[0].content).toBe('{"@type":"Product","name":"A"}');
    expect(scripts[1].content).toBe('alert(1)');
  });
});
