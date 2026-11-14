import { Inter, Playfair_Display } from 'next/font/google';
import styles from './futbolpediaBrand.module.css';

/**
 * Futbolpedia's own type, for its panel and links inside Gaffa: Playfair Display for display and
 * Inter for text, as on futbolpedia.ai.studio. Loaded only where Futbolpedia appears.
 */
export const fpSerif = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-fp-serif',
});

export const fpSans = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-fp-sans',
});

/** Class names that make the Futbolpedia fonts available to a subtree. */
export const fpFontVars = `${fpSerif.variable} ${fpSans.variable}`;

/** Futbolpedia's crest: an italic serif F in a ring. */
export function FutbolpediaMark({ size = 20 }: { size?: number }) {
  return (
    <span
      className={`${fpSerif.variable} ${styles.mark}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.62) }}
      aria-hidden="true"
    >
      F
    </span>
  );
}
