import { toast } from '@/components/ui/toast';

/**
 * The confirmation after a manager answers a trade or loan: from Deals, or from
 * the offer card in chat. One wording for both, so the same click never reads
 * two ways. `who` is the other club.
 */
export function dealToast(kind: 'trade' | 'loan', action: 'accept' | 'reject' | 'cancel', who?: string | null) {
  const noun = kind === 'trade' ? 'Trade' : 'Loan';
  const title =
    action === 'accept' ? `${noun} accepted` : action === 'reject' ? `${noun} declined` : `${noun} offer withdrawn`;
  const description = who ? (action === 'cancel' ? `To ${who}` : `With ${who}`) : undefined;
  if (action === 'accept') toast.success(title, { description });
  else toast(title, { description });
}
