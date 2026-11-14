import React from 'react';
import styles from './FutbolpediaProse.module.css';

/**
 * Futbolpedia's replies are Markdown: paragraphs, bullet and numbered lists, **bold**, *italic*,
 * headings and the odd table. Gaffa's FormattedText covers only bold and headings, so the panel
 * renders them here. Text only: no raw HTML is ever interpreted.
 */

const INLINE = /(\*\*[^*\n]+\*\*|\*[^*\s][^*\n]*?\*|_[^_\s][^_\n]*?_)/g;

function inline(text: string, key: string): React.ReactNode[] {
  return text
    .split(INLINE)
    .filter((part) => part !== '')
    .map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return <strong key={`${key}-${i}`}>{inline(part.slice(2, -2), `${key}-${i}`)}</strong>;
      }
      if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
        if (part.length > 2) return <em key={`${key}-${i}`}>{part.slice(1, -1)}</em>;
      }
      return <React.Fragment key={`${key}-${i}`}>{part}</React.Fragment>;
    });
}

type Block =
  | { kind: 'p'; lines: string[] }
  | { kind: 'h'; text: string }
  | { kind: 'ul' | 'ol'; items: string[] }
  | { kind: 'table'; rows: string[][] };

const BULLET = /^\s*[*\-•]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_RULE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const push = (b: Block) => blocks.push(b);
  const last = () => blocks[blocks.length - 1];
  let gap = true;
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      gap = true;
      continue;
    }
    const heading = HEADING.exec(line);
    const bullet = BULLET.exec(line);
    const numbered = NUMBERED.exec(line);
    if (heading) {
      push({ kind: 'h', text: heading[1] });
    } else if (TABLE_ROW.test(line)) {
      if (TABLE_RULE.test(line)) continue;
      const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const prev = last();
      if (prev?.kind === 'table' && !gap) prev.rows.push(cells);
      else push({ kind: 'table', rows: [cells] });
    } else if (bullet || numbered) {
      const kind = bullet ? 'ul' : 'ol';
      const item = (bullet ?? numbered)![1];
      const prev = last();
      if (prev?.kind === kind) prev.items.push(item);
      else push({ kind, items: [item] });
    } else {
      const prev = last();
      if (prev?.kind === 'p' && !gap) prev.lines.push(line);
      else push({ kind: 'p', lines: [line] });
    }
    gap = false;
  }
  return blocks;
}

export default function FutbolpediaProse({ text }: { text: string }) {
  return (
    <div className={styles.prose}>
      {parseBlocks(text).map((b, i) => {
        const key = `b${i}`;
        switch (b.kind) {
          case 'h':
            return (
              <p key={key} className={styles.heading}>
                {inline(b.text, key)}
              </p>
            );
          case 'ul':
          case 'ol': {
            const List = b.kind;
            return (
              <List key={key} className={styles.list}>
                {b.items.map((item, j) => (
                  <li key={j}>{inline(item, `${key}-${j}`)}</li>
                ))}
              </List>
            );
          }
          case 'table':
            return (
              <div key={key} className={styles.tableWrap}>
                <table className={styles.table}>
                  <tbody>
                    {b.rows.map((row, r) => (
                      <tr key={r}>
                        {row.map((cell, c) =>
                          r === 0 ? (
                            <th key={c}>{inline(cell, `${key}-${r}-${c}`)}</th>
                          ) : (
                            <td key={c}>{inline(cell, `${key}-${r}-${c}`)}</td>
                          ),
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return (
              <p key={key} className={styles.paragraph}>
                {b.lines.map((line, j) => (
                  <React.Fragment key={j}>
                    {j > 0 && <br />}
                    {inline(line, `${key}-${j}`)}
                  </React.Fragment>
                ))}
              </p>
            );
        }
      })}
    </div>
  );
}
