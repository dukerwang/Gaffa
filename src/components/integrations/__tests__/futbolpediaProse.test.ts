import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import FutbolpediaProse from '../FutbolpediaProse';

describe('FutbolpediaProse', () => {
  it('renders Futbolpedia’s lists, bold, italics and tables, and skips raw HTML', () => {
    const html = renderToStaticMarkup(
      createElement(FutbolpediaProse, {
        text: [
          '* **RB: Timber** (Arsenal)',
          '',
          '1. DEF: Muharemović',
          '',
          '*(Note: keep him on the reserves.)*',
          '',
          '| Slot | Player |',
          '| --- | --- |',
          '| RW | Saka |',
          '',
          '<script>alert(1)</script>',
        ].join('\n'),
      }),
    );
    expect(html).toContain('<ul>');
    expect(html).toContain('<strong>RB: Timber</strong>');
    expect(html).toContain('<ol>');
    expect(html).toContain('<em>(Note: keep him on the reserves.)</em>');
    expect(html).toContain('<td>Saka</td>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('*');
  });
});
