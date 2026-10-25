import { Skeleton } from '@/components/ui/Skeleton';
import { Glyph } from './parts';
import gw from './gw.module.css';
import x from './skeletons.module.css';

/**
 * The page's stylesheet is imported here, not through `s` from ./parts: parts is
 * a client module, so a server-rendered loader gets a reference to `s` rather
 * than the class names, and every class comes out undefined (the unstyled pile
 * of shapes the old loaders showed).
 *
 * Loading states for the Gameweeks and Matchup pages. Each is the page's own
 * markup with its classes, its labels and its frames (the bar, the pitch, the
 * panels, the ruled rows), and a bone only where a name, a score or a face will
 * be. That keeps the shape the same at every width and nothing moves when the
 * data lands. Left out because they only show in some states: Round Records,
 * Head-to-Head, and the Still to Play list.
 */

const pb = x.pb;

function Bar() {
  return (
    <nav className={gw.gwb} aria-hidden="true">
      <span className={`${gw.gwbName} ${gw.dOnly}`}>Gameweeks</span>
      <span className={`${gw.gwbStep} ${gw.dOnly}`}>
        <Skeleton width={36} height={36} />
        <span style={{ padding: '0 8px' }}><Skeleton width={128} height={24} /></span>
        <Skeleton width={36} height={36} />
      </span>
      <span className={`${gw.gwbStepM} ${gw.mOnly}`}>
        <span style={{ justifySelf: 'center' }}><Skeleton width={32} height={32} /></span>
        <span className={gw.gwSelM}>
          <Skeleton width={124} height={20} />
          <span style={{ marginTop: 5 }}><Skeleton width={150} height={12} /></span>
        </span>
        <span style={{ justifySelf: 'center' }}><Skeleton width={32} height={32} /></span>
      </span>
      <div className={gw.rib}>
        <span className={`${gw.ribK} ${gw.dOnly}`}>
          <Skeleton width={92} height={15} />
          <Skeleton width={66} height={12} />
        </span>
        <div className={gw.ribCells}>
          {Array.from({ length: 38 }, (_, i) => (
            <span key={i} className={gw.rc}>
              <span className={gw.rcAx}><i className={`${gw.rcBar} ${gw.rcF}`} /></span>
              <span className={gw.rcN} />
            </span>
          ))}
        </div>
      </div>
    </nav>
  );
}

function MatchBar() {
  return (
    <nav className={`${gw.gwb} ${gw.gwbBar}`} aria-hidden="true">
      <span className={gw.mbBack}><Glyph k="left" size={18} />Gameweek<Skeleton width={22} height={18} /></span>
      <div className={gw.mbTies}>
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={gw.tie}>
            <Skeleton shape="circle" width={20} height={20} />
            <Skeleton width={24} height={14} />
            <span className={gw.tieDash}>–</span>
            <Skeleton width={24} height={14} />
            <Skeleton shape="circle" width={20} height={20} />
          </span>
        ))}
      </div>
    </nav>
  );
}

/** The scoreboard on its pitch stripes: the crests, the two figures with the draw-band axis between, and each club's standouts. */
function Scoreboard({ big = false }: { big?: boolean }) {
  const side = (away: boolean) => (
    <div className={`${gw.hxSide}${away ? ` ${gw.hxAway}` : ''}`}>
      <span className={gw.dOnly}><Skeleton shape="circle" className={pb} width={big ? 68 : 56} height={big ? 68 : 56} /></span>
      <span className={gw.mOnly}><Skeleton shape="circle" className={pb} width={40} height={40} /></span>
      <div className={gw.hxTx}>
        <Skeleton className={`${pb} ${x.fit}`} width={big ? 200 : 180} height={big ? 30 : 28} />
        <Skeleton className={`${pb} ${x.fit}`} width={150} height={13} />
        {big && <span className={gw.dOnly}><Skeleton className={pb} width={130} height={13} /></span>}
      </div>
      <span className={gw.hxRowV}><Skeleton className={pb} width={46} height={34} /></span>
    </div>
  );
  const standout = (i: number) => (
    <div key={i} className={`${gw.so}${i === 2 ? ` ${gw.dOnly}` : ''}`}>
      <Skeleton shape="circle" className={pb} width={34} height={34} />
      <span className={gw.soTx}>
        <Skeleton className={pb} width={58} height={12} />
        <Skeleton className={pb} width={26} height={14} />
      </span>
    </div>
  );
  return (
    <article className={`${gw.hx}${big ? ` ${gw.sbBig}` : ''}`}>
      <div className={gw.hxTop}>
        {big ? <Skeleton className={pb} width={170} height={14} /> : <span>Your Fixture</span>}
        <span className={gw.hxTopR}><Skeleton className={pb} width={52} height={14} /></span>
      </div>
      <div className={gw.hxMain}>
        {side(false)}
        <div className={gw.hxMidWrap}>
          <div className={gw.hxMid}>
            <div className={gw.hxFigs}>
              <Skeleton className={pb} width={big ? 76 : 70} height={big ? 60 : 56} />
              <span className={gw.hxSep} />
              <Skeleton className={pb} width={big ? 76 : 70} height={big ? 60 : 56} />
            </div>
            <div className={gw.hxAxis}><i className={gw.hxTick} /></div>
            <span className={gw.hxVerdict}><Skeleton className={pb} width={150} height={16} /></span>
            <div className={gw.hxVerdictRow}><Skeleton className={pb} width={150} height={16} /></div>
          </div>
        </div>
        {side(true)}
      </div>
      <div className={gw.hxFoot}>
        <div className={`${gw.hxFootD} ${gw.dOnly}`}>
          <div className={gw.hxFootS}>{[0, 1, 2].map(standout)}</div>
          <div className={gw.hxFootS}>{[0, 1, 2].map(standout)}</div>
        </div>
        <div className={`${gw.mOnly}`}>
          <div className={gw.hxFootS}>{[0, 1, 2].map(standout)}</div>
        </div>
      </div>
    </article>
  );
}

function Head({ title }: { title: string }) {
  return <div className={gw.sh}><h2 className={gw.shT}>{title}</h2></div>;
}

function Fixtures() {
  const ruler = (
    <div className={gw.fsRuler}>
      {[0, 1, 2, 3].map((i) => <span key={i}><Skeleton className={x.mid} width={44} height={11} /></span>)}
    </div>
  );
  const side = (away: boolean) => (
    <div className={`${gw.fsSide}${away ? ` ${gw.fsAway}` : ''}`}>
      <span className={gw.dOnly}><Skeleton shape="circle" width={34} height={34} /></span>
      <span className={gw.mOnly}><Skeleton shape="circle" width={28} height={28} /></span>
      <span className={gw.fsTx}>
        <Skeleton className={x.fit} width={away ? 130 : 150} height={17} />
        <Skeleton className={x.fit} width={96} height={12} />
      </span>
      <Skeleton width={36} height={26} />
    </div>
  );
  return (
    <section className={gw.blk}>
      <Head title="Fixtures" />
      <div className={gw.panel}>
        <div className={gw.fsHead}><span className={gw.lbl}>Home</span><div>{ruler}</div><span className={gw.lbl} style={{ textAlign: 'right' }}>Away</span></div>
        <div className={gw.fsRulerM}>{ruler}</div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className={gw.fs}>
            {side(false)}
            <div className={gw.fsWorm}>
              <div className={x.axis}><Skeleton height={2} /></div>
              <span className={gw.fsVerdict}><Skeleton width={110} height={13} /></span>
            </div>
            {side(true)}
          </div>
        ))}
      </div>
    </section>
  );
}

function TopPerformers() {
  return (
    <section className={gw.blk}>
      <Head title="Top Performers" />
      <div className={gw.panel}>
        <div className={gw.spChart}>
          <div className={x.chart}>
            {[0, 10, 20, 30, 40].map((v) => (
              <span key={v} className={x.tick} style={{ left: `calc(14px + (100% - 28px) * ${v / 45})` }}><i /><b>{v}</b></span>
            ))}
          </div>
        </div>
        <div className={gw.spList}>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className={gw.spRow}>
              <span className={gw.spRank}>{n}</span>
              <Skeleton shape="circle" width={44} height={44} />
              <span className={gw.spTx}>
                <Skeleton className={x.fit} width={120} height={16} />
                <Skeleton className={x.fit} width={84} height={12} />
              </span>
              <Skeleton width={32} height={20} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Standings() {
  return (
    <section className={gw.blk}>
      <Head title="Standings" />
      <div className={gw.panel}>
        <div className={`${gw.tbH} ${gw.lbl}`}><span>#</span><span /><span /><span>Club</span><span>GW</span><span>W-D-L</span><span>Pts</span></div>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className={gw.tbR}>
            <Skeleton width={12} height={15} />
            <span />
            <Skeleton shape="circle" width={18} height={18} />
            <Skeleton width="62%" height={14} />
            <Skeleton width={22} height={22} />
            <Skeleton width={38} height={13} />
            <Skeleton width={20} height={16} />
          </div>
        ))}
        <div className={gw.stFoot}><span>Arrows show movement this round</span><span className={gw.quiet}>Full Table</span></div>
      </div>
    </section>
  );
}

export function RoundSkeleton() {
  return (
    <div className={`${gw.root} g-page`} aria-busy="true" aria-label="Loading Gameweeks">
      <Bar />
      <div className={gw.hxWide}><Scoreboard /></div>
      <Fixtures />
      <div className={gw.stl}>
        <div className={gw.r2Grid}>
          <div><TopPerformers /></div>
          <div><Standings /></div>
        </div>
      </div>
    </div>
  );
}

// ── The matchup ──

function Momentum() {
  return (
    <section className={gw.blk}>
      <Head title="Momentum" />
      <div className={gw.panel}>
        <div className={gw.mmChart}>
          <div className={x.axis} style={{ '--h': '120px' } as React.CSSProperties}><Skeleton height={2} /></div>
        </div>
      </div>
    </section>
  );
}

function HalfPitch() {
  const row = (n: number, k: string, gk = false) => (
    <div key={k} className={`${x.gRow}${gk ? ` ${x.gGk}` : ''}`}>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={x.gCell}>
          <Skeleton shape="circle" className={pb} width={36} height={36} />
          <Skeleton className={pb} width={50} height={12} />
        </span>
      ))}
    </div>
  );
  return (
    <div className={gw.rp}>
      <div className={gw.rpField}>
        <i className={gw.phTop} /><i className={gw.phCircle} /><i className={gw.phBox} /><i className={gw.phGoal} />
        <div className={gw.rpRows}>{[row(3, 'fw'), row(3, 'mid'), row(4, 'def'), row(1, 'gk', true)]}</div>
      </div>
    </div>
  );
}

function Lineups() {
  return (
    <section className={gw.blk}>
      <Head title="Lineups" />
      <div className={gw.lsSwp}>
        <div className={gw.lsGrid}>
          {[0, 1].map((i) => (
            <div key={i} className={gw.lsCol}>
              <div className={gw.lsHead}>
                <Skeleton shape="circle" width={22} height={22} />
                <Skeleton className={x.fit} width={130} height={16} />
                <span className={gw.lsScore}><Skeleton width={44} height={22} /></span>
              </div>
              <HalfPitch />
              <div className={gw.bnSide}>
                <div className={gw.bnH}>
                  <span className={gw.bnT}>Bench</span>
                  <span className={gw.bnBonus}><Skeleton width={110} height={12} /></span>
                </div>
                <div className={gw.bnChips}>
                  {['DEF', 'MID', 'ATT', 'FLEX'].map((c) => (
                    <div key={c} className={gw.bnSlot}>
                      <Skeleton shape="circle" width={32} height={32} />
                      <Skeleton width={52} height={12} />
                      <span className={gw.bnCat}>{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LineTotals() {
  return (
    <section className={gw.blk}>
      <Head title="Line Totals" />
      <div className={gw.panel}>
        <div className={gw.ltH}>
          <span />
          <span className={gw.ltHc}><Skeleton shape="circle" width={16} height={16} /></span>
          <span />
          <span className={gw.ltHc}><Skeleton shape="circle" width={16} height={16} /></span>
          <span className={gw.lbl}>Edge</span>
        </div>
        {['Goalkeeper', 'Defence', 'Midfield', 'Attack', 'Bench Bonus', 'Total'].map((l) => (
          <div key={l} className={`${gw.ltR}${l === 'Total' ? ` ${gw.ltTot}` : ''}`}>
            <span className={gw.ltL}>{l}</span>
            <Skeleton width={30} height={16} />
            {l === 'Total' ? <span /> : <span className={gw.ltBar} />}
            <Skeleton width={30} height={16} />
            <span className={gw.ltD}><Skeleton width={34} height={14} /></span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Report() {
  return (
    <section className={gw.blk}>
      <Head title="Match Report" />
      <div className={gw.panel}>
        <div className={gw.mrBody}>
          <Skeleton width="88%" height={22} />
          <Skeleton shape="text" lines={3} />
          <div className={gw.mrCol}>
            <span className={gw.mrColH}>Star of the Match</span>
            <Skeleton shape="text" lines={2} />
          </div>
          <div className={gw.mrCol}>
            <span className={gw.mrColH}>Boardroom Notes</span>
            <Skeleton shape="text" lines={2} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Sheet() {
  const rows: [string, number][] = [['Goalkeeper', 1], ['Defence', 3], ['Midfield', 3], ['Attack', 3]];
  return (
    <div className={`${gw.panel} ${gw.shPanel}`}>
      <div className={gw.shHead}>
        <Skeleton shape="circle" width={24} height={24} />
        <Skeleton className={x.fit} width={140} height={18} />
        <span className={gw.shTot}><Skeleton width={46} height={24} /></span>
      </div>
      {rows.map(([line, n]) => (
        <div key={line} className={gw.shLine}>
          <div className={gw.shLH}><span>{line}</span><Skeleton width={28} height={15} /></div>
          {Array.from({ length: n }, (_, i) => (
            <div key={i} className={gw.shE}>
              <div className={gw.shRow}>
                <Skeleton width={30} height={18} />
                <Skeleton shape="circle" width={32} height={32} />
                <span className={gw.shTx}>
                  <Skeleton className={x.fit} width={112} height={15} />
                  <Skeleton className={x.fit} width={150} height={12} />
                </span>
                <span />
                <Skeleton width={30} height={17} />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function TeamSheets() {
  return (
    <section className={gw.blk}>
      <Head title="Team Sheets" />
      <div className={gw.swp}>
        <div className={gw.swpTrack}>
          {[0, 1].map((i) => <div key={i} className={gw.swpCard}><Sheet /></div>)}
        </div>
      </div>
    </section>
  );
}

export function MatchSkeleton() {
  return (
    <div className={`${gw.root} g-page`} aria-busy="true" aria-label="Loading Matchup">
      <MatchBar />
      <Scoreboard big />
      <div className={gw.stl}><Momentum /></div>
      <div className={gw.stl}><Lineups /></div>
      <div className={gw.stl}>
        <div className={gw.story2}>
          <div><LineTotals /></div>
          <div><Report /></div>
        </div>
      </div>
      <div className={gw.stl}><TeamSheets /></div>
    </div>
  );
}
