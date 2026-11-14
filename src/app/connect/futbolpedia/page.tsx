import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/supabase/sessionUser';
import {
  isAllowedReturnOrigin,
  isValidCodeChallenge,
  isValidState,
} from '@/lib/integrations/futbolpediaGrant';
import ConnectClient from './ConnectClient';
import styles from './connect.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Futbolpedia Access · Gaffa',
  robots: { index: false },
};

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Connect with Gaffa: Futbolpedia opens this page in a popup. A signed-in
 * manager approves read-only access and the page hands Futbolpedia a one-time
 * code. The proxy sends a signed-out visitor to /login and back here.
 */
export default async function ConnectFutbolpediaPage({ searchParams }: Props) {
  const params = await searchParams;
  const state = one(params.state);
  const codeChallenge = one(params.code_challenge);
  const returnOrigin = one(params.return_origin);

  // The proxy has already sent a signed-out visitor to /login with this page as `next`.
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect('/login');

  const valid =
    isValidState(state) && isValidCodeChallenge(codeChallenge) && isAllowedReturnOrigin(returnOrigin);

  return (
    <main className={styles.shell}>
      {valid ? (
        <ConnectClient
          state={state}
          codeChallenge={codeChallenge}
          returnOrigin={returnOrigin}
          email={user.email ?? null}
        />
      ) : (
        <section className={styles.card}>
          <h1 className={styles.title}>Invalid Request</h1>
          <p className={styles.lead}>
            This link didn&apos;t come from Futbolpedia, or it was cut short. Start again from
            Futbolpedia with Connect Gaffa.
          </p>
        </section>
      )}
    </main>
  );
}
