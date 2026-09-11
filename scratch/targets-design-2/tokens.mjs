/* Lifted verbatim from src/app/globals.css — :root and [data-theme="dark"].
   Not rounded, not re-derived. `.dark` here stands in for the attribute so an
   artboard can carry both palettes and switch with one class. */
export const TOKENS = `
:root {
  --color-bg-primary:#F8F4EC; --color-bg-secondary:#EBE8E2; --color-bg-card:#FCFAF7;
  --color-bg-card-hover:#EEEBE5; --color-bg-card-alt:#F9F6F1; --color-bg-elevated:#EBE8E2;
  --color-bg-inset:#E2DFDA;
  --color-border:#C2BDB5; --color-border-subtle:#D9D5CF; --color-border-strong:#8C857A;
  --color-border-accent:rgba(12,109,62,0.40);
  --color-text-primary:#1B1915; --color-text-secondary:#49443B; --color-text-muted:#635D51;
  --color-topbar:#185B37;
  --color-accent:#0C6D3E; --color-accent-hover:#134F2E; --color-accent-dim:rgba(12,109,62,0.10);
  --color-accent-ink:#1F7144; --color-on-accent:#FFFFFF;
  --color-warning:#F0A726; --color-warning-text:#875A04; --color-gold:#805D00;
  --color-live:#B23731; --color-tint-accent:#E2EDE5;
  --color-pos-gk:#926500;  --color-pos-gk-on:#FFFFFF;  --color-pos-gk-line:#926500;
  --color-pos-cb:#0076B2;  --color-pos-cb-on:#FFFFFF;  --color-pos-cb-line:#0076B2;
  --color-pos-lb:#5667B9;  --color-pos-lb-on:#FFFFFF;  --color-pos-lb-line:#5667B9;
  --color-pos-rb:#5667B9;  --color-pos-rb-on:#FFFFFF;  --color-pos-rb-line:#5667B9;
  --color-pos-lwb:#008295; --color-pos-lwb-on:#FFFFFF; --color-pos-lwb-line:#008295;
  --color-pos-dm:#7B56B9;  --color-pos-dm-on:#FFFFFF;  --color-pos-dm-line:#7B56B9;
  --color-pos-cm:#915397;  --color-pos-cm-on:#FFFFFF;  --color-pos-cm-line:#915397;
  --color-pos-am:#A34E71;  --color-pos-am-on:#FFFFFF;  --color-pos-am-line:#A34E71;
  --color-pos-lw:#00866F;  --color-pos-lw-on:#FFFFFF;  --color-pos-lw-line:#00866F;
  --color-pos-rw:#00866F;  --color-pos-rw-on:#FFFFFF;  --color-pos-rw-line:#00866F;
  --color-pos-st:#AD4C42;  --color-pos-st-on:#FFFFFF;  --color-pos-st-line:#AD4C42;
  --s1:4px; --s2:8px; --s3:12px; --s4:16px; --s5:20px; --s6:24px; --s8:32px;
  --s10:40px; --s12:48px; --s16:64px;
  --t-10:10px; --t-11:11px; --t-12:12px; --t-13:13px; --t-15:15px; --t-17:17px;
  --t-20:20px; --t-25:25px; --t-32:32px; --t-40:40px;
  --r-shell:10px; --r-control:4px; --r-micro:2px; --r-round:50%; --r-pill:999px;
  --font-serif:'Newsreader',Georgia,'Times New Roman',serif;
  --font-sans:'Hanken Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  --font-mono:'JetBrains Mono','Fira Code',ui-monospace,monospace;
  --font-condensed:'Archivo Narrow','Arial Narrow',sans-serif;
}
.dark {
  --color-bg-primary:#1B1F29; --color-bg-secondary:#242934; --color-bg-card:#272D39;
  --color-bg-card-hover:#313743; --color-bg-card-alt:#202530; --color-bg-elevated:#313743;
  --color-bg-inset:#131720;
  --color-border:#3F4552; --color-border-subtle:#2D333E; --color-border-strong:#707787;
  --color-border-accent:rgba(40,165,100,0.35);
  --color-text-primary:#EBE7E1; --color-text-secondary:#B5B0A7; --color-text-muted:#989389;
  --color-accent:#28A564; --color-accent-hover:#43C07A; --color-accent-dim:rgba(40,165,100,0.14);
  --color-accent-ink:#26A865; --color-on-accent:#1B1915;
  --color-warning:#F0A726; --color-warning-text:#BC8A3F; --color-gold:#B38E3B;
  --color-live:#E67066; --color-tint-accent:#26382C;
  --color-pos-gk-line:#B18331;  --color-pos-cb-line:#4F8FCF;  --color-pos-lb-line:#638AD3;
  --color-pos-rb-line:#638AD3;  --color-pos-lwb-line:#2F98A6; --color-pos-dm-line:#937ECD;
  --color-pos-cm-line:#A679C3;  --color-pos-am-line:#C5709A;  --color-pos-lw-line:#2F9B85;
  --color-pos-rw-line:#2F9B85;  --color-pos-st-line:#CD7167;
}`;

export const FONTS =
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?' +
  'family=Newsreader:opsz,wght@6..72,400;6..72,600;6..72,700;6..72,800&' +
  'family=Hanken+Grotesk:wght@400;500;600;700&' +
  'family=Archivo+Narrow:wght@500;600;700&' +
  'family=JetBrains+Mono:wght@400;700&display=swap">';

export const POS = {
  GK:'gk', CB:'cb', LB:'lb', RB:'rb', LWB:'lwb', DM:'dm',
  CM:'cm', AM:'am', LW:'lw', RW:'rw', ST:'st',
};

/** Inline custom props for a position chip, so one CSS rule paints all twelve. */
export const posVars = (p) => {
  const k = POS[p];
  return `--pf:var(--color-pos-${k});--pi:var(--color-pos-${k}-on);--pl:var(--color-pos-${k}-line)`;
};
