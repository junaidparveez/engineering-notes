import { describe, expect, it } from 'vitest';
import { mdToHtml } from './markdown';

describe('mdToHtml', () => {
  it('renders headings at the right level', () => {
    expect(mdToHtml('# One')).toBe('<h1>One</h1>');
    expect(mdToHtml('### Three')).toBe('<h3>Three</h3>');
  });

  it('groups consecutive bullets into one list', () => {
    expect(mdToHtml('- a\n- b')).toBe('<ul>\n<li>a</li>\n<li>b</li>\n</ul>');
  });

  it('switches between bullet and numbered lists', () => {
    const html = mdToHtml('- a\n\n1. b');
    expect(html).toContain('<ul>');
    expect(html).toContain('<ol>');
    expect(html.indexOf('</ul>')).toBeLessThan(html.indexOf('<ol>'));
  });

  it('joins wrapped lines into one paragraph', () => {
    expect(mdToHtml('one\ntwo')).toBe('<p>one two</p>');
  });

  it('renders inline code, bold, italic and links', () => {
    expect(mdToHtml('`x`')).toBe('<p><code>x</code></p>');
    expect(mdToHtml('**bold**')).toBe('<p><strong>bold</strong></p>');
    expect(mdToHtml('an *em* here')).toBe('<p>an <em>em</em> here</p>');
    expect(mdToHtml('[site](https://example.com)')).toBe(
      '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">site</a></p>',
    );
  });

  it('keeps fenced code verbatim and does not parse it as markdown', () => {
    const html = mdToHtml('```java\n# not a heading\n- not a list\n```');
    expect(html).toBe('<pre><code># not a heading\n- not a list</code></pre>');
  });

  it('strips the frontmatter block', () => {
    expect(mdToHtml('---\ntitle: X\n---\n\nBody')).toBe('<p>Body</p>');
  });

  it('renders blockquotes and horizontal rules', () => {
    expect(mdToHtml('> quoted')).toBe('<blockquote>quoted</blockquote>');
    expect(mdToHtml('---\n')).toBe('<hr/>');
  });

  it('escapes HTML in note content', () => {
    // The preview inserts this with dangerouslySetInnerHTML, so anything that
    // survives unescaped here becomes script execution in the app.
    expect(mdToHtml('<script>alert(1)</script>')).toBe(
      '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>',
    );
    expect(mdToHtml('# <img src=x onerror=alert(1)>')).toBe(
      '<h1>&lt;img src=x onerror=alert(1)&gt;</h1>',
    );
    expect(mdToHtml('```\n<b>in code</b>\n```')).toBe('<pre><code>&lt;b&gt;in code&lt;/b&gt;</code></pre>');
  });

  it('handles Windows line endings', () => {
    expect(mdToHtml('# One\r\n\r\ntext')).toBe('<h1>One</h1>\n<p>text</p>');
  });

  it('returns an empty string for empty input', () => {
    expect(mdToHtml('')).toBe('');
  });
});
