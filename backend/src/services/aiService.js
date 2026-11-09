/**
 * AI SERVICE USING NVIDIA NIM (NEMOTRON 3.5 LIGHTNING 30B A3B)
 *
 * Replaces Google Gemini SDK calls with direct NVIDIA NIM API requests.
 * Exposes both generateComplianceInsights and generatePortfolioNarrative
 * to support Phase 6 AI Compliance Audits and the BI Analytics Dashboard.
 */

import { reserveAiUsage } from './aiUsageService.js';

/**
 * Generates compliance findings and predictive recommendations for a single property listing.
 */
export async function generateComplianceInsights(facts) {
  const apiKey = process.env.NVIDIA_API_KEY;

  if (!apiKey) {
    throw createAiDiagnosticError(
      'NVIDIA AI configuration is unavailable.',
      { code: 'AI_CONFIGURATION_ERROR', category: 'configuration' }
    );
  }

  // Central AI control — checks TerraGuide's daily quota and RPM safety
  // limit atomically, and throws before NVIDIA is ever called if either
  // is exhausted. Shared by all three AI features, see aiUsageService.js.
  try {
    await reserveAiUsage('compliance');
  } catch (error) {
    throw decorateUsageError(error);
  }

  const prompt = buildCompliancePrompt(facts);
  const rawText = await callNvidiaModel(apiKey, prompt);

  let parsed;
  try {
    parsed = parseJsonResponse(rawText);
  } catch (err) {
    throw createNarrativeValidationError('AI response was not valid JSON.', 'JSON_OBJECT', 'AI_INVALID_RESPONSE', 'json');
  }

  return validateComplianceNarrative(parsed, facts);
}

/**
 * Generates an executive business intelligence narrative for the entire property portfolio.
 */
export async function generatePortfolioNarrative(snapshot) {
  const apiKey = process.env.NVIDIA_API_KEY;

  if (!apiKey) {
    throw createAiDiagnosticError(
      'NVIDIA AI configuration is unavailable.',
      { code: 'AI_CONFIGURATION_ERROR', category: 'configuration' }
    );
  }

  await reserveAiUsage('portfolio');

  const prompt = buildPortfolioPrompt(snapshot);
  const rawText = await callNvidiaModel(apiKey, prompt);

  let parsed;
  try {
    parsed = parseJsonResponse(rawText);
  } catch (err) {
    throw new Error('Failed to parse AI Portfolio Narrative as JSON.');
  }

  const requiredFields = [
    'portfolioHealth',
    'marketTrends',
    'buyerBehavior',
    'topPerformingCategories',
    'risks',
    'recommendations',
  ];

  const missingField = requiredFields.find((field) => !parsed[field]);
  if (missingField) {
    throw new Error(`AI response was missing the "${missingField}" field.`);
  }

  return parsed;
}

/**
 * Generates a concise, buyer-facing market summary for the Buyer Home page's
 * "AI Market Insight" widget. Reuses the same NVIDIA NIM call path as
 * compliance insights and the admin portfolio narrative — only the prompt
 * and expected response shape differ.
 */
export async function generateBuyerMarketNarrative(snapshot) {
  const apiKey = process.env.NVIDIA_API_KEY;

  if (!apiKey) {
    throw createAiDiagnosticError(
      'NVIDIA AI configuration is unavailable.',
      { code: 'AI_CONFIGURATION_ERROR', category: 'configuration' }
    );
  }

  await reserveAiUsage('market');

  const prompt = buildBuyerMarketPrompt(snapshot);
  const rawText = await callNvidiaModel(apiKey, prompt);

  let parsed;
  try {
    parsed = parseJsonResponse(rawText);
  } catch (err) {
    throw new Error('Failed to parse AI Market Insight as JSON.');
  }

  // All three fields are required — if any are missing the response is unusable.
  if (!parsed.buyerDemand || !parsed.topListings || !parsed.marketContext) {
    throw new Error('AI response missing one or more required fields (buyerDemand, topListings, marketContext).');
  }

  return {
    buyerDemand: parsed.buyerDemand,
    topListings: parsed.topListings,
    marketContext: parsed.marketContext,
  };
}

/**
 * Helper function to call NVIDIA NIM API and extract clean JSON
 */
export async function callNvidiaModel(apiKey, prompt) {
  const url = 'https://integrate.api.nvidia.com/v1/chat/completions';

  const payload = {
    model: 'nvidia/nemotron-3.5-lightning-30b-a3b',
    messages: [
      {
        role: 'system',
        content:
          'You are an expert real estate compliance and analytics assistant. You MUST return ONLY a valid JSON object without markdown formatting or conversational filler.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.1, // Low temperature for factual consistency
    max_tokens: 700,
    response_format: { type: 'json_object' },
    chat_template_kwargs: { enable_thinking: false },
  };

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const isTimeout = error?.name === 'AbortError' || error?.name === 'TimeoutError' || /timeout/i.test(error?.message || '');
    throw createAiDiagnosticError(
      isTimeout ? 'NVIDIA request timed out.' : 'NVIDIA request could not be completed.',
      { code: isTimeout ? 'AI_TIMEOUT' : 'AI_NETWORK_ERROR', category: isTimeout ? 'timeout' : 'network' }
    );
  }

  if (!response.ok) {
    throw createAiDiagnosticError(
      `NVIDIA provider returned HTTP ${response.status}.`,
      { code: 'AI_PROVIDER_ERROR', category: 'provider', providerStatus: response.status }
    );
  }

  const data = await response.json();
  const message = data?.choices?.[0]?.message;
  const rawContent = message?.content ?? message?.reasoning_content;

  const normalizedContent = Array.isArray(rawContent)
    ? rawContent
        .map((part) => (typeof part === 'string' ? part : part?.text ?? ''))
        .join('')
    : rawContent;

  if (typeof normalizedContent !== 'string' || !normalizedContent.trim()) {
    throw createAiDiagnosticError(
      'NVIDIA response contained no usable narrative content.',
      { code: 'AI_INVALID_RESPONSE', category: 'json', validationRule: 'RESPONSE_CONTENT' }
    );
  }

  let responseText = normalizedContent.trim();

  // Strip markdown code block wrappers if included by the LLM
  if (responseText.startsWith('```json')) {
    responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
  } else if (responseText.startsWith('```')) {
    responseText = responseText.replace(/```/g, '').trim();
  }

  return responseText;
}

export function parseJsonResponse(rawText) {
  const text = rawText.trim();
  const parsed = JSON.parse(text);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('AI response did not contain a JSON object.');
  }
  return parsed;
}

const AI_DIAGNOSTIC_CATEGORIES = new Set([
  'configuration',
  'usage_limit',
  'usage_reservation',
  'provider',
  'network',
  'timeout',
  'json',
  'validation',
  'unknown',
]);

function createAiDiagnosticError(message, {
  code = 'AI_UNAVAILABLE',
  category = 'unknown',
  providerStatus = null,
  validationRule = null,
} = {}) {
  const error = new Error(message);
  error.code = code;
  error.aiCategory = AI_DIAGNOSTIC_CATEGORIES.has(category) ? category : 'unknown';
  error.providerStatus = Number.isInteger(providerStatus) ? providerStatus : null;
  error.validationRule = validationRule || null;
  error.safeMessage = message;
  return error;
}

function decorateUsageError(error) {
  const isUsageLimit = error?.statusCode === 429 || /usage limit|rate limited/i.test(error?.message || '');
  const category = isUsageLimit ? 'usage_limit' : 'usage_reservation';
  const code = isUsageLimit ? 'AI_USAGE_LIMIT' : 'AI_USAGE_RESERVATION_ERROR';
  return createAiDiagnosticError(
    isUsageLimit ? 'TerraGuide AI usage limit reached.' : 'TerraGuide AI usage reservation failed.',
    { code, category }
  );
}

function createNarrativeValidationError(message, rule, code = 'AI_INVALID_RESPONSE', category = 'validation') {
  const error = createAiDiagnosticError(message, {
    code,
    category,
    validationRule: rule,
  });
  return error;
}

export function getAiFailureDiagnostics(error) {
  const category = AI_DIAGNOSTIC_CATEGORIES.has(error?.aiCategory)
    ? error.aiCategory
    : inferAiErrorCategory(error);
  const providerStatus = Number.isInteger(error?.providerStatus) ? error.providerStatus : null;
  const validationRule = typeof error?.validationRule === 'string' ? error.validationRule : null;
  const safeMessage = typeof error?.safeMessage === 'string'
    ? error.safeMessage
    : category === 'usage_limit'
    ? 'TerraGuide AI usage limit reached.'
    : category === 'usage_reservation'
    ? 'TerraGuide AI usage reservation failed.'
    : 'AI narrative generation failed.';

  return {
    errorCategory: category,
    providerStatus,
    validationRule,
    message: sanitizeDiagnosticMessage(safeMessage),
  };
}

function inferAiErrorCategory(error) {
  if (error?.statusCode === 429 && /usage limit|rate limited/i.test(error?.message || '')) {
    return 'usage_limit';
  }
  if (/usage reservation|reservation failed/i.test(error?.message || '')) {
    return 'usage_reservation';
  }
  return 'unknown';
}

function sanitizeDiagnosticMessage(message) {
  return message
    .replace(/Bearer\s+[^\s]+/gi, 'Bearer [redacted]')
    .replace(/(?:api[_-]?key|authorization|nvidia_api_key)\s*[:=]\s*[^\s,;]+/gi, '[redacted]')
    .replace(/https?:\/\/[^\s]+/gi, '[redacted-url]')
    .slice(0, 240);
}

export function logComplianceNarrativeFallback({ propertyId, fallbackReason, error, logger = console }) {
  const diagnostics = getAiFailureDiagnostics(error);
  const event = {
    event: 'compliance_narrative_fallback',
    fallbackReason,
    errorCategory: diagnostics.errorCategory,
    providerStatus: diagnostics.providerStatus,
    validationRule: diagnostics.validationRule,
    message: diagnostics.message,
    timestamp: new Date().toISOString(),
    propertyId: propertyId ? String(propertyId) : null,
  };

  try {
    logger.warn('[AI Compliance]', event);
  } catch (loggingError) {
    // Diagnostics must never prevent deterministic fallback persistence.
  }
  }

const UNSUPPORTED_NUMERIC_CLAIM_PATTERN =
  /(?:\b\d+(?:\.\d+)?\s*%|[$₱€£]\s*\d|\b(?:success rate|probability|likelihood|chance)\s*(?:is|of|at|:)\s*\d)/i;

const UNSUPPORTED_LEGAL_CLAIM_PATTERNS = [
  /\blegally compliant\b/i,
  /\blegal clearance\b/i,
  /\bownership\s+(?:is\s+)?(?:verified|confirmed|established)\b/i,
  /\btitle\s+(?:is\s+)?(?:valid|clear|verified|confirmed)\b/i,
  /\bvalid title\b/i,
  /\bguaranteed\s+(?:sale|transaction|success)\b/i,
  /\bwill\s+(?:sell|succeed)\b/i,
  /\bguarantees?\s+(?:a\s+)?(?:sale|transaction|successful)\b/i,
];

function hasUnsupportedClaim(text) {
  return UNSUPPORTED_NUMERIC_CLAIM_PATTERN.test(text) ||
    UNSUPPORTED_LEGAL_CLAIM_PATTERNS.some((pattern) => pattern.test(text));
}

function hasAllCompleteClaim(text) {
  return /\b(?:all|every|each)\s+(?:required\s+)?(?:documents?|requirements?|items?)\b[^.?!]{0,80}\b(?:verified|complete|satisfied|cleared)\b/i.test(text);
}

function hasPositiveProcessingRecommendation(text) {
  return /\b(?:recommend(?:s|ed)?|should|safe\s+to|ready\s+to)\b[^.?!]{0,80}\b(?:proceed|approve|publish|process|list)\b/i.test(text);
}

function hasReadinessFailureClaim(text) {
  return /\b(?:not\s+ready|failed\s+(?:the\s+)?readiness|unresolved\s+critical|critical\s+(?:issues?|findings?)\s+(?:remain|exist|are\s+present))\b/i.test(text);
}

function hasNoFollowUpClaim(text) {
  return /\b(?:no\s+(?:further|additional)\s+(?:action|follow[- ]?up|review)|nothing\s+further\s+(?:is\s+)?needed|no\s+follow[- ]?up\s+necessary)\b/i.test(text);
}

/**
 * Validates an AI compliance narrative against backend-owned readiness facts.
 * Throws an error marked AI_INVALID_RESPONSE when the narrative is unsafe.
 */
export function validateComplianceNarrative(parsed, facts) {
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw createNarrativeValidationError('AI response must be a JSON object.', 'RESPONSE_OBJECT');
  }

  const unexpectedFields = Object.keys(parsed).filter(
    (field) => !['summary', 'recommendation'].includes(field)
  );
  if (unexpectedFields.length > 0) {
    throw createNarrativeValidationError('AI response contained unexpected fields.', 'EXPECTED_FIELDS');
  }

  if (
    typeof parsed.summary !== 'string' ||
    typeof parsed.recommendation !== 'string' ||
    !parsed.summary.trim() ||
    !parsed.recommendation.trim() ||
    parsed.summary.length > 2000 ||
    parsed.recommendation.length > 2000
  ) {
    throw createNarrativeValidationError('AI response must contain non-empty summary and recommendation strings under 2,000 characters.', 'REQUIRED_NARRATIVE_FIELDS');
  }

  const summary = parsed.summary.trim();
  const recommendation = parsed.recommendation.trim();
  const combined = `${summary} ${recommendation}`;
  const classification = facts.readinessClassification || 'NOT_YET_ASSESSED';
  const hasPendingFindings = (facts.pendingItems?.length || 0) > 0 || (facts.readinessPendingItems?.length || 0) > 0;
  const hasNonCriticalFindings = (facts.readinessNonCriticalIssues?.length || 0) > 0;
  const hasCriticalFindings = (facts.readinessCriticalIssues?.length || 0) > 0;

  if (hasUnsupportedClaim(combined)) {
    throw createNarrativeValidationError('AI response contained an unsupported numerical, legal, ownership, title, or transaction claim.', 'UNSUPPORTED_CLAIM');
  }

  if (classification === 'READY_FOR_PRESENTATION' && hasReadinessFailureClaim(combined)) {
    throw createNarrativeValidationError('AI response contradicted READY_FOR_PRESENTATION.', 'READY_CLASSIFICATION_CONTRADICTION', 'AI_CONTRADICTORY_RESPONSE');
  }

  if (
    classification === 'ATTENTION_REQUIRED' &&
    (hasAllCompleteClaim(combined) || hasNoFollowUpClaim(recommendation)) &&
    (hasPendingFindings || hasNonCriticalFindings)
  ) {
    throw createNarrativeValidationError('AI response contradicted ATTENTION_REQUIRED findings.', 'ATTENTION_CLASSIFICATION_CONTRADICTION', 'AI_CONTRADICTORY_RESPONSE');
  }

  if (classification === 'HOLD_FOR_REVIEW') {
    if (hasPositiveProcessingRecommendation(recommendation)) {
      throw createNarrativeValidationError('AI response recommended processing despite HOLD_FOR_REVIEW.', 'HOLD_PROCESSING_RECOMMENDATION', 'AI_CONTRADICTORY_RESPONSE');
    }
    if (hasCriticalFindings && !/\b(?:hold|address|resolve|review|before\s+proceeding|do\s+not\s+proceed|not\s+proceed|until)\b/i.test(recommendation)) {
      throw createNarrativeValidationError('AI response did not require critical findings to be addressed before proceeding.', 'HOLD_MISSING_REVIEW_DIRECTION', 'AI_CONTRADICTORY_RESPONSE');
    }
  }

  if (classification === 'NOT_APPLICABLE' && hasPositiveProcessingRecommendation(recommendation)) {
    throw createNarrativeValidationError('AI response recommended processing a NOT_APPLICABLE property.', 'NOT_APPLICABLE_PROCESSING_RECOMMENDATION', 'AI_CONTRADICTORY_RESPONSE');
  }

  if (
    classification === 'NOT_YET_ASSESSED' &&
    /\b(?:passed|failed|ready\s+for\s+presentation|assessment\s+(?:shows|confirms))\b/i.test(combined)
  ) {
    throw createNarrativeValidationError('AI response made an unsupported completed-assessment claim.', 'NOT_YET_ASSESSED_COMPLETION_CLAIM', 'AI_CONTRADICTORY_RESPONSE');
  }

  return { summary, recommendation };
}

function formatFallbackFindings(findings) {
  if (!findings || findings.length === 0) return 'None recorded.';
  return findings.map((finding) => `${finding.code}: ${finding.message}`).join(' ');
}

function formatFallbackDocumentStatuses(documentStatuses) {
  const entries = Object.entries(documentStatuses || {});
  if (entries.length === 0) return 'No document status snapshot was supplied.';
  return entries.map(([document, status]) => `${document}: ${status}`).join(', ');
}

/**
 * Generates a deterministic narrative when AI is unavailable or rejected.
 * It uses only the already-calculated backend facts and creates no metrics.
 */
export function createDeterministicFallbackNarrative(facts) {
  const classification = facts.readinessClassification || 'NOT_YET_ASSESSED';
  const label = facts.readinessClassificationLabel || 'Not Yet Assessed';
  const statuses = formatFallbackDocumentStatuses(facts.documentStatuses);
  const critical = formatFallbackFindings(facts.readinessCriticalIssues);
  const pending = formatFallbackFindings(facts.readinessPendingItems);
  const nonCritical = formatFallbackFindings(facts.readinessNonCriticalIssues);
  const statusLine = facts.listingStatus ? ` Listing status: ${facts.listingStatus}.` : '';
  const findingLine = ` Critical findings: ${critical} Pending findings: ${pending} Noncritical findings: ${nonCritical}`;

  const summaries = {
    READY_FOR_PRESENTATION: `System-generated deterministic assessment: ${label}.${statusLine} Document statuses: ${statuses}${findingLine} The tracked administrative requirements are satisfied. This assessment does not establish legal compliance, ownership, title validity, or transaction success.`,
    ATTENTION_REQUIRED: `System-generated deterministic assessment: ${label}.${statusLine} Document statuses: ${statuses}${findingLine} Pending and noncritical findings require administrative follow-up before proceeding. This assessment does not establish legal compliance, ownership, title validity, or transaction success.`,
    HOLD_FOR_REVIEW: `System-generated deterministic assessment: ${label}.${statusLine} Document statuses: ${statuses}${findingLine} Critical findings require review before further listing or transaction processing. This assessment does not establish legal compliance, ownership, title validity, or transaction success.`,
    NOT_APPLICABLE: `System-generated deterministic assessment: ${label}.${statusLine} Document statuses: ${statuses}${findingLine} This property is not an active listing candidate because its status is Reserved or Sold. This assessment does not establish legal compliance, ownership, title validity, or transaction success.`,
    NOT_YET_ASSESSED: `System-generated deterministic assessment: ${label}.${statusLine} Document statuses: ${statuses}${findingLine} No completed readiness assessment is available. This assessment does not establish legal compliance, ownership, title validity, or transaction success.`,
  };

  const recommendations = {
    READY_FOR_PRESENTATION: 'No unresolved deterministic readiness findings were recorded for administrative follow-up.',
    ATTENTION_REQUIRED: `Complete the pending readiness findings: ${pending} Address the noncritical findings: ${nonCritical}`,
    HOLD_FOR_REVIEW: `Hold further listing or transaction processing until the critical findings are addressed and reviewed: ${critical}`,
    NOT_APPLICABLE: 'Do not initiate a new active listing transaction for this Reserved or Sold property.',
    NOT_YET_ASSESSED: 'Complete a readiness assessment before treating this property as passed or failed.',
  };

  return {
    summary: summaries[classification] || summaries.NOT_YET_ASSESSED,
    recommendation: recommendations[classification] || recommendations.NOT_YET_ASSESSED,
  };
}

/**
 * Administrative document-readiness narrative prompt. Deterministic metrics
 * are calculated by the backend and are deliberately not generated by AI.
 */
export function buildCompliancePrompt(facts) {
  const verifiedListStr =
    facts.verifiedList && facts.verifiedList.length > 0
      ? facts.verifiedList.join(', ')
      : 'None';

  const missingListStr =
    facts.missingItems && facts.missingItems.length > 0
      ? facts.missingItems.join(', ')
      : 'None';

  const pendingListStr =
    facts.pendingItems && facts.pendingItems.length > 0
      ? facts.pendingItems.join(', ')
      : 'None';

  const unknownStatusStr =
    facts.unknownStatuses && facts.unknownStatuses.length > 0
      ? facts.unknownStatuses
          .map((entry) => `${entry.document} (${entry.receivedStatus ?? 'absent'})`)
          .join(', ')
      : 'None';

  const statusMapStr = Object.entries(facts.documentStatuses || {})
    .map(([document, status]) => `${document}: ${status}`)
    .join(', ') || 'None';
  const statusCounts = facts.documentStatusCounts || {};
  const statusCountsStr = `verified=${statusCounts.verified || 0}, pending=${statusCounts.pending || 0}, missing=${statusCounts.missing || 0}, unknown=${statusCounts.unknown || 0}`;
  const suitableForStr = facts.suitableFor && facts.suitableFor.length > 0
    ? facts.suitableFor.join(', ')
    : 'None recorded';
  const formatFindings = (findings) => findings && findings.length > 0
    ? findings.map((finding) => `${finding.code}: ${finding.message}`).join(' | ')
    : 'None';
  const classification = facts.readinessClassification || 'NOT_YET_ASSESSED';
  const classificationLabel = facts.readinessClassificationLabel || 'Not Yet Assessed';

  const classificationInstructions = {
    READY_FOR_PRESENTATION:
      'Explain that the tracked administrative requirements are satisfied. Do not claim legal clearance or guaranteed transaction success.',
    ATTENTION_REQUIRED:
      'Identify outstanding pending documents and noncritical property-information issues. Recommend administrative follow-up before proceeding.',
    HOLD_FOR_REVIEW:
      'Clearly identify the critical findings. Recommend holding further listing or transaction processing until the critical issues are addressed and reviewed.',
    NOT_APPLICABLE:
      'Explain that Reserved or Sold properties are not active listing candidates. Do not recommend proceeding with a new listing transaction.',
    NOT_YET_ASSESSED:
      'Explain that no completed readiness assessment is available. Do not imply that the property passed or failed an assessment.',
  };

  return `You are an expert real estate compliance analyst writing a brief, executive findings report based strictly on these ground truth facts:

PROPERTY FACTS:
- Listing: "${facts.propertyName}" (${facts.propertyType} in ${facts.location})
- Listing status: ${facts.listingStatus || 'Not supplied'}
- Suitable uses / intended use: ${suitableForStr}
- Backend readiness classification: ${classification} (${classificationLabel})
- Ready for presentation: ${facts.readinessIsReadyForPresentation === true ? 'Yes' : 'No'}
- Verified Documents: ${verifiedListStr}
- Pending Documents: ${pendingListStr}
- Missing Documents: ${missingListStr}
- Unknown or absent statuses treated conservatively: ${unknownStatusStr}
- Document status mapping: ${statusMapStr}
- Document status counts: ${statusCountsStr}
- Document completeness (authoritative backend reference): ${facts.documentCompleteness ?? 'Not supplied'}%
- Estimated listing success rate (authoritative backend reference): ${facts.estimatedSuccessRate ?? 'Not supplied'}%
- Risk Level: ${facts.riskLevel || 'High'}
- Critical findings: ${formatFindings(facts.readinessCriticalIssues)}
- Pending readiness findings: ${formatFindings(facts.readinessPendingItems)}
- Noncritical findings: ${formatFindings(facts.readinessNonCriticalIssues)}

INSTRUCTIONS:
1. "summary" (AI Findings):
   - Write 2 concise sentences explaining administrative document readiness and the significance of the supplied findings.
   - State that this review is limited to the supplied document verification statuses and does not establish legal compliance, ownership, title validity, or sale probability.
   - Follow the backend readiness classification exactly. Never override it.

2. "recommendation" (Administrative Recommendation):
   - Write 1-2 concise sentences listing prioritized administrative follow-up actions based only on the supplied findings.
   - Classification-specific instruction: ${classificationInstructions[classification] || classificationInstructions.NOT_YET_ASSESSED}

3. ACCURACY AND SCOPE RULES:
   - Use only facts and findings supplied above. Never invent document statuses or property facts.
   - Never claim all documents are verified when any document is pending, missing, or unknown.
   - Mention relevant critical findings and distinguish critical from noncritical findings.
   - Do not invent numerical metrics, success percentages, market benchmarks, or predicted improvements.
   - Treat document completeness, estimated listing success rate, and risk assessment from the backend as authoritative; do not recalculate or alter them.
   - Do not make legal, ownership, title-validity, or transaction-success guarantees.

Respond EXACTLY with this JSON structure and nothing else:
{
  "summary": "...",
  "recommendation": "..."
}`;
}

/**
 * Executive BI Portfolio Prompt for Admin Analytics Dashboard
 */
function buildPortfolioPrompt(snapshot) {
  const { summary, riskCounts, buyerIntelligence, salesPerformance } = snapshot;

  const salesLine =
    salesPerformance && salesPerformance.totalRevenue > 0
      ? `Total realized revenue from Completed transactions: ₱${salesPerformance.totalRevenue.toLocaleString()}. Monthly average: ₱${salesPerformance.monthlyAverage.toLocaleString()}. Simple next-month projection: ₱${salesPerformance.forecastNextMonth.toLocaleString()}${salesPerformance.note ? ` (${salesPerformance.note})` : ''}`
      : 'No completed transactions recorded yet, so there is no sales history.';

  return `You are writing an executive business intelligence report for the administrators of TerraGuide. Write in a professional, confident, advisory tone. Every section should read as a short paragraph (2-4 sentences).

PORTFOLIO FACTS:
- Total properties: ${summary.totalProperties || summary.totalPropertiesCount} (${summary.availableProperties || summary.availablePropertiesCount} Available, ${summary.reservedProperties || summary.reservedPropertiesCount} Reserved, ${summary.soldProperties || summary.soldPropertiesCount} Sold)
- Estimated portfolio value: ₱${summary.estimatedPortfolioValue.toLocaleString()}
- Total registered buyers: ${summary.totalBuyers}
- Average compliance score across ${summary.auditedPropertiesCount} audited properties: ${summary.averageComplianceScore}%
- Compliance pass rate (audited properties with score ≥ 70%): ${summary.averageSuccessRate}%

RISK BREAKDOWN:
- High risk: ${riskCounts.High}
- Medium risk: ${riskCounts.Medium}
- Low risk: ${riskCounts.Low}
- Not yet audited: ${riskCounts.NotAudited}

BUYER PREFERENCES:
- Most requested property type: ${buyerIntelligence.topPreferredType ?? 'No data yet'}
- Most requested location: ${buyerIntelligence.topPreferredLocation ?? 'No data yet'}
- Average stated budget: ₱${buyerIntelligence.averageBudget ? buyerIntelligence.averageBudget.toLocaleString() : '0'}

SALES PERFORMANCE:
${salesLine}

Write exactly these six sections, each 2-4 sentences:
1. "portfolioHealth" — overall assessment of the portfolio's size, status distribution, and value.
2. "marketTrends" — what the sales trend data suggests.
3. "buyerBehavior" — what buyers are actually looking for based on their preferences.
4. "topPerformingCategories" — which property types or segments perform best based on compliance data.
5. "risks" — what the risk breakdown suggests needs attention.
6. "recommendations" — concrete, actionable next steps.

Respond EXACTLY with this JSON structure and nothing else:
{
  "portfolioHealth": "...",
  "marketTrends": "...",
  "buyerBehavior": "...",
  "topPerformingCategories": "...",
  "risks": "...",
  "recommendations": "..."
}`;
}

/**
 * Buyer-facing market summary prompt for the Buyer Home page. Advisory in
 * tone, not promotional — this is meant to help a buyer understand the
 * current market, not sell them a listing.
 */
function buildBuyerMarketPrompt(snapshot) {
  const {
    totalProperties,
    availableProperties,
    totalBuyersWithPreferences,
    averageBudget,
    topPreferredLocation,
    trendingTypes,
    topListings,
  } = snapshot;

  // Only show preference breakdown when we actually have something to show —
  // if there's no data, tell the model that explicitly so it doesn't guess.
  const preferenceBreakdown =
    trendingTypes && trendingTypes.length > 0
      ? trendingTypes.map((t) => `${t.type} (${t.percentage}% of recorded preferences)`).join(', ')
      : 'No buyer preference data recorded yet';

  // Same deal for listings — if nothing has been scored yet, say so.
  const topListingsStr =
    topListings && topListings.length > 0
      ? topListings
          .map((l) => `${l.name} in ${l.location} (market readiness score: ${l.marketScore}/100)`)
          .join('; ')
      : 'No market readiness scores available yet';

  // A zero or missing budget means it simply wasn't recorded — label it that
  // way so the model doesn't try to read meaning into the absence of a number.
  const budgetLine =
    averageBudget && averageBudget > 0
      ? `Average stated budget among buyers who set preferences: ₱${averageBudget.toLocaleString()}`
      : 'Buyer budget information is currently unavailable';

  const locationLine =
    topPreferredLocation
      ? `Most requested location: ${topPreferredLocation}`
      : 'No location preference data recorded yet';

  return `You are writing a short market data summary for buyers browsing TerraGuide, a real estate platform. Report only what the data shows — nothing more.

GROUND RULES:
- Every sentence must trace directly to a fact in the DATA section below.
- Do NOT compare buyer count to listing count to imply competition or pressure.
- Do NOT invent buyer intent, financial behavior, urgency, or market predictions.
- If a data point says "unavailable" or "no data recorded yet", say so plainly — do not read meaning into the absence.
- Do not use "suggests", "may indicate", or "could mean" to smuggle in unsupported conclusions.
- Top market listings are ranked by document compliance and price competitiveness — not popularity or demand.

DATA:
- Total listings on the platform: ${totalProperties} (${availableProperties} currently marked Available)
- Buyers who have saved their preferences: ${totalBuyersWithPreferences}
- ${budgetLine}
- ${locationLine}
- Recorded property type preferences: ${preferenceBreakdown}
- Top listings by market readiness score: ${topListingsStr}

INSTRUCTIONS:
Write exactly three fields. Each field is one or two plain sentences — no lists, no bullet points, no markdown.

"buyerDemand" — which property type has the strongest recorded preference and its percentage. If no preference data exists, say so.
"topListings" — which listings have the highest market readiness scores. Name them and their scores. Clarify the score measures document compliance and price competitiveness, not popularity.
"marketContext" — plain summary of listing availability. Note any missing data (budget, location, preferences) as limitations for the buyer.

Respond EXACTLY with this JSON and nothing else:
{
  "buyerDemand": "...",
  "topListings": "...",
  "marketContext": "..."
}`;
}
