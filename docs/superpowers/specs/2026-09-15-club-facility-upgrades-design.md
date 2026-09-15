# Club Facility Upgrades & Bid Floor Calibration — Design

**Date:** 2026-09-15  
**Status:** Implemented (migration 166). See "As built" below for where the build differs from this draft.  
**Scope:** Permanent club infrastructure upgrades (Academy, IR, Loan capacity), free-agent bid floor calibration, and money supply absorption.

---

## As built (2026-09-15)

Read this before the sections below; where they disagree, this wins.

* **UI names and placement** (Duke, recorded in `docs/DECISIONS.md`): facilities use the squad page's names, Academy / Injured Reserve / Loans Out, under a **Club Facilities** section at the **top of the club page** (`team/roster` and `clubs/[teamId]`), read-only on a rival's club. Also linked from the topbar Club Balance menu, the lineup rail's Academy and IR tier heads when full, and a League Home reminder when full and affordable. §6.1's "Level N", "Medical Centre", "beds" and sentence-case buttons were not used.
* **No activity feed entry.** Purchases appear on the buyer's finance ledger only; the activity page and League Home feed exclude `facility_upgrade`.
* **RPC is `purchase_facility_upgrade_rpc(p_team_id, p_facility)`** with `p_facility` in `academy | ir | loans_out`; it buys the next step of the ladder rather than taking a tier key. It is granted to `service_role` only: the draft below granted a `SECURITY DEFINER` function to `authenticated` with no ownership check, which would have let any signed-in user spend any club's balance. The API route checks ownership.
* **Every limit check reads the team's slots.** §5.2 listed five call sites. The build found seven database functions (`activate_held_rpc`, `execute_loan_acceptance_rpc`, `execute_loan_recall_rpc`, `execute_trade_transaction_rpc`, `place_arrival_rpc`, `place_returning_loanee`, `resolve_single_player_auction_rpc`) and a dozen TypeScript paths. SQL goes through `team_academy_slots()` / `team_ir_slots()` / `team_loan_out_slots()`; TypeScript through `effectiveSlots()` in `src/lib/facilities/facilities.ts`.
* **Two corrections to the reasoning.** The manager listing floor was already 60% (migration 129), not 80%, so the free-agent change equalises the two floors rather than narrowing a 30-point gap. And six clubs buying everything would destroy €1,440m, not €525m.

---

## 1. Problem Statement & Context

Gaffa's dynasty economy currently carries a structural liquidity overhang:
1. **Surplus Starting Liquidity:** Clubs started with €250m–€280m, but 22-man rosters were already drafted. 
2. **Flat Cash Utility in Closed Rosters:** In fantasy football, pure cash does not score matchday points. Selling an active footballer for pure cash leaves an unfillable hole in a manager's starting XI, which froze the cash trade market.
3. **No Non-Player Capital Sinks:** Cash has only one primary destination: winning free-agent auctions. Because marquee stars are scarce, cash pooled up in bank accounts, causing managers to make record-breaking €140m+ bids simply because they held surplus reserves with nothing else to buy.
4. **Free-Agent vs Listing Floor Disparity:** Free-agent auctions carry a 50% minimum bid floor, while manager transfer listings carry an 80% floor (to prevent collusion). This 30% discount heavily favors free-agent bidding and disincentivizes manager-to-manager market listings.

### Core Decisions
* **Do not touch active roster size:** Keep active rosters locked at 22. Do not allow managers to buy general reserve slots (which would monopolize active starters and starve the waiver wire).
* **Do not introduce recurring wage bills or contract decay:** Gaffa is an accessible, football-first fantasy platform. Managers must never face "sweaty" bankruptcy death spirals or administrative maintenance chores.
* **Introduce 4 permanent Club Facility Upgrades:** Provide high-value, voluntary capital investments that give cash direct conversion value into permanent franchise infrastructure.
* **Calibrate on the modular 30/60/60/90 scale:** Total cost across all upgrades is exactly €240m (equivalent to one starting bankroll).
* **Nudge the free-agent minimum bid floor from 50% to 60%:** Tightens mid-tier and elite star openings while keeping true fodder (€1m–€2m) affordable for emergency injury streaming.

---

## 2. The 30 / 60 / 60 / 90 Pricing Schedule

All facility upgrades are **permanent franchise assets**. Once purchased, they remain with the club across all future seasons.

| Facility Upgrade | Baseline | Hard Cap | Price | Mechanical Effect |
| :--- | :---: | :---: | :---: | :--- |
| **Loan Operations Expansion** | 1 out | 2 out | **€30m** | Lets the club loan out 2 players simultaneously instead of 1. |
| **Medical Wing Upgrade** | 2 IR | 3 IR | **€60m** | Expands Injured Reserve to 3 slots. Pure disaster insurance against injury crises. |
| **Youth Academy Expansion (Tier 1)** | 3 taxi | 4 taxi | **€60m** | Expands U21 prospect capacity from 3 to 4 slots. |
| **Youth Academy Expansion (Tier 2)** | 4 taxi | 5 taxi | **€90m** | Expands U21 prospect capacity from 4 to 5 slots (hard cap). |

### Economic Logic
* **Parity between Defense and Offense:** Both the 3rd IR slot and the 4th Academy slot cost exactly **€60m**. A manager choosing between them faces a genuine ideological trade-off: offensive future-building (Academy) versus defensive crisis-insulation (IR).
* **Progressive Luxury Tier:** Academy Slot 5 is a steep **€90m** step ($1.5 \times$ Tier 1), acting as a massive currency incinerator for cash-rich clubs.
* **The €240m Benchmark:** A club that purchases every facility upgrade spends €240m, leaving a clean €10m buffer from a standard €250m starting balance. Across a 6-team league, full facility adoption permanently destroys up to **€525m in surplus currency**, completely neutralizing the annual prize inflow without nerfing headline tournament rewards.

---

## 3. Free-Agent Bid Floor Adjustment

* Update `leagues.free_agent_bid_floor` default from `0.500` (50%) to **`0.600` (60%)**.
* Update existing active leagues (`Dynasty Dragoon`, `Matchday Militia`) to `0.600`.
* **Impact:**
  * €15m starter opening bid floor moves from €7m to **€9m**.
  * €80m superstar opening bid floor moves from €40m to **€48m**.
  * Low-tier fodder (€2m MV) remains at **€1m** (`Math.floor(2 * 0.6) = 1`), protecting cheap injury replacements.
  * Closes the gap with manager listings (80% floor), making player listings on the transfer board more viable.

---

## 4. Data Model & Database Changes

### 4.1 Schema Migration

1. **Enum update:**
   ```sql
   ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'facility_upgrade';
   ```

2. **Per-team capacity overrides on `teams`:**
   Add nullable integer columns to `public.teams`. If `NULL`, the team inherits the league default:
   ```sql
   ALTER TABLE public.teams
     ADD COLUMN IF NOT EXISTS academy_slots INT NULL,
     ADD COLUMN IF NOT EXISTS ir_slots INT NULL,
     ADD COLUMN IF NOT EXISTS loan_out_slots INT NULL;
   ```
   * *Fallback rule:* `effective_academy_slots = COALESCE(team.academy_slots, league.taxi_size, 3)`
   * *Fallback rule:* `effective_ir_slots = COALESCE(team.ir_slots, league.ir_size, 2)`
   * *Fallback rule:* `effective_loan_out_slots = COALESCE(team.loan_out_slots, league.max_loan_outs, 1)`

3. **Update bid floor default:**
   ```sql
   ALTER TABLE public.leagues
     ALTER COLUMN free_agent_bid_floor SET DEFAULT 0.600;

   UPDATE public.leagues
     SET free_agent_bid_floor = 0.600
     WHERE free_agent_bid_floor = 0.500;
   ```

### 4.2 ACID Upgrade RPC: `purchase_facility_upgrade_rpc`

Create a secure Postgres function `public.purchase_facility_upgrade_rpc(p_team_id UUID, p_upgrade_key TEXT)` returning `JSONB`:

```sql
CREATE OR REPLACE FUNCTION public.purchase_facility_upgrade_rpc(
  p_team_id UUID,
  p_upgrade_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_team RECORD;
  v_league RECORD;
  v_cost INT;
  v_current_level INT;
  v_new_level INT;
  v_facility_title TEXT;
BEGIN
  -- 1. Lock team row
  SELECT id, league_id, faab_budget, academy_slots, ir_slots, loan_out_slots
  INTO v_team
  FROM public.teams
  WHERE id = p_team_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team not found');
  END IF;

  -- 2. Lock league row for baseline defaults
  SELECT taxi_size, ir_size, max_loan_outs
  INTO v_league
  FROM public.leagues
  WHERE id = v_team.league_id;

  -- 3. Resolve cost, validation, and target levels
  IF p_upgrade_key = 'academy_4' THEN
    v_current_level := COALESCE(v_team.academy_slots, v_league.taxi_size, 3);
    IF v_current_level <> 3 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Must be at Level 1 (3 slots) to purchase Academy Tier 1');
    END IF;
    v_cost := 60;
    v_new_level := 4;
    v_facility_title := 'Youth Academy Expansion (Slot 4)';

  ELSIF p_upgrade_key = 'academy_5' THEN
    v_current_level := COALESCE(v_team.academy_slots, v_league.taxi_size, 3);
    IF v_current_level <> 4 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Must own Academy Tier 1 (4 slots) to purchase Academy Tier 2');
    END IF;
    v_cost := 90;
    v_new_level := 5;
    v_facility_title := 'Youth Academy Expansion (Slot 5)';

  ELSIF p_upgrade_key = 'ir_3' THEN
    v_current_level := COALESCE(v_team.ir_slots, v_league.ir_size, 2);
    IF v_current_level <> 2 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Medical Wing already fully upgraded');
    END IF;
    v_cost := 60;
    v_new_level := 3;
    v_facility_title := 'Medical Wing Expansion (IR Slot 3)';

  ELSIF p_upgrade_key = 'loan_2' THEN
    v_current_level := COALESCE(v_team.loan_out_slots, v_league.max_loan_outs, 1);
    IF v_current_level <> 1 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Loan Operations already fully upgraded');
    END IF;
    v_cost := 30;
    v_new_level := 2;
    v_facility_title := 'Loan Operations Expansion (Slot 2)';

  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Unknown upgrade key: ' || p_upgrade_key);
  END IF;

  -- 4. Check budget
  IF v_team.faab_budget < v_cost THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient Club Balance (needs €' || v_cost || 'm, hold €' || v_team.faab_budget || 'm)'
    );
  END IF;

  -- 5. Deduct balance and update slots
  UPDATE public.teams
  SET faab_budget = faab_budget - v_cost,
      academy_slots = CASE WHEN p_upgrade_key LIKE 'academy%' THEN v_new_level ELSE academy_slots END,
      ir_slots = CASE WHEN p_upgrade_key = 'ir_3' THEN v_new_level ELSE ir_slots END,
      loan_out_slots = CASE WHEN p_upgrade_key = 'loan_2' THEN v_new_level ELSE loan_out_slots END,
      updated_at = NOW()
  WHERE id = p_team_id;

  -- 6. Insert transaction audit record
  INSERT INTO public.transactions (
    league_id, team_id, type, faab_bid, notes, processed_at, created_at
  ) VALUES (
    v_team.league_id,
    p_team_id,
    'facility_upgrade',
    v_cost,
    'Purchased ' || v_facility_title || ' for €' || v_cost || 'm',
    NOW(),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'upgrade_key', p_upgrade_key,
    'new_level', v_new_level,
    'cost', v_cost,
    'remaining_budget', v_team.faab_budget - v_cost
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purchase_facility_upgrade_rpc(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_facility_upgrade_rpc(UUID, TEXT) TO authenticated, service_role;
```

---

## 5. Backend Code Changes

### 5.1 API Endpoint: `POST /api/leagues/[leagueId]/facilities/upgrade`
* Requires authenticated session matching the team owner or commissioner.
* Body: `{ upgradeKey: 'academy_4' | 'academy_5' | 'ir_3' | 'loan_2' }`.
* Calls `purchase_facility_upgrade_rpc`.
* Returns 200 with new balance and slot counts, or 400 with exact error message.

### 5.2 Roster Capacity and Query Updates
Every place in the codebase that reads roster or slot limits must account for `team.*_slots`:

1. **`src/lib/roster/capacity.ts` (`deriveRosterCapacity`)**:
   Include `team?: { academy_slots?: number | null; ir_slots?: number | null; loan_out_slots?: number | null }`.
   * `taxiSize`: `team?.academy_slots ?? league.taxi_size ?? 3`
   * `irSize`: `team?.ir_slots ?? league.ir_size ?? 2`
2. **`src/app/api/leagues/[leagueId]/auctions/bid/route.ts`**:
   Line 298: Check `myTeam.academy_slots ?? league.taxi_size ?? 3`.
3. **`src/app/api/teams/[teamId]/taxi/route.ts`**:
   Line 62: Read `team.academy_slots ?? league.taxi_size ?? 3`.
4. **`src/app/api/leagues/[leagueId]/loans/route.ts`**:
   Check `lenderTeam.loan_out_slots ?? league.max_loan_outs ?? 1`.
5. **`resolve_single_player_auction_rpc` (Migration 152 update)**:
   In the candidate evaluation loop, check `v_academy_count < COALESCE(v_temp_rec.academy_slots, v_academy_size)`.

### 5.3 Finance Ledger Accounting
Update `src/app/(dashboard)/league/[leagueId]/finance/page.tsx`:
* In `TX_DIRECTIONS`: add `facility_upgrade: 'out'`.
* In `TX_CREATES_MONEY` / money supply calculation: `facility_upgrade` burns 100% of the cost (`destroyed: true`), reflecting accurate deflation on the Money Created vs Destroyed card.

---

## 6. UI & Information Architecture

Adheres strictly to `docs/UI_RULES.md`:
* **No generic bento card slop:** One bounded panel with internal hairlines (`border: var(--line-strong)`, `--r-shell`, `--color-bg-card`).
* **Title Case headings:** Section header is `Club Facilities` (Serif font over a 2px `--color-text-primary` rule).
* **Sentence case buttons:** Button labels use sentence case (`Expand to 4 slots · €60m`). Never all-caps.
* **No eyebrow kickers:** Direct, unadorned typography.

### 6.1 Primary Hub: "Club Facilities"
Located under **My Club** (`src/app/(dashboard)/league/[leagueId]/team/page.tsx`) or as a dedicated section:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Youth Academy                                                               │
│ Level 1 (3 slots) · 3 / 3 occupied                                          │
│ Holds U21 prospects off the active roster                                   │
│                                           [ Expand to 4 slots · €60m ]      │
├─────────────────────────────────────────────────────────────────────────────┤
│ Medical Centre                                                              │
│ Level 1 (2 beds) · 1 / 2 occupied                                           │
│ Houses injured players without active roster penalty                        │
│                                           [ Expand to 3 slots · €60m ]      │
├─────────────────────────────────────────────────────────────────────────────┤
│ Loan Operations                                                             │
│ Level 1 (1 slot) · 0 / 1 loaned out                                         │
│ Commercial outgoing loan capacity                                           │
│                                           [ Expand to 2 slots · €30m ]      │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Button States:
* **Available & Affordable:** Active primary button (`Expand to 4 slots · €60m`).
* **Insufficient Balance:** Disabled state showing needed amount (`Needs €60m · €44m available`).
* **Max Tier Reached:** Muted badge (`Fully upgraded · 5 slots max`).

### 6.2 Contextual In-Situ Affordances (Squad Page)
Managers should not have to leave their squad view when facing a roster crunch:
* **On Academy Board (when at 3/3):** Section header displays:  
  `Academy · 3 / 3` with an inline text action: `[ Expand to 4 slots · €60m ]`.
* **On Injured Reserve (when at 2/2):** Section header displays:  
  `Injured Reserve · 2 / 2` with an inline text action: `[ Add 3rd medical slot · €60m ]`.
* Tapping either opens `PurchaseFacilityModal` directly.

### 6.3 Purchase Confirmation Modal
A focused confirmation modal before deducting balance:
* Displays:
  * Department name and new level description.
  * Cost in whole millions (€m).
  * Current Club Balance.
  * Projected balance after purchase.
* Primary action button: `Confirm purchase · €60m`.
* Secondary action button: `Cancel`.
* On success:
  * Top bar balance pill updates immediately.
  * Toast notification confirms purchase.
  * New slot immediately renders in the squad view.

---

## 7. Out of Scope & Non-Goals

* **No changes to active roster size:** Remains locked at 22.
* **No general reserve slots:** Active bench and reserves cannot be expanded beyond 22.
* **No recurring upkeep fees:** Facility upgrades are one-time capital purchases.
* **No change to departure compensation:** `departure_compensation_rate` stays at `0.600` (60%) to protect Retained Rights and avoid printing unbacked currency.
* **No downgrades / refunds:** Facility purchases are permanent dynasty investments and cannot be sold back.

---

## 8. Verification & Definition of Done

1. **Unit tests (`npm test`):**
   * Test `purchase_facility_upgrade_rpc` validates budget, respects prerequisites (cannot buy Academy 5 without 4), and caps correctly.
   * Test `deriveRosterCapacity` reflects team facility overrides over league defaults.
   * Test `resolve_single_player_auction_rpc` correctly routes up to 5 academy prospects for upgraded clubs.
2. **Linting & UI compliance:**
   * Run `npm run check:ui` to verify typography, casing, and surface tokens meet `docs/UI_RULES.md`.
3. **Build verification:**
   * `npm run build` must pass cleanly with zero TypeScript errors.
