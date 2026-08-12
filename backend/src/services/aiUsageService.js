import AIUsage from '../models/AIUsage.js';
import AIRateLimit from '../models/AIRateLimit.js';
import AppError from '../utils/errors.js';
import { getUsageDateKey, getNextResetAt } from '../utils/aiUsageTime.js';


const FEATURE_FIELDS = {
  compliance: 'complianceRequests',
  portfolio: 'portfolioRequests',
  market: 'marketInsightRequests',
};

function getDailyLimit() {
  const parsed = parseInt(process.env.AI_DAILY_LIMIT, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
}


function getRpmLimit() {
  const parsed = parseInt(process.env.AI_RPM_LIMIT, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 35;
}

async function ensureDailyRecord(dateKey, dailyLimit) {
  try {
    return await AIUsage.findOneAndUpdate(
      { date: dateKey },
      {
        $setOnInsert: {
          date: dateKey,
          totalRequests: 0,
          complianceRequests: 0,
          portfolioRequests: 0,
          marketInsightRequests: 0,
          dailyLimit,
        },
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    if (err.code === 11000) {
      return AIUsage.findOne({ date: dateKey });
    }
    throw err;
  }
}

async function ensureWindowRecord(windowId) {
  try {
    return await AIRateLimit.findOneAndUpdate(
      { windowId },
      { $setOnInsert: { windowId, count: 0 } },
      { upsert: true, new: true }
    );
  } catch (err) {
    if (err.code === 11000) {
      return AIRateLimit.findOne({ windowId });
    }
    throw err;
  }
}

async function tryConsumeDailyUnit(dateKey, dailyLimit, featureField) {
  const updated = await AIUsage.findOneAndUpdate(
    { date: dateKey, totalRequests: { $lt: dailyLimit } },
    { $inc: { totalRequests: 1, [featureField]: 1 } },
    { new: true }
  );
  return updated; 
}


async function releaseDailyUnit(dateKey, featureField) {
  await AIUsage.updateOne(
    { date: dateKey },
    { $inc: { totalRequests: -1, [featureField]: -1 } }
  );
}


async function tryConsumeRpmSlot(windowId, rpmLimit) {
  const updated = await AIRateLimit.findOneAndUpdate(
    { windowId, count: { $lt: rpmLimit } },
    { $inc: { count: 1 } },
    { new: true }
  );
  return updated; // null means the window is already full
}

export async function reserveAiUsage(feature) {
  const featureField = FEATURE_FIELDS[feature];
  if (!featureField) {
    throw new AppError(`Unknown AI feature identifier: "${feature}".`, 500);
  }

  const dailyLimit = getDailyLimit();
  const dateKey = getUsageDateKey();

  await ensureDailyRecord(dateKey, dailyLimit);
  const afterDaily = await tryConsumeDailyUnit(dateKey, dailyLimit, featureField);

  if (!afterDaily) {
    const resetAt = getNextResetAt();
    throw new AppError(
      "Today's TerraGuide AI usage limit has been reached.",
      429,
      {
        error: 'AI_DAILY_LIMIT_REACHED',
        used: dailyLimit,
        limit: dailyLimit,
        remaining: 0,
        resetAt: resetAt.toISOString(),
      }
    );
  }

  const rpmLimit = getRpmLimit();
  const windowId = Math.floor(Date.now() / 60000);

  await ensureWindowRecord(windowId);
  const afterRpm = await tryConsumeRpmSlot(windowId, rpmLimit);

  if (!afterRpm) {
    // Give back the daily unit we already reserved — this request never
    // actually got to run, so it shouldn't count against today's budget.
    await releaseDailyUnit(dateKey, featureField);

    const secondsIntoWindow = Math.floor(Date.now() / 1000) % 60;
    const retryAfter = 60 - secondsIntoWindow;

    throw new AppError(
      'TerraGuide AI requests are temporarily rate limited. Please try again shortly.',
      429,
      {
        error: 'AI_RATE_LIMIT_REACHED',
        limit: rpmLimit,
        retryAfter,
      }
    );
  }

  return { dateKey, featureField };
}

/**
 * Read-only status snapshot for the Admin Dashboard's AI Usage card.
 */
export async function getUsageStatus() {
  const dailyLimit = getDailyLimit();
  const rpmLimit = getRpmLimit();
  const dateKey = getUsageDateKey();
  const windowId = Math.floor(Date.now() / 60000);

  const [dayRecord, windowRecord] = await Promise.all([
    AIUsage.findOne({ date: dateKey }),
    AIRateLimit.findOne({ windowId }),
  ]);

  const used = dayRecord?.totalRequests || 0;
  const remaining = Math.max(dailyLimit - used, 0);
  const percentage = dailyLimit > 0 ? Math.round((used / dailyLimit) * 100) : 0;

  return {
    daily: {
      used,
      limit: dailyLimit,
      remaining,
      percentage,
    },
    rpm: {
      current: windowRecord?.count || 0,
      limit: rpmLimit,
    },
    breakdown: {
      compliance: dayRecord?.complianceRequests || 0,
      portfolio: dayRecord?.portfolioRequests || 0,
      market: dayRecord?.marketInsightRequests || 0,
    },
    resetAt: getNextResetAt().toISOString(),
  };
}