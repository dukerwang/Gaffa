/**
 * The toast store. Call `toast()` from anywhere, client-side; mount
 * <Toaster /> once. No provider, no hook: a notice should cost one line.
 *
 *   toast.success('Bid placed', { description: 'Bukayo Saka · €34m' });
 *   toast.error('Bid refused', { description: 'Your Club Balance is €12m.' });
 *   toast('Lineup saved', { action: { label: 'Undo', onClick: revert } });
 *
 * Messages follow the copy rules: the title is a short past-tense fact in
 * sentence case, the description adds the one detail that matters.
 */

export type ToastVariant = 'neutral' | 'success' | 'error';

export interface ToastOptions {
  description?: string;
  /** Milliseconds on screen. Errors default longer: they need reading. */
  duration?: number;
  action?: { label: string; onClick: () => void };
  /** Pass to replace an existing toast in place (e.g. "Saving…" then "Saved"). */
  id?: string;
}

export interface ToastRecord extends ToastOptions {
  id: string;
  title: string;
  variant: ToastVariant;
  duration: number;
  createdAt: number;
  /** Set when dismissal starts, so the Toaster can play the exit first. */
  dismissing?: boolean;
}

type Listener = (toasts: ToastRecord[]) => void;

let toasts: ToastRecord[] = [];
const listeners = new Set<Listener>();
let counter = 0;

const DEFAULT_DURATION: Record<ToastVariant, number> = {
  neutral: 4000,
  success: 4000,
  error: 6500,
};

const EXIT_MS = 200;

function emit() {
  for (const l of listeners) l(toasts);
}

function push(variant: ToastVariant, title: string, opts: ToastOptions = {}) {
  const id = opts.id ?? `t${++counter}`;
  const record: ToastRecord = {
    ...opts,
    id,
    title,
    variant,
    duration: opts.duration ?? DEFAULT_DURATION[variant],
    createdAt: Date.now(),
  };
  const existing = toasts.findIndex((t) => t.id === id);
  toasts =
    existing >= 0
      ? toasts.map((t, i) => (i === existing ? { ...record, createdAt: t.createdAt } : t))
      : [...toasts, record];
  emit();
  return id;
}

function dismiss(id?: string) {
  const targets = id ? toasts.filter((t) => t.id === id) : toasts;
  if (!targets.length) return;
  toasts = toasts.map((t) => (targets.includes(t) ? { ...t, dismissing: true } : t));
  emit();
  window.setTimeout(() => {
    toasts = toasts.filter((t) => !(t.dismissing && targets.some((d) => d.id === t.id)));
    emit();
  }, EXIT_MS);
}

export const toast = Object.assign(
  (title: string, opts?: ToastOptions) => push('neutral', title, opts),
  {
    success: (title: string, opts?: ToastOptions) => push('success', title, opts),
    error: (title: string, opts?: ToastOptions) => push('error', title, opts),
    dismiss,
  },
);

export function subscribeToasts(listener: Listener) {
  listeners.add(listener);
  listener(toasts);
  return () => {
    listeners.delete(listener);
  };
}
