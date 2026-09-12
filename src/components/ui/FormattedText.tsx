import React from 'react';

const BOLD_PATTERN = /\*\*(.+?)\*\*/g;
const HEADING_PATTERN = /^(#{1,6})\s+(.*)$/;

function parseInline(line: string, lineKey: number): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let segment = 0;

  BOLD_PATTERN.lastIndex = 0;
  while ((match = BOLD_PATTERN.exec(line)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(line.slice(lastIndex, match.index));
    }
    nodes.push(
      <strong key={`${lineKey}-b-${segment++}`}>{match[1]}</strong>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < line.length) {
    nodes.push(line.slice(lastIndex));
  }

  return nodes;
}

function parseLine(line: string, lineKey: number): React.ReactNode[] {
  const heading = HEADING_PATTERN.exec(line);
  if (heading) {
    return [
      <strong key={`${lineKey}-h`} className="fmt-heading">
        {parseInline(heading[2], lineKey)}
      </strong>,
    ];
  }
  return parseInline(line, lineKey);
}

interface FormattedTextProps {
  text: string;
  className?: string;
}

/** Renders lightweight markdown: **bold**, ATX headings, and newlines. */
export default function FormattedText({ text, className }: FormattedTextProps) {
  const lines = text.split('\n');

  return (
    <span className={className}>
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          {i > 0 && <br />}
          {parseLine(line, i)}
        </React.Fragment>
      ))}
    </span>
  );
}
