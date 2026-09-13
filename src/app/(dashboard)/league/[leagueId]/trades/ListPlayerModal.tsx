'use client';

import { useState } from 'react';
import PositionBadge from '@/components/players/PositionBadge';
import { getPlayerDisplayName } from '@/lib/players/displayName';
import { ResponsiveModal, Button } from '@/components/ui';
import styles from './trades.module.css';

export interface ListablePlayer {
  id: string;
  name: string;
  web_name: string | null;
  pl_team?: string | null;
  market_value?: number | null;
  primary_position: string;
  listing?: {
    id: string;
    status: 'pending' | 'active';
    min_bid: number;
    buy_now_price: number | null;
  } | null;
}

interface Props {
  leagueId: string;
  myTeamId: string;
  myRoster: ListablePlayer[];
  onClose: () => void;
  onListed: (playerId: string, listing: any) => void;
  onCancelled: (playerId: string) => void;
}

export default function ListPlayerModal({
  leagueId,
  myRoster,
  onClose,
  onListed,
  onCancelled,
}: Props) {
  const [selectedPlayer, setSelectedPlayer] = useState<ListablePlayer | null>(null);
  const [minBid, setMinBid] = useState<number>(0);
  const [buyNowPrice, setBuyNowPrice] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filter out any active listings from listable selection since they are locked
  const eligiblePlayers = myRoster.filter((p) => p.listing?.status !== 'active');

  async function handleCreateListing(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPlayer) return;

    setError(null);
    setSubmitting(true);

    const buyNowNum = buyNowPrice ? parseInt(buyNowPrice, 10) : undefined;

    if (buyNowNum !== undefined && (isNaN(buyNowNum) || buyNowNum <= minBid)) {
      setError('Buy Now price must be higher than the minimum bid.');
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`/api/leagues/${leagueId}/auctions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: selectedPlayer.id,
          min_bid: minBid,
          buy_now_price: buyNowNum,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to list player');
      }

      onListed(selectedPlayer.id, data.listing);
      setSelectedPlayer(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelListing(p: ListablePlayer, e: React.MouseEvent) {
    e.stopPropagation();
    if (!p.listing) return;

    setCancellingId(p.id);
    setError(null);

    try {
      const res = await fetch(`/api/leagues/${leagueId}/auctions?listing_id=${p.listing.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to cancel listing');
      }

      onCancelled(p.id);
    } catch (err: any) {
      console.error(err);
      setError('An unexpected error occurred.');
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <ResponsiveModal
      open={true}
      onClose={onClose}
      title={selectedPlayer ? 'List Player' : 'Your Roster'}
    >
      {error && (
        <div className={styles.modalHint} style={{ color: 'var(--color-accent-red)', borderBottom: 'none' }}>
          {error}
        </div>
      )}

      {!selectedPlayer ? (
        <>
          <p className={styles.modalHint}>
            Select a player to list on the market, or manage your current listings.
          </p>

          {eligiblePlayers.length === 0 ? (
            <p className={styles.modalEmpty}>Your roster is empty or all players have live auctions.</p>
          ) : (
            <div className={styles.blockToggleList}>
              {eligiblePlayers.map((p) => {
                const isPending = p.listing?.status === 'pending';
                const isCancelling = cancellingId === p.id;
                return (
                  <div
                    key={p.id}
                    className={`${styles.blockToggleRow} ${isPending ? styles.blockToggleRowActive : ''}`}
                    onClick={() => !isPending && setSelectedPlayer(p)}
                    style={{ cursor: isPending ? 'default' : 'pointer' }}
                  >
                    <div className={styles.blockToggleLeft}>
                      <PositionBadge position={p.primary_position as any} size="sm" />
                      <div className={styles.blockToggleInfo}>
                        <span className={styles.blockToggleName}>
                          {getPlayerDisplayName(p, 'initial_last')}
                        </span>
                        <span className={styles.blockToggleClub}>
                          {p.pl_team ?? ''}
                          {p.market_value ? ` · €${p.market_value.toFixed(1)}m` : ''}
                        </span>
                      </div>
                      {isPending && (
                        <span className={styles.blockOnIndicator}>LISTED</span>
                      )}
                    </div>
                    <div className={styles.blockToggleRight}>
                      {isPending && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={(e) => handleCancelListing(p, e)}
                          disabled={isCancelling}
                          loading={isCancelling}
                        >
                          Cancel Listing
                        </Button>
                      )}
                      {!isPending && (
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          Click to List
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <form onSubmit={handleCreateListing} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--color-bg-secondary)', padding: '14px', borderRadius: 'var(--r-control)' }}>
            <PositionBadge position={selectedPlayer.primary_position as any} size="md" />
            <div>
              <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '16px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                {getPlayerDisplayName(selectedPlayer, 'full')}
              </h3>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                {selectedPlayer.pl_team ?? ''} {selectedPlayer.market_value ? `· €${selectedPlayer.market_value.toFixed(1)}m MV` : ''}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-condensed)' }}>
              Minimum Bid (€m)
            </label>
            <input
              type="number"
              min="0"
              step="1"
              required
              value={minBid}
              onChange={(e) => setMinBid(Math.max(0, parseInt(e.target.value, 10) || 0))}
              style={{
                padding: '10px 12px',
                borderRadius: 'var(--r-control)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-card)',
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-condensed)',
                fontSize: '15px',
              }}
            />
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              Set to €0 to accept any offer. Minimum bid to start the auction.
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-condensed)' }}>
              Buy Now Price (€m) — Optional
            </label>
            <input
              type="number"
              min={minBid + 1}
              step="1"
              value={buyNowPrice}
              onChange={(e) => setBuyNowPrice(e.target.value)}
              placeholder="No Buy Now price"
              style={{
                padding: '10px 12px',
                borderRadius: 'var(--r-control)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-card)',
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-condensed)',
                fontSize: '15px',
              }}
            />
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              Leave blank for auction only. If a user bids this amount, they win the player immediately.
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
            <Button
              variant="secondary"
              onClick={() => setSelectedPlayer(null)}
              disabled={submitting}
            >
              Back
            </Button>
            <Button
              variant="primary"
              type="submit"
              loading={submitting}
              disabled={submitting}
            >
              List Player
            </Button>
          </div>
        </form>
      )}
    </ResponsiveModal>
  );
}
