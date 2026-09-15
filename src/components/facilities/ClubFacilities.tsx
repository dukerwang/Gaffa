'use client';

import { useState } from 'react';
import type { FacilityKey, FacilityView } from '@/lib/facilities/facilities';
import SlotStrip from './SlotStrip';
import FacilityPurchaseSheet from './FacilityPurchaseSheet';
import styles from './facilities.module.css';

const CAPTIONS: Record<FacilityKey, string> = {
  academy: 'Under-21 players held off the Active Roster',
  ir: 'Injured players held off the Active Roster',
  loans_out: 'Players out on loan at the same time',
};

/**
 * Club Facilities on the club page. Sits directly under the masthead on every
 * club rather than at the foot of the page: buying capacity is one of the
 * main things Club Balance is for, and Duke asked that it not be buried
 * (docs/DECISIONS.md, 2026-09-15). On a rival's club it is read-only.
 */
export default function ClubFacilities({
  leagueId,
  facilities,
  balance,
  viewerIsOwner,
  onPurchased,
}: {
  leagueId: string;
  facilities: FacilityView[];
  balance: number;
  viewerIsOwner: boolean;
  onPurchased?: () => void;
}) {
  const [buying, setBuying] = useState<FacilityView | null>(null);

  return (
    <section id="facilities" className={`${styles.section} g-panel`}>
      <div className={styles.head}>
        <h2 className={styles.title}>Club Facilities</h2>
        {viewerIsOwner && (
          <div className={styles.balance}>
            Club Balance <b>€{balance}m</b>
          </div>
        )}
      </div>

      {facilities.map((f) => (
        <div key={f.key} className={`${styles.row} ${viewerIsOwner ? '' : styles.rowRival}`}>
          <div>
            <h3 className={styles.name}>{f.name}</h3>
            <p className={styles.caption}>{CAPTIONS[f.key]}</p>
          </div>
          <SlotStrip facility={f} showPrices={viewerIsOwner} />
          <div className={styles.act}>
            <FacilityAction facility={f} balance={balance} viewerIsOwner={viewerIsOwner} onBuy={() => setBuying(f)} />
          </div>
        </div>
      ))}

      {viewerIsOwner && (
        <p className={styles.foot}>
          Upgrades are permanent and stay with your club every season. You can&rsquo;t sell them back.
        </p>
      )}

      {viewerIsOwner && (
        <FacilityPurchaseSheet
          leagueId={leagueId}
          facility={buying}
          balance={balance}
          onClose={() => setBuying(null)}
          onPurchased={onPurchased}
        />
      )}
    </section>
  );
}

function FacilityAction({
  facility,
  balance,
  viewerIsOwner,
  onBuy,
}: {
  facility: FacilityView;
  balance: number;
  viewerIsOwner: boolean;
  onBuy: () => void;
}) {
  if (!facility.next) {
    return (
      <div className={styles.fig}>
        <div className={styles.built}>Fully Built</div>
        {viewerIsOwner && <div className={styles.figKey} style={{ marginTop: 4 }}>{facility.slots} slots</div>}
      </div>
    );
  }
  if (!viewerIsOwner) return null;

  const { price, slots } = facility.next;
  if (balance < price) {
    return (
      <div className={styles.fig}>
        <div className={styles.figValue}>€{price - balance}m short</div>
        <div className={styles.figKey}>Club Balance €{balance}m</div>
      </div>
    );
  }
  return (
    <button type="button" className={styles.buy} onClick={onBuy}>
      Expand to {slots} Slots · €{price}m
    </button>
  );
}
