import styles from './futbolpediaBrand.module.css';

/**
 * Futbolpedia's crest: an italic serif F in a ring. It loads no fonts of its own (it sits in the
 * chat channel list on every dashboard page): inside the panel it picks up Playfair Display
 * from `futbolpediaFonts`, elsewhere Gaffa's serif.
 */
export function FutbolpediaMark({ size = 20 }: { size?: number }) {
  return (
    <span
      className={styles.mark}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.62) }}
      aria-hidden="true"
    >
      F
    </span>
  );
}
