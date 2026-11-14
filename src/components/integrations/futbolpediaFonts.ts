import { Inter, Playfair_Display } from 'next/font/google';

/**
 * Futbolpedia's own type, for its panel and links inside Gaffa: Playfair Display for display and
 * Inter for text, as on futbolpedia.ai.studio. Imported only by those two components, so the
 * fonts load only where Futbolpedia's content appears, not on every dashboard page.
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
