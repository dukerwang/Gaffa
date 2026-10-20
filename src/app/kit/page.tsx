import type { Metadata } from 'next';
import KitClient from './KitClient';

export const metadata: Metadata = {
  title: 'Gaffa Kit',
  description: 'The component library behind Gaffa.',
  robots: { index: false, follow: false },
};

/**
 * The living reference for src/components/ui. Public (see src/proxy.ts) so a
 * branch preview can be reviewed without signing in; it reads no data.
 */
export default function KitPage() {
  return <KitClient />;
}
