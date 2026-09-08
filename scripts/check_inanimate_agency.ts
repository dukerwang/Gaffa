import fs from 'fs';
import path from 'path';

/**
 * Automated regression check: bans inanimate objects taking active verbs in user-facing copy.
 *
 * Rules:
 * 1. Keys/tools must not be the subject of verbs ('Enter opens', 'Escape closes', 'Ctrl+C quits').
 * 2. Ban both 'allows you to' and 'lets you'.
 * 3. Ban pseudo-passive status tags like 'if it holds'.
 * 4. Ban UI components as active verbs in JSX text (e.g. 'this modal lets', 'the button submits').
 */

interface Violation {
  file: string;
  line: number;
  pattern: string;
  matched: string;
  text: string;
}

const CHECKS = [
  {
    name: 'Key or tool as active subject',
    regex: /\b(enter|esc|escape|ctrl\+c|backspace)\s+(opens?|closes?|returns?|quits?|submits?|triggers?)\b/i,
  },
  {
    name: 'Enabler phrasing ("allows you to" / "lets you")',
    regex: /\b(allows?|lets?|enables?)\s+(you|users?|managers?)\s+to\b/i,
  },
  {
    name: 'Pseudo-passive "if it holds"',
    regex: /\bif\s+it\s+holds\b/i,
  },
  {
    name: 'Inanimate UI element as active agent in text',
    regex: />[^<]*\b(this|the)\s+(button|modal|dialog|card|tab|drawer)\s+(shows?|displays?|opens?|closes?|lets?|allows?|invites?|submits?)\b/i,
  },
];

function scanDirectory(dir: string, violations: Violation[]) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.next', '.git'].includes(entry.name)) {
        scanDirectory(fullPath, violations);
      }
    } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('import ') || line.startsWith('export type ') || line.startsWith('// eslint')) {
          continue;
        }

        for (const check of CHECKS) {
          const match = check.regex.exec(line);
          if (match) {
            violations.push({
              file: path.relative(process.cwd(), fullPath),
              line: i + 1,
              pattern: check.name,
              matched: match[0],
              text: line,
            });
          }
        }
      }
    }
  }
}

const targets = [
  path.join(process.cwd(), 'src', 'components'),
  path.join(process.cwd(), 'src', 'app'),
  path.join(process.cwd(), 'src', 'lib', 'auction'),
  path.join(process.cwd(), 'src', 'lib', 'home'),
];

const violations: Violation[] = [];
for (const target of targets) {
  if (fs.existsSync(target)) {
    scanDirectory(target, violations);
  }
}

if (violations.length > 0) {
  console.error('\nFound ' + violations.length + ' inanimate agency copy violation(s):\n');
  for (const v of violations) {
    console.error('  ' + v.file + ':' + v.line + ' [' + v.pattern + ']');
    console.error('    Matched: "' + v.matched + '"');
    console.error('    Source:  ' + v.text + '\n');
  }
  process.exit(1);
} else {
  console.log('✓ No inanimate agency violations detected in target UI/app directories.');
  process.exit(0);
}
