import React from 'react';

// Small, dependency-free markdown renderer for chat messages — bold,
// italic, inline code, fenced code blocks, links, and lists. Deliberately
// not pulling in react-markdown's remark/rehype tree for what's a modest
// formatting need. Builds real React elements (never dangerouslySetInnerHTML),
// so all text content is auto-escaped by React — safe against HTML/script
// injection from a model response or a retrieved document chunk.

let keySeed = 0;
const nextKey = () => `md-${keySeed++}`;

function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Order matters: code spans first (so ** inside `code` isn't parsed as bold), then links, bold, italic.
  const tokenRe = /(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRe.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));

    const [full, code, link, bold, italic] = match;
    if (code) {
      nodes.push(<code key={nextKey()} className="chat-inline-code">{code.slice(1, -1)}</code>);
    } else if (link) {
      const linkMatch = /\[([^\]]+)\]\(([^)]+)\)/.exec(link);
      if (linkMatch) {
        nodes.push(
          <a key={nextKey()} href={linkMatch[2]} target="_blank" rel="noopener noreferrer">
            {linkMatch[1]}
          </a>,
        );
      }
    } else if (bold) {
      nodes.push(<strong key={nextKey()}>{bold.slice(2, -2)}</strong>);
    } else if (italic) {
      nodes.push(<em key={nextKey()}>{italic.slice(1, -1)}</em>);
    }
    lastIndex = match.index + full.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

interface Block {
  type: 'code' | 'ul' | 'ol' | 'p';
  content: string | string[];
  lang?: string;
}

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push({ type: 'code', content: codeLines.join('\n'), lang });
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ul', content: items });
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ol', content: items });
      continue;
    }

    if (line.trim() === '') {
      i++;
      continue;
    }

    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i]) && !lines[i].trim().startsWith('```')) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({ type: 'p', content: paraLines.join('\n') });
  }

  return blocks;
}

export function renderMarkdown(markdown: string): React.ReactNode {
  const blocks = parseBlocks(markdown || '');

  return (
    <>
      {blocks.map(block => {
        if (block.type === 'code') {
          return (
            <pre key={nextKey()} className="chat-code-block">
              <code>{block.content as string}</code>
            </pre>
          );
        }
        if (block.type === 'ul') {
          return (
            <ul key={nextKey()}>
              {(block.content as string[]).map(item => <li key={nextKey()}>{renderInline(item)}</li>)}
            </ul>
          );
        }
        if (block.type === 'ol') {
          return (
            <ol key={nextKey()}>
              {(block.content as string[]).map(item => <li key={nextKey()}>{renderInline(item)}</li>)}
            </ol>
          );
        }
        const text = block.content as string;
        const withBreaks = text.split('\n');
        return (
          <p key={nextKey()}>
            {withBreaks.map((ln, idx) => (
              <React.Fragment key={nextKey()}>
                {renderInline(ln)}
                {idx < withBreaks.length - 1 && <br />}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}
