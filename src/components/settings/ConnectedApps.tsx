'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/toast';
import { originHost } from '@/lib/integrations/futbolpediaConnectUrl';
import styles from './settings.module.css';

interface Grant {
  id: string;
  return_origin: string;
  created_at: string;
  last_used_at: string | null;
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Futbolpedia grants for this manager (Connect with Gaffa, migration 190), each revocable. */
export default function ConnectedApps() {
  const [grants, setGrants] = useState<Grant[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/integrations/futbolpedia/grants')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data) => {
        if (active) setGrants(Array.isArray(data?.grants) ? data.grants : []);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  async function revoke(id: string) {
    setRevoking(id);
    try {
      const res = await fetch(`/api/integrations/futbolpedia/grants/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 404) throw new Error(String(res.status));
      setGrants((prev) => (prev ?? []).filter((g) => g.id !== id));
      toast.success('Access revoked', { description: 'Futbolpedia no longer reads your clubs.' });
    } catch {
      toast.error('Revoke failed', { description: 'Try again.' });
    } finally {
      setRevoking(null);
    }
  }

  if (failed) {
    return <p className={styles.sectionHint}>Couldn&apos;t load connected apps.</p>;
  }
  if (grants === null) return null;
  if (grants.length === 0) {
    return (
      <p className={styles.sectionHint}>
        Nothing connected. Connect Gaffa from Futbolpedia to give it read-only access to your clubs.
      </p>
    );
  }

  return (
    <div className={styles.panel}>
      {grants.map((g) => (
        <div key={g.id} className={styles.row}>
          <div className={styles.rowMain}>
            <span className={styles.rowLabel}>Futbolpedia · {originHost(g.return_origin)}</span>
            <span className={styles.rowMeta}>
              Connected {day(g.created_at)}
              {g.last_used_at ? ` · last used ${day(g.last_used_at)}` : ''}
            </span>
          </div>
          <Button size="sm" variant="secondary" loading={revoking === g.id} onClick={() => revoke(g.id)}>
            Revoke
          </Button>
        </div>
      ))}
    </div>
  );
}
