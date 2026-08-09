export async function generateComplianceInsights(facts) {
  const apiKey = process.env.NVIDIA_API_KEY;

  if (!apiKey) {
    throw new Error('API key is not set in backend/.env');
  }

  const prompt = buildCompliancePrompt(facts);
  const rawText = await callNvidiaModel(apiKey, prompt);

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    throw new Error('Failed to parse AI Compliance Insights as JSON.');
  }

  if (!parsed.summary || !parsed.recommendation) {
    throw new Error('AI response missing required "summary" or "recommendation" fields.');
  }

  return {
    summary: parsed.summary,
    recommendation: parsed.recommendation,
  };
}

/**
 * Generates an executive business intelligence narrative for the entire property portfolio.
 */
export async function generatePortfolioNarrative(snapshot) {
  const apiKey = process.env.NVIDIA_API_KEY;

  if (!apiKey) {
    throw new Error('API key is not set in backend/.env');
  }

  const prompt = buildPortfolioPrompt(snapshot);
  const rawText = await callNvidiaModel(apiKey, prompt);

  let parsed;
  try {
    parsed = JSON.parse(rawText);
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

export async function generateBuyerMarketNarrative(snapshot) {
  const apiKey = process.env.NVIDIA_API_KEY;

  if (!apiKey) {
    throw new Error('API key is not set in backend/.env');
  }

  const prompt = buildBuyerMarketPrompt(snapshot);
  const rawText = await callNvidiaModel(apiKey, prompt);

  let parsed;
  try {
    parsed = JSON.parse(rawText);
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
async function callNvidiaModel(apiKey, prompt) {
  const url = 'https://integrate.api.nvidia.com/v1/chat/completions';

  const payload = {
    model: 'meta/llama-3.1-8b-instruct', // Ultra-fast inference model
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
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errData = await response.text();
    throw new Error(`NVIDIA API Error (${response.status}): ${errData}`);
  }

  const data = await response.json();
  let responseText = data.choices[0].message.content.trim();

  // Strip markdown code block wrappers if included by the LLM
  if (responseText.startsWith('```json')) {
    responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
  } else if (responseText.startsWith('```')) {
    responseText = responseText.replace(/```/g, '').trim();
  }

  return responseText;
}

/**
 * High-Level Compliance Prompt focusing on document status and benchmark success rates
 */
function buildCompliancePrompt(facts) {
  const verifiedListStr =
    facts.verifiedList && facts.verifiedList.length > 0
      ? facts.verifiedList.join(', ')
      : 'None';

  const missingListStr =
    facts.missingItems && facts.missingItems.length > 0
      ? facts.missingItems.join(', ')
      : 'None';

  return `You are an expert real estate compliance analyst writing a brief, executive findings report based strictly on these ground truth facts:

PROPERTY FACTS:
- Listing: "${facts.propertyName}" (${facts.propertyType} in ${facts.location})
- Verified Documents (${facts.verifiedDocuments}/${facts.totalDocuments}): ${verifiedListStr}
- Pending / Missing Documents: ${missingListStr}
- Compliance Score: ${facts.complianceScore}%
- Risk Level: ${facts.riskLevel || 'High'}
- Current Estimated Success Rate: ${facts.estimatedSuccessRate || 50}%
- Projected Success Rate upon completion: ${facts.potentialSuccessRate || 90}%

INSTRUCTIONS:
1. "summary" (AI Findings):
   - Write 2 concise sentences explaining administrative readiness and buyer uncertainty caused by missing items (${missingListStr}).
   - Mention that comparable ${facts.propertyType} listings with complete documentation average an 81% success rate benchmark.
   - DO NOT talk about listing price or valuation.

2. "recommendation" (Predictive Analysis):
   - Write 1 forward-looking sentence stating that completing the ${missingListStr} verification is expected to raise the property's compliance score from ${facts.complianceScore}% to 100%, boosting its estimated success rate from ${facts.estimatedSuccessRate || 50}% to ${facts.potentialSuccessRate || 90}%.

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
      ? `Total revenue from Sold properties: ₱${salesPerformance.totalRevenue.toLocaleString()}. Monthly average: ₱${salesPerformance.monthlyAverage.toLocaleString()}. Simple next-month projection: ₱${salesPerformance.forecastNextMonth.toLocaleString()} (${salesPerformance.note})`
      : 'No properties have been marked Sold yet, so there is no sales history.';

  return `You are writing an executive business intelligence report for the administrators of TerraGuide. Write in a professional, confident, advisory tone. Every section should read as a short paragraph (2-4 sentences).

PORTFOLIO FACTS:
- Total properties: ${summary.totalProperties || summary.totalPropertiesCount} (${summary.availableProperties || summary.availablePropertiesCount} Available, ${summary.reservedProperties || summary.reservedPropertiesCount} Reserved, ${summary.soldProperties || summary.soldPropertiesCount} Sold)
- Estimated portfolio value: ₱${summary.estimatedPortfolioValue.toLocaleString()}
- Total registered buyers: ${summary.totalBuyers}
- Average compliance score across ${summary.auditedPropertiesCount} audited properties: ${summary.averageComplianceScore}%
- Average success rate: ${summary.averageSuccessRate}%

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