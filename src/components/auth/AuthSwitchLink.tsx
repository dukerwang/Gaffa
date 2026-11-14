'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { safeNextPath } from '@/lib/auth/nextPath';

function WithNext({ to, className, children }: { to: string; className?: string; children: React.ReactNode }) {
  const next = safeNextPath(useSearchParams().get('next'));
  return (
    <Link href={next ? `${to}?next=${encodeURIComponent(next)}` : to} className={className}>
      {children}
    </Link>
  );
}

/** The link between sign-in and sign-up, carrying `next` so the manager still returns there. */
export default function AuthSwitchLink(props: { to: string; className?: string; children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <Link href={props.to} className={props.className}>
          {props.children}
        </Link>
      }
    >
      <WithNext {...props} />
    </Suspense>
  );
}
