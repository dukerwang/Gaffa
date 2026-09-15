'use client';

import { useEffect, useRef, useState } from 'react';
import { portraitInitials, portraitSources } from '@/lib/players/photo';
import styles from './dashboard.module.css';

/**
 * The cut-out on a Top Rated tile. Tries the square source, then the fallback,
 * then shows initials: about a quarter of the pool has no square cut-out, and
 * a missing one arrives as a 403 rather than a placeholder.
 */
export default function RatedPortrait({
  photoUrl,
  photoVersion,
  name,
}: {
  photoUrl: string | null;
  photoVersion: string | null;
  name: string;
}) {
  const sources = portraitSources(photoUrl, photoVersion);
  const key = sources[0] ?? '';
  const [tried, setTried] = useState<{ key: string; n: number }>({ key, n: 0 });
  const n = tried.key === key ? tried.n : 0;
  const src = sources[n];
  const imgRef = useRef<HTMLImageElement>(null);

  // The markup is server-rendered, so a 403 can fire before React attaches
  // onError. A finished image with no width is that missed failure.
  useEffect(() => {
    const img = imgRef.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- advancing past a source that failed before hydration
    if (img && img.complete && img.naturalWidth === 0) setTried({ key, n: n + 1 });
  }, [key, n, src]);

  if (!src) {
    return <span className={styles.faceFallback} aria-hidden="true">{portraitInitials(name)}</span>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={src}
      ref={imgRef}
      src={src}
      alt=""
      className={styles.face}
      loading="lazy"
      decoding="async"
      onError={() => setTried({ key, n: n + 1 })}
      onLoad={(e) => {
        if (e.currentTarget.naturalWidth === 0) setTried({ key, n: n + 1 });
      }}
    />
  );
}
