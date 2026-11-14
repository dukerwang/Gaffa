'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { futbolpediaConnectReturnUrl, originHost } from '@/lib/integrations/futbolpediaConnectUrl';
import styles from './connect.module.css';

interface Props {
  state: string;
  codeChallenge: string;
  returnOrigin: string;
  email: string | null;
}

type Answer = { code: string } | { error: 'access_denied' };

/** How long Futbolpedia gets to close this window after the answer is posted. */
const OPENER_GRACE_MS = 2000;

export default function ConnectClient({ state, codeChallenge, returnOrigin, email }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<'allowed' | 'cancelled' | null>(null);

  /**
   * Hand the answer back to the Futbolpedia window that opened this one. postMessage is pinned
   * to returnOrigin (checked against the allowlist), and Futbolpedia closes this window once it
   * has the answer. If the window is still open shortly after, the opener wasn't Futbolpedia on
   * that origin (a link opened from another tab), so this tab goes to Futbolpedia's return route
   * instead. The code is still unused then, since only Futbolpedia can exchange it.
   */
  function deliver(answer: Answer) {
    const toReturnRoute = () => window.location.assign(futbolpediaConnectReturnUrl(returnOrigin, { state, ...answer }));
    const opener = window.opener as Window | null;
    if (!opener || opener.closed) {
      toReturnRoute();
      return;
    }
    opener.postMessage({ type: 'gaffa-connect', state, ...answer }, returnOrigin);
    setDone('code' in answer ? 'allowed' : 'cancelled');
    window.setTimeout(() => {
      if (!window.closed) toReturnRoute();
    }, OPENER_GRACE_MS);
  }

  async function allow() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/integrations/futbolpedia/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code_challenge: codeChallenge, return_origin: returnOrigin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data?.code !== 'string') {
        throw new Error(typeof data?.error === 'string' ? data.error : `Request failed (${res.status})`);
      }
      deliver({ code: data.code });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
      setPending(false);
    }
  }

  if (done) {
    return (
      <section className={styles.card}>
        <h1 className={styles.title}>{done === 'allowed' ? 'Futbolpedia Connected' : 'Request Cancelled'}</h1>
        <p className={styles.lead}>Close this window to return to Futbolpedia.</p>
      </section>
    );
  }

  return (
    <section className={styles.card} aria-labelledby="connect-title">
      <h1 id="connect-title" className={styles.title}>
        Futbolpedia Access
      </h1>
      <p className={styles.lead}>
        Give Futbolpedia read-only access to the clubs you run, so you can ask it about your squad
        and league.
      </p>

      <ul className={styles.scopes}>
        <li>Your clubs and their leagues</li>
        <li>Squads, saved lineups and Club Balance</li>
        <li>Standings, matchups, listings, auctions and free agents</li>
      </ul>

      <p className={styles.note}>
        Futbolpedia can&apos;t set lineups, bid, list or trade. Revoke access any time in Settings.
      </p>

      <dl className={styles.meta}>
        <div>
          <dt>Requested From</dt>
          <dd>{originHost(returnOrigin)}</dd>
        </div>
        {email && (
          <div>
            <dt>Signed In As</dt>
            <dd>{email}</dd>
          </div>
        )}
      </dl>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.actions}>
        <Button variant="ghost" disabled={pending} onClick={() => deliver({ error: 'access_denied' })}>
          Cancel
        </Button>
        <Button variant="primary" loading={pending} onClick={allow}>
          Allow
        </Button>
      </div>
    </section>
  );
}
