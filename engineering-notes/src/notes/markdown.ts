/**
 * The Markdown renderer, ported from the old app.
 *
 * Deliberately not a Markdown library: this handles the subset these notes
 * actually use - headings, lists, fenced code, blockquotes, rules, and inline
 * code/bold/italic/links - in about fifty lines, against a dependency that
 * would be orders of magnitude larger.
 *
 * Everything is escaped before it is wrapped in tags, so note content cannot
 * inject markup into the preview. The only HTML that reaches the page is the
 * tags this file produces.
 */

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Inline spans. Runs on already-escaped text. */
function inline(t: string): string {
  return t
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

export function mdToHtml(src: string): string {
  const fences: string[] = [];
  let s = String(src || '').replace(/\r\n/g, '\n');

  // Drop the frontmatter block; the fields are shown as form inputs instead.
  s = s.replace(/^---\n[\s\S]*?\n---\n?/, '');

  // Lift fenced code out first and leave a placeholder, so the line-by-line
  // pass below cannot mistake code for headings, lists or rules.
  s = s.replace(/```[a-zA-Z0-9+#.-]*\n([\s\S]*?)```/g, (_m, code: string) => {
    fences.push('<pre><code>' + esc(code.replace(/\n$/, '')) + '</code></pre>');
    return '\u0000F' + (fences.length - 1) + '\u0000';
  });

  const out: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  let para: string[] = [];

  const flush = () => {
    if (para.length) {
      out.push('<p>' + inline(para.join(' ')) + '</p>');
      para = [];
    }
  };
  const close = () => {
    if (list) {
      out.push('</' + list + '>');
      list = null;
    }
  };

  for (const raw of s.split('\n')) {
    const line = raw.trimEnd();
    const t = line.trim();

    if (/^\u0000F\d+\u0000$/.test(t)) {
      flush();
      close();
      out.push(t);
      continue;
    }
    if (!t) {
      flush();
      close();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flush();
      close();
      const level = heading[1]!.length;
      out.push(`<h${level}>` + inline(esc(heading[2]!)) + `</h${level}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
      flush();
      close();
      out.push('<hr/>');
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flush();
      close();
      out.push('<blockquote>' + inline(esc(quote[1]!)) + '</blockquote>');
      continue;
    }

    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    if (bullet) {
      flush();
      if (list !== 'ul') {
        close();
        out.push('<ul>');
        list = 'ul';
      }
      out.push('<li>' + inline(esc(bullet[1]!)) + '</li>');
      continue;
    }

    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (numbered) {
      flush();
      if (list !== 'ol') {
        close();
        out.push('<ol>');
        list = 'ol';
      }
      out.push('<li>' + inline(esc(numbered[1]!)) + '</li>');
      continue;
    }

    para.push(esc(line));
  }

  flush();
  close();

  return out.join('\n').replace(/\u0000F(\d+)\u0000/g, (_m, i: string) => fences[Number(i)]!);
}
