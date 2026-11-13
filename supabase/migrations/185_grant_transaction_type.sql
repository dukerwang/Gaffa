-- Migration 185: a transaction type for money the league hands out directly.
--
-- The €30m Transfer Deadline grant on 2026-09-01 raised every club's
-- faab_budget without writing a transactions row, so the finance ledger could
-- not account for it and every club's opening balance read €280m instead of
-- €250m. 186 backfills those rows; this adds the type first, because Postgres
-- refuses a new enum value inside the transaction that added it.

ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'grant';
