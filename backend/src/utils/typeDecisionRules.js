// PROVISIONAL: pending Smart Works confirmation
export const SHORTAGE_GAP_POINTS = 15;

// PROVISIONAL: pending Smart Works confirmation
export const SURPLUS_GAP_POINTS = -15;

// PROVISIONAL: pending Smart Works confirmation
export const MIN_BUYERS_FOR_DECISION = 5;

const SUPPLY_BUCKET_FIELDS = ['listings', 'low', 'medium', 'high', 'notAudited'];

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertNonNegativeInteger(value, fieldName) {
  if (value === undefined || value === null) {
    throw new TypeError(`${fieldName} is required.`);
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new TypeError(`${fieldName} must be a non-negative integer.`);
  }
}

function validateSupplyByType(supplyByType) {
  if (!isPlainObject(supplyByType)) {
    throw new TypeError('supplyByType must be a plain object.');
  }

  for (const [type, bucket] of Object.entries(supplyByType)) {
    if (!isPlainObject(bucket)) {
      throw new TypeError(`supplyByType.${type} must be a plain object.`);
    }
    for (const field of SUPPLY_BUCKET_FIELDS) {
      assertNonNegativeInteger(bucket[field], `supplyByType.${type}.${field}`);
    }
    const bucketSum = bucket.low + bucket.medium + bucket.high + bucket.notAudited;
    if (bucketSum !== bucket.listings) {
      throw new TypeError(
        `supplyByType.${type}: low + medium + high + notAudited (${bucketSum}) must equal listings (${bucket.listings}).`
      );
    }
  }
}

function validateDemandByType(demandByType) {
  if (!isPlainObject(demandByType)) {
    throw new TypeError('demandByType must be a plain object.');
  }

  for (const [type, count] of Object.entries(demandByType)) {
    assertNonNegativeInteger(count, `demandByType.${type}`);
  }
}

function formatPercent(numerator, denominator) {
  const pct = Number(((numerator / denominator) * 100).toFixed(1));
  return Object.is(pct, -0) ? 0 : pct;
}

function formatGapPoints(diff100, denominator) {
  const gap = Number((diff100 / denominator).toFixed(1));
  return Object.is(gap, -0) ? 0 : gap;
}

function buildSentence({
  type,
  buyers,
  listings,
  demandSharePct,
  supplySharePct,
  gapPointsDisplay,
  decision,
  blockingCount,
  unauditedCount,
}) {
  if (decision === 'no_records') {
    return `${type}: no records in the current dataset.`;
  }
  if (decision === 'insufficient_data') {
    return `${type}: not enough records to compute a comparison.`;
  }
  if (decision === 'insufficient_sample') {
    return `${type}: ${buyers} buyer(s) prefer this type; below the ${MIN_BUYERS_FOR_DECISION} buyer minimum, so no decision is made. Gap shown for reference: ${gapPointsDisplay} points.`;
  }
  if (decision === 'shortage') {
    if (blockingCount > 0) {
      const listingWord = blockingCount === 1 ? 'listing' : 'listings';
      return `${type}: ${buyers} buyers prefer this type (${demandSharePct}% of stated preferences) against ${listings} Available listings (${supplySharePct}% of supply). Complete document checks on ${blockingCount} existing ${listingWord} first, then source.`;
    }
    return `${type}: ${buyers} buyers prefer this type (${demandSharePct}% of stated preferences) against ${listings} Available listings (${supplySharePct}% of supply). Source or promote.`;
  }
  if (decision === 'surplus') {
    if (unauditedCount > 0) {
      const listingWord = unauditedCount === 1 ? 'listing' : 'listings';
      return `${type}: ${buyers} buyers prefer this type (${demandSharePct}%) against ${listings} Available listings (${supplySharePct}%). Audit ${unauditedCount} unaudited ${listingWord} before any pricing or promotion decision.`;
    }
    return `${type}: ${buyers} buyers prefer this type (${demandSharePct}%) against ${listings} Available listings (${supplySharePct}%). Hold this type.`;
  }
  return `${type}: ${buyers} buyers (${demandSharePct}%) against ${listings} listings (${supplySharePct}%). Within range; no action.`;
}

export function evaluateTypeDecisions(input) {
  if (!isPlainObject(input)) {
    throw new TypeError('input must be a plain object.');
  }

  const { supplyByType, demandByType, nullDemandCount = 0 } = input;
  validateSupplyByType(supplyByType);
  validateDemandByType(demandByType);
  assertNonNegativeInteger(nullDemandCount, 'nullDemandCount');

  const types = Array.from(new Set([...Object.keys(supplyByType), ...Object.keys(demandByType)])).sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0
  );

  let supplyTotal = 0;
  for (const bucket of Object.values(supplyByType)) {
    supplyTotal += bucket.listings;
  }

  let demandTotal = 0;
  for (const count of Object.values(demandByType)) {
    demandTotal += count;
  }

  const decisions = types.map((type) => {
    const supply = supplyByType[type] ?? { listings: 0, low: 0, medium: 0, high: 0, notAudited: 0 };
    const buyers = demandByType[type] ?? 0;
    const listings = supply.listings;
    const readiness = {
      low: supply.low,
      medium: supply.medium,
      high: supply.high,
      notAudited: supply.notAudited,
    };

    const demandShare = { numerator: buyers, denominator: demandTotal };
    const supplyShare = { numerator: listings, denominator: supplyTotal };

    if (demandTotal === 0 || supplyTotal === 0) {
      const decision = 'insufficient_data';
      return {
        type,
        buyers,
        listings,
        demandShare,
        supplyShare,
        gapPointsDisplay: null,
        decision,
        blockingCount: 0,
        unauditedCount: 0,
        readiness,
        sentence: buildSentence({ type, decision }),
      };
    }

    if (listings === 0 && buyers === 0) {
      const decision = 'no_records';
      return {
        type,
        buyers,
        listings,
        demandShare,
        supplyShare,
        gapPointsDisplay: 0,
        decision,
        blockingCount: 0,
        unauditedCount: 0,
        readiness,
        sentence: buildSentence({ type, decision }),
      };
    }

    const diff100 = 100 * (buyers * supplyTotal - listings * demandTotal);
    const denominator = demandTotal * supplyTotal;
    const gapPointsDisplay = formatGapPoints(diff100, denominator);
    const demandSharePct = formatPercent(buyers, demandTotal);
    const supplySharePct = formatPercent(listings, supplyTotal);

    let decision;
    let blockingCount = 0;
    let unauditedCount = 0;

    if (buyers < MIN_BUYERS_FOR_DECISION) {
      decision = 'insufficient_sample';
    } else if (diff100 >= SHORTAGE_GAP_POINTS * denominator) {
      decision = 'shortage';
      blockingCount = readiness.high + readiness.notAudited;
    } else if (diff100 <= SURPLUS_GAP_POINTS * denominator) {
      decision = 'surplus';
      unauditedCount = readiness.notAudited;
    } else {
      decision = 'within_range';
    }

    return {
      type,
      buyers,
      listings,
      demandShare,
      supplyShare,
      gapPointsDisplay,
      decision,
      blockingCount,
      unauditedCount,
      readiness,
      sentence: buildSentence({
        type,
        buyers,
        listings,
        demandSharePct,
        supplySharePct,
        gapPointsDisplay,
        decision,
        blockingCount,
        unauditedCount,
      }),
    };
  });

  return {
    demandTotal,
    supplyTotal,
    nullDemandCount,
    decisions,
  };
}
