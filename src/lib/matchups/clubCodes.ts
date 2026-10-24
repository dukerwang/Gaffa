const letters = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z]/g, '').toUpperCase();

/**
 * Three-letter codes for a league's clubs, the way a scoreline writes a club:
 * "Stamford & Sons" is STA, "yang fc" is YAN. For a place where the full name
 * would be cut off. Two clubs never share a code: the later one (by name)
 * takes the first letters of its words instead, then a digit as a last resort.
 */
export function clubCodes(teams: { id: string; name: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  const used = new Set<string>();
  const sorted = [...teams].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  for (const t of sorted) {
    const words = t.name.split(/[\s&]+/).map(letters).filter(Boolean);
    const all = words.join('');
    const pad = (c: string) => (c + 'XXX').slice(0, 3);
    const candidates = [
      all.slice(0, 3),
      words[0] ? (words[0].slice(0, 2) + words.slice(1).map((w) => w[0]).join('')).slice(0, 3) : '',
      words.map((w) => w[0]).join('').slice(0, 3),
    ].filter(Boolean).map(pad);
    if (!candidates.length) candidates.push('CLB');
    let code = candidates.find((c) => !used.has(c));
    for (let n = 2; !code; n++) {
      const c = `${candidates[0].slice(0, 2)}${n}`;
      if (!used.has(c)) code = c;
    }
    used.add(code);
    out[t.id] = code;
  }
  return out;
}
