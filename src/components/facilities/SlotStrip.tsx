import type { FacilityView } from '@/lib/facilities/facilities';
import styles from './facilities.module.css';

type Cell = { kind: 'used' | 'open' | 'next' | 'later' | 'new'; price?: string };

/**
 * One facility's slots: in use, owned, and the ones still to buy with their
 * prices. `preview` draws the strip as it will look once `next` is bought.
 * `showPrices` is off on a rival's club, where the unbuilt slots are shown but
 * what they would cost is not that manager's decision.
 */
export default function SlotStrip({
  facility,
  preview = false,
  showPrices = true,
}: {
  facility: FacilityView;
  preview?: boolean;
  showPrices?: boolean;
}) {
  const cells: Cell[] = [];
  for (let i = 0; i < facility.slots; i++) {
    cells.push({ kind: i < facility.used ? 'used' : 'open' });
  }
  if (facility.next) {
    cells.push(
      preview
        ? { kind: 'new', price: 'New' }
        : { kind: 'next', price: showPrices ? `€${facility.next.price}m` : undefined },
    );
  }
  for (const step of facility.later) {
    cells.push({ kind: 'later', price: showPrices ? `€${step.price}m` : undefined });
  }

  const owned = facility.slots + (preview && facility.next ? 1 : 0);

  const barClass: Record<Cell['kind'], string> = {
    used: styles.barUsed,
    open: '',
    next: styles.barNext,
    later: styles.barLater,
    new: styles.barNew,
  };
  const priceClass: Record<Cell['kind'], string> = {
    used: '',
    open: '',
    next: '',
    later: styles.priceLater,
    new: styles.priceNew,
  };

  return (
    <div className={styles.strip} aria-label={`${facility.used} of ${owned} ${facility.name} slots in use`}>
      <div className={styles.count}>
        {facility.used}
        <span className={styles.countOf}> / {owned}</span>
      </div>
      <div className={styles.cells} aria-hidden>
        {cells.map((c, i) => (
          <div key={i} className={styles.cell}>
            <div className={`${styles.bar} ${barClass[c.kind]}`} />
            <div className={`${styles.price} ${priceClass[c.kind]}`}>{c.price ?? ''}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
