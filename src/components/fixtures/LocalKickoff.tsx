'use client';

import { useLocalKickoff } from '@/lib/fixtures/formatKickoff';

export interface LocalKickoffProps {
  iso: string | null | undefined;
  className?: string;
  prefix?: string;
  timeZone?: string;
}

export function LocalKickoff({
  iso,
  className,
  prefix = '',
  timeZone,
}: LocalKickoffProps) {
  const kickoff = useLocalKickoff(iso, timeZone);
  if (!kickoff) return null;
  return (
    <span className={className} title={kickoff}>
      {prefix}
      {kickoff}
    </span>
  );
}

export default LocalKickoff;
