# Portfolio Analytics Rule Specification

**Status:** Draft specification (Phase A — document only).  
**Scope:** Replacement of the AI-generated portfolio narrative (`POST /api/analytics/portfolio-insights`) with deterministic, rule-based portfolio actions and descriptive summary cards for the Admin Analytics screen (Section 5) and Objective 3 reporting.

---

## A. Scope and Status

### Replaced
- The AI-generated narrative from `generatePortfolioNarrative()` (`backend/src/services/aiService.js`) and its six free-text LLM paragraphs (`portfolioHealth`, `marketTrends`, `buyerBehavior`, `topPerformingCategories`, `risks`, `recommendations`).
- The AI quota/rate-limit call on the portfolio path (hiding the unused AI usage row is out of scope for this specification).

### Retained
- The existing underlying queries in `backend/src/services/analyticsService.js`: `getDashboardSummary()`, `getPropertyRankings()`, `getBuyerIntelligence()`, and `getSalesPerformance()`.
- The existing readiness formula: `marketReadinessScore = Math.round(complianceScore * 0.6 + priceCompetitivenessScore * 0.4)` (`calculateMarketReadinessScore`, `analyticsService.js:56-58`).
- The existing risk classification function: `computeRiskLevel(audit)` (`analyticsService.js:38-41`) delegating to `classifyAuditRisk(documentCompleteness ?? complianceScore)` (`auditReadiness.js:408-412`).

### Readiness Snapshot Code-Path Difference (Recorded, Not Fixed in Phase A)
- `getPropertyRankings({ availableOnly = false, useComparablePricing = false })` (`analyticsService.js:258-316`) defaults `useComparablePricing` to `false`.
- Currently, **three** admin paths omit `useComparablePricing` and therefore receive `priceCompetitivenessScore = 50` and `marketReadinessScore = Math.round(audit.complianceScore * 0.6 + 50 * 0.4)`:
  1. The admin rankings endpoint (`backend/src/controllers/AnalyticsController.js:54` calling `analyticsService.getPropertyRankings()`).
  2. The portfolio snapshot builder (`backend/src/services/analyticsService.js:460` calling `getPropertyRankings()`).
  3. The analytics export service (`backend/src/services/exportService.js:363` calling `getPropertyRankings()`).
- Only `getBuyerMarketTrends()` (`AnalyticsController.js:110` $\rightarrow$ `analyticsService.js:572`) currently passes `useComparablePricing: true`, which computes `priceCompetitivenessScore = calculatePriceCompetitiveness(property.price, peers).score` against other `Available` listings of the same `type`.
- Under the target implementation, the portfolio snapshot, the admin rankings endpoint, and `exportService.js:363` will all pass `useComparablePricing: true` so the admin screen, portfolio snapshot, and exported reports share the exact same readiness values.

### Provisional Thresholds (`PROVISIONAL`)
All numeric thresholds introduced by the rules below are **PROVISIONAL** defaults until confirmed by Smart Works:
1. `PRICING_OVER_AVERAGE_RATIO = 0.20` (**PROVISIONAL** — 20% above the average price of other `Available` listings of the same `type`).
2. `UNANSWERED_INQUIRY_DAYS = 7` (**PROVISIONAL** — 7 days pending).
3. `DEMAND_GAP_MIN_BUYERS = 3` (**PROVISIONAL** — at least 3 unmatched buyers).
4. `MIN_PEER_LISTINGS_FOR_PRICING = 1` (**PROVISIONAL** — at least 1 other valid-priced `Available` listing of the same `type`).

*(Document readiness uses the existing `'High'` risk level from `computeRiskLevel` — no new numeric threshold is added. Stalled site visits compare `preferredDate` directly against the start of the current `Asia/Manila` day — no threshold constant is needed.)*

---

## B. Shared Definitions

1. **Reference Date (`referenceDate`)**:
   - The request timestamp (`new Date()`), evaluated in **`Asia/Manila`** calendar terms (`UTC+8`).
   - `referenceDayStart` is `00:00:00.000` in `Asia/Manila` on the reference date's calendar day (for date-only comparisons such as `SiteVisit.preferredDate`).
   - Day-age calculations (such as inquiry age) compare `createdAt` against `referenceDate - N * 24 * 60 * 60 * 1000`.
2. **Available-Listing Set (`availableListings`)**:
   - All `Property` documents where `status === 'Available'` (`Property.js:71-75`).
   - Excludes `'Reserved'` and `'Sold'` listings.
3. **Audited-Property Set (`auditedProperties`)**:
   - All `Property` documents that have at least one `Audit` document (`Audit.propertyId === Property._id`, using the latest `Audit` ordered by `generatedAt: -1`, `analyticsService.js:25-36`).
   - Properties with no `Audit` document are **unaudited** (`computeRiskLevel(null) === null`).
4. **Currency Convention**:
   - `Property.price`, `BuyerPreference.budgetMin`, `BuyerPreference.budgetMax`, and `Transaction.amount` are stored as numeric values in Philippine Pesos (₱). `Property` has no separate currency/unit field (`Property.js:54-58`).

---

## C. Rules

**Template Interpolation Rule:** Every threshold number appearing in an action sentence (such as `{pricingOverAveragePercent}%` and `{unansweredInquiryDays} days`) must be built programmatically from the named constants (`PRICING_OVER_AVERAGE_RATIO`, `UNANSWERED_INQUIRY_DAYS`, `DEMAND_GAP_MIN_BUYERS`) rather than hardcoded literals.

### Rule 1: Document Readiness (`HIGH_RISK_DOCUMENTS`)
- **Inputs**:
  - `Property._id`, `Property.name`, `Property.type`, `Property.status` (`Property.js:14, 29, 71`)
  - Latest `Audit` per property: `Audit.propertyId`, `Audit.documentCompleteness`, `Audit.complianceScore`, `Audit.generatedAt` (`Audit.js:15, 20, 39, 67`)
  - Filter: `Available` and `Reserved` listings in `auditedProperties` (`status === 'Available' || status === 'Reserved'`). **`Sold` listings are excluded.**
- **Named Constant**:
  - `HIGH_RISK_LEVEL = 'High'` (existing output of `computeRiskLevel` / `classifyAuditRisk`, where `score < 40`; no new numeric threshold).
- **Trigger (Pseudocode)**:
  ```text
  activeAudited = auditedProperties.filter(p => p.status === 'Available' || p.status === 'Reserved')
  matches = []
  for property in activeAudited:
    audit = latestAuditByPropertyId.get(property._id)
    if computeRiskLevel(audit) === HIGH_RISK_LEVEL:
      matches.push(property)
  fires = matches.length > 0
  ```
- **Action Text Template**:
  - Single match: `"Review document readiness for 1 high-risk listing ({propertyName}, ID {propertyId})."`
  - Multiple matches: `"Review document readiness for {count} high-risk listings, starting with {propertyName} (ID {propertyId})."`
- **Evidence**:
  - Array of `{ propertyId, propertyName, type, status, complianceScore, riskLevel }` sorted by `complianceScore` ascending, then `propertyId` ascending. No `owner`, buyer name, or email.
- **Sample Size**:
  - Qualified by `activeAudited.length`. If `activeAudited.length === 0`, rule does not fire and displays: `"No audited Available or Reserved properties yet; run document readiness audits before evaluating high-risk listings."`
- **Edge Cases**:
  - **No matches** (`activeAudited.length > 0`, 0 High risk): rule does not fire (no action emitted).
  - **One match**: singular phrasing with `{propertyName}` and `{propertyId}`.
  - **`Sold` listing with High risk**: excluded by the `Available` / `Reserved` filter and never triggers Rule 1.
  - **Unaudited property**: excluded from `activeAudited` (`computeRiskLevel(null) === null`); counted separately under `NotAudited` in the Risks card.
  - **Listing with no price**: still evaluated by Rule 1 because price is not an input to `computeRiskLevel`.
- **Test Cases**:
  1. `auditedProperties = [P1 (status: 'Available', complianceScore: 30, riskLevel: 'High'), P2 (status: 'Reserved', complianceScore: 80, riskLevel: 'Low')]` $\rightarrow$ fires, `count = 1`, evidence `[P1]`, singular action text referencing `P1`.
  2. `auditedProperties = [P1 (status: 'Sold', complianceScore: 20, riskLevel: 'High'), P2 (status: 'Available', complianceScore: 75, riskLevel: 'Low')]` $\rightarrow$ `P1` is excluded as `Sold`; does not fire, `matches = []`.
  3. `activeAudited = []` (only unaudited properties or `Sold` properties exist) $\rightarrow$ does not fire, sample-size note shown.

---

### Rule 2: Pricing Check (`PRICED_ABOVE_TYPE_AVERAGE`)
- **Inputs**:
  - `Property._id`, `Property.name`, `Property.type`, `Property.price`, `Property.status` (`Property.js:14, 29, 54, 71`)
  - Filter: `availableListings` with `typeof property.price === 'number' && Number.isFinite(property.price) && property.price > 0`.
- **Peer-Set Consistency**:
  - The peer set for any evaluated listing is the set of **other** `Available` listings of the same `Property.type` (excluding the listing being scored). This is the exact same peer set used by `getPropertyRankings(..., { useComparablePricing: true })` (`analyticsService.js:261, 289-291`), so Rule 2 and the comparable-pricing readiness score share a single definition of the peer set.
- **Named Constants**:
  - `PRICING_OVER_AVERAGE_RATIO = 0.20` (**PROVISIONAL** — 20% above the mean price of other `Available` listings of the same `type`).
  - `MIN_PEER_LISTINGS_FOR_PRICING = 1` (**PROVISIONAL** — requires at least 1 other valid-priced `Available` peer of the same `type`).
- **Trigger (Pseudocode)**:
  ```text
  validAvailable = availableListings.filter(p => Number.isFinite(p.price) && p.price > 0)
  byType = groupBy(validAvailable, p => p.type)
  matches = []
  for [type, group] of byType:
    for property of group:
      peers = group.filter(candidate => candidate._id !== property._id)
      if peers.length < MIN_PEER_LISTINGS_FOR_PRICING:
        continue
      peerAvg = sum(peers.map(p => p.price)) / peers.length
      threshold = peerAvg * (1 + PRICING_OVER_AVERAGE_RATIO)
      if property.price > threshold:
        pctAbove = round(((property.price - peerAvg) / peerAvg) * 100)
        matches.push({ property, peerAvg, pctAbove })
  fires = matches.length > 0
  ```
- **Action Text Template** *(where `pricingOverAveragePercent = Math.round(PRICING_OVER_AVERAGE_RATIO * 100)`)*:
  - Single match: `"Review pricing for 1 Available listing priced more than {pricingOverAveragePercent}% above its peer average ({propertyName}, ID {propertyId}, {percentAboveAverage}% above peers)."`
  - Multiple matches: `"Review pricing for {count} Available listings priced more than {pricingOverAveragePercent}% above their peer average, starting with {propertyName} (ID {propertyId}, {percentAboveAverage}% above peers)."`
- **Evidence**:
  - Array of `{ propertyId, propertyName, type, price, peerAveragePrice, percentAboveAverage }` sorted by `percentAboveAverage` descending, then `propertyId` ascending. No `owner`, buyer name, or email.
- **Sample Size**:
  - Qualified per listing by `peers.length >= MIN_PEER_LISTINGS_FOR_PRICING` (equivalently `group.length >= 2` valid-priced `Available` listings in that `type`). Types with fewer than 2 valid-priced `Available` listings are skipped; if no type has $\ge 2$ valid-priced `Available` listings, rule does not fire and displays: `"Not enough comparable Available listings of the same type to check pricing."`
- **Edge Cases**:
  - **No matches**: rule does not fire.
  - **One match**: singular phrasing with `{propertyName}`, `{propertyId}`, and `{percentAboveAverage}%`.
  - **Listing with no price (`null`, `undefined`, `<= 0`, `NaN`)**: excluded from both peer averages and trigger checks.
  - **Boundary (`price === peerAvg * (1 + PRICING_OVER_AVERAGE_RATIO)`)**: strict `>` does not trigger.
- **Test Cases**:
  1. `Residential` `Available` listings `[P1: 1_000_000, P2: 1_000_000, P3: 1_900_000]`:
     - For `P3 (1_900_000)`: other peers `[1_000_000, 1_000_000]` $\rightarrow$ `peerAvg = 1_000_000`, `threshold = 1_200_000`. `1_900_000 > 1_200_000` $\rightarrow$ **fires** with `percentAboveAverage = 90%`.
     - For `P1 (1_000_000)` and `P2 (1_000_000)`: other peers `[1_000_000, 1_900_000]` $\rightarrow$ `peerAvg = 1_450_000`, `threshold = 1_740_000`. `1_000_000` is not above `1_740_000` $\rightarrow$ neither fires.
     - Result: fires, `count = 1`, evidence `[P3]` at `90%` above peers.
  2. `Residential` `Available` listings `[P1: 1_000_000, P2: 1_100_000, P3: 1_200_000]`:
     - For `P3 (1_200_000)`: other peers `[1_000_000, 1_100_000]` $\rightarrow$ `peerAvg = 1_050_000`, `threshold = 1_260_000`. `1_200_000 <= 1_260_000` $\rightarrow$ does not fire.
     - `P1` (`peerAvg = 1_150_000`, `threshold = 1_380_000`) and `P2` (`peerAvg = 1_100_000`, `threshold = 1_320_000`) also do not fire.
     - Result: does not fire.
  3. Only 1 `Commercial` listing with valid price (`5_000_000`), plus 1 `Commercial` listing with `price: null` $\rightarrow$ `peers.length = 0 < 1`, skipped, does not fire.

---

### Rule 3: Unanswered Inquiries (`STALE_PENDING_INQUIRIES`)
- **Inputs**:
  - `Inquiry._id`, `Inquiry.status`, `Inquiry.createdAt`, `Inquiry.propertyId` (`Inquiry.js:14, 41, 47`)
  - Joined `Property.name` (`Property.js:14`) for display only; `Inquiry.buyerId` is **not** exposed.
  - Filter: `Inquiry.status === 'Pending'`.
- **Named Constant**:
  - `UNANSWERED_INQUIRY_DAYS = 7` (**PROVISIONAL** — 7 days).
- **Trigger (Pseudocode)**:
  ```text
  cutoff = new Date(referenceDate.getTime() - UNANSWERED_INQUIRY_DAYS * 24 * 60 * 60 * 1000)
  matches = inquiries.filter(inq =>
    inq.status === 'Pending' &&
    inq.createdAt instanceof Date &&
    inq.createdAt.getTime() < cutoff.getTime()
  )
  fires = matches.length > 0
  ```
- **Action Text Template** *(where `unansweredInquiryDays = UNANSWERED_INQUIRY_DAYS`)*:
  - Single match: `"Respond to 1 inquiry pending for more than {unansweredInquiryDays} days on {propertyName} (Property ID {propertyId})."`
  - Multiple matches: `"Respond to {count} inquiries pending for more than {unansweredInquiryDays} days, oldest on {propertyName} (Property ID {propertyId})."`
- **Evidence**:
  - Array of `{ inquiryId, propertyId, propertyName, createdAt, daysPending }` sorted by `createdAt` ascending (oldest first). No buyer name, email, or inquiry message body.
- **Sample Size**:
  - Qualified by `pendingInquiries.length`. If 0 pending inquiries exist, rule does not fire (no sample-size warning needed).
- **Edge Cases**:
  - **No matches** (all pending inquiries $\le \text{UNANSWERED\_INQUIRY\_DAYS}$ old, or 0 pending inquiries): rule does not fire.
  - **One match**: singular phrasing with `{propertyName}` and `{propertyId}`.
  - **Orphaned `propertyId`** (referenced property deleted): render `propertyName = 'Unavailable listing'` and keep `propertyId`.
- **Test Cases**:
  1. `referenceDate = 2026-11-26T12:00:00Z`; 1 `Pending` inquiry with `createdAt = 2026-11-18T12:00:00Z` (8 days old) $\rightarrow$ fires, `count = 1`.
  2. `referenceDate = 2026-11-26T12:00:00Z`; 2 `Pending` inquiries with `createdAt = 2026-11-24T12:00:00Z` (2 days old) $\rightarrow$ does not fire.
  3. `referenceDate = 2026-11-26T12:00:00Z`; 1 `Responded` inquiry with `createdAt = 2026-10-01T00:00:00Z` $\rightarrow$ ignored (status is not `'Pending'`), does not fire.

---

### Rule 4: Stalled Site Visits (`OVERDUE_PENDING_SITE_VISITS`)
- **Inputs**:
  - `SiteVisit._id`, `SiteVisit.status`, `SiteVisit.preferredDate`, `SiteVisit.propertyId` (`SiteVisit.js:12, 17, 69`)
  - Joined `Property.name` (`Property.js:14`) for display only; `SiteVisit.buyerId` is **not** exposed.
  - Filter: `SiteVisit.status === 'Pending'`.
- **Named Constant**:
  - None. Rule 4 compares `preferredDate` directly against `referenceDayStart` in `Asia/Manila`.
- **Trigger (Pseudocode)**:
  ```text
  matches = siteVisits.filter(visit =>
    visit.status === 'Pending' &&
    visit.preferredDate instanceof Date &&
    visit.preferredDate.getTime() < referenceDayStart.getTime()
  )
  fires = matches.length > 0
  ```
- **Action Text Template**:
  - Single match: `"Follow up on 1 pending site visit whose preferred date has passed on {propertyName} (Property ID {propertyId})."`
  - Multiple matches: `"Follow up on {count} pending site visits whose preferred dates have passed, earliest on {propertyName} (Property ID {propertyId})."`
- **Evidence**:
  - Array of `{ siteVisitId, propertyId, propertyName, preferredDate }` (date formatted `YYYY-MM-DD`) sorted by `preferredDate` ascending. No buyer name, email, or notes.
- **Sample Size**:
  - Qualified by `pendingSiteVisits.length`. If 0 pending site visits exist, rule does not fire.
- **Edge Cases**:
  - **No matches** (all pending visits have `preferredDate >= referenceDayStart`, or 0 pending visits): rule does not fire.
  - **One match**: singular phrasing with `{propertyName}` and `{propertyId}`.
  - **Same-day visit** (`preferredDate` on the same `Asia/Manila` calendar day as `referenceDate`): `preferredDate >= referenceDayStart`, so it does not trigger until the next Manila calendar day.
- **Test Cases**:
  1. `referenceDayStart = 2026-11-26T00:00:00+08:00`; 1 `Pending` visit with `preferredDate = 2026-11-20` $\rightarrow$ fires, `count = 1`.
  2. `referenceDayStart = 2026-11-26T00:00:00+08:00`; 2 `Pending` visits with `preferredDate = 2026-11-26` and `2026-12-01` $\rightarrow$ does not fire.
  3. `referenceDayStart = 2026-11-26T00:00:00+08:00`; 1 `Scheduled` visit with `preferredDate = 2026-11-10` $\rightarrow$ ignored (status is not `'Pending'`), does not fire.

---

### Rule 5: Demand Gap (`UNMET_BUYER_BUDGET_DEMAND`)
- **Inputs**:
  - `BuyerPreference.budgetMin`, `BuyerPreference.budgetMax` (`BuyerPreference.js:12-20`; both `Number`, `default: null`)
  - `Property.price`, `Property.status` (`Property.js:54, 71`)
  - Filter: `availableListings` with valid positive numeric `price`; `BuyerPreference` records where at least one of `budgetMin` or `budgetMax` is a finite positive number.
  - **Record-to-Buyer Correspondence**: `BuyerPreference` has one record per buyer (`userId` has `unique: true`, `BuyerPreference.js:9`), so counting `BuyerPreference` records equals counting buyers.
- **Named Constant**:
  - `DEMAND_GAP_MIN_BUYERS = 3` (**PROVISIONAL** — at least 3 unmatched buyers).
- **Trigger (Pseudocode)**:
  ```text
  validPrices = availableListings
    .map(p => p.price)
    .filter(price => typeof price === 'number' && Number.isFinite(price) && price > 0)

  evaluatedBuyers = 0
  unmatchedBuyers = 0
  for pref of buyerPreferences:
    hasMin = typeof pref.budgetMin === 'number' && Number.isFinite(pref.budgetMin) && pref.budgetMin > 0
    hasMax = typeof pref.budgetMax === 'number' && Number.isFinite(pref.budgetMax) && pref.budgetMax > 0
    if !hasMin && !hasMax:
      continue // both bounds null/unset -> excluded
    if hasMin && hasMax && pref.budgetMin > pref.budgetMax:
      continue // invalid inverted range -> excluded
    evaluatedBuyers += 1
    minBound = hasMin ? pref.budgetMin : 0
    maxBound = hasMax ? pref.budgetMax : Infinity
    hasMatchingListing = validPrices.some(price => price >= minBound && price <= maxBound)
    if !hasMatchingListing:
      unmatchedBuyers += 1

  fires = unmatchedBuyers >= DEMAND_GAP_MIN_BUYERS
  ```
- **Action Text Template**:
  - `"Source listings for {count} buyers whose stated budget range currently has no Available property."`
- **Evidence**:
  - Anonymous aggregate summary only: `{ unmatchedBuyerCount, evaluatedBuyerCount, availableListingsWithPriceCount }`. No `userId`, buyer name, or email is returned.
- **Sample Size**:
  - Qualified by `evaluatedBuyers >= DEMAND_GAP_MIN_BUYERS`. If `evaluatedBuyers < DEMAND_GAP_MIN_BUYERS`, rule does not fire and displays: `"Fewer than {demandGapMinBuyers} buyers have recorded budget bounds; demand-gap check requires at least {demandGapMinBuyers}."`
- **Edge Cases**:
  - **No matches** (`unmatchedBuyers === 0`): rule does not fire.
  - **Minimum-buyer case**: `unmatchedBuyers === 2` does not fire; `unmatchedBuyers === 3` fires.
  - **Buyer with both `budgetMin: null` and `budgetMax: null`**: excluded from `evaluatedBuyers` and `unmatchedBuyers`.
  - **Buyer with one null bound**: `budgetMin: null, budgetMax: 1_500_000` checks `price <= 1_500_000`; `budgetMin: 5_000_000, budgetMax: null` checks `price >= 5_000_000`.
  - **Listing with no price (`null` or `<= 0`)**: excluded from `validPrices` so it cannot falsely satisfy a buyer's budget.
- **Test Cases**:
  1. `availableListings` prices `[3_000_000, 4_000_000]`; 3 buyers with `[500_000, 1_000_000]` $\rightarrow$ fires, `unmatchedBuyerCount = 3`.
  2. `availableListings` prices `[3_000_000]`; 2 buyers with `[500_000, 1_000_000]` and 1 buyer with `[2_000_000, 3_500_000]` $\rightarrow$ `unmatchedBuyerCount = 2 < 3`, does not fire.
  3. `availableListings` prices `[3_000_000]`; 4 buyers with `{ budgetMin: null, budgetMax: null }` $\rightarrow$ `evaluatedBuyerCount = 0`, does not fire, sample-size note shown.

---

## D. Section 5 Cards (Replacing the AI Narrative)

Every number on every card maps to a named query or rule in this specification:

| Card Title | Query / Rule Backing Each Number | Sentence / Display Template | Can Be Empty? |
| :--- | :--- | :--- | :--- |
| **Portfolio Health** | `getDashboardSummary()` (`totalProperties`, `availableProperties`, `reservedProperties`, `soldProperties`, `estimatedPortfolioValue`, `totalBuyers`, `averageComplianceScore`, `auditedPropertiesCount`) | `"The portfolio contains {totalProperties} properties ({availableProperties} Available, {reservedProperties} Reserved, {soldProperties} Sold) with an estimated value of {estimatedPortfolioValue}, {totalBuyers} registered buyers, and an average compliance score of {averageComplianceScore}% across {auditedPropertiesCount} audited properties."` | No (renders `0` counts when empty) |
| **Market Trends** | `getSalesPerformance()` (`totalRevenue`, `revenueYTD`, `monthlyAverage`, `monthlyTrend.length`, `isApproximate`, `note`). `forecastNextMonth` is no longer shown. | `"Completed transactions total {totalRevenue} in recorded revenue ({revenueYTD} year-to-date), averaging {monthlyAverage} per active month."` (+ `note` when `isApproximate === true`; when `monthlyTrend.length < 3`, append `"No projection is shown while fewer than 3 completed months exist."`) | Yes — if `totalRevenue === 0`, shows `"No completed transactions recorded yet."` |
| **Buyer Behavior** | `getBuyerIntelligence()` (`totalBuyersWithPreferences`, `preferredTypes[0]`, `preferredLocations[0]`, and corrected `averageBudget` computed only over `BuyerPreference` records where both `budgetMin` and `budgetMax` are non-null, with count `buyersWithBothBudgetBounds`). *(Note: this describes the corrected `averageBudget` behavior; updating `getBuyerIntelligence()` in code is a separate task.)* | `"{totalBuyersWithPreferences} buyers have recorded preferences, with an average stated budget of {averageBudget} (based on {buyersWithBothBudgetBounds} buyers with both bounds). Top recorded type: {topPreferredType or 'None'}; top recorded location: {topPreferredLocation or 'None'}."` | Yes — if `totalBuyersWithPreferences === 0`, shows `"No buyer preferences recorded yet."` |
| **Portfolio Breakdown by Type & Risk** *(replaces Top-Performing Categories)* | `Property` + latest `Audit` grouped by `Property.type` and `computeRiskLevel(audit)` (`High`, `Medium`, `Low`, `NotAudited`) — no inferred ranking | Structured counts table/list: for each `Property.type` present, `{type}: {total} total ({Low} Low, {Medium} Medium, {High} High, {NotAudited} Not Audited)`. | Yes — if `totalProperties === 0`, shows `"No properties recorded yet."` |
| **Risks** | `getPortfolioSnapshot().riskCounts` (`High`, `Medium`, `Low`, `NotAudited` from `getPropertyRankings()`) | `"Audited risk breakdown: {High} High, {Medium} Medium, {Low} Low, and {NotAudited} properties not yet audited."` | No (renders `0` counts when empty) |
| **Recommendations** | Rules 1–5 (`HIGH_RISK_DOCUMENTS`, `PRICED_ABOVE_TYPE_AVERAGE`, `STALE_PENDING_INQUIRIES`, `OVERDUE_PENDING_SITE_VISITS`, `UNMET_BUYER_BUDGET_DEMAND`) | Ordered list of fired rule action sentences (built from the named constants) with expandable/inline non-personal evidence items. | Yes — if no rule fires, shows `"No action rules triggered for the current portfolio snapshot."` |

---

## E. Figures That Must Not Appear

The following figures from earlier sample/draft narratives have **no backing query** in `analyticsService.js` and are explicitly removed:
- `"21 properties"` (hardcoded/stale sample count — must always come from `getDashboardSummary().totalProperties`).
- `"76%"` / `"76% pass rate"` / any `"pass rate"` phrasing conflated with sales performance (`averageSuccessRate` is strictly the share of audited properties with `complianceScore >= 70`, not a sales or approval metric).
- `"suburban"` (unbacked narrative adjective — location labels must come verbatim from `BuyerPreference.location` or `Property.location`).
- `"conversion"` / `"conversion rate"` (no query in `analyticsService.js` computes an inquiry-to-transaction ratio).

---

## F. Data Limits (Current Dataset Snapshot)

Current dataset counts verified via read-only query on `2026-11-26` (`Asia/Manila`) and the dataset summary:
- **19 properties** (18 `Available`/`Reserved`: 11 `Low`, 2 `Medium`, 0 `High`, 5 `NotAudited`; 1 `Sold`: 1 `NotAudited`)
- **2 completed transactions** (fewer than 3 completed months; no projection shown on Market Trends)
- **15 searches on one day** (not an input to Rules 1–5)
- **23 buyer preference records** (22 with both `budgetMin` and `budgetMax` non-null, 0 with only one bound, 1 with both `null`)
- **3 pending site visits**
- **2 pending inquiries**

Current rule match counts on this dataset:
1. **Rule 1 (`HIGH_RISK_DOCUMENTS`)**: **0 matches currently** (0 `High`-risk listings among the 18 `Available`/`Reserved` properties; the 1 `Sold` property is excluded).
2. **Rule 2 (`PRICED_ABOVE_TYPE_AVERAGE`)**: **5 matches currently** across 4 eligible `Available` property types with $\ge 2$ valid-priced listings (`Residential`: 4, `Commercial`: 3, `Agricultural`: 3, `House & Lot`: 8).
3. **Rule 3 (`STALE_PENDING_INQUIRIES`)**: **0 matches currently** (0 of the 2 pending inquiries are older than `UNANSWERED_INQUIRY_DAYS` = 7 days).
4. **Rule 4 (`OVERDUE_PENDING_SITE_VISITS`)**: **1 match currently** (1 of the 3 pending site visits has `preferredDate` before `2026-11-26` in `Asia/Manila`).
5. **Rule 5 (`UNMET_BUYER_BUDGET_DEMAND`)**: **7 matches currently** (7 of 22 buyers with recorded budget bounds have no `Available` listing within their stated budget range; 1 record with both bounds `null` is excluded).

---

## G. Open Items

1. **Confirm `PROVISIONAL` thresholds with Smart Works**:
   - `PRICING_OVER_AVERAGE_RATIO = 0.20` (20% above peer average)
   - `UNANSWERED_INQUIRY_DAYS = 7` (7 days pending)
   - `DEMAND_GAP_MIN_BUYERS = 3` (minimum 3 unmatched buyers)
   - `MIN_PEER_LISTINGS_FOR_PRICING = 1` (minimum 1 other peer listing of the same type)
2. **Announce readiness snapshot change**:
   - Passing `useComparablePricing: true` in `getPortfolioSnapshot()` (`analyticsService.js:460`), `GET /api/analytics/rankings` (`AnalyticsController.js:54`), and `exportService.js:363` will replace the fixed `priceCompetitivenessScore = 50` currently used on the Admin Analytics rankings table and exported reports with peer-based pricing against `Available` listings of the same `type`, shifting displayed `marketReadinessScore` values once implemented.
3. **Code follow-up (`averageBudget`)**:
   - Update `getBuyerIntelligence()` (`analyticsService.js:331, 367-369`) to exclude preferences where either `budgetMin` or `budgetMax` is `null` and return `buyersWithBothBudgetBounds`.
