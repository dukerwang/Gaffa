import type { ReactNode } from 'react';
import NavigationLink from '@/components/ui/NavigationLink';
import Trophy from '@/components/trophies/Trophy';
import type { ShelfItem } from '@/lib/cups/cupsView';
import s from './cups.module.css';

/**
 * The page's anchor: the three trophies on the topbar's green, each one the
 * switch for its cup and carrying your status in it. `children` is the Next
 * Tie card, which rides the shelf's edge on a phone and sits beside the
 * trophies on a desktop.
 */
export function TrophyShelf({
  items,
  club,
  season,
  children,
}: {
  items: ShelfItem[];
  club: { primary: string; secondary: string } | null;
  season: string | null;
  children?: ReactNode;
}) {
  return (
    <>
      <section className={s.shelf} aria-labelledby="cups-title">
        <div className={s.shelfGrid}>
          <div>
            <h1 id="cups-title" className={s.shelfH}>Cups</h1>
            <nav className={s.cab} aria-label="Cups">
              {items.map((it) => {
                const inner = (
                  <>
                    <span className={s.tro}>
                      <Trophy kind={it.kind} size="hero" height={96} season={season} club={club} />
                    </span>
                    <span className={s.cabName}>{it.short}</span>
                    <span className={s.cabStatus}>{it.status}</span>
                  </>
                );
                return it.href ? (
                  <NavigationLink
                    key={it.type}
                    href={it.href}
                    scroll={false}
                    className={`${s.cabItem}${it.selected ? ` ${s.on}` : ''}`}
                    aria-current={it.selected ? 'page' : undefined}
                    aria-label={`${it.name}: ${it.status}`}
                  >
                    {inner}
                  </NavigationLink>
                ) : (
                  <span key={it.type} className={s.cabItem} aria-label={`${it.name}: ${it.status}`}>{inner}</span>
                );
              })}
            </nav>
          </div>
          {children && <div className={s.nextSlot}>{children}</div>}
        </div>
      </section>
      {children && <div className={s.afterShelf} />}
    </>
  );
}
