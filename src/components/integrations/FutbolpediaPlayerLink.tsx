'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import {
  futbolpediaCardUrl,
  futbolpediaScoutUrl,
  lookUpFutbolpediaCards,
  type FutbolpediaCard,
} from '@/lib/integrations/futbolpediaLinks';
import { FutbolpediaMark, fpFontVars } from './futbolpediaBrand';
import styles from './FutbolpediaPlayerLink.module.css';

/**
 * Where to read further about a player on Futbolpedia, a separate app: his dossier card when
 * Futbolpedia has one, otherwise Scout with his name filled in. No rating is shown here.
 * `names` are tried in order (his full name, then the name he's known by).
 */
export default function FutbolpediaPlayerLink({ names }: { names: string[] }) {
  const key = names.filter(Boolean).join('|');
  const [found, setFound] = useState<{ key: string; card: FutbolpediaCard | null } | null>(null);

  useEffect(() => {
    let active = true;
    const wanted = key.split('|').filter(Boolean);
    if (wanted.length === 0) return;
    void lookUpFutbolpediaCards(wanted).then((cards) => {
      if (!active) return;
      const card = wanted.map((n) => cards[n]).find(Boolean) ?? null;
      setFound({ key, card });
    });
    return () => {
      active = false;
    };
  }, [key]);

  // Nothing until the lookup answers, so the link never flips from Scout to Read.
  if (!found || found.key !== key) return null;
  const { card } = found;
  const name = key.split('|').find(Boolean) ?? '';

  return (
    <a
      className={`${fpFontVars} ${styles.link}`}
      href={card ? futbolpediaCardUrl(card.slug) : futbolpediaScoutUrl(name)}
      target="_blank"
      rel="noopener noreferrer"
    >
      <FutbolpediaMark size={18} />
      <span className={styles.text}>
        <span className={styles.action}>{card ? 'Read on Futbolpedia' : 'Scout on Futbolpedia'}</span>
        <span className={styles.meta}>{card ? card.label : 'No dossier yet'}</span>
      </span>
      <Icon name="external-link" size={13} strokeWidth={2} />
    </a>
  );
}
