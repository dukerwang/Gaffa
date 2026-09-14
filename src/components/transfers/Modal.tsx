'use client';

import ResponsiveModal from '@/components/ui/ResponsiveModal';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Rendered to the left of the title — a crest, usually. */
  lead?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Wider frame for the two-sided propose builder. */
  wide?: boolean;
}

/**
 * The shell every transfers dialog sits in.
 * Standardized on the Gaffa UI ResponsiveModal primitive.
 */
export default function Modal({ open, onClose, title, lead, children, footer, wide }: Props) {
  return (
    <ResponsiveModal
      open={open}
      onClose={onClose}
      title={title}
      lead={lead}
      footer={footer}
      wide={wide}
    >
      {children}
    </ResponsiveModal>
  );
}
