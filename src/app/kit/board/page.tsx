import type { Metadata } from 'next';
import BoardPrototype from './BoardPrototype';

export const metadata: Metadata = {
  title: 'The Board (prototype)',
  robots: { index: false, follow: false },
};

/**
 * A prototype of the Transfers Board, built from the Gaffa Kit and the app's
 * own tokens, with invented data. Public (see src/proxy.ts) so a branch preview
 * can be reviewed without signing in; it reads no data and calls no route.
 */
export default function BoardPrototypePage() {
  return <BoardPrototype />;
}
