'use client';

import { useState } from 'react';
import {
  Button,
  ResponsiveModal,
  SegmentedControl,
  SimpleSelect,
  Kbd,
} from '@/components/ui';
import styles from './ui-showcase.module.css';

export default function UIShowcasePage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'roster' | 'pitch' | 'retained'>('roster');
  const [selectedPos, setSelectedPos] = useState('CB');
  const [loading, setLoading] = useState(false);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Gaffa UI Primitives Playground</h1>
        <p className={styles.subtitle}>
          Living reference for Gaffa&apos;s unified, responsive, token-aligned UI components.
        </p>
      </header>

      <div className={styles.grid}>
        {/* 1. Button Primitives */}
        <section className={styles.card}>
          <div>
            <h2 className={styles.cardTitle}>1. Buttons</h2>
            <p className={styles.cardDesc}>
              Variants, active press feedback (scale 0.97), and inline loading state.
            </p>
          </div>

          <div className={styles.row}>
            <Button variant="primary">Save Lineup</Button>
            <Button variant="secondary">Manage Squad</Button>
            <Button variant="ghost">Cancel</Button>
            <Button variant="danger">Release Player</Button>
          </div>

          <div className={`${styles.row} ${styles.divider}`}>
            <Button
              variant="primary"
              loading={loading}
              onClick={() => {
                setLoading(true);
                setTimeout(() => setLoading(false), 2000);
              }}
            >
              Test Loading (2s)
            </Button>
            <Button variant="secondary" size="sm">
              Small Action
            </Button>
            <Button variant="secondary" size="lg">
              Large Touch (44px)
            </Button>
          </div>
        </section>

        {/* 2. SegmentedControl */}
        <section className={styles.card}>
          <div>
            <h2 className={styles.cardTitle}>2. SegmentedControl</h2>
            <p className={styles.cardDesc}>
              Accessible tablist with ArrowLeft / ArrowRight keyboard navigation.
            </p>
          </div>

          <SegmentedControl<'roster' | 'pitch' | 'retained'>
            value={selectedTab}
            onChange={setSelectedTab}
            options={[
              { value: 'roster', label: 'Active Roster' },
              { value: 'pitch', label: 'Pitch View' },
              { value: 'retained', label: 'Retained List' },
            ]}
          />

          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
            Active tab: <b>{selectedTab}</b>
          </p>
        </section>

        {/* 3. SimpleSelect */}
        <section className={styles.card}>
          <div>
            <h2 className={styles.cardTitle}>3. SimpleSelect</h2>
            <p className={styles.cardDesc}>
              Desktop custom select that automatically delegates to native OS wheels on mobile.
            </p>
          </div>

          <SimpleSelect
            label="Tactical Position Slot"
            value={selectedPos}
            onChange={setSelectedPos}
            options={[
              { value: 'GK', label: 'Goalkeeper (GK)' },
              { value: 'CB', label: 'Centre-Back (CB)' },
              { value: 'LWB', label: 'Left Wing-Back (LWB)' },
              { value: 'DM', label: 'Defensive Midfielder (DM)' },
              { value: 'CF', label: 'Centre Forward (CF)' },
            ]}
          />

          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
            Selected position: <b>{selectedPos}</b>
          </p>
        </section>

        {/* 4. ResponsiveModal */}
        <section className={styles.card}>
          <div>
            <h2 className={styles.cardTitle}>4. ResponsiveModal</h2>
            <p className={styles.cardDesc}>
              Centered dialog on desktop; bottom sheet drawer on mobile (&lt;640px) with safe-area padding.
            </p>
          </div>

          <div>
            <Button variant="primary" onClick={() => setModalOpen(true)}>
              Open ResponsiveModal
            </Button>
          </div>

          <div className={styles.divider}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
              Keyboard affordance: <Kbd>Enter</Kbd> to open · <Kbd>Esc</Kbd> to return
            </span>
          </div>
        </section>
      </div>

      {/* The Responsive Modal Instance */}
      <ResponsiveModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Sample Responsive Modal"
        padded
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setModalOpen(false)}>
              Confirm Action
            </Button>
          </>
        }
      >
        <p style={{ fontSize: '14px', lineHeight: 1.5, color: 'var(--color-text-secondary)', margin: 0 }}>
          This dialog is rendered via <code>ResponsiveModal</code>.
        </p>
        <ul style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.6, marginTop: '12px', paddingLeft: '20px' }}>
          <li>On desktop (&gt;640px), it centers with shadow XOR border.</li>
          <li>On mobile (&lt;=640px), it anchors to the bottom with top rounded corners and safe area padding.</li>
          <li>Pressing <Kbd>Esc</Kbd> or clicking the backdrop dismisses it safely.</li>
        </ul>
      </ResponsiveModal>
    </div>
  );
}
