/**
 * Builds scratch/gaffa-update-preview-2026-09-16.html: the announcement pop-up
 * and the /updates entry for the mid-September post, on the phone frame and
 * tokens from scratch/gaffa-update-preview.html.
 *
 * The body goes through react-markdown + remark-gfm, the renderer UpdatesView
 * uses, so tables, bold and lists come out the way the app draws them.
 *
 *   tsx scratch/build_update_preview_2026_09_16.tsx
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SLUG, TITLE, SUMMARY, HIGHLIGHTS, readBody } from './publish_update_2026_09_16';

const TEMPLATE = resolve(process.cwd(), 'scratch/gaffa-update-preview.html');
const OUT = resolve(process.cwd(), 'scratch/gaffa-update-preview-2026-09-16.html');

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const BELL =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.7 21a2 2 0 0 1-3.4 0"></path></svg>';

function sliceBetween(src: string, start: string, end: string): [number, number] {
  const a = src.indexOf(start);
  const b = src.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error(`template marker missing: ${start} … ${end}`);
  return [a, b];
}

function renderLog(): string {
  const html = renderToStaticMarkup(createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, readBody()));
  // One <section> per <h2>, matching the template's layout, with tables in a
  // scroll container so a wide one can't push the page sideways.
  const parts = html.split(/(?=<h2>)/).filter((p) => p.trim());
  return parts
    .map((p) => `<section>${p.replace(/<table>/g, '<div class="tableWrap"><table>').replace(/<\/table>/g, '</table></div>')}</section>`)
    .join('\n');
}

function main() {
  let html = readFileSync(TEMPLATE, 'utf8');
  const date = new Date('2026-09-16T12:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Page header
  html = html.replace('<h1>Deadline Day Update</h1>', '<h1>Mid-September Update</h1>');
  html = html.replace(/<title>[^<]*<\/title>/, '<title>Mid-September Update Preview</title>');

  // Pop-up, drawn to match UpdateAnnouncementModal: bell badge and title, the
  // summary, numbered highlights, and one "See what's new" button.
  // The pop-up as UpdateAnnouncementModal draws it since the full-notes change:
  // bell badge and title, the whole post in a scrolling body, then View All
  // Updates and Done.
  const modal = `
                <div class="modalTop" style="padding-bottom:12px;border-bottom:1px solid var(--g-border)">
                  <div style="display:flex;align-items:center;gap:10px">
                    <span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:var(--g-accent);color:#fff;flex-shrink:0"><span style="width:16px;height:16px;display:inline-flex">${BELL}</span></span>
                    <h2 id="modalTitle" style="margin:0">${esc(TITLE)}</h2>
                  </div>
                </div>
                <div class="log" style="max-height:430px;overflow-y:auto;padding:14px 18px 6px">
${renderLog()}
                </div>
                <div class="modalActions" style="border-top:1px solid var(--g-border);padding-top:12px">
                  <button class="btn btnGhost" type="button" data-view="log">View All Updates</button>
                  <button class="btn btnPrimary" type="button">Done</button>
                </div>
              `;
  const [mA, mB] = sliceBetween(html, '<div class="modalTop">', '</div>\n            </div>\n          </div>\n\n          <!-- ============ CHANGELOG');
  html = html.slice(0, mA) + modal.trim() + '\n              ' + html.slice(mB);

  // Changelog head
  html = html.replace(
    /<span class="dateline">What's New · [^<]*<\/span>\s*<h1>[^<]*<\/h1>\s*<p>[^<]*<\/p>/,
    `<span class="dateline">What's New · ${date}</span>\n                <h1>${esc(TITLE)}</h1>\n                <p>${esc(SUMMARY)}</p>`,
  );

  // Changelog body
  const [lA, lB] = sliceBetween(html, '<div class="log">', '</div>\n            </div>\n          </div>\n\n        </div>');
  html = html.slice(0, lA) + `<div class="log">\n${renderLog()}\n<div class="endMark"></div>\n              ` + html.slice(lB);

  // Side notes
  const [aA, aB] = sliceBetween(html, '<aside class="aside">', '</aside>');
  html =
    html.slice(0, aA) +
    `<aside class="aside">
      <div class="card">
        <h3>About This Preview</h3>
        <p>The <strong>pop-up</strong> opens once for every manager, the next time they load Gaffa after publishing. It's the same notification that lights the bell, so dismissing either clears both. It carries the full patch notes; scroll inside it to read the rest. <strong>View All Updates</strong> goes to <code>/updates</code>, where this post sits with every earlier one.</p>
        <p>The changelog body here is rendered with react-markdown and remark-gfm, the renderer the updates page uses.</p>
      </div>
      <div class="card">
        <h3>Release</h3>
        <div class="meta">
          <div class="metaRow"><span>Sections</span><span>${(readBody().match(/^## /gm) ?? []).length}</span></div>
          <div class="metaRow"><span>Words</span><span>${readBody().split(/\s+/).length}</span></div>
          <div class="metaRow"><span>Commits since last post</span><span>94</span></div>
          <div class="metaRow"><span>Notifications</span><span>One per account</span></div>
        </div>
      </div>
    ` +
    html.slice(aB);

  writeFileSync(OUT, html);
  console.log(`[preview] wrote ${OUT}`);
}

main();
