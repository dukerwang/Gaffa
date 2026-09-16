'use client';

import CutoutPortrait from '@/components/players/CutoutPortrait';
import styles from './dashboard.module.css';

/** The cut-out on a Top Rated tile, in this page's frame. */
export default function RatedPortrait({
  photoUrl,
  photoVersion,
  name,
}: {
  photoUrl: string | null;
  photoVersion: string | null;
  name: string;
}) {
  return (
    <CutoutPortrait
      photoUrl={photoUrl}
      photoVersion={photoVersion}
      name={name}
      className={styles.face}
      fallbackClassName={styles.faceFallback}
    />
  );
}
