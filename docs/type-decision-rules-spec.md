# Property-Type Decision Rules Specification

Status: **PROVISIONAL** (all numeric thresholds require Smart Works confirmation before final lock).

## Section A: Scope and status

- This specification defines the property-type decision rule for the admin analytics section. It replaces the type-level content of the removed AI portfolio narrative section.
- Operational portfolio rules in `backend/src/utils/portfolioRules.js` (`HIGH_RISK_DOCUMENTS`, `STALE_PENDING_INQUIRIES`, `OVERDUE_PENDING_SITE_VISITS`) are referenced as separate operational rules and are not redefined here.
- All numeric thresholds in this document are **PROVISIONAL** until Smart Works confirms them.
- The property-type decision is strictly descriptive of stated buyer preferences and current Available listings. It makes no claim about sales outcomes.

## Section B: Definitions

1. **Supply share**: For a property type, the count of `Available` listings of that type with a finite `price > 0`, divided by the total count of `Available` listings with a finite `price > 0` across all types. Computed as an exact fraction.
2. **Demand share**: For a property type, the count of buyer-scoped `BuyerPreference` records (where `userId` belongs to a `User` with `role: 'buyer'`) having that `landType`, divided by the total count of `landType`-bearing buyer-scoped records (currently `15`). Records with `landType: null` (currently `1`) are excluded from the denominator and reported separately. This denominator choice directly affects every demand share, and the `null` record is not counted in any type's share.
3. **Gap**: Demand share minus supply share, expressed in percentage points and computed from the exact fractions before rounding. The display value is `round(exactGap × 100, 1)`. Shares must not be rounded before subtracting.
4. **Buyers behind demand**: The count of distinct buyers (distinct `userId`) whose buyer-scoped preference has that `landType`. This is the sample size for the demand share.
5. **Condominium**: Excluded from all property-type decision cards when it has zero Available listings and zero buyer-scoped preference records. Reported as `"no records in the current dataset"`, not as an empty card.

## Section C: Decision rules (PROVISIONAL)

Named constants:

- `SHORTAGE_GAP_POINTS = 15.0` (**PROVISIONAL**)
- `SURPLUS_GAP_POINTS = −15.0` (**PROVISIONAL**)
- `MIN_BUYERS_FOR_DECISION = 5` (**PROVISIONAL**; applies to both shortage and surplus decisions)

Evaluation order for each property type:

1. **Insufficient sample**: `buyers behind demand < MIN_BUYERS_FOR_DECISION`. Output: gap and counts only; no decision.
2. **Shortage**: `gap >= SHORTAGE_GAP_POINTS` and sample is sufficient (`buyers >= MIN_BUYERS_FOR_DECISION`). Output: source or promote, subject to the readiness modifier in Section D.
3. **Surplus**: `gap <= SURPLUS_GAP_POINTS` and sample is sufficient (`buyers >= MIN_BUYERS_FOR_DECISION`). Output: hold this type, subject to the readiness modifier in Section D.
4. **Near the line**: sample is sufficient (`buyers >= MIN_BUYERS_FOR_DECISION`) and `SURPLUS_GAP_POINTS < gap < SHORTAGE_GAP_POINTS`. Output: no action, shown as `"within range."`

Boundary conditions:

- A gap equal to `SHORTAGE_GAP_POINTS` (`15.0`) classifies as a **Shortage**.
- A gap equal to `SURPLUS_GAP_POINTS` (`−15.0`) classifies as a **Surplus**.

## Section D: Readiness modifier

Applies only after Section C evaluates to Case 2 (**Shortage**) or Case 3 (**Surplus**).

For the property type's `Available` listings, determine each listing's latest audit (sorted by `generatedAt` descending) and classify its risk level using `computeRiskLevel` from `backend/src/utils/auditReadiness.js` (`Low`, `Medium`, `High`, or `NotAudited` when no audit exists). Count the `High` and `NotAudited` listings:

- **Shortage** and `(High + NotAudited) >= 1`: output `"Complete document checks on the existing listings first, then source."` Name the count of blocking listings (`blockingCount = High + NotAudited`).
- **Shortage** and `blockingCount = 0`: output `"Source or promote."`
- **Surplus** and `NotAudited >= 1`: output `"Audit the unaudited listings before any pricing or promotion decision."` Name the count of unaudited listings (`unauditedCount = NotAudited`).
- **Surplus** and `NotAudited = 0`: output `"Hold this type."`
- **Medium** listings do **not** block a decision (**PROVISIONAL**). They are still counted and displayed in the readiness breakdown for the type.

## Section E: Sentence templates

Templates must read all numbers from computed values and named constants. Hardcoding literal threshold numbers in template text is not allowed.

- **Shortage, ready**:
  `"{type}: {buyers} buyers prefer this type ({demandShare}% of stated preferences) against {listings} Available listings ({supplyShare}% of supply). Source or promote."`
- **Shortage, blocked**:
  `"{type}: {buyers} buyers prefer this type ({demandShare}% of stated preferences) against {listings} Available listings ({supplyShare}% of supply). Complete document checks on {blockingCount} existing listing(s) first, then source."`
- **Surplus, unaudited**:
  `"{type}: {buyers} buyers prefer this type ({demandShare}%) against {listings} Available listings ({supplyShare}%). Audit {unauditedCount} unaudited listing(s) before any pricing or promotion decision."`
- **Surplus, clear**:
  `"{type}: {buyers} buyers prefer this type ({demandShare}%) against {listings} Available listings ({supplyShare}%). Hold this type."`
- **Insufficient sample**:
  `"{type}: {buyers} buyer(s) prefer this type; below the {MIN_BUYERS} buyer minimum, so no decision is made. Gap shown for reference: {gap} points."`
- **Within range**:
  `"{type}: {buyers} buyers ({demandShare}%) against {listings} listings ({supplyShare}%). Within range; no action."`

## Section F: Current outcome

### Recorded baseline counts

- `Available` listings by type (all with finite `price > 0`; total `18`):
  - `Residential`: 4 (3 Low, 1 Medium, 0 High, 0 NotAudited)
  - `Agricultural`: 3 (2 Low, 1 Medium, 0 High, 0 NotAudited)
  - `Commercial`: 3 (3 Low, 0 Medium, 0 High, 0 NotAudited)
  - `House & Lot`: 8 (3 Low, 0 Medium, 0 High, 5 NotAudited)
- Buyer-scoped `BuyerPreference` `landType` counts (`role: 'buyer'`):
  - `Residential`: 7
  - `Agricultural`: 4
  - `Commercial`: 2
  - `House & Lot`: 2
  - `null`: 1 (excluded from demand-share denominator; reported separately)
  - `landType`-bearing total: `15`; buyer-scoped total: `16`
- Distinct buyers per `landType` equal the record counts above; 0 buyers appear under more than one `landType`.
- `Condominium`: 0 Available listings, 0 buyer-scoped records — excluded from cards and reported as `"no records in the current dataset"`.

### Decision table

| Property Type | Exact Demand Share | Exact Supply Share | Exact Gap (`demand − supply`) | Display Gap (pp) | Buyers Behind Demand | Listings Behind Supply | Readiness (Low / Med / High / NotAudited) | Decision |
|---|---|---|---|---:|---:|---:|---|---|
| Residential | 7/15 (46.7%) | 4/18 (22.2%) | 22/90 = 11/45 | +24.4 | 7 | 4 | 3 / 1 / 0 / 0 | Sample sufficient; Shortage; 0 blocking → **"Source or promote."** |
| Agricultural | 4/15 (26.7%) | 3/18 (16.7%) | 9/90 = 1/10 | +10.0 | 4 | 3 | 2 / 1 / 0 / 0 | Insufficient sample (4 < `MIN_BUYERS_FOR_DECISION`) → **No decision** |
| Commercial | 2/15 (13.3%) | 3/18 (16.7%) | −3/90 = −1/30 | −3.3 | 2 | 3 | 3 / 0 / 0 / 0 | Insufficient sample (2 < `MIN_BUYERS_FOR_DECISION`) → **No decision** |
| House & Lot | 2/15 (13.3%) | 8/18 (44.4%) | −28/90 = −14/45 | −31.1 | 2 | 8 | 3 / 0 / 0 / 5 | Insufficient sample (2 < `MIN_BUYERS_FOR_DECISION`) → **No type decision.** Operational note: 5 unaudited listings (see Section G). |

## Section G: Operational rule candidate (PENDING, not implemented)

- **`UNAUDITED_AVAILABLE_LISTINGS`** (**PENDING** — scope decision required; not implemented):
  - Trigger condition: fires when any `Available` listing has no audit (`NotAudited`).
  - Scope: counts listings rather than buyers, so it does not use `MIN_BUYERS_FOR_DECISION`.
  - Current dataset count: 5 listings, all `House & Lot`.
  - Status: **PENDING**. Adding this rule to `portfolioRules.js` is a separate scope decision and is not part of this specification.

## Section H: Data limits

- Only `15` `landType`-bearing buyer-scoped preference records exist; with 4 types having at least 2 buyers, only `Residential` currently meets `MIN_BUYERS_FOR_DECISION`.
- The type decision is based on stated preferences, not completed sales. At this sample size, each single buyer shifts a type's demand share by roughly 6 to 7 percentage points (`1/15 ≈ 6.7` points).
- Listing price is not used to evaluate shortage or surplus (only checked for finite `price > 0` for inclusion in supply). Lot size is not normalized, so no surplus or shortage in price or per-sqm terms is inferred.
- No predictive claim is made. Do not use the words `"predict"`, `"forecast"`, or `"conversion"` when describing the decision.

## Section I: Open items

1. Confirm `SHORTAGE_GAP_POINTS`, `SURPLUS_GAP_POINTS`, and `MIN_BUYERS_FOR_DECISION` with Smart Works when possible.
2. Decide whether `UNAUDITED_AVAILABLE_LISTINGS` is added as an operational rule.
3. Decide whether `Medium`-risk listings should block a shortage decision (current provisional choice: no).
4. Confirm the denominator choice for demand shares (`landType`-bearing buyer-scoped records, currently `15`, excluding `null`).
5. AI phrasing is not specified here; it is a later step behind a validator that accepts only figures present in the rule output.
